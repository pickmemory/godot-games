class_name RewriteNodeDirector
extends Node2D

## RewriteNodeDirector · 赤壁·借东风改写节点端到端编排器（issue #19 · Loop A 整合）。
##
## 职责：把 P5-1..P5-6 已落地系统**编排串联**成一个可玩改写节点场景，跑通 Loop A：
##   探索（村落 TileMap）→ 收集（气象线索 POI）→ 门条件（线索数 ≥ 阈值）→ 术士（授术法 + 触发改写）
##   → 抉择（RewritePanel #18）→ 引擎结算（RewriteCausalityEngine #17：Δ/CP/分支）→ 旁白+演出（#18）
##   → 节点完成（回写 QuestSystem #16 完成态）。
##
## 复用而非重写（issue 验收要点 3）：敌人/战斗/任务日志/改写引擎/RewritePanel 全部走既有信号与只读 API；
## 本导演只做**节点编排 + 场景内数据驱动**（flow_data .tres）。不写 v_i/Δ/CP（DAG 硬契约）。
##
## ⚠️ S5 代理（open-world §2.2/§7.4）：S5 探索核心层（C5）未落地（前置依赖）。本导演作为**玩法层 S5 代理**：
##   - 读取 IntelPOIData、聚合 intel_cov、发 EventBus.intel_updated（S5→S1，rewrite-causality §7.4）；
##   - 七星坛交互成功 → 发 EventBus.verb_executed（S5 交互路径，rewrite-causality §3.5/§7.3 DAG）。
##   与既有信号契约一致；正式 S5 落地后由其接管，本导演的 POI/交互胶水退场。
##
## ⚠️ 派发延迟（mainline §2.5 / 信号生命周期）：QuestSystem._ready 在 chapter_data 非空时会自动派发 N2
##   （emit node_activated）。但场景树 _ready 顺序下，此刻 RewriteCausalityEngine/RewritePanelView 尚未
##   connect（信号会丢失），且设计要求「探索→收集→术士→抉择」先后序（issue §2.3-§2.4）。故本场景
##   QuestSystem.chapter_data **置空**（_ready 不自动派发），由本导演在术士触发时显式调用
##   `quest.chapter_data = ...; quest.enter_chapter()`（enter_chapter 为 QuestSystem 公共 API，mainline §2.2）
##   完成派发 → emit node_activated → 引擎激活 + RewritePanel 呼出。
##
## 知识诚实（A5）：Godot 4.7 API 不确定处标 [待确认]/TODO，不臆造。

enum State { ENTER, EXPLORING, REWRITE_ACTIVE, NODE_COMPLETE }

@export var flow_data: RewriteNodeFlowData
## 术士触发时注入 QuestSystem（延迟派发，见类注）。场景 author 赋值 ch_chibi_war.tres。
@export var chapter_data: ChapterData
@export var debug_log: bool = false

# null 安全解析（get_node_or_null）：测试以 RewriteNodeDirector.new() 裸实例化时无场景子节点，
# @onready 用 $Path 会报错；场景内这些路径均存在，解析结果不变。
@onready var _player: CharacterBody2D = get_node_or_null("L3_Characters/Player")
@onready var _camera: Camera2D = get_node_or_null("Camera2D")
@onready var _clue_zones_parent: Node = get_node_or_null("Zones/ClueZones")
@onready var _shaman_zone: Area2D = get_node_or_null("Zones/ShamanZone")
@onready var _altar_zone: Area2D = get_node_or_null("Zones/AltarZone")
@onready var _objective_label: Label = get_node_or_null("%ObjectiveLabel")
@onready var _clue_label: Label = get_node_or_null("%ClueLabel")
@onready var _status_label: Label = get_node_or_null("%StatusLabel")

var _state: int = State.ENTER
var _quest: QuestSystem = null
var _engine: RewriteCausalityEngine = null

# ── 线索采集态（本地化、存档友好：纯数据 id 集合，可序列化）──
var _collected_clue_ids: Dictionary = {}     # poi_id(StringName) -> true
var _intel_cov: float = 0.0
var _total_clue_intel: float = 0.0           # 该节点线索 intel_raw 总和（聚合分母参考）

# ── 玩家当前所在的交互区（Area2D body_entered/exited 维护）──
var _in_range_clues: Dictionary = {}         # poi_id(StringName) -> true（当前重叠且未采集）
var _in_shaman: bool = false
var _in_altar: bool = false
var _shaman_triggered: bool = false

# ── Loop A 返回世界（issue #21 收口）──
const _WORLD_SCENE := "res://scenes/world/world.tscn"
var _returning: bool = false


# ═══════════════════════════ 生命周期 ═══════════════════════════

func _ready() -> void:
	# 测试/未配置：flow_data 为空时跳过场景装配（测试经 _init_flow() 注入 flow_data 后驱动逻辑）。
	if flow_data == null:
		if debug_log:
			print("[RewriteNodeDirector] flow_data 为空，跳过场景装配（测试模式）")
		return
	if is_instance_valid(_player):
		_player.global_position = flow_data.player_start_position
	_spawn_clue_zones()
	_setup_shaman_altar_zones()
	_init_flow()


## 逻辑初始化（与场景装配解耦，供测试复用）：定位核心系统 + 算 intel 总量 + 接信号 + 进探索态。
func _init_flow() -> void:
	_quest = get_tree().get_first_node_in_group("quest_system")
	_engine = get_tree().get_first_node_in_group("rewrite_engine")
	_compute_total_intel()
	# 节点完成回写由 QuestSystem 自身 _on_node_resolved 处理（置「已确认」+ 推进章节 + emit quest_reward_declared）；
	# 本导演订阅 node_resolved 仅做展示态切换（复用 #16，不重复回写）。
	if not EventBus.node_resolved.is_connected(_on_node_resolved):
		EventBus.node_resolved.connect(_on_node_resolved)
	_enter_state(State.EXPLORING)
	AudioManager.play_music("choice")
	if debug_log:
		print("[RewriteNodeDirector] flow=%s clues=%d threshold=%d total_intel=%.2f quest=%s engine=%s" %
			[flow_data.flow_id, flow_data.clue_pois.size(), flow_data.required_clue_count,
			 _total_clue_intel, is_instance_valid(_quest), is_instance_valid(_engine)])


func _physics_process(_delta: float) -> void:
	if is_instance_valid(_player) and is_instance_valid(_camera):
		_camera.global_position = _player.global_position
	if _state == State.EXPLORING or _state == State.REWRITE_ACTIVE:
		if Input.is_action_just_pressed("interact"):
			_handle_interact()
	elif _state == State.NODE_COMPLETE:
		# Loop A 收口（issue #21）：节点确认 + 反馈演出结束后，按 interact(E) 返回 world。
		# 守卫：仅当本导演是当前场景根（裸实例/测试不转场）且反馈演出不在进行（让玩家先看完结算）。
		if Input.is_action_just_pressed("interact") and _can_return_to_world():
			_return_to_world()


func _exit_tree() -> void:
	if EventBus.node_resolved.is_connected(_on_node_resolved):
		EventBus.node_resolved.disconnect(_on_node_resolved)


# ═══════════════════════════ 状态机 ═══════════════════════════

func _enter_state(s: int) -> void:
	_state = s
	match s:
		State.EXPLORING:
			_set_objective(flow_data.objective_explore)
		State.REWRITE_ACTIVE:
			_set_objective(flow_data.objective_rewrite)
			_set_status("术士已授术法·改写节点激活")
		State.NODE_COMPLETE:
			_set_objective(flow_data.objective_complete)
			_set_status("Loop A 闭环完成 · 按 E（interact）返回世界")
	_refresh_clue_label()


## S1→S2/导演：节点确认回告。QuestSystem._on_node_resolved 已自行置 N2「已确认」+ 推进章节进度
## + emit quest_reward_declared（复用 #16 完成回调）。本导演仅切到 NODE_COMPLETE 展示态。
func _on_node_resolved(node_id: StringName, _final_vars: Dictionary, _delta_node: int, _cp_earned: int) -> void:
	if node_id != flow_data.node_id:
		return
	_enter_state(State.NODE_COMPLETE)
	if debug_log:
		var qst := ""
		if _quest != null:
			qst = _quest.get_node_lifecycle_state_name(node_id)
		print("[RewriteNodeDirector] node_resolved %s → quest state=%s" % [node_id, qst])


# ═══════════════════════════ 交互区生成（数据驱动，读 flow_data） ═══════════════════════════

func _spawn_clue_zones() -> void:
	for poi in flow_data.clue_pois:
		if poi == null:
			continue
		var zone: Area2D = Area2D.new()
		zone.name = "Clue_%s" % String(poi.poi_id)
		zone.position = poi.position
		var col := CollisionShape2D.new()
		var shape := CircleShape2D.new()
		shape.radius = poi.interact_radius_px
		col.shape = shape            # 每实例独占 shape（避免共享 radius 互相覆盖，同 player/enemy.gd 处理）
		zone.add_child(col)
		zone.add_child(_make_marker(Color(0.55, 0.78, 0.95, 0.9), poi.display_name))   # greybox 占位（美术留 P5-10）
		_clue_zones_parent.add_child(zone)
		zone.body_entered.connect(_on_clue_body_entered.bind(poi.poi_id))
		zone.body_exited.connect(_on_clue_body_exited.bind(poi.poi_id))


func _setup_shaman_altar_zones() -> void:
	# 位置/半径由 flow_data 注入（.tscn 内占位 shape 半径在此覆盖）
	_shaman_zone.position = flow_data.shaman_position
	_apply_circle_radius(_shaman_zone, flow_data.shaman_interact_radius_px)
	_altar_zone.position = flow_data.altar_position
	_apply_circle_radius(_altar_zone, flow_data.altar_interact_radius_px)
	if not _shaman_zone.body_entered.is_connected(_on_shaman_body_entered):
		_shaman_zone.body_entered.connect(_on_shaman_body_entered)
		_shaman_zone.body_exited.connect(_on_shaman_body_exited)
	if not _altar_zone.body_entered.is_connected(_on_altar_body_entered):
		_altar_zone.body_entered.connect(_on_altar_body_entered)
		_altar_zone.body_exited.connect(_on_altar_body_exited)
	_shaman_zone.add_child(_make_marker(Color(0.85, 0.7, 0.35, 0.95), "术士（求东风）"))
	_altar_zone.add_child(_make_marker(Color(0.7, 0.6, 0.95, 0.95), "七星坛"))


func _apply_circle_radius(zone: Area2D, radius_px: float) -> void:
	var col: CollisionShape2D = zone.get_node_or_null("CollisionShape2D")
	if col != null and col.shape is CircleShape2D:
		(col.shape as CircleShape2D).radius = radius_px


## greybox 视觉占位（art-bible 对齐留 P5-10；本 issue 不生成美术，用纯色 PlaceholderTexture2D）。
func _make_marker(color: Color, label_text: String) -> Node2D:
	var m := Node2D.new()
	var spr := Sprite2D.new()
	var tex := PlaceholderTexture2D.new()
	tex.size = Vector2(40, 40)
	spr.texture = tex
	spr.modulate = color
	m.add_child(spr)
	var lbl := Label.new()
	lbl.text = label_text
	lbl.offset_left = -72.0
	lbl.offset_top = 28.0
	lbl.offset_right = 72.0
	lbl.offset_bottom = 52.0
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.add_theme_color_override("font_color", Color(0.92, 0.96, 1, 1))
	m.add_child(lbl)
	return m


func _compute_total_intel() -> void:
	_total_clue_intel = 0.0
	if flow_data == null:
		return
	for poi in flow_data.clue_pois:
		if poi != null and poi.relates_to_node == flow_data.node_id:
			_total_clue_intel += poi.intel_raw
	if _total_clue_intel <= 0.0:
		_total_clue_intel = 1.0   # 防除零（数据兜底）


# ═══════════════════════════ 交互区检测（Area2D body_entered/exited） ═══════════════════════════

func _on_clue_body_entered(body: Node, poi_id: StringName) -> void:
	if body.is_in_group("player") and not _collected_clue_ids.has(poi_id):
		_in_range_clues[poi_id] = true


func _on_clue_body_exited(body: Node, poi_id: StringName) -> void:
	if body.is_in_group("player"):
		_in_range_clues.erase(poi_id)


func _on_shaman_body_entered(body: Node) -> void:
	if body.is_in_group("player"):
		_in_shaman = true


func _on_shaman_body_exited(body: Node) -> void:
	if body.is_in_group("player"):
		_in_shaman = false


func _on_altar_body_entered(body: Node) -> void:
	if body.is_in_group("player"):
		_in_altar = true


func _on_altar_body_exited(body: Node) -> void:
	if body.is_in_group("player"):
		_in_altar = false


# ═══════════════════════════ 交互（interact 键，E / 手柄△） ═══════════════════════════

func _handle_interact() -> void:
	# 优先级：未采集线索 > 七星坛（改写激活时）> 术士（探索时）
	if not _in_range_clues.is_empty():
		var poi_id: StringName = &""
		for k in _in_range_clues:
			poi_id = k
			break
		_collect_clue(poi_id)
		return
	if _state == State.REWRITE_ACTIVE and _in_altar:
		_smash_altar()
		return
	if _state == State.EXPLORING and _in_shaman:
		_try_trigger_rewrite()
		return


# ═══════════════════════════ 线索采集（S5 代理：聚合 intel_cov + 发 intel_updated） ═══════════════════════════

## 采集线索（open-world §2.2 流程 ①→⑦ 的 S5 代理实现）。
func _collect_clue(poi_id: StringName) -> void:
	if _collected_clue_ids.has(poi_id):
		return
	var poi: IntelPOIData = _find_poi(poi_id)
	if poi == null:
		return
	_collected_clue_ids[poi_id] = true
	_in_range_clues.erase(poi_id)
	# intel_cov 聚合（open-world §4.1：累加 intel_raw，clamp [0,1]；S5 代理，正式归 S5 核心层）
	_intel_cov = clampf(_intel_cov + poi.intel_raw, 0.0, 1.0)
	# S5→S1：intel_updated（rewrite-causality §7.4 / open-world §6.2）—— S1 据 intel_cov 降 diff、解锁蓝图可见性
	EventBus.intel_updated.emit(_intel_cov, [String(poi.intel_entry_id)])
	_set_status(poi.system_voice_on_collect)
	_refresh_clue_label()
	if debug_log:
		print("[RewriteNodeDirector] clue collected %s intel_cov=%.2f" % [poi_id, _intel_cov])


func _find_poi(poi_id: StringName) -> IntelPOIData:
	if flow_data == null:
		return null
	for poi in flow_data.clue_pois:
		if poi != null and poi.poi_id == poi_id:
			return poi
	return null


# ═══════════════════════════ 七星坛交互（S5 代理：发 verb_executed，DAG §5.3） ═══════════════════════════

## 玩家在七星坛交互（改写激活时）→ S5 交互成功 → 发 verb_executed（rewrite-causality §3.5/§7.3）。
## C1 据动词 effect.set 改 v_altar=smashed 后算 Δ（C1 封闭；本导演不写 v_i/Δ）。
func _smash_altar() -> void:
	EventBus.verb_executed.emit(flow_data.altar_verb_id, flow_data.altar_scene_id, true)
	_set_status("七星坛被破坏——verb_executed 已发，v_altar=smashed 由改写引擎应用")
	if debug_log:
		print("[RewriteNodeDirector] altar smashed → verb_executed %s" % flow_data.altar_verb_id)


# ═══════════════════════════ 术士触发改写（延迟派发 + 授术法） ═══════════════════════════

## 玩家在术士处（线索 ≥ 阈值）触发改写：授术法（ability_unlocked）+ 延迟派发节点（quest.enter_chapter）。
func _try_trigger_rewrite() -> void:
	if _shaman_triggered:
		return
	var collected: int = _collected_clue_ids.size()
	if collected < flow_data.required_clue_count:
		_set_status(flow_data.hint_clues_needed.format({"n": flow_data.required_clue_count}))
		if debug_log:
			print("[RewriteNodeDirector] shaman rejected: %d < %d" % [collected, flow_data.required_clue_count])
		return
	_shaman_triggered = true
	# 术士授术：C3→C4 ability_unlocked（combat §6.3）。S3 未落地，本导演代理发出（与 §7.2 契约一致）。
	if flow_data.granted_ability_id != &"":
		EventBus.ability_unlocked.emit(flow_data.granted_ability_id)
		if debug_log:
			print("[RewriteNodeDirector] shaman granted ability %s" % flow_data.granted_ability_id)
	# 延迟派发（mainline §2.2 enter_chapter 公共 API）→ _dispatch_node(N2) → emit node_activated
	# → RewriteCausalityEngine._on_node_activated（初始化 v_i=baseline）+ RewritePanelView._on_node_activated（呼出面板）。
	if _quest != null and chapter_data != null:
		_quest.chapter_data = chapter_data
		_quest.enter_chapter()
		if debug_log:
			print("[RewriteNodeDirector] quest.enter_chapter dispatched node %s" % flow_data.node_id)
	else:
		push_warning("RewriteNodeDirector: QuestSystem/chapter_data 缺失，节点未派发（RewritePanel 不会呼出）")
	_enter_state(State.REWRITE_ACTIVE)


# ═══════════════════════════ HUD（null 安全，供测试无 UI 节点时复用） ═══════════════════════════

func _set_objective(text: String) -> void:
	if _objective_label != null:
		_objective_label.text = text


func _set_status(text: String) -> void:
	if _status_label != null:
		_status_label.text = text


func _refresh_clue_label() -> void:
	if _clue_label == null or flow_data == null:
		return
	var collected: int = _collected_clue_ids.size()
	var total: int = flow_data.clue_pois.size()
	_clue_label.text = "气象线索：%d/%d  ·  intel_cov：%.2f" % [collected, total, _intel_cov]


# ═══════════════════════════ Loop A 返回世界（issue #21 收口） ═══════════════════════════

## 是否允许返回 world：本导演为当前场景根（非裸实例/测试）且反馈演出（TimelineStage）不在进行。
## TimelineStage 消费 ui_accept/ui_cancel；interact(E) 不被其消费，但演出进行中按 E 会跳过体验 →
## 故加 _timeline_playing() 守卫，等玩家看完结算（ui_accept 关闭演出后）再允许返回。
func _can_return_to_world() -> bool:
	if _returning:
		return false
	# 裸实例/测试（RewriteNodeDirector.new() 为测试根的子节点）不转场。
	if get_tree().current_scene != self:
		return false
	if _timeline_playing():
		return false
	return true

## 反馈演出（TimelineStage）是否仍在进行（可见 = 演出或结算停留中）。
func _timeline_playing() -> bool:
	var ts: Node = get_tree().get_first_node_in_group("timeline_stage")
	if ts is TimelineStage:
		return (ts as TimelineStage).is_playing()
	return false

## 返回 world（Loop A 闭环）。节点确认时 SaveManager 已自动存档（node_resolved → atomic_save）。
func _return_to_world() -> void:
	if _returning:
		return
	_returning = true
	print("[RewriteNodeDirector] Loop A → 返回 world（节点已确认并存档）")
	# call_deferred：避开信号回调中直接 change_scene 的「busy set」错误（同 boot.gd 范式）。
	get_tree().call_deferred("change_scene_to_file", _WORLD_SCENE)


# ═══════════════════════════ 公共查询（测试/调试） ═══════════════════════════

func get_state() -> int:
	return _state

func get_state_name() -> String:
	match _state:
		State.ENTER: return "ENTER"
		State.EXPLORING: return "EXPLORING"
		State.REWRITE_ACTIVE: return "REWRITE_ACTIVE"
		State.NODE_COMPLETE: return "NODE_COMPLETE"
	return "UNKNOWN"

func get_intel_cov() -> float:
	return _intel_cov

func get_collected_clue_count() -> int:
	return _collected_clue_ids.size()

func is_shaman_triggered() -> bool:
	return _shaman_triggered

func is_node_complete() -> bool:
	return _state == State.NODE_COMPLETE

func get_collected_clue_ids() -> Array:
	return _collected_clue_ids.keys()

## 测试辅助：注入 flow_data/chapter_data 并跑逻辑初始化（绕过 @onready 场景装配）。
func debug_init_for_test(flow: RewriteNodeFlowData, chapter: ChapterData) -> void:
	flow_data = flow
	chapter_data = chapter
	_init_flow()
