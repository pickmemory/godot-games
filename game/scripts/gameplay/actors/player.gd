class_name Player
extends CharacterBody2D

## Player · 玩家控制器（玩法层 G1）。
## 参考：architecture §3.3 G1 / open-world §1.2 探索动词 / adr-003（输入）/ adr-001（叠层）。
##
## P3-2 最小可移动实现：
##   - 方向取 Input.get_vector("move_left","move_right","move_up","move_down")；
##     WASD（键鼠）与左摇杆（手柄）经 InputMap 双绑定自动生效，代码只查动作名（不碰原始键码）。
##   - stance：sprint / crouch / walk；目标速度读 data/globals/PlayerMovementGlobals（数据驱动，不硬编码）。
##   - 加速度/摩擦经 move_toward 做帧率无关插值。
##
## 本 issue 不实现（留后续）：战斗输入转发（→C4）、采集/对话触发（→S5）、stance 广播给 C4 感知。

enum Stance { WALK, SPRINT, CROUCH }

## 数据驱动参数；缺省回退 data/globals/player_movement_globals.tres（演示数据驱动边界）。
@export var movement_globals: PlayerMovementGlobals

var _stance: Stance = Stance.WALK
var _dir: Vector2 = Vector2.ZERO


func _ready() -> void:
	if movement_globals == null:
		push_warning("Player: movement_globals 未赋值，回退 data/globals/player_movement_globals.tres")
		movement_globals = load("res://data/globals/player_movement_globals.tres")
	# 场景内分组（architecture §8.2：player 经分组/EventBus 间接寻址；本 issue 仅占位）。
	add_to_group("player")


func _physics_process(delta: float) -> void:
	# Input.get_vector 内部应用各动作死区（adr-003 K8）+ 圆形裁剪，键鼠/手柄同源。
	_dir = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	_update_stance()

	var target_velocity := _dir * _target_speed()
	var rate := _accel_rate()
	velocity = velocity.move_toward(target_velocity, rate * delta)
	move_and_slide()


func _update_stance() -> void:
	# 优先级：crouch > sprint > walk（蹲行时压制奔跑，便于潜行；combat §2.7 / open-world §1.2）。
	if Input.is_action_pressed("crouch"):
		_stance = Stance.CROUCH
	elif Input.is_action_pressed("sprint"):
		_stance = Stance.SPRINT
	else:
		_stance = Stance.WALK


func _target_speed() -> float:
	match _stance:
		Stance.SPRINT:
			return movement_globals.sprint_speed
		Stance.CROUCH:
			return movement_globals.crouch_speed
		_:
			return movement_globals.walk_speed


func _accel_rate() -> float:
	# 有目标方向 → 加速；否则 → 摩擦减速。
	if _dir.length_squared() > 0.0001:
		return movement_globals.acceleration
	return movement_globals.friction
