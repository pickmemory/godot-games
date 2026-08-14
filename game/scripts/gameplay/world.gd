class_name WorldDirector
extends Node2D

## world 场景根控制器（P3-2 最小 + P5-8 读档重同步）。
## 参考：architecture §8.2（world 叠层）/ adr-001（Camera2D）/ §9.2（读档重同步）。
##
## 职责：
##   - 驱动 Camera2D 跟随玩家（Camera2D 按 §8.2 置世界根，非 Player 子节点；每帧同步位置，
##     渲染端缓动由 position_smoothing 负责，K9）。
##   - P5-8：读档重同步（§9.2）。world._ready 在所有 Systems 子节点 _ready 之后执行
##     （Godot 自底向上 _ready），此时 C1(RewriteCausalityEngine)/C2(QuestSystem) 已就绪，
##     若 SaveManager 有待注入快照（来自主菜单「继续」），在此 deserialize 到 C1/C2。
##     C3/C5 尚未落地 → 防御性空快照（SaveManager._serialize_optional_panel）。
##
## 留后续 issue：C4/C5 场景内系统节点的 EventBus connect/disconnect 生命周期、
## WindDirector 广播 wind_visual_dir、C5 读档世界重建（TileMap/NPC/遭遇，§9.2 完整版）。

@onready var _camera: Camera2D = $Camera2D
@onready var _player: Node2D = $L3_Characters/Player


func _ready() -> void:
	# 读档重同步（architecture §9.2）：主菜单「继续」预载快照 → world 起步时注入 C1/C2。
	# C2._ready 已据章节数据派发（fresh baseline）；此处 deserialize 覆盖为存档态，
	# 由各系统的 deserialize() 负责 resync 信号重发（防 UI 失同步）。
	if SaveManager.has_pending_load():
		SaveManager.apply_pending_load()


func _physics_process(_delta: float) -> void:
	# 跟随玩家（Camera2D 自身的 position_smoothing 做渲染端缓动）。
	if is_instance_valid(_player):
		_camera.global_position = _player.global_position
