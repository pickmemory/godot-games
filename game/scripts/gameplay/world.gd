class_name WorldDirector
extends Node2D

## world 场景根控制器（P3-2 最小）。
## 参考：architecture §8.2（world 叠层）/ adr-001（Camera2D）。
##
## 职责（本 issue）：驱动 Camera2D 跟随玩家。
##   - Camera2D 按 §8.2 置于世界根（非 Player 子节点），故需每帧同步位置；
##   - Camera2D.position_smoothing_enabled 负责渲染端缓动（K9，见 engine-reference）。
##
## 留后续 issue：C4/C5 场景内系统节点的 EventBus connect/disconnect 生命周期、
## WindDirector 广播 wind_visual_dir、读档世界重同步（§9.2）。

@onready var _camera: Camera2D = $Camera2D
@onready var _player: Node2D = $L3_Characters/Player


func _physics_process(_delta: float) -> void:
	# 跟随玩家（Camera2D 自身的 position_smoothing 做渲染端缓动）。
	if is_instance_valid(_player):
		_camera.global_position = _player.global_position
