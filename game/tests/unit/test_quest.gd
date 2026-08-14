extends Node

## tests/unit/test_quest.gd —— 主线任务系统 S2/C2 测试（issue #16 / engineering-lead.md：每个 Story 附测试证据）。
##
## 运行：$GODOT_BIN --headless --path game res://tests/unit/test_quest.tscn
##
## 覆盖（mainline-quest §2.1 状态机 / §4.2 can_dispatch / §4.3 P_ch / §2.3 existence 两段式 / §6 信号契约 / 存档）：
##   A. 5 态生命周期状态机：未激活→可改写→执行中→已确认；→已消失（§2.1）。
##   B. can_dispatch §4.2 各分支：prereq_unconfirmed / existence_unmet / t_dispatch_not_yet / chapter_not_entered / ok。
##   C. P_ch §4.3：MVP「章节进入→派 N2→resolve→进度更新」流程；权重加权；只计已确认。
##   D. existence false → 消失决策（causal_link_propagated 驱动，§2.3 ④b）；node_vanished 直驱。
##   E. existence true → 派发决策（causal_link_propagated 驱动，§2.3 ④a）。
##   F. 信号契约：node_activated(S2→S1)、quest_objective_updated(S2→S3)、quest_target_scene_set(S2→S5)、
##      quest_dispatch_voiced(S2→X1)、quest_progress_updated(S2→S3)、quest_reward_declared(S2→S3)、
##      quest_node_vanished_voiced(S2→X1/S3/S5)、node_committed(S2→S1)。
##   G. 存档态契约 serialize/deserialize（§3.3）。
##   H. boot 数据校验 validate_chapter：Σw=1.0 / mvp_subset 引用合法。

const CHAPTER_PATH := "res://data/quests/chapters/ch_chibi_war.tres"
const N2_ID := &"n2_east_wind"
const N1_ID := &"n1_chain_scheme"
const N3_ID := &"n3_huarong"

var _passed: int = 0
var _failed: int = 0

# 信号捕获
var _node_activated: Array = []
var _quest_objective: Array = []
var _quest_target_scene: Array = []
var _quest_dispatch_voiced: Array = []
var _quest_progress: Array = []
var _quest_reward: Array = []
var _quest_vanished_voiced: Array = []
var _node_committed: Array = []


func _ready() -> void:
	await _run()
	_summary()
	get_tree().quit(1 if _failed > 0 else 0)


func _run() -> void:
	# 连接 S2 发出的信号（捕获）
	EventBus.node_activated.connect(_on_node_activated)
	EventBus.quest_objective_updated.connect(_on_quest_objective)
	EventBus.quest_target_scene_set.connect(_on_quest_target_scene)
	EventBus.quest_dispatch_voiced.connect(_on_quest_dispatch_voiced)
	EventBus.quest_progress_updated.connect(_on_quest_progress)
	EventBus.quest_reward_declared.connect(_on_quest_reward)
	EventBus.quest_node_vanished_voiced.connect(_on_quest_vanished_voiced)
	EventBus.node_committed.connect(_on_node_committed)

	_test_h_data_validation()
	await _test_a_lifecycle_state_machine()
	await _test_b_can_dispatch_branches()
	await _test_c_mvp_flow_and_progress()
	await _test_d_existence_false_vanish()
	await _test_e_existence_true_dispatch()
	await _test_f_signal_contract_on_dispatch()
	await _test_g_save_state_contract()


# ───────────────────────── H. boot 数据校验（validate_chapter） ─────────────────────────

func _test_h_data_validation() -> void:
	var chap: ChapterData = load(CHAPTER_PATH)
	# H1：合法章节数据 Σw=1.0，mvp_subset 合法
	var vr: Dictionary = QuestSystem.new().validate_chapter(chap)
	_check(vr.ok, "H1 ch_chibi_war validate ok (Σw=1.0, mvp_subset 合法)", "errors=%s" % str(vr.errors))
	# H2：破坏权重和 → 失败
	var bad: ChapterData = chap.duplicate()
	bad.ordered_nodes[0].weight = 0.1  # 改 n1 → 0.1，和变 0.8
	var vr2: Dictionary = QuestSystem.new().validate_chapter(bad)
	_check(not vr2.ok, "H2 broken weights → fail", "ok=%s errors=%s" % [vr2.ok, str(vr2.errors)])
	# H3：mvp_subset 引用非法 → 失败
	var bad2: ChapterData = chap.duplicate()
	bad2.mvp_subset = [&"n_does_not_exist"]
	var vr3: Dictionary = QuestSystem.new().validate_chapter(bad2)
	_check(not vr3.ok, "H3 illegal mvp_subset ref → fail", "ok=%s errors=%s" % [vr3.ok, str(vr3.errors)])


# ───────────────────────── A. 5 态生命周期状态机（§2.1） ─────────────────────────

func _test_a_lifecycle_state_machine() -> void:
	var qs: QuestSystem = _new_quest_system()
	await get_tree().physics_frame  # _ready → enter_chapter → dispatch N2

	# A1：N2 派发后 = 可改写
	_check(qs.get_node_lifecycle_state(N2_ID) == QuestSystem.LifecycleState.REWRITABLE,
		"A1 N2 未激活→可改写 (dispatched)", "state=%s" % qs.get_node_lifecycle_state_name(N2_ID))
	_check(qs.get_node_lifecycle_state_name(N2_ID) == "可改写",
		"A1 state_name 中文映射", "got %s" % qs.get_node_lifecycle_state_name(N2_ID))

	# A2：可改写 → 执行中（advance_to_executing）
	_check(qs.advance_to_executing(N2_ID), "A2 advance_to_executing ok", "failed")
	_check(qs.get_node_lifecycle_state(N2_ID) == QuestSystem.LifecycleState.EXECUTING,
		"A2 N2 可改写→执行中", "state=%s" % qs.get_node_lifecycle_state_name(N2_ID))
	# A2b：非可改写态 advance 失败
	_check(not qs.advance_to_executing(N2_ID), "A2b advance from EXECUTING fails", "should fail")

	# A3：执行中 → 已确认（node_resolved，S1→S2 手动 emit）
	EventBus.node_resolved.emit(N2_ID, {"v_wind": "southeast"}, 40, 90)
	await get_tree().physics_frame
	_check(qs.get_node_lifecycle_state(N2_ID) == QuestSystem.LifecycleState.CONFIRMED,
		"A3 N2 执行中→已确认 (node_resolved)", "state=%s" % qs.get_node_lifecycle_state_name(N2_ID))
	# A3b：已确认 ledger 含 resolved_at
	var snap: Dictionary = qs.get_node_lifecycle_ledger()
	_check(int(snap[N2_ID]["resolved_at"]) > 0, "A3b resolved_at recorded", "got %d" % int(snap[N2_ID]["resolved_at"]))

	# A4：→ 已消失（node_vanished，S1→S2 手动 emit；用测试节点避免污染 N2）
	var qs2: QuestSystem = _new_quest_system()
	await get_tree().physics_frame
	qs2.debug_register_node(&"n_test_vanish")
	EventBus.node_vanished.emit(&"n_test_vanish")
	await get_tree().physics_frame
	_check(qs2.get_node_lifecycle_state(&"n_test_vanish") == QuestSystem.LifecycleState.VANISHED,
		"A4 node_vanished → 已消失", "state=%s" % qs2.get_node_lifecycle_state_name(&"n_test_vanish"))
	_check(qs2.get_vanished_nodes().has(&"n_test_vanish"), "A4 vanished_nodes set contains", "got %s" % str(qs2.get_vanished_nodes()))
	qs.queue_free()
	qs2.queue_free()


# ───────────────────────── B. can_dispatch §4.2 各分支 ─────────────────────────

func _test_b_can_dispatch_branches() -> void:
	var qs: QuestSystem = _new_quest_system()
	await get_tree().physics_frame

	# B1：章节未进入 → chapter_not_entered（用独立节点 + 手动退出章节态）
	qs.debug_reset_runtime()
	qs.debug_register_node(&"n_t1")
	# 把 _chapter_entered 关掉验证：用另一未进入实例
	var qs_fresh: QuestSystem = _new_quest_system_no_enter()
	qs_fresh.debug_register_node(&"n_t1")
	var r1: Dictionary = qs_fresh.can_dispatch(&"n_t1")
	_check(not r1.ok and r1.reason == "chapter_not_entered", "B1 chapter_not_entered", "got %s" % r1)

	# B2：前序未确认 → prereq_unconfirmed
	qs.debug_reset_runtime()
	var d2 := QuestNodeDispatchData.new()
	d2.node_id = &"n_t2"
	d2.t_dispatch = QuestNodeDispatchData.TDispatch.ON_PREDECESSOR_RESOLVED
	d2.prereq_nodes = [N1_ID]  # N1 未确认
	qs.debug_register_node(&"n_t2", d2)
	var r2: Dictionary = qs.can_dispatch(&"n_t2")
	_check(not r2.ok and r2.reason == "prereq_unconfirmed", "B2 prereq_unconfirmed", "got %s" % r2)

	# B3：存在性不满足 → existence_unmet
	qs.debug_reset_runtime()
	var d3 := QuestNodeDispatchData.new()
	d3.node_id = &"n_t3"
	d3.t_dispatch = QuestNodeDispatchData.TDispatch.ON_CHAPTER_ENTER
	d3.existence_dep_ref = &"link_test_exist"
	qs.debug_register_node(&"n_t3", d3)
	qs.debug_set_existence_condition(&"n_t3", false)
	var r3: Dictionary = qs.can_dispatch(&"n_t3")
	_check(not r3.ok and r3.reason == "existence_unmet", "B3 existence_unmet", "got %s" % r3)

	# B4：t_dispatch=ON_PLAYER_REACH 且 S5 未接 → t_dispatch_not_yet
	qs.debug_reset_runtime()
	var d4 := QuestNodeDispatchData.new()
	d4.node_id = &"n_t4"
	d4.t_dispatch = QuestNodeDispatchData.TDispatch.ON_PLAYER_REACH
	qs.debug_register_node(&"n_t4", d4)
	var r4: Dictionary = qs.can_dispatch(&"n_t4")
	_check(not r4.ok and r4.reason == "t_dispatch_not_yet", "B4 t_dispatch_not_yet (S5 未接)", "got %s" % r4)

	# B5：全满足 → ok（无前序/无存在性/on_chapter_enter）
	qs.debug_reset_runtime()
	var d5 := QuestNodeDispatchData.new()
	d5.node_id = &"n_t5"
	d5.t_dispatch = QuestNodeDispatchData.TDispatch.ON_CHAPTER_ENTER
	qs.debug_register_node(&"n_t5", d5)
	var r5: Dictionary = qs.can_dispatch(&"n_t5")
	_check(r5.ok and r5.reason == "ok", "B5 can_dispatch ok (no prereq/no existence)", "got %s" % r5)

	# B6：存在性满足 → ok（existence gate pass）
	qs.debug_reset_runtime()
	var d6 := QuestNodeDispatchData.new()
	d6.node_id = &"n_t6"
	d6.t_dispatch = QuestNodeDispatchData.TDispatch.ON_CHAPTER_ENTER
	d6.existence_dep_ref = &"link_test_exist"
	qs.debug_register_node(&"n_t6", d6)
	qs.debug_set_existence_condition(&"n_t6", true)
	var r6: Dictionary = qs.can_dispatch(&"n_t6")
	_check(r6.ok, "B6 existence met → can_dispatch ok", "got %s" % r6)

	# B7：前序已确认 → ok（on_predecessor_resolved）
	qs.debug_reset_runtime()
	var d7 := QuestNodeDispatchData.new()
	d7.node_id = &"n_t7"
	d7.t_dispatch = QuestNodeDispatchData.TDispatch.ON_PREDECESSOR_RESOLVED
	d7.prereq_nodes = [&"n_t7a"]
	qs.debug_register_node(&"n_t7", d7)
	qs.debug_register_node(&"n_t7a")
	# 手动把 n_t7a 置 已确认
	qs._ledger[&"n_t7a"]["state"] = QuestSystem.LifecycleState.CONFIRMED
	var r7: Dictionary = qs.can_dispatch(&"n_t7")
	_check(r7.ok, "B7 prereq confirmed → ok", "got %s" % r7)

	qs.queue_free()
	qs_fresh.queue_free()


# ───────────────────────── C. MVP 流程 + P_ch（§4.3） ─────────────────────────

func _test_c_mvp_flow_and_progress() -> void:
	var qs: QuestSystem = _new_quest_system()
	await get_tree().physics_frame  # _ready → enter_chapter

	# C1：章节进入即派 N2（on_chapter_enter）
	_check(qs.get_node_lifecycle_state(N2_ID) == QuestSystem.LifecycleState.REWRITABLE,
		"C1 chapter enter → dispatch N2 (on_chapter_enter)", "state=%s" % qs.get_node_lifecycle_state_name(N2_ID))
	_check(qs.get_current_tracked_node_id() == N2_ID, "C1 tracked node == N2", "got %s" % qs.get_current_tracked_node_id())

	# C2：P_ch 初值 0（N2 未确认）
	_check(is_equal_approx(qs.get_chapter_progress(), 0.0), "C2 P_ch=0 before resolve", "got %.2f" % qs.get_chapter_progress())

	# C3：N2 resolve → P_ch = w_node(n2) = 0.4
	_quest_progress.clear()
	EventBus.node_resolved.emit(N2_ID, {"v_wind": "southeast"}, 40, 90)
	await get_tree().physics_frame
	_check(qs.get_node_lifecycle_state(N2_ID) == QuestSystem.LifecycleState.CONFIRMED,
		"C3a N2 resolved → 已确认", "state=%s" % qs.get_node_lifecycle_state_name(N2_ID))
	_check(is_equal_approx(qs.get_chapter_progress(), 0.4),
		"C3b P_ch = w_node(n2) = 0.4", "got %.4f" % qs.get_chapter_progress())
	# C3c：resolve 后 emit quest_progress_updated(ch_chibi_war, 0.4)
	var emitted_04 := false
	for c in _quest_progress:
		if c[0] == &"ch_chibi_war" and is_equal_approx(float(c[1]), 0.4):
			emitted_04 = true
	_check(emitted_04, "C3c quest_progress_updated(ch_chibi_war, 0.4) emitted", "calls=%s" % str(_quest_progress))
	# C3d：resolve 后 tracked node 清空（无更多可改写节点）
	_check(qs.get_current_tracked_node_id() == &"", "C3d tracked cleared after resolve (no more active)", "got %s" % qs.get_current_tracked_node_id())

	# C4：重复 resolve 不再推进 P_ch（已确认幂等）
	var p_before := qs.get_chapter_progress()
	EventBus.node_resolved.emit(N2_ID, {"v_wind": "none"}, 99, 0)
	await get_tree().physics_frame
	_check(is_equal_approx(qs.get_chapter_progress(), p_before), "C4 re-resolve keeps P_ch (idempotent)", "%.4f→%.4f" % [p_before, qs.get_chapter_progress()])
	qs.queue_free()


# ───────────────────────── D. existence false → 消失决策（§2.3 ④b） ─────────────────────────

func _test_d_existence_false_vanish() -> void:
	var qs: QuestSystem = _new_quest_system()
	await get_tree().physics_frame
	qs.debug_reset_runtime()
	# 注册一个带 existence 依赖的测试节点 n3_huarong（模拟目标态 N3 依赖 N2 火攻）
	var d := QuestNodeDispatchData.new()
	d.node_id = N3_ID
	d.t_dispatch = QuestNodeDispatchData.TDispatch.ON_CHAPTER_ENTER
	d.existence_dep_ref = &"link_fire_power_to_n3_existence"
	d.system_vanish_voice = "世界线已重排"
	qs.debug_register_node(N3_ID, d)

	# D1：causal_link_propagated existence false → 消失决策（§2.3 ④b）
	_quest_vanished_voiced.clear()
	EventBus.causal_link_propagated.emit(&"link_fire_power_to_n3_existence", N2_ID, "unmet", N3_ID)
	await get_tree().physics_frame
	_check(qs.get_node_lifecycle_state(N3_ID) == QuestSystem.LifecycleState.VANISHED,
		"D1 causal_link existence=false → 已消失", "state=%s" % qs.get_node_lifecycle_state_name(N3_ID))
	_check(qs.get_vanished_nodes().has(N3_ID), "D1 vanished_nodes has N3", "got %s" % str(qs.get_vanished_nodes()))
	# D2：emit quest_node_vanished_voiced
	var voiced := false
	for c in _quest_vanished_voiced:
		if c[0] == N3_ID:
			voiced = true
	_check(voiced, "D2 quest_node_vanished_voiced emitted", "calls=%s" % str(_quest_vanished_voiced))

	# D3：node_vanished 直驱（S1 回告）也能置已消失（用新节点）
	qs.debug_register_node(&"n_vanish_direct")
	EventBus.node_vanished.emit(&"n_vanish_direct")
	await get_tree().physics_frame
	_check(qs.get_node_lifecycle_state(&"n_vanish_direct") == QuestSystem.LifecycleState.VANISHED,
		"D3 node_vanished direct → 已消失", "state=%s" % qs.get_node_lifecycle_state_name(&"n_vanish_direct"))
	qs.queue_free()


# ───────────────────────── E. existence true → 派发决策（§2.3 ④a） ─────────────────────────

func _test_e_existence_true_dispatch() -> void:
	var qs: QuestSystem = _new_quest_system()
	await get_tree().physics_frame
	qs.debug_reset_runtime()
	var d := QuestNodeDispatchData.new()
	d.node_id = N3_ID
	d.t_dispatch = QuestNodeDispatchData.TDispatch.ON_CHAPTER_ENTER
	d.existence_dep_ref = &"link_fire_power_to_n3_existence"
	d.objective_short = "华容道追击"
	qs.debug_register_node(N3_ID, d)

	# E1：派发前 N3 未激活
	_check(qs.get_node_lifecycle_state(N3_ID) == QuestSystem.LifecycleState.UNACTIVATED,
		"E1 N3 未激活 before existence", "state=%s" % qs.get_node_lifecycle_state_name(N3_ID))

	# E2：causal_link_propagated existence true → 派发（§2.3 ④a，on_chapter_enter 已满足）
	_node_activated.clear()
	EventBus.causal_link_propagated.emit(&"link_fire_power_to_n3_existence", N2_ID, "met", N3_ID)
	await get_tree().physics_frame
	_check(qs.get_node_lifecycle_state(N3_ID) == QuestSystem.LifecycleState.REWRITABLE,
		"E2 existence=true → 派发 N3 (可改写)", "state=%s" % qs.get_node_lifecycle_state_name(N3_ID))
	var act := false
	for c in _node_activated:
		if c[0] == N3_ID:
			act = true
	_check(act, "E2 node_activated(N3) emitted on existence dispatch", "calls=%s" % str(_node_activated))
	qs.queue_free()


# ───────────────────────── F. 信号契约（派发时发出的 S2→ 各信号） ─────────────────────────

func _test_f_signal_contract_on_dispatch() -> void:
	# 清捕获【必须在创建 qs 之前】：N2 派发在 _ready 同步发生（add_child 期间 emit）。
	_node_activated.clear()
	_quest_objective.clear()
	_quest_target_scene.clear()
	_quest_dispatch_voiced.clear()
	_node_committed.clear()
	_quest_reward.clear()
	var qs: QuestSystem = _new_quest_system()
	await get_tree().physics_frame  # _ready 派发 N2（emit 在 add_child 同步期已完成）

	# F1：node_activated(N2) S2→S1
	var act_n2 := false
	for c in _node_activated:
		if c[0] == N2_ID:
			act_n2 = true
	_check(act_n2, "F1 node_activated(n2) emitted (S2→S1)", "calls=%s" % str(_node_activated))

	# F2：quest_objective_updated(N2, short, long) S2→S3
	var obj := false
	for c in _quest_objective:
		if c[0] == N2_ID and c[1] == "前往七星坛，决定东风是否借成":
			obj = true
	_check(obj, "F2 quest_objective_updated(n2, short, long) (S2→S3)", "calls=%s" % str(_quest_objective))

	# F3：quest_target_scene_set(N2, scene_altar) S2→S5
	var ts := false
	for c in _quest_target_scene:
		if c[0] == N2_ID and c[1] == &"scene_altar":
			ts = true
	_check(ts, "F3 quest_target_scene_set(n2, scene_altar) (S2→S5)", "calls=%s" % str(_quest_target_scene))

	# F4：quest_dispatch_voiced(N2, “已锁定目标：借东风…”) S2→X1
	var dv := false
	for c in _quest_dispatch_voiced:
		if c[0] == N2_ID and c[1].find("已锁定目标") >= 0:
			dv = true
	_check(dv, "F4 quest_dispatch_voiced(n2, dispatch voice) (S2→X1)", "calls=%s" % str(_quest_dispatch_voiced))

	# F5：node_resolved 后 quest_reward_declared(N2, 1.2, 10) S2→S3（§4.1 加成参数）
	_quest_reward.clear()
	EventBus.node_resolved.emit(N2_ID, {}, 40, 90)
	await get_tree().physics_frame
	var rw := false
	for c in _quest_reward:
		if c[0] == N2_ID and is_equal_approx(float(c[1]), 1.2) and int(c[2]) == 10:
			rw = true
	_check(rw, "F5 quest_reward_declared(n2, 1.2, 10) (S2→S3 §4.1)", "calls=%s" % str(_quest_reward))

	# F6：force_commit_node → node_committed(S2→S1)；用独立未确认节点（N2 已在 F5 确认）
	qs.debug_register_node(&"n_commit_test")
	_node_committed.clear()
	_check(qs.force_commit_node(&"n_commit_test"), "F6 force_commit returns true", "failed")
	await get_tree().physics_frame
	var cm := false
	for c in _node_committed:
		if c[0] == &"n_commit_test":
			cm = true
	_check(cm, "F6 node_committed(n_commit_test) emitted (S2→S1 force commit)", "calls=%s" % str(_node_committed))
	qs.queue_free()


# ───────────────────────── G. 存档态契约 serialize/deserialize（§3.3） ─────────────────────────

func _test_g_save_state_contract() -> void:
	var qs: QuestSystem = _new_quest_system()
	await get_tree().physics_frame
	# 推进：N2 派发 → 执行中
	qs.advance_to_executing(N2_ID)
	EventBus.node_resolved.emit(N2_ID, {}, 40, 90)
	await get_tree().physics_frame
	# 制造一个已消失节点
	qs.debug_register_node(&"n_save_vanish")
	EventBus.node_vanished.emit(&"n_save_vanish")
	await get_tree().physics_frame

	var snap: Dictionary = qs.serialize()
	_check(snap.schema == "mainline_quest.v1", "G1 serialize schema", "got %s" % str(snap.get("schema")))
	_check(snap.active_chapter == "ch_chibi_war", "G1 serialize active_chapter", "got %s" % str(snap.get("active_chapter")))
	_check(is_equal_approx(float(snap.chapter_progress), 0.4), "G1 serialize chapter_progress=0.4", "got %s" % str(snap.get("chapter_progress")))
	_check(str(snap.node_lifecycle_ledger.get("n2_east_wind", {}).get("state")) == str(QuestSystem.LifecycleState.CONFIRMED),
		"G1 serialize ledger n2=CONFIRMED", "got %s" % str(snap.node_lifecycle_ledger.get("n2_east_wind")))
	_check(snap.vanished_nodes.has("n_save_vanish"), "G1 serialize vanished_nodes", "got %s" % str(snap.get("vanished_nodes")))

	# 反序列化到新实例
	var qs2: QuestSystem = _new_quest_system_no_enter()
	qs2.deserialize(snap)
	_check(qs2.get_node_lifecycle_state(N2_ID) == QuestSystem.LifecycleState.CONFIRMED,
		"G2 deserialize restores n2=CONFIRMED", "state=%s" % qs2.get_node_lifecycle_state_name(N2_ID))
	_check(is_equal_approx(qs2.get_chapter_progress(), 0.4), "G2 deserialize restores P_ch=0.4", "got %.4f" % qs2.get_chapter_progress())
	_check(qs2.get_vanished_nodes().has(&"n_save_vanish"), "G2 deserialize restores vanished_nodes", "got %s" % str(qs2.get_vanished_nodes()))
	_check(snap.node_lifecycle_ledger is Dictionary and not snap.node_lifecycle_ledger.is_empty(),
		"G3 ledger 结构非空（存档契约可消费）", "empty?")
	qs.queue_free()
	qs2.queue_free()


# ───────────────────────── 辅助 ─────────────────────────

func _new_quest_system() -> QuestSystem:
	# 正常实例：_ready 会加载 ch_chibi_war + 校验 + enter_chapter + 派发 N2
	var qs: QuestSystem = QuestSystem.new()
	qs.chapter_data = load(CHAPTER_PATH)
	add_child(qs)
	return qs


func _new_quest_system_no_enter() -> QuestSystem:
	# 不赋 chapter_data → _ready 不 enter_chapter（用于测 can_dispatch 的 chapter_not_entered / deserialize）
	var qs: QuestSystem = QuestSystem.new()
	add_child(qs)
	return qs


func _on_node_activated(node_id: StringName) -> void:
	_node_activated.append([node_id])

func _on_quest_objective(node_id: StringName, short: String, _long: String) -> void:
	_quest_objective.append([node_id, short])

func _on_quest_target_scene(node_id: StringName, scene: StringName) -> void:
	_quest_target_scene.append([node_id, scene])

func _on_quest_dispatch_voiced(node_id: StringName, voice: String) -> void:
	_quest_dispatch_voiced.append([node_id, voice])

func _on_quest_progress(chapter_id: StringName, p_ch: float) -> void:
	_quest_progress.append([chapter_id, p_ch])

func _on_quest_reward(node_id: StringName, mult: float, flat: int) -> void:
	_quest_reward.append([node_id, mult, flat])

func _on_quest_vanished_voiced(node_id: StringName, voice: String) -> void:
	_quest_vanished_voiced.append([node_id, voice])

func _on_node_committed(node_id: StringName) -> void:
	_node_committed.append([node_id])


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
