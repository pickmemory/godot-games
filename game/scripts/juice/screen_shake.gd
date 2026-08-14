class_name ScreenShake
extends Node
## P6 juice · 相机震屏组件（trauma 模型 · 节制为主）
## 对齐：art-bible §3.1「避免战斗时剧烈抖动破坏俯视全局可读性」；combat §6.5/§7.6①。
## 挂载：作为 Camera2D 的【子节点】（world.tscn: Camera2D/ScreenShake）。每 _physics_process 写 _cam.offset。
##   注意：world.gd 每帧写 _camera.global_position（跟随玩家），Camera2D.offset 与之正交（互不干扰）。
## 模型：trauma ∈[0,1]；offset = trauma² × max_amp × 随机方向（经典平方衰减，首尾平滑）。
## 可访问性（combat §7.6① / ux-spec §11.1「减少屏幕震」）：reduce_motion=true → offset 恒零。

@export var max_amp: float = 8.0          # px 上限（art-bible §3.1 节制；实测 trauma²×8 已很轻）
@export var decay: float = 4.0            # trauma 衰减（/s）；4 → 一次注入约 0.25s 衰减完
@export var reduce_motion: bool = false   # 由 JuiceController.set_reduce_motion() 同步

var _cam: Camera2D = null
var _trauma: float = 0.0

func _ready() -> void:
	_cam = get_parent() as Camera2D

func _physics_process(_delta: float) -> void:
	if _cam == null:
		return
	_trauma = max(0.0, _trauma - decay * _delta)
	if reduce_motion or _trauma <= 0.0:
		_cam.offset = Vector2.ZERO
		return
	var amt: float = _trauma * _trauma * max_amp
	_cam.offset = Vector2(randf_range(-amt, amt), randf_range(-amt, amt))

## 注入震屏（trauma ∈[0,1]，累加封顶 1）。由 JuiceController.request_shake() 调用。
func add_trauma(amount: float) -> void:
	_trauma = clamp(_trauma + amount, 0.0, 1.0)

func set_reduce_motion(enabled: bool) -> void:
	reduce_motion = enabled
	if enabled and _cam != null:
		_cam.offset = Vector2.ZERO
