class_name WeaponTrail
extends Line2D
## P6 juice · 普攻挥砍拖尾（Line2D 采样 + 寿命衰减）
## 对齐：art-bible §7.1 动态线「武器拖尾拉长动势」；§7.2/§7.3 节奏与帧预算；§2.4 色相法则（普攻=宣纸白墨描，非系统青蓝）。
## 挂载：作为武器/玩家子节点，set_as_top_level(true) 用全局坐标画线；玩法层在普攻 active 帧调 add_swing_point()。
## 接线点（交程基岩，issue comment）：player.gd 普攻 active 阶段（_check_hitbox_hits 邻近）每帧采样武器尖端全局位。
## 可访问性（ux-spec §11.1「减少动效」）：reduce_motion=true → 不采样、清空，无拖尾。

@export var max_points: int = 12
@export var lifetime: float = 0.18            # s，单点寿命（art-bible §7.3 普攻节奏）
@export var ink_color: Color = Color(0.92, 0.90, 0.82, 0.85)   # 宣纸白偏暖（art-bible §2.1 主色 A' 偏白）
@export var trail_width: float = 6.0
@export var reduce_motion: bool = false       # 由 JuiceController.set_reduce_motion() 同步

var _samples: Array = []   # Array[{ pos: Vector2, age: float }]

func _ready() -> void:
	set_as_top_level(true)
	default_color = ink_color
	width = trail_width
	joint_mode = Line2D.LINE_JOINT_ROUND
	begin_cap_mode = Line2D.LINE_CAP_ROUND
	end_cap_mode = Line2D.LINE_CAP_ROUND
	clear_points()

func _process(delta: float) -> void:
	if reduce_motion:
		if _samples.size() > 0:
			_samples.clear()
		if get_point_count() > 0:
			clear_points()
		return
	# 老化 + 丢弃过期样本
	var alive: Array = []
	for s in _samples:
		s.age += delta
		if s.age < lifetime:
			alive.append(s)
	_samples = alive
	# 重建折线（新点在前，形成尖端淡出感）
	clear_points()
	var n: int = min(_samples.size(), max_points)
	for i in range(n - 1, -1, -1):
		add_point(_samples[i].pos)

## 玩法层在普攻挥砍 active 帧采样武器尖端全局位调用。
func add_swing_point(global_pos: Vector2) -> void:
	if reduce_motion:
		return
	_samples.append({ "pos": global_pos, "age": 0.0 })
	if _samples.size() > max_points:
		_samples.pop_at(0)

func set_reduce_motion(enabled: bool) -> void:
	reduce_motion = enabled
