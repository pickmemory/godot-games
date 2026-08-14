class_name EncounterSpawner
extends Node

## 遭遇生成器（玩法层 G5 · open-world §2.6 / combat §2.1 遭遇布置）。
##
## P5-1 最小实现（issue #13：勿破坏现有玩家移动场景，仅接入）：
##   - 读取自身 Marker2D 子节点作为刷新点，实例化 enemy_scene 到 spawn_parent（L3_Characters）。
##   - 注入巡逻路点（遭遇布置归 S5，行为归 S4 —— 两段式，combat §2.1/§7.4）。
##   - 跟踪存活敌人；全灭 → 发 EventBus.encounter_cleared（architecture §7.2 已登记的 C4→C5 契约）。
##
## 范围克制：完整遭遇表（open-world §3.3：encounter_trigger/spawn_state/cooldown_enc/node_lock）
##   归 S5 核心层 issue；本 G5 仅作 P5-1 把「敌人能被放进世界」跑通的最小胶水。
##
## 信号纪律（control-manifest）：encounter_cleared 是 §7.2 总表既定跨系统信号（非私加）；
##   敌人 state/hurt/died 是场景内原生信号（由本生成器 connect），不塞 EventBus。

@export var enemy_scene: PackedScene
## 头目场景（可选）：Marker2D 带 metadata/enemy_kind="brute" 时用本场景生成。
@export var brute_scene: PackedScene
@export var encounter_id: StringName = &"enc_bandit_ambush_01"
## 实例化目标父节点（L3_Characters，做 Y 轴深度排序）；在 world.tscn 中以 NodePath 注入。
@export var spawn_parent: NodePath = ^"../../L3_Characters"
## 每个刷新点的巡逻往返偏移（px）；正式巡逻路线归 S5 遭遇表注入，此处仅占位演示。
@export var patrol_pace_px: float = 128.0

var _alive_count: int = 0


func _ready() -> void:
	if enemy_scene == null:
		push_warning("EncounterSpawner: enemy_scene 未赋值，跳过生成")
		return
	_spawn()


func _spawn() -> void:
	var parent: Node = get_node_or_null(spawn_parent)
	if parent == null:
		parent = get_parent()
	for sp in _collect_spawn_points():
		var scene: PackedScene = enemy_scene
		if brute_scene != null and sp.has_meta("enemy_kind") and String(sp.get_meta("enemy_kind")) == "brute":
			scene = brute_scene
		var enemy: Node = scene.instantiate()
		parent.add_child(enemy)
		enemy.global_position = sp.global_position
		# 巡逻路点：刷新点 ± 横向偏移往返（占位；正式路点由 S5 遭遇表给）。
		var pos: Vector2 = sp.global_position
		var sign_x: float = 1.0 if (sp.get_index() % 2 == 0) else -1.0
		# 用强类型 Array[Vector2] 赋值（与 Enemy.patrol_waypoints 类型一致，避免运行时类型不匹配）。
		var waypoints: Array[Vector2] = [
			pos,
			pos + Vector2(patrol_pace_px * sign_x, 0.0),
		]
		if "patrol_waypoints" in enemy:
			enemy.patrol_waypoints = waypoints
		if enemy.has_signal("died"):
			enemy.died.connect(_on_enemy_died)
			_alive_count += 1


func _on_enemy_died(_enemy_id: Variant) -> void:
	_alive_count = max(0, _alive_count - 1)
	if _alive_count <= 0:
		# architecture §7.2：C4（战斗）判定全灭 → C5（开放世界）更新遭遇 spawn_state。
		# 本 G5 在 world 场景内代表遭遇侧；C5 核心层落地后由其 connect 此信号。
		EventBus.encounter_cleared.emit(encounter_id)


func _collect_spawn_points() -> Array:
	var out: Array = []
	for c in get_children():
		if c is Marker2D:
			out.append(c)
	return out
