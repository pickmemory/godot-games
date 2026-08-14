class_name Pickup
extends Area2D

## 掉落拾取物（BF 战意珠 / HP 回复珠 · 纯玩法层表现）。
## 敌人死亡时生成；近距磁吸飞向玩家；触碰生效（资源归 C4 apply_pickup）。
## 视觉：轨道 A 暖墨彩小球（BF 青/HP 朱 —— 战意属系统侧故青蓝，回复属生机故朱砂）。

enum Kind { BF, HP }

@export var kind: Kind = Kind.BF
@export var amount: int = 8
@export var magnet_radius: float = 150.0
@export var magnet_speed: float = 420.0

var _t: float = 0.0
var _player: Node2D = null


func _ready() -> void:
	var col := CollisionShape2D.new()
	var shape := CircleShape2D.new()
	shape.radius = 22.0
	col.shape = shape
	add_child(col)
	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	_t += delta
	if not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player")
	queue_redraw()
	if not is_instance_valid(_player):
		return
	var to_p: Vector2 = _player.global_position - global_position
	if to_p.length() <= magnet_radius:
		global_position += to_p.normalized() * magnet_speed * delta


func _draw() -> void:
	# 磁吸期间放大脉动 + 微浮动（活物感）
	var pulse: float = 1.0 + 0.12 * sin(_t * 6.0)
	var col: Color = Color(0.35, 0.8, 0.95, 0.9) if kind == Kind.BF else Color(0.92, 0.3, 0.25, 0.9)
	var r: float = 9.0 * pulse
	draw_circle(Vector2(0, sin(_t * 3.0) * 2.0), r + 4.0, Color(col.r, col.g, col.b, 0.25))
	draw_circle(Vector2(0, sin(_t * 3.0) * 2.0), r, col)
	draw_circle(Vector2(0, sin(_t * 3.0) * 2.0), r * 0.45, Color(1, 1, 1, 0.55))


func _on_body_entered(body: Node) -> void:
	if not body.is_in_group("player"):
		return
	var cs: Node = get_tree().get_first_node_in_group("combat_system")
	if cs != null and cs.has_method("apply_pickup"):
		if kind == Kind.BF:
			cs.apply_pickup(amount, 0)
		else:
			cs.apply_pickup(0, amount)
	queue_free()
