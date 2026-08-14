extends Node

## tests/unit/test_rewrite.gd —— 改写/因果引擎 S1/C1 测试（issue #17 / engineering-lead.md：每个 Story 附测试证据）。
##
## 运行：$GODOT_BIN --headless --path game res://tests/unit/test_rewrite.tscn
##
## 覆盖（rewrite-causality §4 公式 + §5 边缘情况 + §6 信号契约 + §2.5 因果链 + §3.6 存档）：
##   A. §4 公式数值正确性（纯静态函数）：Δ/M/CP/cost_RE/tier/diff 精确值。
##   B. §2.3 节点激活：node_activated → v_i=baseline + RE 重置 + 可改写态。
##   C. §2.7 实时预览：verb_executed → variable_changed(is_preview=true) + deviation_recomputed(is_preview=true)。
##   D. §2.1⑦⑧ 锁定结算（node_committed）：Δ/M/CP/tier 信号组 + node_resolved（用真 N2 数据）。
##   E. §4.2 CP 两段式：cp_awarded 发出、C1 不持余额；§6 信号契约逐条捕获。
##   F. §2.5 因果链：value 链 transform + existence 链 condition 评估（met/unmet）+ node_vanished。
##   G. §5.1 防刷分：max_attempts 封顶 + 自动结算 + CP 仅锁定时一次 + 蓝图锁定不可换。
##   H. §5.2 重大偏差/世界线震荡：critical_deviation_triggered + worldline_shaken + 不双倍 CP。
##   I. §5.3 DAG 一致：verb_executed 是 v_i 改变唯一通道（C1 据 effect.set 自改）。
##   J. §5.4 存档回溯：未锁定 working_vars 可回滚；已锁定不回滚；serialize/deserialize。
##   K. §5.5 蓝图不可达兜底：未选蓝图 M=0 → CP≈0 不崩；选蓝图后 Δ 仍正常算。
##   L. 读档一致性校验 check_save_consistency（C1 resolved == C2 confirmed）。
##   M. §2.4 intel_cov 门控：蓝图 unlock_intel_cov 不达 → select 拒绝。

const N2_ID := &"n2_east_wind"
const N3_ID := &"n3_huarong"
const BP_SELF := &"bp_player_self_wind"
const BP_BASE := &"bp_baseline_keep"
const VERB_SMASH := &"verb_smash_altar"
const VERB_BLOCK := &"verb_block_kongming"
const VERB_SELF_WIND := &"verb_self_borrow_wind"

var _passed: int = 0
var _failed: int = 0

# 信号捕获（S1 发出）
var _blueprint_declared: Array = []
var _variable_changed: Array = []
var _deviation_recomputed: Array = []
var _intent_match: Array = []
var _cp_awarded: Array = []
var _feedback_tier: Array = []
var _critical_deviation: Array = []
var _causal_link: Array = []
var _node_resolved: Array = []
var _node_vanished: Array = []


func _ready() -> void:
	await _run()
	_summary()
	get_tree().quit(1 if _failed > 0 else 0)


func _run() -> void:
	_connect_signals()
	_test_a_formulas()
	await _test_b_node_activation()
	await _test_c_preview_on_verb()
	await _test_d_settle_commit()
	await _test_e_cp_two_segment()
	await _test_f_causal_chain()
	await _test_g_antifarm_max_attempts()
	await _test_h_critical_worldline()
	await _test_i_dag_verb_channel()
	await _test_j_save_state()
	_test_k_blueprint_unreachable_fallback()
	_test_l_consistency_check()
	await _test_m_intel_cov_gate()
	_test_z_real_data_weights()


func _connect_signals() -> void:
	EventBus.blueprint_declared.connect(_on_blueprint_declared)
	EventBus.variable_changed.connect(_on_variable_changed)
	EventBus.deviation_recomputed.connect(_on_deviation_recomputed)
	EventBus.intent_match_computed.connect(_on_intent_match)
	EventBus.cp_awarded.connect(_on_cp_awarded)
	EventBus.feedback_tier.connect(_on_feedback_tier)
	EventBus.critical_deviation_triggered.connect(_on_critical_deviation)
	EventBus.causal_link_propagated.connect(_on_causal_link)
	EventBus.node_resolved.connect(_on_node_resolved)
	EventBus.node_vanished.connect(_on_node_vanished)


# ───────────────────────── A. §4 公式数值正确性（纯静态函数） ─────────────────────────

func _test_a_formulas() -> void:
	# Δ_node = Σ(w·d)·100
	var d1: float = RewriteCausalityEngine.compute_node_deviation([{"w": 0.6, "d": 1.0}, {"w": 0.4, "d": 0.0}])
	_check(is_equal_approx(d1, 60.0), "A1 Δ=(0.6·1+0.4·0)·100=60", "got %.2f" % d1)
	var d2: float = RewriteCausalityEngine.compute_node_deviation([{"w": 0.6, "d": 1.0}, {"w": 0.2, "d": 1.0}, {"w": 0.2, "d": 1.0}])
	_check(is_equal_approx(d2, 100.0), "A2 Δ=100 (clamp at full)", "got %.2f" % d2)
	# d_i enum（用真 v_wind entries：none=1.0, southeast=0.0）
	var vw := load("res://data/variables/v_wind.tres")
	_check(is_equal_approx(RewriteCausalityEngine.compute_var_deviation_enum("none", vw.entries), 1.0), "A3 d(none)=1.0", "got")
	_check(is_equal_approx(RewriteCausalityEngine.compute_var_deviation_enum("southeast", vw.entries), 0.0), "A4 d(southeast)=0.0", "got")
	# d_i numeric = |actual−baseline|/range
	_check(is_equal_approx(RewriteCausalityEngine.compute_var_deviation_numeric(5.0, 0.0, 0.0, 10.0), 0.5), "A5 d_num=5/10=0.5", "got")
	# match enum / numeric
	_check(is_equal_approx(RewriteCausalityEngine.compute_match_enum("a", "a"), 1.0), "A6 match_enum same=1.0", "got")
	_check(is_equal_approx(RewriteCausalityEngine.compute_match_enum("a", "b"), 0.0), "A7 match_enum diff=0.0", "got")
	_check(is_equal_approx(RewriteCausalityEngine.compute_match_numeric(2.0, 8.0, 0.0, 10.0), 0.4), "A8 match_num=1−6/10=0.4", "got")
	# M = Σ(w'·match)
	var m1: float = RewriteCausalityEngine.compute_intent_match([{"w": 0.7, "match": 1.0}, {"w": 0.3, "match": 0.0}])
	_check(is_equal_approx(m1, 0.7), "A9 M=0.7", "got %.2f" % m1)
	# CP_earned = round(CP_node·M·(1+k·min(Δ,Δ_cap)/Δ_cap))
	_check(RewriteCausalityEngine.compute_cp_earned(120, 1.0, 0.0, 0.5, 100.0) == 120, "A10 CP baseline=120", "got")
	_check(RewriteCausalityEngine.compute_cp_earned(120, 1.0, 80.0, 0.5, 100.0) == 168, "A11 CP Δ80=round(120·1.4)=168", "got")
	_check(RewriteCausalityEngine.compute_cp_earned(120, 0.0, 80.0, 0.5, 100.0) == 0, "A12 CP M=0 → 0", "got")
	_check(RewriteCausalityEngine.compute_cp_earned(120, 1.0, 150.0, 0.5, 100.0) == 180, "A13 CP Δ150 cap@100 → round(120·1.5)=180", "got")
	# cost_RE = cost_base·diff_base·(1−intel_cov)·(1−disc)
	_check(RewriteCausalityEngine.compute_verb_cost(40, 1.2, 0.0, 0.0) == 48, "A14 cost=40·1.2=48", "got")
	_check(RewriteCausalityEngine.compute_verb_cost(40, 1.2, 0.5, 0.0) == 24, "A15 cost intel0.5=24", "got")
	_check(RewriteCausalityEngine.compute_verb_cost(40, 1.2, 0.0, 0.5) == 24, "A16 cost disc0.5=24", "got")
	_check(RewriteCausalityEngine.compute_verb_cost(40, 1.2, 1.0, 0.5) == 0, "A17 cost intel1.0·disc0.5=0（§15.2 已知风险，公式照 GDD）", "got")
	_check(RewriteCausalityEngine.compute_verb_cost(40, 1.2, 0.3, 0.7) == 17, "A18 disc 封顶 0.5（0.7→0.5）：cost=round(40·1.2·0.7·0.5)=17（未封顶应为 10）", "got")
	# tier
	_check(RewriteCausalityEngine.compute_feedback_tier(0.0, 20.0, 80.0) == RewriteCausalityEngine.FeedbackTier.MINOR, "A19 tier(0)=minor", "got")
	_check(RewriteCausalityEngine.compute_feedback_tier(20.0, 20.0, 80.0) == RewriteCausalityEngine.FeedbackTier.NOTABLE, "A20 tier(20)=notable", "got")
	_check(RewriteCausalityEngine.compute_feedback_tier(79.9, 20.0, 80.0) == RewriteCausalityEngine.FeedbackTier.NOTABLE, "A21 tier(79.9)=notable", "got")
	_check(RewriteCausalityEngine.compute_feedback_tier(80.0, 20.0, 80.0) == RewriteCausalityEngine.FeedbackTier.CRITICAL, "A22 tier(80)=critical", "got")
	_check(RewriteCausalityEngine.feedback_tier_name(2) == "critical", "A23 tier_name(2)=critical", "got")
	# diff
	_check(is_equal_approx(RewriteCausalityEngine.compute_effective_difficulty(1.2, 0.5), 0.6), "A24 diff=1.2·0.5=0.6", "got")


# ───────────────────────── B. §2.3 节点激活 ─────────────────────────

func _test_b_node_activation() -> void:
	var eng := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	_check(eng.get_active_node_id() == N2_ID, "B1 active node = n2", "got %s" % eng.get_active_node_id())
	_check(eng.get_active_node_state() == RewriteCausalityEngine.NodeNumState.REWRITABLE, "B2 state=REWRITABLE", "got %d" % eng.get_active_node_state())
	# working_vars = baseline（v_wind=southeast / v_altar=intact / v_kong=alive）
	var wv := eng.get_working_vars()
	_check(String(wv[&"v_wind"]) == "southeast", "B3 v_wind baseline=southeast", "got %s" % str(wv.get(&"v_wind")))
	_check(String(wv[&"v_altar"]) == "intact", "B4 v_altar baseline=intact", "got %s" % str(wv.get(&"v_altar")))
	_check(String(wv[&"v_kong"]) == "alive", "B5 v_kong baseline=alive", "got %s" % str(wv.get(&"v_kong")))
	_check(eng.get_re() == 100, "B6 RE reset to re_max=100", "got %d" % eng.get_re())
	eng.queue_free()


# ───────────────────────── C. §2.7 实时预览（verb_executed → variable_changed + deviation_recomputed preview） ─────────────────────────

func _test_c_preview_on_verb() -> void:
	var eng := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	_variable_changed.clear()
	_deviation_recomputed.clear()
	# verb_smash_altar: v_altar intact→smashed
	EventBus.verb_executed.emit(VERB_SMASH, &"scene_altar", true)
	await get_tree().physics_frame
	# variable_changed(is_preview=true)
	var vc := false
	for c in _variable_changed:
		if c[0] == &"v_altar" and c[1] == "intact" and c[2] == "smashed" and c[3] == true:
			vc = true
	_check(vc, "C1 variable_changed(v_altar, intact, smashed, preview=true)", "calls=%s" % str(_variable_changed))
	# deviation_recomputed(is_preview=true) Δ=20（0.2·1.0·100）
	var dr := false
	for c in _deviation_recomputed:
		if c[0] == N2_ID and int(c[1]) == 20 and c[2] == true:
			dr = true
	_check(dr, "C2 deviation_recomputed(n2, 20, preview=true)", "calls=%s" % str(_deviation_recomputed))
	_check(eng.get_attempts_used() == 1, "C3 attempts_used=1", "got %d" % eng.get_attempts_used())
	# CP 未发（预览不结算，§2.7）
	_check(_cp_awarded.is_empty(), "C4 no cp_awarded during preview (§2.7)", "got %s" % str(_cp_awarded))
	eng.queue_free()


# ───────────────────────── D. §2.1⑦⑧ 锁定结算（node_committed） ─────────────────────────

func _test_d_settle_commit() -> void:
	var eng := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	eng.debug_set_intel_cov(0.7)   # 满足 bp_player_self_wind unlock_intel_cov=0.6
	eng.select_blueprint(N2_ID, BP_SELF)
	await get_tree().physics_frame
	EventBus.verb_executed.emit(VERB_SMASH, &"scene_altar", true)   # v_altar=smashed
	await get_tree().physics_frame
	_clear_settle_signals()
	EventBus.node_committed.emit(N2_ID)
	await get_tree().physics_frame
	# 结算：Δ=20, M=0.7（v_wind match1·0.7 + v_altar smashed≠intact match0·0.3）, CP=round(120·0.7·1.1)=92
	_check(_has_deviation(N2_ID, 20, false), "D1 deviation_recomputed(n2,20,preview=false)", "calls=%s" % str(_deviation_recomputed))
	_check(_has_intent(N2_ID, 0.7), "D2 intent_match_computed(n2,0.7)", "calls=%s" % str(_intent_match))
	_check(_has_cp(92, N2_ID), "D3 cp_awarded(92,n2)（§4.2 round(120·0.7·1.1)）", "calls=%s" % str(_cp_awarded))
	_check(_has_tier(N2_ID, RewriteCausalityEngine.FeedbackTier.NOTABLE), "D4 feedback_tier(n2,notable=1)", "calls=%s" % str(_feedback_tier))
	# node_resolved(node_id, final_vars, delta_node=20, cp_earned=92)；捕获为 [node_id, delta, cp]
	var nr := false
	for c in _node_resolved:
		if c[0] == N2_ID and int(c[1]) == 20 and int(c[2]) == 92:
			nr = true
	_check(nr, "D5 node_resolved(n2, final_vars, 20, 92)", "calls=%s" % str(_node_resolved))
	_check(eng.is_node_resolved(N2_ID), "D6 n2 in resolved_nodes", "got false")
	eng.queue_free()


# ───────────────────────── E. §4.2 CP 两段式（cp_awarded 发出，C1 不持余额） ─────────────────────────

func _test_e_cp_two_segment() -> void:
	var eng := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	eng.debug_set_intel_cov(0.7)
	eng.select_blueprint(N2_ID, BP_SELF)
	await get_tree().physics_frame
	_cp_awarded.clear()
	EventBus.verb_executed.emit(VERB_SELF_WIND, &"scene_altar", true)   # v_wind=southeast(=baseline, Δ=0)
	await get_tree().physics_frame
	EventBus.node_committed.emit(N2_ID)
	await get_tree().physics_frame
	# Δ=0（v_wind=southeast=baseline）, M=1.0（v_wind match1·0.7 + v_altar intact match1·0.3）, CP=120
	var cp := false
	for c in _cp_awarded:
		if int(c[0]) == 120 and c[1] == N2_ID:
			cp = true
	_check(cp, "E1 cp_awarded(120) baseline-tier（M=1,Δ=0）", "calls=%s" % str(_cp_awarded))
	# C1 无 get_cp_balance 方法（CP 账户归 S3，两段式）——验证 C1 不暴露余额 API
	_check(not eng.has_method("get_cp_balance"), "E2 C1 无 CP 余额 API（账户归 S3，两段式）", "C1 暴露了余额 API！违规")
	eng.queue_free()


# ───────────────────────── F. §2.5 因果链（value transform + existence condition） ─────────────────────────

func _test_f_causal_chain() -> void:
	# F1-F2: v_wind=southeast → fire_power=high → existence met（N3 派发，无 vanish）
	var eng := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	eng.debug_set_intel_cov(0.7)
	eng.select_blueprint(N2_ID, BP_SELF)
	await get_tree().physics_frame
	EventBus.verb_executed.emit(VERB_SELF_WIND, &"scene_altar", true)   # v_wind=southeast
	await get_tree().physics_frame
	_causal_link.clear()
	_node_vanished.clear()
	EventBus.node_committed.emit(N2_ID)
	await get_tree().physics_frame
	# value 链：fire_power=high
	var vlink := false
	for c in _causal_link:
		if c[0] == &"link_wind_to_n3" and c[2] == "high":
			vlink = true
	_check(vlink, "F1 value link resolved fire_power=high", "calls=%s" % str(_causal_link))
	# existence 链：met
	var elink := false
	for c in _causal_link:
		if c[0] == &"link_fire_power_to_n3_existence" and c[2] == "met":
			elink = true
	_check(elink, "F2 existence link → met（fire_power==high）", "calls=%s" % str(_causal_link))
	_check(not _node_vanished.has(N3_ID) and _node_vanished.is_empty(), "F3 no node_vanished (existence met)", "calls=%s" % str(_node_vanished))
	eng.queue_free()

	# F4-F5: v_wind=none → fire_power=none → existence unmet → node_vanished(N3)
	var eng2 := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	eng2.select_blueprint(N2_ID, BP_BASE)   # unlock_intel_cov=0，无需情报
	await get_tree().physics_frame
	EventBus.verb_executed.emit(VERB_BLOCK, &"enemy_kongming", true)   # v_kong=dead, v_wind=none
	await get_tree().physics_frame
	_causal_link.clear()
	_node_vanished.clear()
	EventBus.node_committed.emit(N2_ID)
	await get_tree().physics_frame
	var vlink2 := false
	for c in _causal_link:
		if c[0] == &"link_wind_to_n3" and c[2] == "none":
			vlink2 = true
	_check(vlink2, "F4 value link resolved fire_power=none (v_wind=none)", "calls=%s" % str(_causal_link))
	var elink2 := false
	for c in _causal_link:
		if c[0] == &"link_fire_power_to_n3_existence" and c[2] == "unmet":
			elink2 = true
	_check(elink2, "F5 existence link → unmet（fire_power==high 不成立）", "calls=%s" % str(_causal_link))
	var vanished := false
	for c in _node_vanished:
		if c[0] == N3_ID:
			vanished = true
	_check(vanished, "F6 node_vanished(n3) on existence unmet", "calls=%s" % str(_node_vanished))
	eng2.queue_free()


# ───────────────────────── G. §5.1 防刷分（max_attempts + 自动结算 + 蓝图锁定） ─────────────────────────

func _test_g_antifarm_max_attempts() -> void:
	var eng := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	eng.debug_set_intel_cov(0.7)
	var r1 := eng.select_blueprint(N2_ID, BP_SELF)
	_check(r1.ok, "G1 select bp_self ok", "got %s" % r1)
	# §5.1 蓝图锁定：换蓝图被拒
	var r2 := eng.select_blueprint(N2_ID, BP_BASE)
	_check(not r2.ok and r2.reason == "blueprint_locked", "G2 blueprint 不可换（§5.1）", "got %s" % r2)
	# CP 仅锁定时结算：改写期间不发 cp_awarded
	_cp_awarded.clear()
	_node_resolved.clear()
	EventBus.verb_executed.emit(VERB_SMASH, &"scene_altar", true)   # attempt 1
	await get_tree().physics_frame
	_check(_cp_awarded.is_empty(), "G3 改写期间不发 cp_awarded（仅锁定结算）", "got %s" % str(_cp_awarded))
	EventBus.verb_executed.emit(VERB_SELF_WIND, &"scene_altar", true)   # attempt 2
	await get_tree().physics_frame
	_check(_cp_awarded.is_empty(), "G4 第2次改写仍不发 cp", "got %s" % str(_cp_awarded))
	# 第3次 verb → max_attempts=3 达到 → 自动结算
	EventBus.verb_executed.emit(VERB_BLOCK, &"enemy_kongming", true)   # attempt 3 → auto-settle
	await get_tree().physics_frame
	_check(not _node_resolved.is_empty(), "G5 第3次 verb(max_attempts) → 自动结算 node_resolved", "calls=%s" % str(_node_resolved))
	# CP 仅结算一次（§5.1）
	var cp_count := _cp_awarded.size()
	await get_tree().physics_frame
	_check(_cp_awarded.size() == cp_count, "G6 CP 仅结算一次（无重复）", "%d→%d" % [cp_count, _cp_awarded.size()])
	# 已确认后再发 verb → 忽略（§5.3 防悬挂）
	var nr_before := _node_resolved.size()
	EventBus.verb_executed.emit(VERB_SMASH, &"scene_altar", true)
	await get_tree().physics_frame
	_check(_node_resolved.size() == nr_before, "G7 已确认节点 verb_executed 被忽略", "%d→%d" % [nr_before, _node_resolved.size()])
	eng.queue_free()


# ───────────────────────── H. §5.2 重大偏差/世界线震荡（不双倍 CP） ─────────────────────────

func _test_h_critical_worldline() -> void:
	var eng := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	eng.select_blueprint(N2_ID, BP_BASE)
	await get_tree().physics_frame
	# verb_block_kongming: v_wind=none(d1.0·w0.6) + v_kong=dead(d1.0·w0.2) → Δ=80=critical
	EventBus.verb_executed.emit(VERB_BLOCK, &"enemy_kongming", true)
	await get_tree().physics_frame
	_critical_deviation.clear()
	_clear_settle_signals()
	EventBus.node_committed.emit(N2_ID)
	await get_tree().physics_frame
	# critical_deviation_triggered(n2, 80)
	var crit := false
	for c in _critical_deviation:
		if c[0] == N2_ID and int(c[1]) == 80:
			crit = true
	_check(crit, "H1 critical_deviation_triggered(n2,80)", "calls=%s" % str(_critical_deviation))
	_check(eng.is_worldline_shaken(), "H2 worldline_shaken=true", "got false")
	_check(eng.get_shake_count() == 1, "H3 shake_count=1", "got %d" % eng.get_shake_count())
	# tier=critical
	_check(_has_tier(N2_ID, RewriteCausalityEngine.FeedbackTier.CRITICAL), "H4 feedback_tier=critical", "calls=%s" % str(_feedback_tier))
	# 不双倍 CP：M=0.33（v_altar match1·0.33, wind/kong match0）, Δ=80 → CP=round(120·0.33·1.4)=55（非双倍）
	var cp := false
	for c in _cp_awarded:
		if int(c[0]) == 55:
			cp = true
	_check(cp, "H5 CP=55（§4.2 公式，不双倍；M≈0.33·Δ80 加成）", "calls=%s" % str(_cp_awarded))
	eng.queue_free()


# ───────────────────────── I. §5.3 DAG 一致（verb_executed 是 v_i 改变唯一通道） ─────────────────────────

func _test_i_dag_verb_channel() -> void:
	var eng := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	# verb_executed success=false → 不改 v_i（§2.1⑤ Loop B 失败可重试）
	_variable_changed.clear()
	EventBus.verb_executed.emit(VERB_SMASH, &"scene_altar", false)
	await get_tree().physics_frame
	_check(_variable_changed.is_empty(), "I1 verb failure 不改 v_i（§2.1⑤）", "got %s" % str(_variable_changed))
	_check(String(eng.get_working_var(&"v_altar")) == "intact", "I2 v_altar 仍 intact（失败不改）", "got %s" % eng.get_working_var(&"v_altar"))
	# 非本节点动词 → 忽略
	EventBus.verb_executed.emit(&"verb_not_in_node", &"x", true)
	await get_tree().physics_frame
	_check(eng.get_attempts_used() == 0, "I3 非本节点 verb 被忽略（不计 attempts）", "got %d" % eng.get_attempts_used())
	# C1 持有 v_i 真值（get_working_var 唯一来源）；无外部 set_working_var 方法（DAG：S4/S5 不直写）
	_check(not eng.has_method("set_working_var"), "I4 C1 无 set_working_var（S4/S5 不直写 v_i，§5.3 DAG）", "C1 暴露了 v_i 写 API！违规")
	eng.queue_free()


# ───────────────────────── J. §5.4 存档回溯（serialize/deserialize） ─────────────────────────

func _test_j_save_state() -> void:
	# J1: 未锁定 working_vars 可回滚（序列化未锁定快照）
	var eng := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	eng.debug_set_intel_cov(0.7)
	eng.select_blueprint(N2_ID, BP_SELF)
	await get_tree().physics_frame
	EventBus.verb_executed.emit(VERB_SMASH, &"scene_altar", true)   # v_altar=smashed, 未锁定
	await get_tree().physics_frame
	var snap := eng.serialize()
	_check(snap.schema == "rewrite_engine.v1", "J1 serialize schema", "got %s" % str(snap.get("schema")))
	var unsnap: Dictionary = snap.unresolved_node_snapshot
	_check(not unsnap.is_empty(), "J2 unresolved_node_snapshot 非空（未锁定）", "empty")
	_check(String(unsnap.working_vars.get("v_altar")) == "smashed", "J3 snapshot v_altar=smashed", "got %s" % str(unsnap.working_vars.get("v_altar")))
	_check(int(unsnap.attempts_used) == 1, "J4 snapshot attempts=1", "got %s" % str(unsnap.attempts_used))
	# 反序列化到新实例 → 恢复执行中态（不结算 Δ/CP，§5.4）
	var eng2 := _new_engine()
	eng2.deserialize(snap)
	_check(eng2.get_active_node_id() == N2_ID, "J5 deserialize 恢复 active=n2", "got %s" % eng2.get_active_node_id())
	_check(eng2.get_active_node_state() == RewriteCausalityEngine.NodeNumState.EXECUTING, "J6 恢复 EXECUTING 态（未锁定回滚）", "got %d" % eng2.get_active_node_state())
	_check(String(eng2.get_working_var(&"v_altar")) == "smashed", "J7 恢复 working_vars v_altar=smashed", "got %s" % eng2.get_working_var(&"v_altar"))
	eng.queue_free()
	eng2.queue_free()

	# J8: 已锁定 resolved_nodes 不回滚（序列化 resolved）
	var eng3 := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	eng3.select_blueprint(N2_ID, BP_BASE)
	await get_tree().physics_frame
	EventBus.verb_executed.emit(VERB_SMASH, &"scene_altar", true)
	await get_tree().physics_frame
	EventBus.node_committed.emit(N2_ID)
	await get_tree().physics_frame
	var snap2 := eng3.serialize()
	_check(not snap2.resolved_nodes.is_empty(), "J8 resolved_nodes 非空（已锁定）", "empty")
	_check(snap2.unresolved_node_snapshot.is_empty(), "J9 resolved 后 unresolved 快照空", "got %s" % str(snap2.unresolved_node_snapshot))
	eng3.queue_free()


# ───────────────────────── K. §5.5 蓝图不可达兜底（M=0 → CP≈0 不崩） ─────────────────────────

func _test_k_blueprint_unreachable_fallback() -> void:
	var eng := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	# 不选蓝图 → M=0
	EventBus.verb_executed.emit(VERB_SMASH, &"scene_altar", true)
	await get_tree().physics_frame
	_clear_settle_signals()
	# 不应崩；锁定 → M=0, CP=0（§5.5 兜底）
	EventBus.node_committed.emit(N2_ID)
	await get_tree().physics_frame
	_check(_has_intent(N2_ID, 0.0), "K1 未选蓝图 → M=0", "calls=%s" % str(_intent_match))
	_check(_has_cp(0, N2_ID), "K2 M=0 → CP_earned≈0（不崩，§5.5）", "calls=%s" % str(_cp_awarded))
	# node_resolved 仍发出（不卡流程，§5.5）
	_check(not _node_resolved.is_empty(), "K3 node_resolved 仍发出（不卡流程）", "empty")
	eng.queue_free()


# ───────────────────────── L. 读档一致性校验 check_save_consistency ─────────────────────────

func _test_l_consistency_check() -> void:
	# 一致：C1 resolved={n2}, C2 confirmed={n2}
	var rw_ok: Dictionary = {"resolved_nodes": {"n2_east_wind": {}}}
	var qs_ok: Dictionary = {"node_lifecycle_ledger": {"n2_east_wind": {"state": 3}}}   # CONFIRMED=3
	var r1 := RewriteCausalityEngine.check_save_consistency(rw_ok, qs_ok)
	_check(r1.ok, "L1 一致 → ok", "got %s" % r1)
	# 不一致：C1 resolved={n2}, C2 confirmed={n3}
	var rw_bad: Dictionary = {"resolved_nodes": {"n2_east_wind": {}}}
	var qs_bad: Dictionary = {"node_lifecycle_ledger": {"n3_huarong": {"state": 3}}}
	var r2 := RewriteCausalityEngine.check_save_consistency(rw_bad, qs_bad)
	_check(not r2.ok, "L2 不一致 → fail", "got %s" % r2)
	_check(not (r2.errors as Array).is_empty(), "L3 报错信息非空", "got %s" % str(r2.errors))


# ───────────────────────── M. §2.4 intel_cov 门控 ─────────────────────────

func _test_m_intel_cov_gate() -> void:
	var eng := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	# intel_cov=0 < bp_player_self_wind unlock_intel_cov=0.6 → 拒绝
	eng.debug_set_intel_cov(0.0)
	var r1 := eng.select_blueprint(N2_ID, BP_SELF)
	_check(not r1.ok and r1.reason == "intel_cov_too_low", "M1 intel_cov=0 → bp_self 拒绝（§2.4 门控）", "got %s" % r1)
	# intel_cov=0.6 → 允许
	eng.debug_set_intel_cov(0.6)
	var r2 := eng.select_blueprint(N2_ID, BP_SELF)
	_check(r2.ok, "M2 intel_cov=0.6 → bp_self 允许", "got %s" % r2)
	# bp_baseline_keep unlock_intel_cov=0 → 总是允许
	var eng2 := _new_engine()
	EventBus.node_activated.emit(N2_ID)
	await get_tree().physics_frame
	var r3 := eng2.select_blueprint(N2_ID, BP_BASE)
	_check(r3.ok, "M3 bp_baseline_keep（unlock=0）总允许", "got %s" % r3)
	eng.queue_free()
	eng2.queue_free()


# ───────────────────────── Z. 真数据校验（n2 Σw=1.0，三变量 baseline d=0） ─────────────────────────

func _test_z_real_data_weights() -> void:
	var nd := load("res://data/nodes/n2_east_wind.tres") as RewriteNodeData
	_check(is_equal_approx(nd.sum_weights(), 1.0), "Z1 n2 Σw=1.0（§4.1 归一化）", "got %.3f" % nd.sum_weights())
	_check(nd.delta_critical == 80.0, "Z2 n2 delta_critical=80", "got %s" % nd.delta_critical)
	_check(nd.cp_node == 120, "Z3 n2 cp_node=120", "got %s" % nd.cp_node)
	_check(nd.max_attempts == 3, "Z4 n2 max_attempts=3", "got %s" % nd.max_attempts)
	for vid in [&"v_wind", &"v_altar", &"v_kong"]:
		var vd := load("res://data/variables/%s.tres" % vid) as RewriteVariableData
		_check(is_equal_approx(vd.get_deviation_for(String(vd.baseline)), 0.0), "Z5 %s baseline d=0" % vid, "got %s" % vd.get_deviation_for(String(vd.baseline)))


# ───────────────────────── 辅助 ─────────────────────────

func _new_engine() -> RewriteCausalityEngine:
	var eng := RewriteCausalityEngine.new()
	add_child(eng)   # _ready → connect + load causal_links
	return eng

func _clear_settle_signals() -> void:
	_deviation_recomputed.clear()
	_intent_match.clear()
	_cp_awarded.clear()
	_feedback_tier.clear()
	_critical_deviation.clear()
	_node_resolved.clear()

func _has_deviation(node_id: StringName, delta: int, preview: bool) -> bool:
	for c in _deviation_recomputed:
		if c[0] == node_id and int(c[1]) == delta and c[2] == preview:
			return true
	return false

func _has_intent(node_id: StringName, m: float) -> bool:
	for c in _intent_match:
		if c[0] == node_id and is_equal_approx(float(c[1]), m):
			return true
	return false

func _has_cp(amount: int, node_id: StringName) -> bool:
	for c in _cp_awarded:
		if int(c[0]) == amount and c[1] == node_id:
			return true
	return false

func _has_tier(node_id: StringName, tier: int) -> bool:
	for c in _feedback_tier:
		if c[0] == node_id and int(c[1]) == tier:
			return true
	return false


func _on_blueprint_declared(node_id: StringName, bp_id: StringName) -> void:
	_blueprint_declared.append([node_id, bp_id])
func _on_variable_changed(var_id: StringName, old_v: String, new_v: String, preview: bool) -> void:
	_variable_changed.append([var_id, old_v, new_v, preview])
func _on_deviation_recomputed(node_id: StringName, delta_node: int, preview: bool) -> void:
	_deviation_recomputed.append([node_id, delta_node, preview])
func _on_intent_match(node_id: StringName, m: float) -> void:
	_intent_match.append([node_id, m])
func _on_cp_awarded(amount: int, node_id: StringName, _reason: String) -> void:
	_cp_awarded.append([amount, node_id])
func _on_feedback_tier(node_id: StringName, tier: int) -> void:
	_feedback_tier.append([node_id, tier])
func _on_critical_deviation(node_id: StringName, delta_node: int) -> void:
	_critical_deviation.append([node_id, delta_node])
func _on_causal_link(link_id: StringName, source: StringName, value: String, target: StringName) -> void:
	_causal_link.append([link_id, source, value, target])
func _on_node_resolved(node_id: StringName, _fv: Dictionary, delta_node: int, cp_earned: int) -> void:
	_node_resolved.append([node_id, delta_node, cp_earned])
func _on_node_vanished(node_id: StringName) -> void:
	_node_vanished.append([node_id])


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
