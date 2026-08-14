class_name Enemy
extends CharacterBody2D

## 敌人角色（玩法层 G2 · combat §2.8 敌人 FSM / §3.3 敌人定义 / §2.7 感知警戒）。
##
## 数据驱动：所有数值/感知/攻击参数来自 enemy_data（.tres），脚本只读（issue #13 验收要点 1）。
## FSM 状态（issue #13 锁定三态 + 死亡）：PATROL → CHASE → HURT → DEAD。
##   - PATROL：沿遭遇布置注入的巡逻路点移动；感知累积 sight_meter。
##   - CHASE：追击玩家；进入攻击范围发可读前摇的近战劈砍（windup→active→recover）。
##   - HURT：受击反应（hurt_dur）；施加击退；结束后回追击前态。
##   - DEAD：hp≤0 倒地，广播 died 后清理。
##
## 信号（场景内原生信号，combat §6.4 / control-manifest「场景内就近原生/分组」，供 P5-2 战斗系统订阅）：
##   state_changed / hurt / died / attack_landed
##
## 受击接口：take_hit(amount, from_dir, knockback_px, damage_type) —— P5-2 攻方命中盒结算后调用。
##
## 范围克制（issue #13 / combat §2.9）：
##   - 普通敌人击杀不发 verb_executed（不发 S1）；改写目标敌人（曹操/庞统等）的 verb_executed 时序留 P5-2/改写 issue。
##   - 伤害公式（combat §4.1）归 P5-2 攻方；本脚本只接收已结算伤害量。
##   - 不实现闪避/硬直槽/暴击（玩家完整集，combat §2.4/§2.5）。

signal state_changed(new_state: StringName)
signal hurt(amount: int, from_dir: Vector2)
signal died(enemy_id: StringName)
signal attack_landed(target: Node, attack_id: StringName, knockback_dir: Vector2)

enum State { PATROL, CHASE, HURT, DEAD }
enum AttackPhase { NONE, WINDUP, ACTIVE, RECOVER }

## 数据驱动参数（缺省回退山贼原型，便于裸实例化调试）。
@export var enemy_data: EnemyData
## 调试可视（视野锥/听觉/攻击范围/状态文本，可开关）—— 可调试 AI（issue #13 验收要点 3）。
@export var debug_draw: bool = false

## 巡逻路点（世界坐标）；由遭遇布置（S5/G5 遭遇生成器）运行时注入（combat §3.3 patrol_route_ref）。
var patrol_waypoints: Array[Vector2] = []

var _state: State = State.PATROL
var _attack_phase: AttackPhase = AttackPhase.NONE
var _state_before_hurt: State = State.PATROL
var _current_hp: int = 0

var _facing: Vector2 = Vector2.DOWN
var _velocity_target: Vector2 = Vector2.ZERO

# 感知
var _sight_meter: float = 0.0  # [0,1]：达 1.0 进入 CHASE
var _lost_timer: float = 0.0   # 脱战计时

# 巡逻
var _wp_index: int = 0

# 攻击
var _attack_index: int = 0
var _attack_timer: float = 0.0
var _attack_cooldown: float = 0.0
var _attack_has_landed: bool = false

# 受击/击退
var _hurt_timer: float = 0.0
var _knockback_vel: Vector2 = Vector2.ZERO
var _flash_tween: Tween = null

# 死亡清理
var _dead_clean_timer: float = 0.6

# 移动插值速率（保持与 player.gd 量级一致；非战斗核心数值，作常量不落数据）。
const _ACCEL: float = 1200.0
const _KNOCKBACK_DECAY: float = 2400.0  # 击退衰减（px/s²）
const _DEAD_CLEAN_DELAY: float = 0.6    # 倒地到清理（秒）

@onready var _attack_hitbox: Area2D = $AttackHitbox
@onready var _attack_shape_node: CollisionShape2D = $AttackHitbox/CollisionShape2D
@onready var _debug_label: Label = $DebugLabel


func _ready() -> void:
	if enemy_data == null:
		push_warning("Enemy: enemy_data 未赋值，回退 data/enemies/npc_bandit_chibi.tres")
		enemy_data = load("res://data/enemies/npc_bandit_chibi.tres")
	_current_hp = enemy_data.hp_max
	add_to_group("enemy")
	add_to_group("damageable")
	# 每敌人独占命中盒形状：避免多实例共享 .tscn 内联 CircleShape2D 互相覆盖 radius。
	if _attack_shape_node != null:
		var own_shape := CircleShape2D.new()
		own_shape.radius = 16.0
		_attack_shape_node.shape = own_shape
	# 命中盒默认关闭（仅 active 阶段开启）。
	_disable_attack_hitbox()
	_apply_debug_visible(false)
	_change_state(State.PATROL, true)


# ───────────────────────── 主循环 ─────────────────────────

func _physics_process(delta: float) -> void:
	if enemy_data == null:
		return
	if _state == State.DEAD:
		_tick_dead(delta)
		return

	_update_player_ref()
	match _state:
		State.PATROL:
			_tick_patrol(delta)
		State.CHASE:
			_tick_chase(delta)
		State.HURT:
			_tick_hurt(delta)

	# 击退叠加到本帧位移之上（combat §4.4 击退方向）。
	_apply_knockback(delta)
	move_and_slide()

	if debug_draw:
		queue_redraw()
	_update_debug_label()


# ───────────────────────── 状态：PATROL ─────────────────────────

func _tick_patrol(delta: float) -> void:
	if _update_detection(delta) or _sight_meter >= 1.0:
		if _sight_meter >= 1.0:
			_change_state(State.CHASE)
			return
	# 沿巡逻路点移动（路点由遭遇布置注入；空则原地待机）。
	if patrol_waypoints.is_empty():
		_velocity_target = Vector2.ZERO
		return
	var target_pos: Vector2 = patrol_waypoints[_wp_index]
	var to_tgt: Vector2 = target_pos - global_position
	if to_tgt.length() <= 6.0:
		_wp_index = (_wp_index + 1) % patrol_waypoints.size()
		to_tgt = patrol_waypoints[_wp_index] - global_position
	if to_tgt.length() > 0.001:
		_facing = to_tgt.normalized()
	var speed: float = enemy_data.move_speed_px * enemy_data.ai.patrol_speed_mult
	_velocity_target = _facing * speed


# ───────────────────────── 状态：CHASE ─────────────────────────

func _tick_chase(delta: float) -> void:
	var sensed: bool = _update_detection(delta)
	if sensed:
		_lost_timer = 0.0
	else:
		_lost_timer += delta
		if _lost_timer >= enemy_data.detection.lose_target_time:
			_reset_detection()
			_change_state(State.PATROL)
			return

	var to_player: Vector2 = Vector2.ZERO
	if is_instance_valid(_player):
		to_player = _player.global_position - global_position
		if to_player.length() > 0.001:
			_facing = to_player.normalized()

	# 攻击序列进行中 → 走攻击时序（含位移/命中盒），不再追击位移。
	if _attack_phase != AttackPhase.NONE:
		_tick_attack(delta)
		return

	_attack_cooldown = max(0.0, _attack_cooldown - delta)

	# 在攻击范围且冷却就绪 → 起手攻击（combat §2.8 可读前摇）。
	if is_instance_valid(_player):
		var atk: EnemyAttackData = _current_attack()
		if _attack_cooldown <= 0.0 and to_player.length() <= atk.range_px:
			_start_attack()
			_tick_attack(delta)
			return
		# 否则继续追击位移。
		var speed: float = enemy_data.move_speed_px * enemy_data.ai.chase_speed_mult
		_velocity_target = _facing * speed
	else:
		_velocity_target = Vector2.ZERO


func _tick_attack(delta: float) -> void:
	var atk: EnemyAttackData = _current_attack()
	_attack_timer -= delta
	match _attack_phase:
		AttackPhase.WINDUP:
			# 前摇：停下预备（可读 telegraph）。
			_velocity_target = Vector2.ZERO
			if _attack_timer <= 0.0:
				_attack_phase = AttackPhase.ACTIVE
				_attack_timer = atk.active
				_attack_has_landed = false
				_enable_attack_hitbox(atk)
		AttackPhase.ACTIVE:
			# 命中盒生效期间小幅前冲；每帧检测重叠（已在内不依赖 body_entered 转换）。
			_velocity_target = _facing * (enemy_data.move_speed_px * 0.6)
			_check_attack_hit()
			_reposition_attack_hitbox()
			if _attack_timer <= 0.0:
				_disable_attack_hitbox()
				_attack_phase = AttackPhase.RECOVER
				_attack_timer = atk.recover
		AttackPhase.RECOVER:
			_velocity_target = Vector2.ZERO
			if _attack_timer <= 0.0:
				_attack_phase = AttackPhase.NONE
				_attack_cooldown = atk.cooldown


func _start_attack() -> void:
	var atk: EnemyAttackData = _current_attack()
	_attack_phase = AttackPhase.WINDUP
	_attack_timer = atk.windup
	_attack_has_landed = false


func _check_attack_hit() -> void:
	if _attack_has_landed:
		return
	if not _attack_hitbox.monitoring:
		return
	var atk: EnemyAttackData = _current_attack()
	for body in _attack_hitbox.get_overlapping_bodies():
		if body != self and body.is_in_group("player"):
			_attack_has_landed = true
			# P5-2 伤害结算接口：攻方（敌人）把命中事件交出，由 P5-2 战斗系统对玩家套 §4.1 公式。
			attack_landed.emit(body, atk.id, _facing)
			break


func _current_attack() -> EnemyAttackData:
	var attacks: Array[EnemyAttackData] = enemy_data.ai.attacks
	if attacks.is_empty():
		push_warning("Enemy: ai.attacks 为空，回退默认 EnemyAttackData")
		return EnemyAttackData.new()
	return attacks[_attack_index % attacks.size()]


# ───────────────────────── 状态：HURT ─────────────────────────

func _tick_hurt(delta: float) -> void:
	_velocity_target = Vector2.ZERO
	_hurt_timer -= delta
	if _hurt_timer <= 0.0:
		# 受击结束 → 回追击前态（combat §2.5 受击后恢复）。
		_change_state(_state_before_hurt if _state_before_hurt != State.HURT else State.PATROL)


# ───────────────────────── 状态：DEAD ─────────────────────────

func _tick_dead(delta: float) -> void:
	_velocity_target = Vector2.ZERO
	_dead_clean_timer -= delta
	if _dead_clean_timer <= 0.0:
		queue_free()


# ───────────────────────── 受击接口（P5-2 攻方调用） ─────────────────────────

## 受击结算入口。amount 为攻方按 combat §4.1 已结算的伤害量（整数 ≥1）；
## from_dir 为攻击来源方向（用于击退方向与表现）；knockback_px 为攻方击退位移。
func take_hit(amount: int, from_dir: Vector2, knockback_px: float = 24.0, _damage_type: StringName = &"physical") -> void:
	if _state == State.DEAD or enemy_data == null:
		return
	var dmg: int = max(1, amount)  # combat §4.1 保底 1（公式本身归 P5-2 攻方）
	_current_hp = max(0, _current_hp - dmg)

	var kdir: Vector2 = from_dir.normalized() if from_dir.length() > 0.001 else _facing
	_knockback_vel = kdir * (knockback_px / max(0.1, enemy_data.knockback_mass))
	hurt.emit(dmg, kdir)

	if _current_hp <= 0:
		_die()
	else:
		_flash_sprite()
		_enter_hurt()


func _enter_hurt() -> void:
	if _state == State.HURT:
		return
	_state_before_hurt = _state
	_change_state(State.HURT)

## 受击白闪（纯表现，手感反馈）。命中后 sprite 提亮一瞬再回正；死亡时由 _die 接管置灰。
func _flash_sprite() -> void:
	var sprite: Sprite2D = get_node_or_null("Sprite2D") as Sprite2D
	if sprite == null:
		return
	if _flash_tween != null and _flash_tween.is_valid():
		_flash_tween.kill()
	sprite.modulate = Color(3.5, 3.5, 3.5, 1.0)
	_flash_tween = create_tween()
	_flash_tween.tween_property(sprite, "modulate", Color(1, 1, 1, 1), 0.08)


func _die() -> void:
	_change_state(State.DEAD)
	_disable_attack_hitbox()
	_dead_clean_timer = _DEAD_CLEAN_DELAY  # 倒地表现后清理
	if _flash_tween != null and _flash_tween.is_valid():
		_flash_tween.kill()
	# 倒地：关闭物理碰撞（不再挡路/被打），保留实体做倒地表现后清理。
	var col: CollisionShape2D = get_node_or_null("CollisionShape2D")
	if col != null:
		col.set_deferred("disabled", true)
	var sprite: Node = get_node_or_null("Sprite2D")
	if sprite is Sprite2D:
		(sprite as Sprite2D).modulate = Color(0.5, 0.5, 0.5, 0.6)
	died.emit(enemy_data.enemy_id)


# ───────────────────────── 感知（combat §2.7） ─────────────────────────

var _player: Node2D = null

func _update_player_ref() -> void:
	if not is_instance_valid(_player):
		_player = get_tree().get_first_node_in_group("player")


## 更新 sight_meter；返回本帧是否感知到目标（视野锥内或听觉半径内）。
func _update_detection(delta: float) -> bool:
	var det: EnemyDetectionData = enemy_data.detection
	var can_sense: bool = false
	if is_instance_valid(_player):
		var to_p: Vector2 = _player.global_position - global_position
		var dist: float = to_p.length()
		var in_hearing: bool = dist <= det.hearing_radius_px
		var in_view: bool = false
		if dist <= det.view_radius_px and dist > 0.001:
			# 视野锥：玩家相对朝向夹角 ≤ 半角。
			var ang: float = rad_to_deg(_facing.angle_to(to_p))
			in_view = abs(ang) <= det.view_cone_half_deg
		if in_view:
			_sight_meter += det.sight_gain_rate * delta
			can_sense = true
		elif in_hearing:
			# P5-1 简化：进入听觉半径即累积（暂忽略玩家 stance 噪声耦合，留 TODO(open-world)）。
			_sight_meter += det.hear_gain_rate * delta
			can_sense = true
		else:
			_sight_meter -= (1.0 / max(0.01, det.alert_decay)) * delta
	else:
		_sight_meter -= (1.0 / max(0.01, det.alert_decay)) * delta
	_sight_meter = clamp(_sight_meter, 0.0, 1.0)
	return can_sense


func _reset_detection() -> void:
	_sight_meter = 0.0
	_lost_timer = 0.0


# ───────────────────────── 状态切换 + 位移 ─────────────────────────

func _change_state(new_state: State, force: bool = false) -> void:
	if not force and _state == new_state:
		return
	_state = new_state
	# 切出 CHASE 时取消进行中的攻击时序。
	if new_state != State.CHASE and _attack_phase != AttackPhase.NONE:
		_disable_attack_hitbox()
		_attack_phase = AttackPhase.NONE
	state_changed.emit(_state_name(new_state))
	_apply_debug_visible(debug_draw)


func _apply_knockback(delta: float) -> void:
	# 位移缓和（accel/friction）：与 player.gd 一致用 move_toward 趋近目标速度。
	velocity = velocity.move_toward(_velocity_target, _ACCEL * delta)
	if _knockback_vel.length_squared() > 0.0001:
		velocity += _knockback_vel
		_knockback_vel = _knockback_vel.move_toward(Vector2.ZERO, _KNOCKBACK_DECAY * delta)


# ───────────────────────── 命中盒 ─────────────────────────

func _enable_attack_hitbox(atk: EnemyAttackData) -> void:
	# 命中盒半径≈攻击范围，置于朝向前方 range/2 处（圆形近似前方扇形，art-bible §4.x 形制归林绘澄）。
	var shape: CircleShape2D = _attack_shape_node.shape as CircleShape2D
	if shape != null:
		shape.radius = atk.range_px * 0.5
	_reposition_attack_hitbox()
	_attack_shape_node.set_deferred("disabled", false)
	_attack_hitbox.monitoring = true


func _disable_attack_hitbox() -> void:
	if _attack_hitbox != null:
		_attack_hitbox.monitoring = false
	if _attack_shape_node != null:
		_attack_shape_node.set_deferred("disabled", true)


func _reposition_attack_hitbox() -> void:
	var atk: EnemyAttackData = _current_attack()
	_attack_hitbox.position = _facing * (atk.range_px * 0.5)


# ───────────────────────── 调试可视（issue #13 验收要点 3） ─────────────────────────

func _update_debug_label() -> void:
	if _debug_label == null:
		return
	if not debug_draw:
		return
	var atk_phase := ""
	match _attack_phase:
		AttackPhase.WINDUP: atk_phase = ":windup"
		AttackPhase.ACTIVE: atk_phase = ":active"
		AttackPhase.RECOVER: atk_phase = ":recover"
	_debug_label.text = "%s%s\nhp=%d/%d\nmeter=%.2f" % [
		_state_name(_state), atk_phase, _current_hp, enemy_data.hp_max, _sight_meter
	]


func _apply_debug_visible(vis: bool) -> void:
	if _debug_label != null:
		_debug_label.visible = vis


func _draw() -> void:
	if not debug_draw or enemy_data == null or enemy_data.detection == null:
		return
	var det: EnemyDetectionData = enemy_data.detection
	# 听觉半径（黄）。
	_draw_circle_outline(Color(1.0, 0.92, 0.3, 0.5), det.hearing_radius_px)
	# 视野锥扇形（红）。
	_draw_cone(Color(1.0, 0.3, 0.3, 0.28), det.view_radius_px, det.view_cone_half_deg)
	# 攻击范围（橙）。
	if not enemy_data.ai.attacks.is_empty():
		_draw_circle_outline(Color(1.0, 0.55, 0.2, 0.7), _current_attack().range_px)


func _draw_circle_outline(color: Color, radius_px: float) -> void:
	var pts: PackedVector2Array = []
	var count: int = 36
	for i in count:
		var a: float = TAU * float(i) / float(count)
		pts.append(Vector2(cos(a), sin(a)) * radius_px)
	draw_colored_polygon(pts, color)


func _draw_cone(color: Color, radius_px: float, half_deg: float) -> void:
	var base_ang: float = _facing.angle()
	var half: float = deg_to_rad(half_deg)
	var pts: PackedVector2Array = [Vector2.ZERO]
	var count: int = 18
	for i in count + 1:
		var a: float = base_ang - half + (2.0 * half) * float(i) / float(count)
		pts.append(Vector2(cos(a), sin(a)) * radius_px)
	draw_colored_polygon(pts, color)


# ───────────────────────── 公共查询（测试/调试/P5-2） ─────────────────────────

func get_state_name() -> String:
	return _state_name(_state)


func get_hp() -> int:
	return _current_hp


func is_alive() -> bool:
	return _state != State.DEAD


static func _state_name(s: State) -> StringName:
	match s:
		State.PATROL: return &"PATROL"
		State.CHASE: return &"CHASE"
		State.HURT: return &"HURT"
		State.DEAD: return &"DEAD"
	return &"UNKNOWN"
