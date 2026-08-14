class_name WorldDirector
extends Node2D

## world 场景根控制器（P3-2 最小 + P5-8 读档重同步 + P5-9 Loop A 闭环接线）。
## 参考：architecture §8.2（world 叠层）/ adr-001（Camera2D）/ §8.4（启动序列）/ §9.2（读档重同步）。
##
## 职责：
##   - 驱动 Camera2D 跟随玩家（Camera2D 按 §8.2 置世界根，非 Player 子节点；每帧同步位置，
##     渲染端缓动由 position_smoothing 负责，K9）。
##   - P5-8：读档重同步（§9.2）。world._ready 在所有 Systems 子节点 _ready 之后执行
##     （Godot 自底向上 _ready），此时 C1(RewriteCausalityEngine)/C2(QuestSystem) 已就绪，
##     若 SaveManager 有待注入快照（来自主菜单「继续」），在此 deserialize 到 C1/C2。
##   - P5-9（本 issue #21 · Loop A 收口）：把 world 接线为 Loop A 的「探索 + 战斗」前奏——
##     遭遇清场（EventBus.encounter_cleared，山贼全灭，architecture §7.2 C4→C5 契约）或
##     调试跳过（R 键，烟雾自测用）→ change_scene_to_file 跳改写节点场景 rewrite_node_chibi.tscn
##     （借东风）。改写节点场景完成后由 RewriteNodeDirector 跳回 world（闭环）。
##
## 复用而非重写（issue 验收要点 3）：world 仅作前奏 + 转场胶水；改写引擎/抉择/反馈演出
##   全在改写节点场景内（P5-7 #19 已就位）。本脚本不重写任何系统，只接线/校时。
##
## 校时（issue §闭环序列「探索→战斗→再改写」）：world 的 QuestSystem chapter_data **置空**
##   （_ready 不自动派发 N2），避免 world 一进入就 emit node_activated → RewritePanel 立即弹出，
##   破坏 Loop A 序列。N2 派发在改写节点场景内由 RewriteNodeDirector 延迟触发（见其类注）。
##   C1/C2 仍保留在 world（供「继续」读档 apply_pending_load 注入，§9.2）；chapter_data 置空
##   不影响 deserialize（其独立恢复账本/进度，§3.3）。
##
## 防循环（回到 world 不重复触发改写）：转场前 _is_loop_a_complete() 只读窥探 active 槽存档，
##   若含已确认节点（resolved_nodes 非空）则不再跳改写节点（并提示闭环达成）。新游戏空槽 → 未完成。
##   ⚠️ 烟雾级自测：world 重入后 C1/C2 为 fresh（未做 return-resync），故用存档窥探判定而非运行时态；
##      完整的「回到 world 即重同步 C1/C5 世界态」归 S5 核心层（open-world §5.5/§9.2 完整版，Phase 6）。
##
## 知识诚实（A5）：转场用 SceneTree.change_scene_to_file（Godot 4.7 标准，§8.4），不臆造 API。

const _REWRITE_NODE_SCENE := "res://scenes/rewrite_node_chibi/rewrite_node_chibi.tscn"

@onready var _camera: Camera2D = $Camera2D
@onready var _player: Node2D = $L3_Characters/Player
@onready var _objective_label: Label = get_node_or_null("%ObjectiveLabel")
@onready var _hint_label: Label = get_node_or_null("%HintLabel")

var _transitioning: bool = false


func _ready() -> void:
	# 读档重同步（architecture §9.2）：主菜单「继续」预载快照 → world 起步时注入 C1/C2。
	# C2._ready 已就绪（chapter_data 置空 → 不自动派发）；此处 deserialize 覆盖为存档态，
	# 由各系统的 deserialize() 负责 resync 信号重发（防 UI 失同步）。
	if SaveManager.has_pending_load():
		SaveManager.apply_pending_load()
	# Loop A 接线（issue #21）：遭遇清场（山贼全灭）→ 跳改写节点场景。
	if not EventBus.encounter_cleared.is_connected(_on_encounter_cleared):
		EventBus.encounter_cleared.connect(_on_encounter_cleared)
	_refresh_hud()
	AudioManager.play_music("explore")


func _exit_tree() -> void:
	# adr-004：切场景/销毁时 disconnect 防悬挂回调（只断本对象自己的连接）。
	if EventBus.encounter_cleared.is_connected(_on_encounter_cleared):
		EventBus.encounter_cleared.disconnect(_on_encounter_cleared)


func _physics_process(_delta: float) -> void:
	# 跟随玩家（Camera2D 自身的 position_smoothing 做渲染端缓动）。
	if is_instance_valid(_player):
		_camera.global_position = _player.global_position


func _unhandled_input(event: InputEvent) -> void:
	# 调试跳过（烟雾自测用，issue #21）：按 R 直达改写节点场景，免去战斗。
	# 用 physical_keycode 判定，无需改 InputMap（R 不在既有动作集）。
	if _transitioning:
		return
	if _is_loop_a_complete():
		return
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_R:
		_goto_rewrite_node("debug_skip(R)")
		get_viewport().set_input_as_handled()


# ───────────────────────── Loop A 转场胶水（issue #21） ─────────────────────────

## 遭遇清场（architecture §7.2 C4→C5 契约）：山贼全灭 = Loop A「战斗→改写」触发。
func _on_encounter_cleared(_encounter_id: StringName) -> void:
	if _transitioning:
		return
	if _is_loop_a_complete():
		if _hint_label != null:
			_hint_label.text = "改写节点已完成并存档。Loop A 闭环达成（可关闭窗口；或退出后「继续游戏」复查存档）。"
		return
	_goto_rewrite_node("encounter_cleared")


func _goto_rewrite_node(reason: String) -> void:
	if _transitioning:
		return
	# 仅当 world 为当前场景时转场（WorldDirector 为 world 根节点；防裸实例/测试误触）。
	if get_tree().current_scene != self:
		return
	_transitioning = true
	print("[WorldDirector] Loop A → 改写节点场景（%s）" % reason)
	# call_deferred：避开 _ready/信号回调中直接 change_scene 的「busy set」错误（同 boot.gd 范式）。
	get_tree().call_deferred("change_scene_to_file", _REWRITE_NODE_SCENE)


## Loop A 是否已完成（active 槽存档含已确认节点）→ 防止 world↔改写节点来回循环。
## 只读窥探存档（load_slot 不注入运行时态）；新游戏空槽 → 未完成。
func _is_loop_a_complete() -> bool:
	var slot: int = SaveManager.get_active_slot()
	if slot < 0:
		return false
	var res: Dictionary = SaveManager.load_slot(slot)
	if not res.ok:
		return false
	var systems: Dictionary = (res.snapshot as Dictionary).get("systems", {})
	var c1: Dictionary = systems.get("rewrite_engine", {})
	return not c1.get("resolved_nodes", {}).is_empty()


# ───────────────────────── HUD（Loop A 前奏指引，烟雾自测可读） ─────────────────────────

func _refresh_hud() -> void:
	if _objective_label == null and _hint_label == null:
		return
	var done := _is_loop_a_complete()
	if _objective_label != null:
		if done:
			_objective_label.text = "目标：改写节点（借东风）已完成 · 自由巡游赤壁村落（Loop A 闭环达成）"
		else:
			_objective_label.text = "目标：探索赤壁村落，击败山贼以触发改写节点（借东风）"
	if _hint_label != null:
		if done:
			_hint_label.text = "闭环已达成。关闭窗口退出；或退出后「继续游戏」复查历史偏差存档。"
		else:
			_hint_label.text = "操作：WASD 移动 · 鼠标左键普攻（连段）· 右键系统术法 · E 交互 · （烟雾自测：R 跳过战斗直达改写节点）"
