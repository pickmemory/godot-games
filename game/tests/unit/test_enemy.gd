extends Node

## tests/unit/test_enemy.gd —— 敌人原型最小测试（issue #13 / engineering-lead.md：每个 Story 附测试证据）。
##
## 运行：$GODOT_BIN --headless --path game res://tests/unit/test_enemy.tscn
##
## 覆盖（数据驱动 + FSM 三态 + 感知）：
##   1. 出生态 = PATROL；hp == enemy_data.hp_max（数据驱动）；enemy_id 来自 .tres。
##   2. take_hit → HURT + hp 扣减；hurt_dur 后回 PATROL。
##   3. take_hit 至 hp≤0 → DEAD + died 信号。
##   4. 玩家进入视野锥（无遮挡）→ PATROL→CHASE（combat §2.7 sight_meter 累积）。
##
## 不测：攻击命中（attack_landed）依赖物理重叠时序，留 P5-2 集成测；verb_executed 普通敌人不发（combat §2.9）。

const BANDIT_SCENE: PackedScene = preload("res://scenes/enemies/bandit.tscn")

var _passed: int = 0
var _failed: int = 0
var _died_flag: bool = false
var _died_id: StringName = &""


func _ready() -> void:
	await _run()
	_summary()
	get_tree().quit(1 if _failed > 0 else 0)


func _run() -> void:
	# ── 测试 1：出生态 + 数据驱动 ──
	var e: Enemy = BANDIT_SCENE.instantiate()
	add_child(e)
	_check(e.get_state_name() == "PATROL", "T1 initial state == PATROL", "got %s" % e.get_state_name())
	_check(e.get_hp() == e.enemy_data.hp_max, "T1 hp == hp_max(%d)" % e.enemy_data.hp_max, "got %d" % e.get_hp())
	_check(e.enemy_data.enemy_id == &"npc_bandit_chibi", "T1 enemy_id from .tres", "got %s" % e.enemy_data.enemy_id)
	_check(e.enemy_data.hp_max == 28, "T1 hp_max 数据驱动值 28", "got %d" % e.enemy_data.hp_max)

	# ── 测试 2：受击 → HURT ──
	e.take_hit(10, Vector2.LEFT)
	_check(e.get_state_name() == "HURT", "T2 state == HURT after take_hit", "got %s" % e.get_state_name())
	_check(e.get_hp() == 18, "T2 hp == 18 (28-10)", "got %d" % e.get_hp())
	await _advance(60)  # > hurt_dur(0.4s ≈ 24 帧)
	_check(e.get_state_name() == "PATROL", "T2 returns to PATROL after hurt_dur", "got %s" % e.get_state_name())

	# ── 测试 3：击杀 → DEAD + died 信号 ──
	e.died.connect(_on_died)
	e.take_hit(18, Vector2.LEFT)  # 18-18 = 0
	_check(e.get_state_name() == "DEAD", "T3 state == DEAD at hp<=0", "got %s" % e.get_state_name())
	_check(_died_flag, "T3 died signal emitted", "no signal")
	_check(_died_id == &"npc_bandit_chibi", "T3 died carries enemy_id", "got %s" % _died_id)
	e.queue_free()

	# ── 测试 4：感知 → PATROL→CHASE（视野锥）──
	_died_flag = false
	var e2: Enemy = BANDIT_SCENE.instantiate()
	add_child(e2)
	# 假玩家：CharacterBody2D 入组 "player"，置于敌人朝向（DOWN=+y）的视野锥内。
	var fake_player: CharacterBody2D = CharacterBody2D.new()
	fake_player.add_to_group("player")
	fake_player.global_position = e2.global_position + Vector2(0, 100)  # 100px < view_radius 256，正前方
	add_child(fake_player)
	var became_chase: bool = false
	for i in 150:  # sight_gain 1.5/s → ~0.67s ≈ 40 帧达 1.0
		await get_tree().physics_frame
		if e2.get_state_name() == "CHASE":
			became_chase = true
			break
	_check(became_chase, "T4 PATROL->CHASE when player in view cone", "stayed %s (meter=%.2f)" % [e2.get_state_name(), 0.0])
	e2.queue_free()
	fake_player.queue_free()

	# ── 测试 5：遭遇生成器集成（绕开 #10 player 缺陷，最小世界容器）──
	var layer := Node2D.new()
	layer.name = &"CharsLayer"
	add_child(layer)
	var spawner := EncounterSpawner.new()
	spawner.name = &"Spawner"
	spawner.enemy_scene = BANDIT_SCENE
	spawner.encounter_id = &"enc_test"
	spawner.spawn_parent = ^"../CharsLayer"
	var marker := Marker2D.new()
	marker.position = Vector2(50, 50)
	spawner.add_child(marker)
	add_child(spawner)  # _ready → _spawn 实例化敌人到 layer
	await get_tree().physics_frame
	var spawned: Array = layer.get_children().filter(func(c): return c is Enemy)
	_check(spawned.size() == 1, "T5 spawner instantiates 1 enemy at marker", "got %d" % spawned.size())
	if spawned.size() == 1:
		var enc_cleared := [false]
		var on_cleared := func(_eid: StringName) -> void: enc_cleared[0] = true
		EventBus.encounter_cleared.connect(on_cleared)
		var se: Enemy = spawned[0]
		_check(se.get_state_name() == "PATROL", "T5 spawned enemy initial PATROL", "got %s" % se.get_state_name())
		se.take_hit(se.get_hp(), Vector2.LEFT)  # 全血一击杀
		await get_tree().physics_frame
		_check(enc_cleared[0], "T5 encounter_cleared emitted on all-dead", "not emitted")
		EventBus.encounter_cleared.disconnect(on_cleared)
	spawner.queue_free()
	layer.queue_free()


func _on_died(enemy_id: StringName) -> void:
	_died_flag = true
	_died_id = enemy_id


func _advance(frames: int) -> void:
	for i in frames:
		await get_tree().physics_frame


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
