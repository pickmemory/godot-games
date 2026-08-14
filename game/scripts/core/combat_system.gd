class_name CombatSystem
extends Node

## CombatSystem · 实时战斗系统核心层 C4（S4 权威逻辑所有者）。
## 参考：architecture §3.2 C4 / §4.1 分层单向 / §4.2 DAG / §7.2 信号总表；combat.md 全篇；adr-004。
##
## 部署形态（architecture §3.2 / adr-004 §决定2）：C4 = **world 场景内节点**（非 Autoload），
## 挂 world.tscn Systems/CombatSystem；_ready 加入分组 "combat_system" 供玩法层经
## get_tree().get_first_node_in_group("combat_system") 定位（adr-004 §2）。
##
## 分层纯净（architecture §4.1「核心不反向调玩法」+ A7「C 可独立单测」）：
##   - 本类**只持有自己的权威态**（HP/BF/冷却/警戒/已解锁能力）+ **纯伤害公式** + verb_executed 发出。
##   - **不引用任何玩法层类**（Enemy/Player/EnemyData 等），不调 take_hit（那是玩法层职责）。
##   - 玩法层（player.gd）读 enemy 数据 → 传标量给本类公式 → 自行调 enemy.take_hit → 回报命中/击杀。
##   - 故本类可脱离场景/敌人独立单测（A7，control-manifest「C1 可独立单测」同款纪律应用于 C4）。
##
## 拥有（唯一真值，combat §3.5 不持久化；读档满血+清警戒）：
##   - 玩家战斗状态 HP/BF（§4.2 再生）+ 警戒档位 alert_level（§2.7）+ 能力冷却 + 已解锁能力集。
##
## DAG 硬契约（红线 · combat §2.9/§5.3 / rewrite-causality §5.3,§7.3 / systems-index §3.1）：
##   - 战斗击杀改写目标 / rewrite_proxy 术法释放 → **只发** EventBus.verb_executed(verb_id,target,success)（→C1/S1）；
##     **绝不直写 v_i/Δ**（本类无 v_i/Δ 字段，S1 计算封闭）。
##   - 普通敌人击杀不发 verb_executed（combat §2.9）——由玩法层据 enemy_data.rewrite_verb_id 决定是否回报。
##
## 信号契约（adr-004 / architecture §7.2，总表登记非私加）：
##   - 发出：verb_executed / alert_state_changed / hp_changed / bf_changed（§7.2 C4 发出表）。
##   - 接收：ability_unlocked（§7.2 C3 发出 → C4）。
##   - 场景内高频（命中盒命中、敌人 attack_landed）走节点原生 signal，不塞总线（control-manifest）。
##
## 知识诚实（A5 / issue #14 验收要点 8）：Godot 4.7 API 不确定处标 [待确认]/TODO，不臆造。

@export var player_combat: PlayerCombatData
@export var detection_globals: DetectionGlobalsData
@export var debug_log: bool = false

# 玩家战斗运行时态（combat §3.5 非持久）
var _hp: int = 0
var _bf: int = 0
var _alert_level: int = 0
var _downed: bool = false
var _i_frames_timer: float = 0.0   # 闪避无敌帧倒计时（MVP dodge 关闭恒 0；hook 保留，combat §2.4）

# 能力执行运行时
var _unlocked_abilities: Dictionary = {}    # ability_id(StringName) -> true
var _cooldowns: Dictionary = {}              # ability_id(StringName) -> 剩余秒
var _casting_ability: StringName = &""       # 正在前摇的 ability_id（打断用，combat §2.6）
var _ability_cache: Dictionary = {}          # ability_id(StringName) -> AbilityData（.tres 缓存）

# 警戒扫描节流（低频；C4 扫自己场景的战斗体，非跨系统轮询）
var _alert_scan_accum: float = 0.0
const _ALERT_SCAN_INTERVAL: float = 0.2
const _KNOCKBACK_VEL_SCALE: float = 6.0   # knockback_px → 初始速度（px/s）换算

# 发射节流（仅在整数变化时发 hp/bf changed，避免每帧噪声）
var _last_emitted_hp: int = -1
var _last_emitted_bf: int = -1

# 小数再生累加器（每帧 regen_rate·delta < 1，需跨帧累加再取整；避免丢小数）
var _bf_accum: float = 0.0
var _hp_accum: float = 0.0


func _ready() -> void:
	if player_combat == null:
		push_warning("CombatSystem: player_combat 未赋值，回退 data/combat/player_combat.tres")
		player_combat = load("res://data/combat/player_combat.tres")
	if detection_globals == null:
		push_warning("CombatSystem: detection_globals 未赋值，回退 data/globals/detection_globals.tres")
		detection_globals = load("res://data/globals/detection_globals.tres")
	_hp = player_combat.hp_max
	_bf = player_combat.bf_max
	_last_emitted_hp = -1
	_last_emitted_bf = -1
	add_to_group("combat_system")
	# adr-004 §后果：C4 场景节点在 _ready connect EventBus，_exit_tree disconnect（防悬挂回调）。
	EventBus.ability_unlocked.connect(_on_ability_unlocked)
	_emit_hp()
	_emit_bf()


func _exit_tree() -> void:
	if EventBus.ability_unlocked.is_connected(_on_ability_unlocked):
		EventBus.ability_unlocked.disconnect(_on_ability_unlocked)


func _physics_process(delta: float) -> void:
	if _downed:
		return
	# 冷却推进
	var keys: Array = _cooldowns.keys()
	for k in keys:
		_cooldowns[k] = max(0.0, _cooldowns[k] - delta)
		if _cooldowns[k] <= 0.0:
			_cooldowns.erase(k)
	# i_frames 倒计时（MVP 恒 0；dodge 启用时由闪避态设值）
	if _i_frames_timer > 0.0:
		_i_frames_timer = max(0.0, _i_frames_timer - delta)
	# BF 被动再生（combat §4.2）：用小数累加器，避免每帧 int(round(分秒值))=0 丢小数。
	_bf_accum += player_combat.regen_bf_passive * delta
	if _bf_accum >= 1.0:
		var add_bf: int = int(floor(_bf_accum))
		_bf_accum -= float(add_bf)
		_add_bf(add_bf)
	# HP 脱战再生（combat §3.1 hp_regen_ooc，仅 alert_level≤1；MVP alert 二值 0/3 → 未交战时）
	if _alert_level <= 1 and _hp < player_combat.hp_max:
		_hp_accum += player_combat.hp_regen_ooc * delta
		if _hp_accum >= 1.0:
			var add_hp: int = int(floor(_hp_accum))
			_hp_accum -= float(add_hp)
			_set_hp(clampi(_hp + add_hp, 0, player_combat.hp_max))
	# 警戒扫描（低频）
	_alert_scan_accum += delta
	if _alert_scan_accum >= _ALERT_SCAN_INTERVAL:
		_alert_scan_accum = 0.0
		_scan_alert()


# ───────────────────────── 伤害公式（combat §4.1，纯函数，可独立单测 · A7） ─────────────────────────

## §4.1：dmg = max(1, round(atk_base · mult_skill · crit_mult · (1−resist) − DEF))，整数 ≥1。
## crit_mult = crit_mult_data if rand()<crit_chance else 1.0。resist ∈ [0,0.8]。
static func compute_damage(atk_base: int, mult_skill: float, crit_chance: float, crit_mult_data: float, resist: float, def_: int) -> int:
	var r: float = clamp(resist, 0.0, 0.8)
	var cm: float = crit_mult_data if randf() < crit_chance else 1.0
	var raw: float = float(atk_base) * mult_skill * cm * (1.0 - r) - float(def_)
	return max(1, int(round(raw)))


# ───────────────────────── 出向伤害（玩家攻方，玩法层传标量；命中回 BF / 击杀钩子由玩法层回报） ─────────────────────────

## 玩家出向伤害（普攻 stage.mult 或 attack 术法 damage.mult_skill）：用玩家 atk_base/crit + 守方 resist/def。
## 守方 resist/def 由玩法层（player.gd）读 enemy.enemy_data 后传入（分层：核心不读玩法节点）。
func compute_outgoing_damage(mult_skill: float, resist: float, def_: int) -> int:
	return compute_damage(player_combat.atk_base, mult_skill, player_combat.crit_chance, player_combat.crit_mult, resist, def_)

## 玩家命中敌人后回报：按 §4.2 命中回战意（regen_bf_on_hit，整数）。即使击杀也奖励主动输出。
func on_player_hit_enemy() -> void:
	_add_bf(player_combat.regen_bf_on_hit)


# ───────────────────────── 入向伤害（敌人攻方 → 玩家 HP；C4 持有 HP 权威） ─────────────────────────

## 敌人攻击命中玩家：以敌人为攻方（atk_base/mult 由玩法层从 enemy 数据传入）按 §4.1 算伤害；
## i_frames 内免疫（MVP dodge 关闭恒不免疫）。**C4 直接修改自己 HP**（权威）+ 发 hp_changed。
## 返回 {dmg:int, knockback_vel:Vector2, dodged:bool}。dmg>0 表示玩家确实掉血（供玩法层判断打断施法）。
func resolve_enemy_hit_on_player(atk_base: int, mult: float, knockback_dir: Vector2, knockback_px: float) -> Dictionary:
	var result: Dictionary = {"dmg": 0, "knockback_vel": Vector2.ZERO, "dodged": false}
	if _downed:
		return result
	if is_player_invulnerable():  # i_frames（combat §4.4；MVP 恒 false）
		result.dodged = true
		return result
	# 敌人无 crit_chance（EnemyData 未含）→ crit_chance=0，crit_mult=1；玩家无 resist 字段 → resist=0（combat §4.1）。
	var dmg: int = compute_damage(atk_base, mult, 0.0, 1.0, 0.0, player_combat.def_base)
	_hp = max(0, _hp - dmg)
	_emit_hp()
	var kbvel: Vector2 = knockback_dir.normalized() * knockback_px * _KNOCKBACK_VEL_SCALE
	result.dmg = dmg
	result.knockback_vel = kbvel
	if _hp <= 0:
		_enter_downed()
	if debug_log:
		print("[CombatSystem] enemy hit player dmg=%d hp=%d/%d kb=%s" % [dmg, _hp, player_combat.hp_max, str(kbvel)])
	return result


# ───────────────────────── 能力释放（combat §2.6 流程） ─────────────────────────

## 释放前置校验（combat §2.6 ②）：ability_id∈S3 解锁集 ∧ BF≥bf_cost ∧ 未冷却 ∧ 未倒地 ∧ 未在施法。
## requires.scene 归 S5 校验（combat §5.4）——S5 未接线，C4 暂不校验 scene，留 TODO(S5)（见 issue comment）。
func can_cast(ability_id: StringName) -> Dictionary:
	var reason: String = ""
	var ok: bool = true
	if _downed:
		ok = false; reason = "downed"
	elif not _unlocked_abilities.has(ability_id):
		# requires.ability 校验归 S4（combat §2.6 / rewrite-causality §3.5）：未解锁则施法失败，不发 verb_executed。
		ok = false; reason = "locked"
	elif _casting_ability != &"":
		ok = false; reason = "already_casting"
	else:
		var ab: AbilityData = get_ability_data(ability_id)
		if ab == null:
			ok = false; reason = "no_data"
		elif _bf < ab.bf_cost:
			ok = false; reason = "no_bf"
		elif _cooldowns.has(ability_id) and _cooldowns[ability_id] > 0.0:
			ok = false; reason = "cooldown"
	return {"ok": ok, "reason": reason}


## 进入前摇（combat §2.6 ③）：标记施法中，**不扣 BF**（前摇可被打断，打断不耗 BF，防双重惩罚，§2.2）。
func begin_cast(ability_id: StringName) -> bool:
	var chk: Dictionary = can_cast(ability_id)
	if not chk.ok:
		if debug_log:
			print("[CombatSystem] begin_cast %s denied: %s" % [ability_id, chk.reason])
		return false
	_casting_ability = ability_id
	return true


## 释放瞬间（combat §2.6 ④）：扣 BF、进冷却、rewrite_proxy 发 verb_executed（**不写 v_i/Δ**，combat §2.9/§5.3）。
## 「释放瞬间不可打断」（combat §2.2）——commit 后施法进入不可打断的释放/后摇。
func commit_cast(ability_id: StringName) -> bool:
	if _casting_ability != ability_id:
		return false
	var ab: AbilityData = get_ability_data(ability_id)
	if ab == null:
		_casting_ability = &""
		return false
	_bf = max(0, _bf - ab.bf_cost)
	_emit_bf()
	_cooldowns[ability_id] = ab.cooldown
	_casting_ability = &""
	# rewrite_proxy：释放即触发改写动词（combat §2.6 ⑥ / §3.2）。target 用 requires_scene（场所语义）；
	# 战斗击杀改写目标走 notify_rewrite_target_killed（target=enemy_id）。S1 收事件后自算 v_i/Δ（C4 不写）。
	if ab.kind == AbilityData.Kind.REWRITE_PROXY and ab.rewrite_proxy_verb != &"":
		var target: StringName = ab.requires_scene  # MVP：S2 当前节点未接线，target 用场所语义占位
		EventBus.verb_executed.emit(ab.rewrite_proxy_verb, target, true)
		if debug_log:
			print("[CombatSystem] rewrite_proxy committed: verb=%s target=%s (C4 不写 v_i/Δ)" % [ab.rewrite_proxy_verb, target])
	return true


## 前摇被打断（combat §2.2/§2.6）：不扣 BF、不进冷却（防双重惩罚）。仅清施法标记。
func interrupt_cast() -> void:
	if _casting_ability != &"":
		if debug_log:
			print("[CombatSystem] cast interrupted (no BF cost): %s" % _casting_ability)
		_casting_ability = &""


## 按 ability_id 加载（缓存）AbilityData（.tres，data/skills/<ability_id>.tres，architecture §6.2）。
func get_ability_data(ability_id: StringName) -> AbilityData:
	if _ability_cache.has(ability_id):
		return _ability_cache[ability_id]
	var path: String = "res://data/skills/%s.tres" % ability_id
	if not ResourceLoader.exists(path):
		push_warning("CombatSystem: ability data 不存在 %s" % path)
		return null
	var ab: AbilityData = load(path) as AbilityData
	if ab != null:
		_ability_cache[ability_id] = ab
	return ab


# ───────────────────────── 击杀改写目标钩子（DAG 硬契约，combat §2.9/§5.3） ─────────────────────────

## 玩法层在敌人 HP≤0 后回报：若该敌人是改写目标（rewrite_verb_id 非空）→ C4 发 verb_executed（→C1/S1）。
## **C4 不写 v_i/Δ**（combat §5.3）。普通敌人（rewrite_verb_id 空）玩法层不调本方法 → 不发 verb_executed（combat §2.9）。
func notify_rewrite_target_killed(verb_id: StringName, target_id: StringName) -> void:
	if verb_id == &"":
		return
	EventBus.verb_executed.emit(verb_id, target_id, true)
	if debug_log:
		print("[CombatSystem] rewrite target killed: verb=%s target=%s (C4 不写 v_i/Δ)" % [verb_id, target_id])


# ───────────────────────── 警戒聚合（combat §2.7，影响改写难度 + 门控脱战再生） ─────────────────────────

## MVP 简化：扫 "enemy" 组，任一存活敌人处于 CHASE/HURT → alert_level=3（交战），否则 0（未察觉）。
## 用鸭子类型读 get_state_name()/is_alive()，**不引用 Enemy 类**（守分层：核心不依赖玩法类）。
## P5-1 敌人 FSM 折叠了 suspicious(1)/detected(2) → 仅 PATROL/CHASE/HURT/DEAD，故 MVP 警戒二值化
## （suspicious/detected 粒度待完整集 FSM；[待确认] 见 issue comment）。
## node_id 暂为空（S2 当前改写节点未接线；待 S2/S5 联合）。
func _scan_alert() -> void:
	var engaged: bool = false
	for e in get_tree().get_nodes_in_group("enemy"):
		if e == null or not is_instance_valid(e):
			continue
		if not (e.has_method("is_alive") and e.has_method("get_state_name")):
			continue
		if not e.is_alive():
			continue
		var s: String = e.get_state_name()
		if s == "CHASE" or s == "HURT":
			engaged = true
			break
	var new_level: int = 3 if engaged else 0
	if new_level == _alert_level:
		return
	_alert_level = new_level
	var mult: float = detection_globals.get_alert_mult_for_level(_alert_level) if detection_globals != null else 1.0
	# architecture §7.2 C4 发出表 / combat §6.1：alert 跨档即发。S1 是否应用 [待联合确认]（combat §7.7①）。
	EventBus.alert_state_changed.emit(&"", _alert_level, mult)
	if debug_log:
		print("[CombatSystem] alert -> %d (mult=%.2f)" % [_alert_level, mult])


# ───────────────────────── 资源池（combat §4.2 / §3.1） ─────────────────────────

func _add_bf(amount: int) -> void:
	if amount == 0:
		return
	_set_bf(clampi(_bf + amount, 0, player_combat.bf_max))

func _set_bf(v: int) -> void:
	if v != _bf:
		_bf = v
		_emit_bf()

func _set_hp(v: int) -> void:
	if v != _hp:
		_hp = v
		_emit_hp()


func _enter_downed() -> void:
	_downed = true
	_casting_ability = &""
	# 失败态表现/重开归 S5 checkpoint（combat §3.1 on_downed / §5.2）；本 issue 仅置态 + 广播 hp=0。
	# TODO(S5): respawn_rule（reload_encounter/nearest_camp），不扣 CP、不删改写进度。
	if debug_log:
		print("[CombatSystem] player downed")


# ───────────────────────── EventBus 接收（S3→S4 能力解锁，combat §6.3） ─────────────────────────

func _on_ability_unlocked(ability_id: StringName) -> void:
	_unlocked_abilities[ability_id] = true
	if debug_log:
		print("[CombatSystem] ability unlocked: %s" % ability_id)


# ───────────────────────── 信号发射（节流：仅整数变化时发） ─────────────────────────

func _emit_hp() -> void:
	if _hp != _last_emitted_hp:
		_last_emitted_hp = _hp
		EventBus.hp_changed.emit(_hp, player_combat.hp_max)

func _emit_bf() -> void:
	if _bf != _last_emitted_bf:
		_last_emitted_bf = _bf
		EventBus.bf_changed.emit(_bf, player_combat.bf_max)


# ───────────────────────── 公共查询（玩法层/测试/调试） ─────────────────────────

func get_hp() -> int:
	return _hp

func get_bf() -> int:
	return _bf

func get_alert_level() -> int:
	return _alert_level

## 玩家战斗配置（数据驱动；玩法层读段值/范围/前摇用）。缺省返回 null 供玩法层判空。
func get_combat_data_safe() -> PlayerCombatData:
	return player_combat

func is_player_downed() -> bool:
	return _downed

## i_frames 查询（combat §4.4；MVP dodge 关闭恒 false；dodge 启用时由闪避态置 _i_frames_timer）。
func is_player_invulnerable() -> bool:
	if player_combat == null or player_combat.dodge == null:
		return false
	if not player_combat.dodge.mvp_enabled:
		return false
	return _i_frames_timer > 0.0

## 测试/调试辅助：注入解锁（绕过 S3；正式流程走 EventBus.ability_unlocked）。
func debug_grant_ability(ability_id: StringName) -> void:
	_unlocked_abilities[ability_id] = true

## 测试/调试辅助：强制 i_frames（仅 dodge.mvp_enabled 时生效；验证 hook）。
func debug_set_i_frames(seconds: float) -> void:
	if player_combat != null and player_combat.dodge != null and player_combat.dodge.mvp_enabled:
		_i_frames_timer = max(0.0, seconds)
