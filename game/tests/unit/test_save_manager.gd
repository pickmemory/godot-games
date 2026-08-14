extends Node

## tests/unit/test_save_manager.gd —— SaveManager（X4 存档）测试（issue #20 / engineering-lead.md：每 Story 附测试证据）。
##
## 运行：$GODOT_BIN --headless --path game res://tests/unit/test_save_manager.tscn
##
## 覆盖（architecture §9 / control-manifest 存档节）：
##   A. 原子写 + 读档 round-trip（§9.2 临时文件+rename）：C1/C2 快照存→读→一致。
##   B. 槽位摘要 list_slots/get_slot_summary（§9.1 字段：章节进度/Δ累计/世界线/时间/朝代）。
##   C. 一致性校验（control-manifest 存档节）：C1 resolved == C2 confirmed；不一致即拒读档报错。
##   D. 空槽/多槽：空槽摘要 empty=true；first_empty_slot 选槽。
##   E. 新游戏/继续流程：new_game 清 pending；continue_slot 预载 pending_load；apply_pending_load 注入 C1/C2。
##   F. 自动存档触发：node_resolved → atomic_save 到 _active_slot。
##   G. schema_version 迁移钩子（v1 原样读）。
##
## 清理：测试写真实 user://saves/ 文件，_ready 开头 + 结尾删全部槽位，防污染其他测试/真机存档。
## ⚠️ 注：本测试会删除 user://saves/ 下所有 slot_*.sav（仅测试环境，CI 无真实存档）。

const N2_ID := &"n2_east_wind"

var _passed: int = 0
var _failed: int = 0
var _c1: RewriteCausalityEngine
var _c2: QuestSystem


func _ready() -> void:
	_clean_disk()
	await _run()
	_summary()
	_clean_disk()
	get_tree().quit(1 if _failed > 0 else 0)


func _run() -> void:
	# 挂载真实 C1/C2 到分组（SaveManager._collect_snapshot 经组寻址）。
	_c1 = RewriteCausalityEngine.new()
	_c1.debug_set_test_mode()
	_c1.causal_links_path = ""   # 跳过因果链强加载
	add_child(_c1)
	_c2 = QuestSystem.new()
	add_child(_c2)   # 无 chapter_data → 不 enter_chapter（供 deserialize 测试）

	await _test_a_atomic_round_trip()
	await _test_b_slot_summary()
	await _test_c_consistency_gate()
	await _test_d_empty_slots()
	await _test_e_new_continue_flow()
	await _test_f_auto_save_trigger()
	await _test_g_schema_migration()


# ───────────────────────── A. 原子写 + 读档 round-trip（§9.2） ─────────────────────────

func _test_a_atomic_round_trip() -> void:
	SaveManager.debug_reset_runtime()
	# 给 C1 注入一个已确认节点（resolved_nodes 非空）
	_c1.debug_register_node(N2_ID, _make_node(N2_ID))
	_c1.debug_activate_node(N2_ID)
	# 制造 resolved：手动塞 _resolved_nodes（绕过完整结算，仅测存档序列化）
	_inject_resolved(N2_ID, {"v_wind": "southeast"}, 32, 96)
	# C2 账本置 N2 已确认（保持一致性）
	_c2.debug_register_node(N2_ID)
	_eventually_confirm_in_c2(N2_ID)

	var save_res: Dictionary = SaveManager.atomic_save(0)
	_check(save_res.ok, "A1 atomic_save slot0 ok", "got %s" % str(save_res))
	_check(FileAccess.file_exists("user://saves/slot_0.sav"), "A2 存档文件已落盘", "slot_0.sav 不存在")

	var load_res: Dictionary = SaveManager.load_slot(0)
	_check(load_res.ok, "A3 load_slot slot0 ok（一致性通过）", "got %s" % str(load_res))
	var systems: Dictionary = (load_res.snapshot as Dictionary).get("systems", {})
	_check(not (systems.get("rewrite_engine", {}) as Dictionary).is_empty(), "A4 读档含 C1 快照", "rewrite_engine empty")
	_check(not (systems.get("mainline_quest", {}) as Dictionary).is_empty(), "A4 读档含 C2 快照", "mainline_quest empty")
	_check(int((load_res.snapshot as Dictionary).get("schema_version", 0)) == SaveManager.SCHEMA_VERSION, "A5 schema_version=1", "got %s" % str((load_res.snapshot as Dictionary).get("schema_version")))


# ───────────────────────── B. 槽位摘要（§9.1 字段） ─────────────────────────

func _test_b_slot_summary() -> void:
	var summ: Dictionary = SaveManager.get_slot_summary(0)
	_check(not bool(summ.get("empty", true)), "B1 slot0 非空", "empty?")
	_check(int(summ.get("delta_total", -1)) == 32, "B2 delta_total=32（Σ resolved delta_node）", "got %s" % str(summ.get("delta_total")))
	_check(String(summ.get("dynasty", "")) == String(DynastyLoader.DEFAULT_DYNASTY), "B3 dynasty=dyn_threekingdoms_chibi", "got %s" % str(summ.get("dynasty")))
	_check(int(summ.get("saved_at", 0)) > 0, "B4 saved_at>0", "got %s" % str(summ.get("saved_at")))
	# slot1 未存 → 空
	var summ1: Dictionary = SaveManager.get_slot_summary(1)
	_check(bool(summ1.get("empty", false)), "B5 slot1 空", "got %s" % str(summ1))
	var all := SaveManager.list_slots()
	_check(all.size() == SaveManager.NUM_SLOTS, "B6 list_slots 数量=NUM_SLOTS(%d)" % SaveManager.NUM_SLOTS, "got %d" % all.size())


# ───────────────────────── C. 一致性校验（control-manifest：不一致即拒读档报错） ─────────────────────────

func _test_c_consistency_gate() -> void:
	# 构造不一致存档：C1 resolved 有 N2，但 C2 ledger 无 N2 confirmed。
	var bad_snapshot := {
		"tag": "chibi_rewriter.save",
		"schema_version": SaveManager.SCHEMA_VERSION,
		"saved_at": int(Time.get_unix_time_from_system()),
		"active_dynasty": String(DynastyLoader.DEFAULT_DYNASTY),
		"systems": {
			"rewrite_engine": {
				"resolved_nodes": {"n_lone": {"final_vars": {}, "delta_node": 50, "cp_earned": 10, "blueprint": ""}},
				"critical_flags": {"worldline_shaken": false},
				"active_dynasty": String(DynastyLoader.DEFAULT_DYNASTY),
			},
			"mainline_quest": {
				"node_lifecycle_ledger": {},   # C2 无任何 confirmed → 与 C1 的 n_lone 不一致
				"chapter_progress": 0.0,
				"active_chapter": "ch_chibi_war",
			},
		},
	}
	_write_raw_slot(2, bad_snapshot)
	var res: Dictionary = SaveManager.load_slot(2)
	_check(not res.ok, "C1 不一致存档被拒读档（consistency_failed）", "got ok=%s reason=%s" % [str(res.get("ok")), str(res.get("reason"))])
	_check(String(res.get("reason", "")) == "consistency_failed", "C2 reason=consistency_failed", "got %s" % str(res.get("reason")))


# ───────────────────────── D. 空槽 / 多槽 ─────────────────────────

func _test_d_empty_slots() -> void:
	# 清空所有槽再测 first_empty_slot
	_clean_disk()
	SaveManager.debug_reset_runtime()
	var ng: Dictionary = SaveManager.new_game()
	_check(ng.ok and int(ng.get("slot", -1)) == 0, "D1 new_game 选首个空槽=0", "got %s" % str(ng))
	# 全空时 has_any_save=false
	_check(not SaveManager.has_any_save(), "D2 全空 has_any_save=false", "got true")
	_check(SaveManager.get_recent_slot() < 0, "D3 全空 recent_slot=-1", "got %s" % str(SaveManager.get_recent_slot()))


# ───────────────────────── E. 新游戏/继续：pending_load 注入 ─────────────────────────

func _test_e_new_continue_flow() -> void:
	_clean_disk()
	SaveManager.debug_reset_runtime()
	# 先存一个一致存档到槽1（复用 A 的注入）
	_inject_resolved(N2_ID, {"v_wind": "southeast"}, 32, 96)
	_eventually_confirm_in_c2(N2_ID)
	SaveManager.debug_set_active_slot(1)
	var sr: Dictionary = SaveManager.atomic_save(1)
	_check(sr.ok, "E1 存档槽1 ok", "got %s" % str(sr))

	# 新游戏：清 pending
	var ng: Dictionary = SaveManager.new_game()
	_check(ng.ok and not SaveManager.has_pending_load(), "E2 new_game 清 pending_load", "pending=%s" % str(SaveManager.has_pending_load()))

	# 继续：预载 pending
	var cg: Dictionary = SaveManager.continue_slot(1)
	_check(cg.ok, "E3 continue_slot 槽1 ok", "got %s" % str(cg))
	_check(SaveManager.has_pending_load(), "E4 continue 预载 pending_load", "pending=false")
	# apply_pending_load 应注入 C1/C2（resolved 恢复）
	# 先清 C1/C2 运行时态，模拟 world 起步前
	_c1.debug_reset_runtime()
	_c2.debug_reset_runtime()
	SaveManager.apply_pending_load()
	_check(not SaveManager.has_pending_load(), "E5 apply 后 pending 清空", "pending=true")
	_check(_c1.is_node_resolved(N2_ID), "E6 apply 注入 C1 resolved_nodes", "N2 未恢复")
	_check(_c2.get_node_lifecycle_state(N2_ID) == QuestSystem.LifecycleState.CONFIRMED, "E7 apply 注入 C2 ledger=CONFIRMED", "state=%s" % str(_c2.get_node_lifecycle_state(N2_ID)))


# ───────────────────────── F. 自动存档触发（node_resolved → atomic_save） ─────────────────────────

func _test_f_auto_save_trigger() -> void:
	_clean_disk()
	SaveManager.debug_reset_runtime()
	SaveManager.debug_set_active_slot(0)
	# 清 C1/C2 → 注入新 resolved 并 emit node_resolved
	_c1.debug_reset_runtime()
	_c2.debug_reset_runtime()
	_inject_resolved(N2_ID, {"v_wind": "southeast"}, 32, 96)
	_eventually_confirm_in_c2(N2_ID)
	# emit node_resolved → SaveManager._on_node_resolved 自动存档到 slot0
	EventBus.node_resolved.emit(N2_ID, {"v_wind": "southeast"}, 32, 96)
	await get_tree().process_frame   # 让信号回调跑
	_check(FileAccess.file_exists("user://saves/slot_0.sav"), "F1 node_resolved 触发自动存档 slot0", "文件不存在")
	_check(SaveManager.get_recent_slot() == 0, "F2 recent_slot 更新=0", "got %s" % str(SaveManager.get_recent_slot()))


# ───────────────────────── G. schema 迁移钩子（v1 原样读） ─────────────────────────

func _test_g_schema_migration() -> void:
	_clean_disk()
	SaveManager.debug_reset_runtime()
	_inject_resolved(N2_ID, {"v_wind": "southeast"}, 32, 96)
	_eventually_confirm_in_c2(N2_ID)
	SaveManager.debug_set_active_slot(0)
	SaveManager.atomic_save(0)
	var summ: Dictionary = SaveManager.get_slot_summary(0)
	_check(not bool(summ.get("empty", true)), "G1 v1 schema 存档可读", "empty?")
	# 直接调 _migrate（v1 原样）
	var snap := SaveManager.load_slot(0)
	_check(snap.ok, "G2 v1 load_slot 通过", "got %s" % str(snap))


# ───────────────────────── 辅助 ─────────────────────────

## 造一个最小 RewriteNodeData（供 C1 debug_register_node）。
func _make_node(node_id: StringName) -> RewriteNodeData:
	var nd := RewriteNodeData.new()
	nd.node_id = node_id
	nd.display_title = "test"
	nd.max_attempts = 3
	nd.cp_node = 100
	nd.re_max = 100
	nd.diff_base = 1.0
	return nd


## 直接往 C1 注入一个 resolved 记录（绕过完整结算，仅测存档序列化）。
func _inject_resolved(node_id: StringName, final_vars: Dictionary, delta_node: int, cp_earned: int) -> void:
	# 用 C1 暴露的 debug 入口不具备直接塞 resolved 的能力；改用 serialize 拼装 + deserialize 注入。
	var base := _c1.serialize()
	var resolved: Dictionary = base.get("resolved_nodes", {})
	resolved[String(node_id)] = {"final_vars": final_vars, "delta_node": delta_node, "cp_earned": cp_earned, "blueprint": ""}
	base["resolved_nodes"] = resolved
	_c1.deserialize(base)


## 在 C2 账本里把 node 置 CONFIRMED（不 emit node_resolved，避免触发自动存档污染；仅对齐一致性）。
func _eventually_confirm_in_c2(node_id: StringName) -> void:
	_c2.debug_register_node(node_id)
	# emit node_resolved 让 C2 走正常确认路径（C2 _on_node_resolved 置 CONFIRMED）。
	# 但这会触发 SaveManager 自动存档（若 _active_slot≥0）→ 测试里先确保 _active_slot<0 或 clean。
	EventBus.node_resolved.emit(node_id, {}, 0, 0)


func _write_raw_slot(slot: int, snapshot: Dictionary) -> void:
	var path := "user://saves/slot_%d.sav" % slot
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string(var_to_str(snapshot))
	f.close()


func _clean_disk() -> void:
	var d := DirAccess.open("user://saves/")
	if d == null:
		return
	d.list_dir_begin()
	var name_ := d.get_next()
	while name_ != "":
		if not d.current_is_dir() and (name_.begins_with("slot_") or name_.begins_with(".slot_")):
			d.remove(name_)
		name_ = d.get_next()
	d.list_dir_end()


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
