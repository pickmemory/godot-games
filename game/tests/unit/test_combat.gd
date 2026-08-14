extends Node

## tests/unit/test_combat.gd —— 玩家战斗侧最小测试（issue #14 / engineering-lead.md：每个 Story 附测试证据）。
##
## 运行：$GODOT_BIN --headless --path game res://tests/unit/test_combat.tscn
##
## 覆盖（数据驱动 + §4.1 公式 + 连段 FSM + DAG 硬契约 + 资源池）：
##   A. §4.1 伤害公式（纯函数）：基础/倍率/保底1/抗性/暴击。
##   B. compute_outgoing_damage（用 player_combat.tres 数值）。
##   C. 资源池：BF 被动再生；HP 脱战再生 + 交战时门控（alert）。
##   D. 能力释放 §2.6：can_cast 门控（locked/no_bf/cooldown/ok）+ begin/commit/interrupt 的 BF 语义。
##   E. verb_executed DAG 硬契约（issue #14 验收要点 2/§5.3）：
##        - rewrite_proxy(wind) commit → 发 verb_executed(verb_self_borrow_wind, scene_altar, true)；C4 不写 v_i/Δ。
##        - 前摇打断 → 不发 verb、不耗 BF（防双重惩罚，§2.2）。
##        - 未解锁 → 不发 verb。
##        - 普通敌人击杀 → 不发 verb_executed（combat §2.9）。
##        - 改写目标击杀 → 发 verb_executed（combat §5.3）。
##   F. resolve_enemy_hit_on_player：HP 扣减 + hp_changed + hp≤0 倒地。
##   G. 玩家连段 FSM：FREE→ATK1→ATK2→ATK3（派生窗口 cancel_from 接段）。
##   H. 玩家命中盒集成：普攻命中敌人扣血（数据驱动结算）；普通敌人击杀不发 verb。
##   I. 玩家命中盒集成：改写目标敌人击杀发 verb_executed。

const PLAYER_SCENE: PackedScene = preload("res://scenes/actors/player.tscn")
const BANDIT_SCENE: PackedScene = preload("res://scenes/enemies/bandit.tscn")
const WIND_ABILITY: StringName = &"ability_system_magic_wind"
const WIND_VERB: StringName = &"verb_self_borrow_wind"
const WIND_SCENE: StringName = &"scene_altar"

var _passed: int = 0
var _failed: int = 0

# verb_executed 捕获
var _verb_calls: Array = []

# hp_changed 捕获
var _hp_calls: Array = []


func _ready() -> void:
	await _run()
	_summary()
	get_tree().quit(1 if _failed > 0 else 0)


func _run() -> void:
	EventBus.verb_executed.connect(_on_verb_executed)
	EventBus.hp_changed.connect(_on_hp_changed)

	_test_a_damage_formula()
	_test_b_outgoing_damage()
	await _test_c_resource_pool()
	await _test_d_ability_release_semantics()
	await _test_e_verb_dag_contract()
	await _test_f_enemy_hit_player()
	await _test_g_combo_fsm()
	await _test_h_hitbox_normal_kill_no_verb()
	await _test_i_hitbox_rewrite_target_kill_verb()
	await _test_j_attack_signal_dedup()


# ───────────────────────── A. §4.1 伤害公式（纯函数） ─────────────────────────

func _test_a_damage_formula() -> void:
	# crit_chance=0 → cm=1。
	var d1: int = CombatSystem.compute_damage(18, 1.0, 0.0, 1.5, 0.0, 1)
	_check(d1 == 17, "A1 base dmg 18*1-1=17", "got %d" % d1)
	# 倍率 1.4
	var d2: int = CombatSystem.compute_damage(18, 1.4, 0.0, 1.5, 0.0, 2)
	_check(d2 == 23, "A2 mult1.4 dmg round(18*1.4-2)=23", "got %d" % d2)
	# 保底 1
	var d3: int = CombatSystem.compute_damage(5, 1.0, 0.0, 1.5, 0.0, 100)
	_check(d3 == 1, "A3 floor max(1,...) = 1", "got %d" % d3)
	# 抗性 0.5
	var d4: int = CombatSystem.compute_damage(100, 1.0, 0.0, 1.5, 0.5, 0)
	_check(d4 == 50, "A4 resist0.5 dmg round(100*0.5)=50", "got %d" % d4)
	# 暴击（crit_chance=1 → cm=1.5）
	var d5: int = CombatSystem.compute_damage(10, 1.0, 1.0, 1.5, 0.0, 0)
	_check(d5 == 15, "A5 crit dmg round(10*1.5)=15", "got %d" % d5)


# ───────────────────────── B. compute_outgoing_damage（player_combat 数值） ─────────────────────────

func _test_b_outgoing_damage() -> void:
	var cs: CombatSystem = _new_combat_system()
	# player_combat: atk_base=18, crit_chance=0, crit_mult=1.5；敌人 def=1, resist=0 → 17
	var d: int = cs.compute_outgoing_damage(1.0, 0.0, 1)
	_check(d == 17, "B1 outgoing stage1 mult1.0 → 17", "got %d" % d)
	# bandit resist_system_arcane=0.1（术法抗性）；physical resist=0
	var dp: int = cs.compute_outgoing_damage(1.0, 0.0, 1)
	_check(dp == 17, "B2 physical resist=0 → 17", "got %d" % dp)
	cs.queue_free()


# ───────────────────────── C. 资源池（BF 被动再生 + HP 脱战再生 + 交战门控） ─────────────────────────

func _test_c_resource_pool() -> void:
	# C1：BF 被动再生（regen_bf_passive=6/s）——独立实例避免累加器残留
	var cs1: CombatSystem = _new_combat_system()
	cs1._bf = 0
	await _advance_seconds(cs1, 1.0)
	_check(cs1.get_bf() >= 5 and cs1.get_bf() <= 7, "C1 BF passive regen ~6/s", "got %d" % cs1.get_bf())
	cs1.queue_free()

	# C2：HP 脱战再生（hp_regen_ooc=4/s，alert=0）
	var cs2: CombatSystem = _new_combat_system()
	cs2._hp = 90
	await _advance_seconds(cs2, 1.0)
	_check(cs2.get_hp() >= 93 and cs2.get_hp() <= 95, "C2 HP ooc regen ~4/s when not engaged", "got %d" % cs2.get_hp())
	cs2.queue_free()

	# C3：交战门控（注入 CHASE stub → alert=3 → HP 不再生）
	var cs3: CombatSystem = _new_combat_system()
	cs3._hp = 80
	var stub := _StubEnemy.new()
	stub.st = "CHASE"
	stub.add_to_group("enemy")
	add_child(stub)
	await _advance_seconds(cs3, 0.6)  # > alert scan interval 0.2s
	_check(cs3.get_alert_level() == 3, "C3 alert=3 when enemy CHASE", "got %d" % cs3.get_alert_level())
	_check(cs3.get_hp() == 80, "C3 HP NO regen when engaged (alert>1)", "got %d (regen leaked)" % cs3.get_hp())
	stub.queue_free()
	cs3.queue_free()


# ───────────────────────── D. 能力释放 §2.6（can_cast 门控 + BF 语义） ─────────────────────────

func _test_d_ability_release_semantics() -> void:
	var cs: CombatSystem = _new_combat_system()
	cs.debug_grant_ability(WIND_ABILITY)  # 模拟 S3 解锁
	# D1：未解锁 → locked
	cs._unlocked_abilities.clear()
	var r_locked: Dictionary = cs.can_cast(WIND_ABILITY)
	_check(not r_locked.ok and r_locked.reason == "locked", "D1 can_cast locked when not unlocked", "got %s" % r_locked)
	cs.debug_grant_ability(WIND_ABILITY)
	# D2：解锁 + BF 足 → ok
	var r_ok: Dictionary = cs.can_cast(WIND_ABILITY)
	_check(r_ok.ok, "D2 can_cast ok when unlocked+BF", "got %s" % r_ok)
	# D3：BF 不足 → no_bf
	cs._bf = 5  # wind bf_cost=30
	var r_bf: Dictionary = cs.can_cast(WIND_ABILITY)
	_check(not r_bf.ok and r_bf.reason == "no_bf", "D3 can_cast no_bf", "got %s" % r_bf)
	cs._bf = cs.player_combat.bf_max
	# D4：begin → commit → 扣 BF + 进冷却
	var bf_before: int = cs.get_bf()
	_check(cs.begin_cast(WIND_ABILITY), "D4 begin_cast ok", "failed")
	var bf_after_begin: int = cs.get_bf()
	_check(bf_after_begin == bf_before, "D4 begin_cast does NOT deduct BF (前摇不耗)", "bf %d→%d" % [bf_before, bf_after_begin])
	_check(cs.commit_cast(WIND_ABILITY), "D4 commit_cast ok", "failed")
	var bf_after_commit: int = cs.get_bf()
	_check(bf_after_commit == bf_before - 30, "D4 commit deducts bf_cost=30", "bf %d→%d" % [bf_before, bf_after_commit])
	# D5：commit 后进冷却 → cooldown
	var r_cd: Dictionary = cs.can_cast(WIND_ABILITY)
	_check(not r_cd.ok and r_cd.reason == "cooldown", "D5 can_cast cooldown after commit", "got %s" % r_cd)
	cs.queue_free()

	# D6：interrupt 不耗 BF（防双重惩罚）
	var cs2: CombatSystem = _new_combat_system()
	cs2.debug_grant_ability(WIND_ABILITY)
	var bf0: int = cs2.get_bf()
	cs2.begin_cast(WIND_ABILITY)
	cs2.interrupt_cast()
	_check(cs2.get_bf() == bf0, "D6 interrupt_cast does NOT deduct BF", "bf %d→%d" % [bf0, cs2.get_bf()])
	cs2.queue_free()


# ───────────────────────── E. verb_executed DAG 硬契约（§2.9/§5.3） ─────────────────────────

func _test_e_verb_dag_contract() -> void:
	# E1：未解锁 cast → 不发 verb
	_verb_calls.clear()
	var cs: CombatSystem = _new_combat_system()
	# 不解锁，直接 begin（can_cast 会拦；用 begin_cast 返回 false 验证）
	var began: bool = cs.begin_cast(WIND_ABILITY)
	_check(not began and _verb_calls.is_empty(), "E1 locked cast emits NO verb_executed", "began=%s verbs=%d" % [began, _verb_calls.size()])
	cs.queue_free()

	# E2：解锁 + 完整 commit → 发 verb_executed(verb_self_borrow_wind, scene_altar, true)
	_verb_calls.clear()
	var cs2: CombatSystem = _new_combat_system()
	cs2.debug_grant_ability(WIND_ABILITY)
	cs2.begin_cast(WIND_ABILITY)
	cs2.commit_cast(WIND_ABILITY)
	await get_tree().physics_frame  # 让信号分发
	_check(_verb_calls.size() == 1, "E2 wind commit emits 1 verb_executed", "got %d" % _verb_calls.size())
	if not _verb_calls.is_empty():
		var c: Array = _verb_calls[0]
		_check(c[0] == WIND_VERB, "E2 verb_id == verb_self_borrow_wind", "got %s" % c[0])
		_check(c[1] == WIND_SCENE, "E2 target == scene_altar (requires_scene)", "got %s" % c[1])
		_check(c[2] == true, "E2 success == true", "got %s" % c[2])
	cs2.queue_free()

	# E3：前摇打断 → 不发 verb
	_verb_calls.clear()
	var cs3: CombatSystem = _new_combat_system()
	cs3.debug_grant_ability(WIND_ABILITY)
	cs3.begin_cast(WIND_ABILITY)
	cs3.interrupt_cast()
	await get_tree().physics_frame
	_check(_verb_calls.is_empty(), "E3 interrupt emits NO verb_executed", "got %d" % _verb_calls.size())
	cs3.queue_free()

	# E4：notify_rewrite_target_killed 空 verb → 不发；非空 → 发
	_verb_calls.clear()
	var cs4: CombatSystem = _new_combat_system()
	cs4.notify_rewrite_target_killed(&"", &"enemy_x")  # 普通敌人（verb 空）→ 守护：不发
	await get_tree().physics_frame
	_check(_verb_calls.is_empty(), "E4 empty verb → NO emit (普通敌人不发)", "got %d" % _verb_calls.size())
	cs4.notify_rewrite_target_killed(&"verb_kill_test", &"enemy_rewrite")
	await get_tree().physics_frame
	_check(_verb_calls.size() == 1 and _verb_calls[0][0] == &"verb_kill_test", "E4 rewrite verb → emit", "got %s" % str(_verb_calls))
	cs4.queue_free()


# ───────────────────────── F. resolve_enemy_hit_on_player（HP 权威 + hp_changed） ─────────────────────────

func _test_f_enemy_hit_player() -> void:
	_hp_calls.clear()
	var cs: CombatSystem = _new_combat_system()
	var hp0: int = cs.get_hp()
	# 敌人 atk=6, mult=1.0, player def=5 → max(1, round(6*1-5))=1
	var res: Dictionary = cs.resolve_enemy_hit_on_player(6, 1.0, Vector2.LEFT, 24.0)
	_check(int(res.dmg) == 1, "F1 enemy hit dmg = max(1,6-5)=1", "got %d" % int(res.dmg))
	_check(cs.get_hp() == hp0 - 1, "F1 HP decreased by dmg", "hp %d→%d" % [hp0, cs.get_hp()])
	_check(not _hp_calls.is_empty(), "F1 hp_changed emitted", "no signal")
	_check(Vector2(res.knockback_vel).length() > 0.0, "F1 knockback_vel non-zero", "got %s" % res.knockback_vel)
	# 倒地：把 HP 打到 0
	cs._hp = 1
	cs.resolve_enemy_hit_on_player(100, 1.0, Vector2.LEFT, 24.0)
	_check(cs.is_player_downed(), "F2 player downed at hp<=0", "not downed (hp=%d)" % cs.get_hp())
	cs.queue_free()


# ───────────────────────── G. 玩家连段 FSM（FREE→ATK1→ATK2→ATK3） ─────────────────────────

func _test_g_combo_fsm() -> void:
	var player: Player = PLAYER_SCENE.instantiate()
	add_child(player)
	await get_tree().physics_frame  # _ready
	var cs: CombatSystem = _new_combat_system()
	await get_tree().physics_frame
	await get_tree().physics_frame  # 确保 player._ensure_combat_system 命中
	_check(player.get_combat_state_name() == "FREE", "G1 initial state FREE", "got %s" % player.get_combat_state_name())

	# ATK1
	player._try_basic_attack()
	await get_tree().physics_frame
	_check(player.get_combat_state_name() == "ATTACKING", "G2 state ATTACKING after attack", "got %s" % player.get_combat_state_name())
	_check(player.get_combo_stage() == 1, "G2 combo_stage == 1", "got %d" % player.get_combo_stage())

	# 推进到 stage1 派生窗口（cancel_from 0.60·0.30≈0.18s≈11 帧）→ 派生 stage2
	await _advance_frames(13)
	player._try_basic_attack()  # queue stage2（_cancel_armed 已 true）
	# stage1 总 0.30s≈18 帧；再推进 10 帧 → 过 stage1 recover 进 stage2 active 窗口（未结束）
	await _advance_frames(10)
	_check(player.get_combo_stage() == 2, "G3 combo_stage == 2 via cancel window", "got %d (state=%s)" % [player.get_combo_stage(), player.get_combat_state_name()])

	# stage2 派生窗口 → 派生 stage3
	await _advance_frames(8)  # stage2 cancel armed（stage2 起于 ~frame18，armed ~frame29）
	player._try_basic_attack()  # queue stage3
	await _advance_frames(10)  # 过 stage2 recover 进 stage3 active
	_check(player.get_combo_stage() == 3, "G4 combo_stage == 3", "got %d (state=%s)" % [player.get_combo_stage(), player.get_combat_state_name()])

	# stage3 完成无派生 → 回 FREE
	await _advance_frames(25)
	_check(player.get_combat_state_name() == "FREE", "G5 returns FREE after stage3", "got %s" % player.get_combat_state_name())

	cs.queue_free()
	player.queue_free()


# ───────────────────────── H. 命中盒集成：普攻命中 + 普通敌人击杀不发 verb ─────────────────────────

func _test_h_hitbox_normal_kill_no_verb() -> void:
	_verb_calls.clear()
	var cs: CombatSystem = _new_combat_system()
	var player: Player = PLAYER_SCENE.instantiate()
	add_child(player)
	# 敌人置于玩家朝向（默认 DOWN=+y）前方 40px（命中盒范围 56）
	var enemy: Enemy = BANDIT_SCENE.instantiate()
	add_child(enemy)
	await get_tree().physics_frame
	player.global_position = Vector2.ZERO
	enemy.global_position = Vector2(0, 40)
	await get_tree().physics_frame
	await get_tree().physics_frame

	var hp_full: int = enemy.get_hp()
	# ATK1 命中（stage1 mult1.0, bandit def1, resist0 → 17）
	player._try_basic_attack()
	await _advance_frames(20)  # 过 windup+active 命中
	var hp_after_one: int = enemy.get_hp()
	_check(hp_after_one == hp_full - 17, "H1 normal hit deals 17 (data-driven)", "hp %d→%d" % [hp_full, hp_after_one])

	# 击杀普通敌人（bandit hp28 → 需 2 命中）
	while enemy.is_alive():
		player._try_basic_attack()
		await _advance_frames(22)
	_check(not enemy.is_alive(), "H2 normal enemy killed", "still alive hp=%d" % enemy.get_hp())
	await get_tree().physics_frame
	_check(_verb_calls.is_empty(), "H2 normal kill emits NO verb_executed (combat §2.9)", "got %d verbs" % _verb_calls.size())

	cs.queue_free()
	player.queue_free()
	enemy.queue_free()


# ───────────────────────── I. 命中盒集成：改写目标击杀发 verb_executed ─────────────────────────

func _test_i_hitbox_rewrite_target_kill_verb() -> void:
	_verb_calls.clear()
	var cs: CombatSystem = _new_combat_system()
	var player: Player = PLAYER_SCENE.instantiate()
	add_child(player)
	# 用 bandit enemy_data 副本，设低 HP + rewrite_verb_id（改写目标）
	var base_data: EnemyData = load("res://data/enemies/npc_bandit_chibi.tres")
	var data: EnemyData = base_data.duplicate()
	data.hp_max = 5
	data.rewrite_verb_id = &"verb_kill_test"
	var enemy: Enemy = BANDIT_SCENE.instantiate()
	enemy.enemy_data = data  # add_child 前 override → _ready 读到此值
	add_child(enemy)
	await get_tree().physics_frame
	player.global_position = Vector2.ZERO
	enemy.global_position = Vector2(0, 40)
	await get_tree().physics_frame
	await get_tree().physics_frame

	# 一击（17 ≥ 5）即杀 → 改写目标击杀
	player._try_basic_attack()
	await _advance_frames(22)
	_check(not enemy.is_alive(), "I1 rewrite target killed in 1 hit", "alive hp=%d" % enemy.get_hp())
	await get_tree().physics_frame
	_check(_verb_calls.size() == 1, "I2 rewrite-target kill emits 1 verb_executed", "got %d" % _verb_calls.size())
	if not _verb_calls.is_empty():
		_check(_verb_calls[0][0] == &"verb_kill_test", "I2 verb_id == verb_kill_test", "got %s" % _verb_calls[0][0])
		_check(_verb_calls[0][1] == &"npc_bandit_chibi", "I2 target == enemy_id", "got %s" % _verb_calls[0][1])

	cs.queue_free()
	player.queue_free()
	enemy.queue_free()


# ───────────────────────── J. attack_landed 连接去重（防每帧重复连接导致多次伤害） ─────────────────────────

func _test_j_attack_signal_dedup() -> void:
	var cs: CombatSystem = _new_combat_system()
	var player: Player = PLAYER_SCENE.instantiate()
	add_child(player)
	var enemy: Enemy = BANDIT_SCENE.instantiate()
	add_child(enemy)
	await get_tree().physics_frame
	await get_tree().physics_frame
	player.global_position = Vector2.ZERO
	enemy.global_position = Vector2(0, 40)
	# 跨多帧（player._consume_enemy_attack_signals 每帧跑）→ 连接应仅 1 条，不重复
	for i in 6:
		await get_tree().physics_frame
	var conns: Array = enemy.attack_landed.get_connections()
	_check(conns.size() == 1, "J1 exactly 1 attack_landed connection (no dups)", "got %d" % conns.size())
	# 手动 emit 一次 → 玩家 HP 应只扣一次（bandit atk=6 mult=1.0 def=5 → 1 点）
	var hp_before: int = cs.get_hp()
	enemy.attack_landed.emit(player, &"atk_bandit_cleave", Vector2.UP)
	await get_tree().physics_frame
	_check(cs.get_hp() == hp_before - 1, "J2 player takes dmg exactly once per emit", "hp %d→%d" % [hp_before, cs.get_hp()])
	cs.queue_free()
	player.queue_free()
	enemy.queue_free()


# ───────────────────────── 辅助 ─────────────────────────

func _new_combat_system() -> CombatSystem:
	var cs: CombatSystem = CombatSystem.new()
	add_child(cs)
	return cs


func _advance_seconds(node: Node, seconds: float) -> void:
	# 推进物理帧（60fps）以驱动 CombatSystem._physics_process（再生/冷却/扫描）
	var frames: int = int(round(seconds * 60.0))
	for i in frames:
		await get_tree().physics_frame


func _advance_frames(frames: int) -> void:
	for i in frames:
		await get_tree().physics_frame


func _on_verb_executed(verb_id: StringName, target: StringName, success: bool) -> void:
	_verb_calls.append([verb_id, target, success])


func _on_hp_changed(new_hp: int, _max_hp: int) -> void:
	_hp_calls.append(new_hp)


func _check(cond: bool, name: String, detail: String) -> void:
	if cond:
		_passed += 1
		print("[PASS] %s" % name)
	else:
		_failed += 1
		print("[FAIL] %s — %s" % [name, detail])


func _summary() -> void:
	print("========================================")
	print("TEST SUMMARY: pass=%d fail=%d" % [_passed, _failed])
	print("RESULT: %s" % ("ALL PASS" if _failed == 0 else "HAS FAILURES"))
	print("========================================")


# ───────────────────────── 警戒扫描鸭子类型 stub（C3 用） ─────────────────────────

class _StubEnemy extends Node:
	var st: String = "PATROL"
	func is_alive() -> bool:
		return true
	func get_state_name() -> String:
		return st
