extends Node

## tests/unit/test_rewrite_node_chibi.gd —— 赤壁·借东风改写节点端到端编排测试（issue #19 / engineering-lead.md：每个 Story 附测试证据）。
##
## 运行：$GODOT_BIN --headless --path game res://tests/unit/test_rewrite_node_chibi.tscn
##
## 覆盖 RewriteNodeDirector 的 Loop A 编排逻辑（复用 #16/#17/#18 既有系统，不重写）：
##   A. 初始态（EXPLORING + flow 加载 + 线索计数 + intel_cov=0）。
##   B. 线索采集 1（intel_cov 0.25 + intel_updated 发出 + 状态不变）。
##   C. 线索采集 2（intel_cov 0.50）。
##   D. 术士门拒绝（线索 1 < 阈值 2 → 不派发、不授术）。
##   E. 术士门通过（线索 2 ≥ 阈值 → ability_unlocked 发出 + quest.enter_chapter 派发 → 引擎激活 N2 + REWRITE_ACTIVE）。
##   F. 蓝图 intel_cov 门（0.50 < 0.6 → bp_self 拒；采集第 3 条 0.75 ≥ 0.6 → bp_self 通过）。
##   G. 七星坛交互（verb_executed 发出 → 引擎改 v_altar=smashed，DAG §5.3）。
##   H. 确认改写（node_committed → 引擎结算 → node_resolved → 导演 NODE_COMPLETE + QuestSystem N2=已确认 + Δ/CP 正确）。

const FLOW_PATH := "res://data/scenes/rewrite_node_chibi/east_wind_flow.tres"
const CHAPTER_PATH := "res://data/quests/chapters/ch_chibi_war.tres"
const N2_ID := &"n2_east_wind"
const BP_SELF := &"bp_player_self_wind"
const POI_REED := &"poi_wind_reed_observatory"
const POI_FISHER := &"poi_wind_fisherman"
const POI_OLDMAN := &"poi_sky_old_man"
const ABILITY_WIND := &"ability_system_magic_wind"
const VERB_SMASH := &"verb_smash_altar"

var _passed: int = 0
var _failed: int = 0
var _engine: RewriteCausalityEngine
var _quest: QuestSystem
var _director: RewriteNodeDirector
var _intel_updates: Array = []
var _abilities: Array = []
var _verbs: Array = []


func _ready() -> void:
	await _setup()
	await _run()
	_teardown()
	_summary()
	get_tree().quit(1 if _failed > 0 else 0)


func _run() -> void:
	await _test_a_initial()
	await _test_b_collect_one()
	await _test_c_collect_two()
	await _test_d_shaman_reject()
	await _test_e_shaman_accept_dispatch()
	await _test_f_blueprint_intel_gate()
	await _test_g_altar_smash()
	await _test_h_commit_complete()


# ───────────────────────── setup / teardown ─────────────────────────

func _setup() -> void:
	# 核心系统先入树（_ready 接信号 + 加分组），再建导演。
	_engine = RewriteCausalityEngine.new()
	add_child(_engine)
	_quest = QuestSystem.new()
	# chapter_data 留空（_ready 仅接信号，不自动派发——与场景「延迟派发」一致）。
	add_child(_quest)
	await get_tree().process_frame   # 让 _ready 跑完（接 node_resolved/causal_link_propagated/node_vanished + intel_updated）
	_director = RewriteNodeDirector.new()
	add_child(_director)   # _ready: flow_data 为空 → 提前返回（无场景装配）
	_director.debug_init_for_test(load(FLOW_PATH), load(CHAPTER_PATH))
	await get_tree().process_frame
	# 信号探针
	EventBus.intel_updated.connect(_on_intel_updated)
	EventBus.ability_unlocked.connect(_on_ability_unlocked)
	EventBus.verb_executed.connect(_on_verb_executed)


func _teardown() -> void:
	for sig in [EventBus.intel_updated, EventBus.ability_unlocked, EventBus.verb_executed]:
		for c in sig.get_connections():
			if c.callable.get_object() == self:
				sig.disconnect(c.callable)


func _on_intel_updated(cov: float, _new_intels: Array) -> void:
	_intel_updates.append(cov)


func _on_ability_unlocked(ability_id: StringName) -> void:
	_abilities.append(ability_id)


func _on_verb_executed(verb_id: StringName, _target: StringName, _success: bool) -> void:
	_verbs.append(verb_id)


# ───────────────────────── A. 初始态 ─────────────────────────

func _test_a_initial() -> void:
	_check(_director.get_state() == RewriteNodeDirector.State.EXPLORING, "A1 初始态 EXPLORING", "got %s" % _director.get_state_name())
	_check(_director.get_collected_clue_count() == 0, "A2 初始 0 线索", "got %d" % _director.get_collected_clue_count())
	_check(is_equal_approx(_director.get_intel_cov(), 0.0), "A3 初始 intel_cov=0", "got %.2f" % _director.get_intel_cov())
	_check(not _director.is_shaman_triggered(), "A4 术士未触发", "triggered")
	_check(not _director.is_node_complete(), "A5 节点未完成", "complete")
	_check(_engine.get_active_node_id() == &"", "A6 引擎无激活节点", "got %s" % _engine.get_active_node_id())


# ───────────────────────── B. 采集 1 条线索 ─────────────────────────

func _test_b_collect_one() -> void:
	_director._collect_clue(POI_REED)
	await get_tree().process_frame
	_check(_director.get_collected_clue_count() == 1, "B1 采集后 1 条", "got %d" % _director.get_collected_clue_count())
	_check(is_equal_approx(_director.get_intel_cov(), 0.25), "B2 intel_cov=0.25", "got %.2f" % _director.get_intel_cov())
	_check(_intel_updates.size() == 1, "B3 intel_updated 发出 1 次", "got %d" % _intel_updates.size())
	_check(is_equal_approx(float(_intel_updates[0]), 0.25), "B4 intel_updated 载荷=0.25", "got %s" % str(_intel_updates))
	_check(_director.get_state() == RewriteNodeDirector.State.EXPLORING, "B5 状态仍 EXPLORING", "got %s" % _director.get_state_name())


# ───────────────────────── C. 采集 2 条线索 ─────────────────────────

func _test_c_collect_two() -> void:
	_director._collect_clue(POI_FISHER)
	await get_tree().process_frame
	_check(_director.get_collected_clue_count() == 2, "C1 采集后 2 条", "got %d" % _director.get_collected_clue_count())
	_check(is_equal_approx(_director.get_intel_cov(), 0.50), "C2 intel_cov=0.50", "got %.2f" % _director.get_intel_cov())
	_check(_intel_updates.size() == 2, "C3 intel_updated 累计 2 次", "got %d" % _intel_updates.size())


# ───────────────────────── D. 术士门拒绝（1 < 2）─────────────────────────

func _test_d_shaman_reject() -> void:
	# 回退到 1 条线索测拒绝
	_director._collected_clue_ids.clear()
	_director._intel_cov = 0.0
	_director._collect_clue(POI_REED)
	await get_tree().process_frame
	var abilities_before := _abilities.size()
	_director._try_trigger_rewrite()
	await get_tree().process_frame
	_check(not _director.is_shaman_triggered(), "D1 1 条线索 → 术士拒绝（未触发）", "triggered")
	_check(_abilities.size() == abilities_before, "D2 拒绝时不授术（无 ability_unlocked）", "got %d" % _abilities.size())
	_check(_director.get_state() == RewriteNodeDirector.State.EXPLORING, "D3 状态仍 EXPLORING", "got %s" % _director.get_state_name())
	# 恢复到 2 条线索
	_director._collect_clue(POI_FISHER)
	await get_tree().process_frame


# ───────────────────────── E. 术士门通过（2 ≥ 2）→ 派发 ─────────────────────────

func _test_e_shaman_accept_dispatch() -> void:
	_director._try_trigger_rewrite()
	await get_tree().process_frame
	_check(_director.is_shaman_triggered(), "E1 2 条线索 → 术士触发", "not triggered")
	_check(_abilities.has(ABILITY_WIND), "E2 授术 ability_unlocked(ability_system_magic_wind)", "got %s" % str(_abilities))
	_check(_director.get_state() == RewriteNodeDirector.State.REWRITE_ACTIVE, "E3 状态 → REWRITE_ACTIVE", "got %s" % _director.get_state_name())
	_check(_engine.get_active_node_id() == N2_ID, "E4 引擎激活 N2", "got %s" % _engine.get_active_node_id())
	_check(_engine.get_active_node_state() == RewriteCausalityEngine.NodeNumState.REWRITABLE, "E5 引擎态 REWRITABLE", "got %d" % _engine.get_active_node_state())
	_check(_engine.get_working_var(&"v_wind") == &"southeast", "E6 v_wind 初始化=baseline(southeast)", "got %s" % _engine.get_working_var(&"v_wind"))
	_check(_quest.get_node_lifecycle_state(N2_ID) == QuestSystem.LifecycleState.REWRITABLE, "E7 QuestSystem N2=可改写", "got %s" % _quest.get_node_lifecycle_state_name(N2_ID))


# ───────────────────────── F. 蓝图 intel_cov 门 ─────────────────────────

func _test_f_blueprint_intel_gate() -> void:
	# 此时 intel_cov=0.50 < 0.6 → bp_self 拒（engine.select_blueprint，§2.4 门控）
	var r_low: Dictionary = _engine.select_blueprint(N2_ID, BP_SELF)
	_check(not r_low.ok and String(r_low.reason) == "intel_cov_too_low", "F1 intel_cov=0.50 → bp_self 拒(intel_cov_too_low)", "got %s" % str(r_low))
	# 采集第 3 条 → intel_cov=0.75 ≥ 0.6 → bp_self 通过
	_director._collect_clue(POI_OLDMAN)
	await get_tree().process_frame
	_check(is_equal_approx(_director.get_intel_cov(), 0.75), "F2 第 3 条 → intel_cov=0.75", "got %.2f" % _director.get_intel_cov())
	var r_high: Dictionary = _engine.select_blueprint(N2_ID, BP_SELF)
	_check(r_high.ok, "F3 intel_cov=0.75 → bp_self 通过", "got %s" % str(r_high))
	_check(_engine.get_selected_blueprint() == BP_SELF, "F4 引擎 selected_blueprint=bp_self", "got %s" % _engine.get_selected_blueprint())


# ───────────────────────── G. 七星坛交互（verb_executed → v_altar=smashed） ─────────────────────────

func _test_g_altar_smash() -> void:
	_director._smash_altar()
	await get_tree().process_frame
	_check(_verbs.has(VERB_SMASH), "G1 七星坛 → verb_executed(verb_smash_altar)", "got %s" % str(_verbs))
	_check(_engine.get_working_var(&"v_altar") == &"smashed", "G2 引擎应用 v_altar=smashed（DAG §5.3）", "got %s" % _engine.get_working_var(&"v_altar"))
	_check(_engine.get_attempts_used() == 1, "G3 attempts_used=1", "got %d" % _engine.get_attempts_used())


# ───────────────────────── H. 确认改写 → 结算 → 完成 ─────────────────────────

func _test_h_commit_complete() -> void:
	# 玩家确认（RewritePanelView 实际发 node_committed；测试直接 emit 模拟玩家确认）
	EventBus.node_committed.emit(N2_ID)
	await get_tree().process_frame
	_check(_director.is_node_complete(), "H1 node_resolved → 导演 NODE_COMPLETE", "got %s" % _director.get_state_name())
	_check(_quest.get_node_lifecycle_state(N2_ID) == QuestSystem.LifecycleState.CONFIRMED, "H2 QuestSystem N2=已确认（#16 完成回调）", "got %s" % _quest.get_node_lifecycle_state_name(N2_ID))
	var resolved: Dictionary = _engine.get_resolved_node(N2_ID)
	_check(int(resolved.get("delta_node", -1)) == 20, "H3 引擎结算 Δ=20（v_altar smashed, w0.2·d1.0·100）", "got %s" % str(resolved))
	_check(int(resolved.get("cp_earned", -1)) == 92, "H4 引擎结算 CP=92（§4.2 round(120·0.7·1.1)）", "got %s" % str(resolved))
	_check(String(resolved.get("blueprint", "")) == String(BP_SELF), "H5 resolved.blueprint=bp_self", "got %s" % str(resolved))


# ───────────────────────── 辅助 ─────────────────────────

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
