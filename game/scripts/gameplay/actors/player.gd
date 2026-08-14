class_name Player
extends CharacterBody2D

## Player · 玩家控制器（玩法层 G1）。
## 参考：architecture §3.3 G1 / open-world §1.2 探索动词 / combat §2.2 玩家战斗状态机 / adr-003（输入）/ adr-001（叠层）。
##
## P3-2 移动/stance（保留，issue #14「接入不破坏」）：
##   - 方向取 Input.get_vector("move_left","move_right","move_up","move_down")；WASD+左摇杆经 InputMap 双绑定。
##   - stance：sprint / crouch / walk；目标速度读 data/globals/player_movement_globals（数据驱动）。
##
## P5-2 战斗（issue #14：普攻 3 段连段 + 1 系统术法 + 命中盒/伤害/击退/受击 + 资源池转发）：
##   - 战斗 FSM（FREE / ATTACKING[含 3 段连段] / CASTING / DOWNED）+ 朝向 facing（4 向基础，art-bible §7.1）。
##   - 权威数值（HP/BF/伤害公式/冷却/verb_executed）归 C4 CombatSystem（核心层，architecture §3.2）；
##     本脚本只做：输入转发、连段/施法 FSM 时序、命中盒（Area2D）激活、击退位移、调试可视。
##   - 玩法→核心单向（architecture §4.1）：本节点调 combat_system.* 方法；核心不反向调本节点。
##   - DAG 硬契约：本节点不写 v_i/Δ（无此字段）；改写动词经 combat_system 发 EventBus.verb_executed（combat §2.9）。
##
## 范围克制（issue #14 验收要点 6 / combat §1.4/§2.4/§2.5）：
##   - MVP 仅普攻连段 + 1 系统术法（ability_system_magic_wind，rewrite_proxy 不造伤害）。
##   - 不实现闪避/硬直槽/格挡/弹反（完整集）；i_frames 字段+hook 在 CombatSystem 预留（dodge.mvp_enabled=false）。

enum Stance { WALK, SPRINT, CROUCH }

enum CombatState { FREE, ATTACKING, CASTING }
enum AttackPhase { NONE, WINDUP, ACTIVE, RECOVER }
enum CastPhase { NONE, WINDUP, RELEASE, RECOVER }

## 移动全局参数；缺省回退 data/globals/player_movement_globals.tres。
@export var movement_globals: PlayerMovementGlobals
## 主术法 ability_id（MVP 唯一系统术法；join 键，combat §3.2/§2.6）。skill_1 绑定此 ability。
@export var primary_ability_id: StringName = &"ability_system_magic_wind"
## 调试可视（命中盒弧线 + 战斗态/combo/HP/BF 文本，可开关）—— 可调试（issue #14 验收要点 5）。
@export var debug_draw: bool = false

var _stance: Stance = Stance.WALK
var _dir: Vector2 = Vector2.ZERO
## 朝向（4 向基础，art-bible §7.1）；移动时更新，战斗中锁定。默认朝下。
var _facing: Vector2 = Vector2.DOWN

# ── 战斗 FSM ──
var _combat_state: CombatState = CombatState.FREE
var _attack_phase: AttackPhase = AttackPhase.NONE
var _cast_phase: CastPhase = CastPhase.NONE
var _combo_stage: int = 0          # 当前普攻段（1..3）；0=未在攻击
var _attack_elapsed: float = 0.0
var _attack_total: float = 0.0
var _cancel_armed: bool = false
var _queued_next: int = 0          # 派生下一段（1..3）；0=无
var _swing_hit: Array[Node] = []   # 本挥击已命中目标集（combat §2.3 一次判定，防多帧重复结算）
var _cast_ability: StringName = &""
var _cast_elapsed: float = 0.0
var _cast_total: float = 0.0
var _took_damage_this_frame: bool = false

# ── 击退（combat §4.4 击退方向/衰减）──
var _knockback_vel: Vector2 = Vector2.ZERO

# ── 已连接 attack_landed 的敌人集（防 .bind(e) Callable 不等导致每帧重复连接）──
var _hit_signal_enemies: Array[Node] = []

# ── 核心层引用（经分组定位，adr-004 §2）──
var _combat_system: CombatSystem = null
var _juice: JuiceController = null

# ── 常量（非战斗核心数值，作常量不落数据）──
const _KNOCKBACK_DECAY: float = 2400.0      # 击退衰减（px/s²，与 enemy.gd 量级一致）
const _CAST_RELEASE_DUR: float = 0.10       # 释放瞬间（不可打断，combat §2.2）
const _CAST_RECOVER_DUR: float = 0.15       # 施法后摇
const _ATTACK_HITBOX_OFFSET_RATIO: float = 0.5  # 命中盒置于朝向前方 range*0.5 处

@onready var _attack_hitbox: Area2D = $AttackHitbox
@onready var _attack_shape_node: CollisionShape2D = $AttackHitbox/CollisionShape2D
@onready var _debug_label: Label = $DebugLabel
@onready var _sprite: Sprite2D = get_node_or_null("Sprite2D") as Sprite2D

# ── 精灵表现（idle/walk 双帧 + 镜像翻转 + 行走浮动；方向集/多帧动画归续产）──
const _TEX_IDLE_PATH := "res://assets/sprites/char_player_traveler_idle_s.png"
const _TEX_WALK_PATH := "res://assets/sprites/char_player_traveler_walk_s.png"
var _tex_idle: Texture2D = null
var _tex_walk: Texture2D = null
var _sprite_base_offset := Vector2.ZERO
var _bob_phase := 0.0


func _ready() -> void:
	if movement_globals == null:
		push_warning("Player: movement_globals 未赋值，回退 data/globals/player_movement_globals.tres")
		movement_globals = load("res://data/globals/player_movement_globals.tres")
	add_to_group("player")
	# 每玩家独占命中盒形状：避免多实例共享 .tscn 内联 shape 互相覆盖 radius（同 enemy.gd 处理）。
	if _attack_shape_node != null:
		var own_shape := CircleShape2D.new()
		own_shape.radius = 26.0
		_attack_shape_node.shape = own_shape
	_disable_hitbox()
	_apply_debug_visible(false)
	_tex_idle = load(_TEX_IDLE_PATH) as Texture2D
	_tex_walk = load(_TEX_WALK_PATH) as Texture2D
	if _sprite != null:
		if _sprite.texture == null and _tex_idle != null:
			_sprite.texture = _tex_idle
		_sprite_base_offset = _sprite.offset


func _physics_process(delta: float) -> void:
	_took_damage_this_frame = false
	_ensure_combat_system()
	_update_facing()
	_tick_combat(delta)
	_handle_combat_input()
	_consume_enemy_attack_signals()

	# 位移：战斗锁定时目标速度 0（仍受击退影响）；否则按 stance 移动。
	var locked: bool = _is_movement_locked()
	var target_velocity: Vector2 = Vector2.ZERO
	if not locked:
		_dir = Input.get_vector("move_left", "move_right", "move_up", "move_down")
		_update_stance()
		target_velocity = _dir * _target_speed()
	else:
		_dir = Vector2.ZERO
	var rate: float = _accel_rate_locked() if locked else _accel_rate()
	velocity = velocity.move_toward(target_velocity, rate * delta)
	_apply_knockback(delta)
	move_and_slide()

	if _combat_system != null and _combat_system.is_player_downed() and _combat_state != CombatState.CASTING:
		# DOWNED 由 combat_system 持有态；本节点表现：禁输入（locked 已置），表现见 _draw/_update_debug_label。
		pass

	if debug_draw or _combat_state == CombatState.ATTACKING:
		queue_redraw()
	_update_debug_label()
	_update_visual(delta)


# ───────────────────────── 移动 / stance（P3-2 保留，勿破坏） ─────────────────────────

func _update_facing() -> void:
	# 战斗中（攻击/施法）锁定朝向；移动时更新朝向（4 向基础，art-bible §7.1）。
	if _combat_state != CombatState.FREE:
		return
	var v: Vector2 = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	if v.length_squared() > 0.01:
		_facing = v.normalized()


func _update_stance() -> void:
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
	if _dir.length_squared() > 0.0001:
		return movement_globals.acceleration
	return movement_globals.friction


func _accel_rate_locked() -> float:
	# 战斗锁定态：强制减速到 0（摩擦率）。
	return movement_globals.friction


func _is_movement_locked() -> bool:
	if _combat_system != null and _combat_system.is_player_downed():
		return true
	return _combat_state == CombatState.ATTACKING or _combat_state == CombatState.CASTING


# ───────────────────────── 战斗输入转发 ─────────────────────────

func _handle_combat_input() -> void:
	if _combat_system == null or _combat_system.is_player_downed():
		return
	# 普攻（鼠标左键 / 手柄□，InputMap basic_attack；combat §2.3）。
	if Input.is_action_just_pressed("basic_attack"):
		_try_basic_attack()
	# 系统术法（skill_1；combat §2.6）。MVP 绑定 primary_ability_id。
	if Input.is_action_just_pressed("skill_1"):
		_try_cast(primary_ability_id)


func _try_basic_attack() -> void:
	var data: PlayerCombatData = _combat_system.get_combat_data_safe() if _combat_system != null else null
	if data == null or data.basic_attack_stages.is_empty():
		return
	match _combat_state:
		CombatState.FREE:
			_start_attack(1)
		CombatState.ATTACKING:
			# 派生窗口（cancel_from）内可接下一段（combat §2.3）；窗口外按键忽略（reset 到 1 由回到 FREE 后下次按键实现）。
			if _cancel_armed:
				_queued_next = _combo_stage + 1 if _combo_stage < data.basic_attack_stages.size() else 0
		CombatState.CASTING:
			pass  # 施法中不接普攻（combat §2.2 可打断性：施法前摇仅受击可打断）


func _try_cast(ability_id: StringName) -> void:
	if _combat_state != CombatState.FREE:
		return  # 施法仅从 FREE 起手（combat §2.2）
	var chk: Dictionary = _combat_system.can_cast(ability_id)
	if not chk.ok:
		if debug_draw:
			print("[Player] cast %s denied: %s" % [ability_id, chk.get("reason", "")])
		return  # 未解锁/无 BF/冷却中 → 施法失败，不发 verb_executed（combat §2.6）
	if _combat_system.begin_cast(ability_id):
		_cast_ability = ability_id
		_cast_total = _combat_system.get_ability_data(ability_id).cast_time
		_cast_elapsed = 0.0
		_cast_phase = CastPhase.WINDUP
		_combat_state = CombatState.CASTING


# ───────────────────────── 战斗 FSM tick ─────────────────────────

func _tick_combat(delta: float) -> void:
	match _combat_state:
		CombatState.ATTACKING:
			_tick_attack(delta)
		CombatState.CASTING:
			_tick_cast(delta)
		CombatState.FREE:
			pass


func _tick_attack(delta: float) -> void:
	var data: PlayerCombatData = _combat_system.get_combat_data_safe()
	if data == null:
		return
	var stage: BasicAttackStageData = data.basic_attack_stages[_combo_stage - 1]
	_attack_elapsed += delta
	# 派生窗口 armed（combat §2.3 cancel_from ≈ 0.60）。
	if not _cancel_armed and _attack_total > 0.0 and _attack_elapsed >= stage.cancel_from * _attack_total:
		_cancel_armed = true

	match _attack_phase:
		AttackPhase.WINDUP:
			if _attack_elapsed >= stage.windup:
				_attack_phase = AttackPhase.ACTIVE
				_swing_hit.clear()
				_enable_hitbox(data)
		AttackPhase.ACTIVE:
			_check_hitbox_hits()
			_reposition_hitbox(data)
			var active_end: float = stage.windup + stage.active
			if _attack_elapsed >= active_end:
				_disable_hitbox()
				_attack_phase = AttackPhase.RECOVER
		AttackPhase.RECOVER:
			if _attack_elapsed >= _attack_total:
				_finish_attack(data)


func _start_attack(stage_num: int) -> void:
	var data: PlayerCombatData = _combat_system.get_combat_data_safe()
	if data == null:
		return
	_combo_stage = stage_num
	var stage: BasicAttackStageData = data.basic_attack_stages[stage_num - 1]
	_attack_total = stage.windup + stage.active + stage.recover
	_attack_elapsed = 0.0
	_cancel_armed = false
	_queued_next = 0
	_attack_phase = AttackPhase.WINDUP
	_swing_hit.clear()
	_combat_state = CombatState.ATTACKING


func _finish_attack(data: PlayerCombatData) -> void:
	_disable_hitbox()
	_attack_phase = AttackPhase.NONE
	if _queued_next >= 1 and _queued_next <= data.basic_attack_stages.size():
		_start_attack(_queued_next)  # 派生下一段（combat §2.3 连段）
	else:
		_combo_stage = 0
		_combat_state = CombatState.FREE


func _tick_cast(delta: float) -> void:
	_cast_elapsed += delta
	var ability: AbilityData = _combat_system.get_ability_data(_cast_ability)
	match _cast_phase:
		CastPhase.WINDUP:
			# 前摇可被受击打断（combat §2.2/§2.6，打断不耗 BF）。
			if _took_damage_this_frame:
				_combat_system.interrupt_cast()
				_cast_phase = CastPhase.NONE
				_cast_ability = &""
				_combat_state = CombatState.FREE
				return
			if _cast_elapsed >= _cast_total:
				# 释放瞬间（不可打断）：commit 扣 BF + 进冷却 + rewrite_proxy 发 verb_executed（combat §2.6 ④⑥）。
				_combat_system.commit_cast(_cast_ability)
				_cast_phase = CastPhase.RELEASE
				_cast_elapsed = 0.0
				_cast_total = _CAST_RELEASE_DUR
		CastPhase.RELEASE:
			if _cast_elapsed >= _cast_total:
				_cast_phase = CastPhase.RECOVER
				_cast_elapsed = 0.0
				_cast_total = _CAST_RECOVER_DUR
		CastPhase.RECOVER:
			if _cast_elapsed >= _cast_total:
				_cast_phase = CastPhase.NONE
				_cast_ability = &""
				_combat_state = CombatState.FREE
	if ability == null:
		return


# ───────────────────────── 命中盒（Area2D，combat §2.3 / §3.1 hitbox_shape=arc_front） ─────────────────────────

func _enable_hitbox(data: PlayerCombatData) -> void:
	# arc_front 以朝向前方的圆形近似（与 enemy.gd 一致；真正扇形/弧形 CollisionPolygon 待林绘澄资产规格，
	# 标 [待确认] 见 issue comment / architecture §13）。命中盒半径≈ range*0.6。
	var shape: CircleShape2D = _attack_shape_node.shape as CircleShape2D
	if shape != null:
		shape.radius = data.hitbox_range_px * 0.6
	_reposition_hitbox(data)
	_attack_shape_node.set_deferred("disabled", false)
	_attack_hitbox.monitoring = true


func _disable_hitbox() -> void:
	if _attack_hitbox != null:
		_attack_hitbox.monitoring = false
	if _attack_shape_node != null:
		_attack_shape_node.set_deferred("disabled", true)


func _reposition_hitbox(data: PlayerCombatData) -> void:
	_attack_hitbox.position = _facing * (data.hitbox_range_px * _ATTACK_HITBOX_OFFSET_RATIO)


func _check_hitbox_hits() -> void:
	if not _attack_hitbox.monitoring:
		return
	var data: PlayerCombatData = _combat_system.get_combat_data_safe()
	if data == null or _combo_stage < 1:
		return
	var stage: BasicAttackStageData = data.basic_attack_stages[_combo_stage - 1]
	for body in _attack_hitbox.get_overlapping_bodies():
		if body == self:
			continue
		if not (body is Enemy) or not body.is_alive():
			continue
		if body in _swing_hit:
			continue  # 本挥击已命中此目标（combat §2.3 一次判定）
		_swing_hit.append(body)
		# 分层（architecture §4.1）：玩法层读 enemy 数据 → 传标量给 C4 纯公式 → 自行调 take_hit。
		var resist: float = _enemy_resist(body, &"physical")
		var def_: int = _enemy_def(body)
		var dmg: int = _combat_system.compute_outgoing_damage(stage.mult, resist, def_)
		var was_alive: bool = body.is_alive()
		body.take_hit(dmg, _facing, stage.knockback, &"physical")
		_combat_system.on_player_hit_enemy()  # §4.2 命中回战意
		_ensure_juice()
		if _juice != null:
			_juice.request_hit_stop()   # 命中停顿（手感）
			_juice.request_shake(0.22)   # 轻震屏
		# DAG 硬契约（combat §2.9/§5.3）：改写目标击杀 → 回报 C4 发 verb_executed（C4 不写 v_i/Δ）。
		if was_alive and not body.is_alive():
			var verb: StringName = body.enemy_data.rewrite_verb_id if body.enemy_data != null else &""
			if verb != &"":
				_combat_system.notify_rewrite_target_killed(verb, body.enemy_data.enemy_id)


# ───────────────────────── 受击（敌人 → 玩家，combat §4.1/§4.4） ─────────────────────────

## 低频确保连接所有存活敌人的 attack_landed 信号（场景内原生信号，combat §6.4 / control-manifest 场景内就近）。
## 不修改 enemy.gd（issue #13 FSM 勿重写）；仅被动订阅其既有信号 attack_landed(target, attack_id, knockback_dir)。
## bind(enemy) 把发射方敌人绑入回调；用 _hit_signal_enemies 追踪避免重复连接
## （.bind(e) 与未绑定 Callable 不等，is_connected 无法识别，故显式追踪）。
func _consume_enemy_attack_signals() -> void:
	if _combat_system == null:
		return
	_hit_signal_enemies = _hit_signal_enemies.filter(func(e): return is_instance_valid(e))
	for e in get_tree().get_nodes_in_group("enemy"):
		if not (e is Enemy):
			continue
		if not e.has_signal("attack_landed"):
			continue
		if e in _hit_signal_enemies:
			continue
		e.attack_landed.connect(_on_enemy_attack_landed.bind(e))
		_hit_signal_enemies.append(e)


func _on_enemy_attack_landed(_target: Node, attack_id: StringName, knockback_dir: Variant, enemy: Variant) -> void:
	if _combat_system == null or _combat_system.is_player_downed():
		return
	if not (enemy is Enemy):
		return
	var kdir: Vector2 = knockback_dir if knockback_dir is Vector2 else _facing
	# 分层（architecture §4.1）：玩法层从 enemy 数据读攻方标量 → 传 C4 入向公式（C4 持 HP 权威）。
	var atk_data: EnemyAttackData = _enemy_attack(enemy, attack_id)
	var atk_base: int = enemy.enemy_data.atk_base if enemy.enemy_data != null else 0
	var mult: float = atk_data.mult if atk_data != null else 1.0
	var kbpx: float = atk_data.knockback_px if atk_data != null else 24.0
	var res: Dictionary = _combat_system.resolve_enemy_hit_on_player(atk_base, mult, kdir, kbpx)
	if int(res.get("dmg", 0)) > 0:
		_took_damage_this_frame = true  # 供施法前摇判断打断（combat §2.6）
		var kv: Vector2 = res.get("knockback_vel", Vector2.ZERO)
		if kv.length_squared() > 0.0001:
			_knockback_vel = kv


# ── 敌人数据查询（玩法层读玩法层；分层：核心不读玩法节点，故查询下沉至此）──

func _enemy_def(enemy: Enemy) -> int:
	return enemy.enemy_data.def_base if enemy.enemy_data != null else 0

func _enemy_resist(enemy: Enemy, damage_type: StringName) -> float:
	var d: EnemyData = enemy.enemy_data
	if d == null:
		return 0.0
	match damage_type:
		&"physical": return d.resist_physical
		&"system_arcane": return d.resist_system_arcane
		&"fire": return d.resist_fire
	return 0.0

func _enemy_attack(enemy: Enemy, attack_id: StringName) -> EnemyAttackData:
	var d: EnemyData = enemy.enemy_data
	if d == null or d.ai == null or d.ai.attacks.is_empty():
		return null
	for a in d.ai.attacks:
		if a.id == attack_id:
			return a
	return d.ai.attacks[0]  # 未命中 id 回退 attacks[0]（P5-1 单攻击敌人常态）


func _apply_knockback(delta: float) -> void:
	if _knockback_vel.length_squared() > 0.0001:
		velocity += _knockback_vel
		_knockback_vel = _knockback_vel.move_toward(Vector2.ZERO, _KNOCKBACK_DECAY * delta)


# ───────────────────────── 核心层引用 ─────────────────────────

func _ensure_combat_system() -> void:
	if not is_instance_valid(_combat_system):
		_combat_system = get_tree().get_first_node_in_group("combat_system") as CombatSystem

func _ensure_juice() -> void:
	if not is_instance_valid(_juice):
		_juice = get_tree().get_first_node_in_group("juice_controller") as JuiceController


# ───────────────────────── 调试可视（issue #14 验收要点 5：可调试，可开关） ─────────────────────────

func _update_debug_label() -> void:
	if _debug_label == null:
		return
	if not debug_draw:
		return
	var s: String = "FREE"
	match _combat_state:
		CombatState.ATTACKING:
			var ph: String = ""
			match _attack_phase:
				AttackPhase.WINDUP: ph = "windup"
				AttackPhase.ACTIVE: ph = "ACTIVE"
				AttackPhase.RECOVER: ph = "recover"
			s = "ATK%d:%s%s" % [_combo_stage, ph, " (cancel)" if _cancel_armed else ""]
		CombatState.CASTING:
			var ph: String = ""
			match _cast_phase:
				CastPhase.WINDUP: ph = "windup"
				CastPhase.RELEASE: ph = "RELEASE"
				CastPhase.RECOVER: ph = "recover"
			s = "CAST:%s" % ph
	var hp: int = _combat_system.get_hp() if _combat_system != null else -1
	var bf: int = _combat_system.get_bf() if _combat_system != null else -1
	_debug_label.text = "%s\nhp=%d bf=%d\nfacing=(%.1f,%.1f)" % [s, hp, bf, _facing.x, _facing.y]


func _apply_debug_visible(vis: bool) -> void:
	if _debug_label != null:
		_debug_label.visible = vis


func _draw() -> void:
	if _combat_system == null:
		return
	var data: PlayerCombatData = _combat_system.get_combat_data_safe()
	if data == null:
		return
	# 挥砍弧光（ACTIVE 阶段始终显示——战斗可读性，非 debug 专属；art-bible §3.3 信息焦点）。
	if _attack_phase == AttackPhase.ACTIVE:
		_draw_cone(Color(1.0, 0.93, 0.72, 0.38), data.hitbox_range_px, 55.0)
	if not debug_draw:
		return
	# 命中盒前方弧形（active 时高亮）。
	var col: Color = Color(0.4, 0.8, 1.0, 0.5) if _attack_phase == AttackPhase.ACTIVE else Color(0.4, 0.8, 1.0, 0.2)
	_draw_cone(col, data.hitbox_range_px, 55.0)
	if _combat_system.is_player_downed():
		_draw_circle_outline(Color(0.8, 0.1, 0.1, 0.5), 28.0)


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


# ───────────────────────── 精灵表现（双帧 + 翻转 + 浮动） ─────────────────────────

## idle/walk 双帧切换 + 左右镜像 + 行走微浮动（廉价但有效的“活”感；完整方向集/序列帧归续产）。
func _update_visual(delta: float) -> void:
	if _sprite == null:
		return
	_sprite.flip_h = _facing.x < -0.05
	var moving: bool = velocity.length() > 12.0
	var want: Texture2D = _tex_walk if moving else _tex_idle
	if want != null and _sprite.texture != want:
		_sprite.texture = want
	if moving:
		_bob_phase = fmod(_bob_phase + delta * 9.0, TAU)
		_sprite.offset = _sprite_base_offset + Vector2(0.0, sin(_bob_phase) * 2.5)
	else:
		_bob_phase = 0.0
		_sprite.offset = _sprite_base_offset


# ───────────────────────── 公共查询（测试/调试） ─────────────────────────

func get_facing() -> Vector2:
	return _facing


func get_combat_state_name() -> String:
	match _combat_state:
		CombatState.FREE: return "FREE"
		CombatState.ATTACKING: return "ATTACKING"
		CombatState.CASTING: return "CASTING"
	return "UNKNOWN"


func get_combo_stage() -> int:
	return _combo_stage


func get_attack_phase_name() -> String:
	match _attack_phase:
		AttackPhase.NONE: return "NONE"
		AttackPhase.WINDUP: return "WINDUP"
		AttackPhase.ACTIVE: return "ACTIVE"
		AttackPhase.RECOVER: return "RECOVER"
	return "UNKNOWN"
