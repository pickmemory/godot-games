extends Node

## tests/unit/test_rewrite_feedback.gd —— 改写/因果反馈层测试（issue #18 / engineering-lead.md：每个 Story 附测试证据）。
##
## 运行：$GODOT_BIN --headless --path game res://tests/unit/test_rewrite_feedback.tscn
##
## 覆盖（ux-spec §6.3/§6.4/§9.2 + rewrite-causality §2.7/§4.4/§4.5/§5.5 + panel §2.5/§2.6 + control-manifest）：
##   A. RewritePanel 呼出（node_activated → 开 + 读真 N2 数据填充：标题/intro/intel_cov/蓝图/动词/RE/预览）。
##   B. 蓝图卡 intel_cov 门控（unlock_intel_cov 不达 → 锁定灰蒙；达 → 可选 → select_blueprint → blueprint_declared → 高亮）。
##   C. special_flags（self_replacement）触发系统特殊旁白提示。
##   D. 实时预览（verb_executed → variable_changed + deviation_recomputed preview → 面板 Δ/变量即时刷新；预览不发 CP）。
##   E. 确认改写（玩家点「确认改写」→ emit node_committed；未选蓝图 → 拦截 + 警告，不 emit）。
##   F. 反馈控制器 minor（Δ<20 → 不进 STG，仅短横幅）。
##   G. 反馈控制器 notable（20≤Δ<80 → STG 卷轴 + 结算屏 Δ/M/CP + X1 旁白）。
##   H. 反馈控制器 critical（Δ≥80 → STG 长演出 + glitch + 世界线震荡旁白）。
##   I. 连续 critical 演出降级压缩（panel §2.5 防疲劳）。
##   J. 预览 vs 锁定区分（is_preview=true 不触发控制器演出；仅 is_preview=false 累积 _pending）。
##   K. 蓝图不可达兜底（M=0 → CP≈0 + 意图落空旁白，不崩，§5.5）。
##   L. node_vanished → 面板收起 + 消失横幅，无悬挂 UI。
##   M. 焦点链 + 信号生命周期（控件焦点可达；connect 恰 1 次）。

const PANEL_SCENE: PackedScene = preload("res://ui/rewrite_panel/rewrite_panel.tscn")
const TS_SCENE: PackedScene = preload("res://ui/rewrite_panel/timeline_stage.tscn")
const N2_ID := &"n2_east_wind"
const N3_ID := &"n3_huarong"
const BP_SELF := &"bp_player_self_wind"
const BP_BASE := &"bp_baseline_keep"
const VERB_SMASH := &"verb_smash_altar"
const VERB_BLOCK := &"verb_block_kongming"
const VERB_SELF_WIND := &"verb_self_borrow_wind"

var _passed: int = 0
var _failed: int = 0
var _engine: RewriteCausalityEngine
var _panel: RewritePanelView
var _controller: RewriteFeedbackController
var _ts: TimelineStage
var _committed: Array = []


func _ready() -> void:
	await _setup()
	await _run()
	_teardown()
	_summary()
	get_tree().quit(1 if _failed > 0 else 0)


func _run() -> void:
	await _test_a_panel_open_populate()
	await _test_b_intel_cov_gate_and_select()
	await _test_c_special_flag_narration()
	await _test_d_preview_on_verb()
	await _test_e_commit_guard_and_emit()
	await _test_f_minor_banner()
	await _test_g_notable_stage()
	await _test_h_critical_glitch()
	await _test_i_consecutive_critical_degrade()
	await _test_j_preview_vs_lock()
	await _test_k_unreachable_fallback()
	await _test_l_node_vanished()
	await _test_m_focus_chain_and_signals()


# ───────────────────────── setup / teardown ─────────────────────────

func _setup() -> void:
	# 引擎先入树（其 _ready 先连 node_activated → 面板后连，emit 时引擎先处理初始化 working_vars）
	_engine = RewriteCausalityEngine.new()
	add_child(_engine)
	await get_tree().process_frame
	_panel = PANEL_SCENE.instantiate()
	add_child(_panel)
	_panel.debug_set_engine(_engine)
	_controller = RewriteFeedbackController.new()
	add_child(_controller)
	_controller.debug_set_engine(_engine)
	_ts = TS_SCENE.instantiate()
	add_child(_ts)
	_controller.debug_set_timeline_stage(_ts)
	await get_tree().process_frame
	EventBus.node_committed.connect(_on_node_committed)


func _teardown() -> void:
	if EventBus.node_committed.is_connected(_on_node_committed):
		EventBus.node_committed.disconnect(_on_node_committed)


func _reset_runtime() -> void:
	_engine.debug_reset_runtime()
	if _panel.is_open():
		_panel._close_panel()
	_controller._pending.clear()
	_controller._consecutive_critical = 0
	_controller._last_pending_node = &""
	_ts._hide_all()
	_committed.clear()


## reset + 设 intel_cov + 激活节点 + 可选蓝图（每测试自包含，不依赖前序状态）。
func _prep_node(intel_cov: float, bp_id: StringName = &"") -> void:
	_reset_runtime()
	_engine.debug_set_intel_cov(intel_cov)
	EventBus.node_activated.emit(N2_ID)
	await get_tree().process_frame
	if bp_id != &"":
		_engine.select_blueprint(N2_ID, bp_id)
		await get_tree().process_frame


# ───────────────────────── A. 面板呼出 + 填充 ─────────────────────────

func _test_a_panel_open_populate() -> void:
	await _prep_node(0.0)
	_check(_panel.is_open(), "A1 node_activated → 面板开", "closed")
	_check(_panel.get_active_node_id() == N2_ID, "A2 active node = n2", "got %s" % _panel.get_active_node_id())
	_check(_panel._node_title_label.text == "n2_east_wind · 借东风", "A3 标题 n2·借东风", "got '%s'" % _panel._node_title_label.text)
	_check(_panel._dispatch_intro_label.text == "已锁定目标：借东风。当前节点偏差归零。记录员就位。", "A4 派单 system_intro", "got '%s'" % _panel._dispatch_intro_label.text)
	_check(_panel._intel_value_label.text == "0.00", "A5 intel_cov=0.00 显示", "got '%s'" % _panel._intel_value_label.text)
	_check(_panel._blueprint_list.get_child_count() == 2, "A6 2 蓝图卡", "got %d" % _panel._blueprint_list.get_child_count())
	_check(_panel._verb_list.get_child_count() == 3, "A7 3 动词行", "got %d" % _panel._verb_list.get_child_count())
	_check(_panel._preview_vars_label.text.find("v_wind") >= 0, "A8 预览含 v_wind", "got '%s'" % _panel._preview_vars_label.text)
	_check(_panel._preview_vars_label.text.find("东南风") >= 0, "A9 v_wind 显示中文 display", "got '%s'" % _panel._preview_vars_label.text)
	_check(_panel._re_value_label.text == "100/100", "A10 RE=100/100（re_max）", "got '%s'" % _panel._re_value_label.text)
	_check(_panel._attempts_value_label.text == "0/3", "A11 attempts=0/3", "got '%s'" % _panel._attempts_value_label.text)


# ───────────────────────── B. intel_cov 门控 + select ─────────────────────────

func _test_b_intel_cov_gate_and_select() -> void:
	await _prep_node(0.0)
	var bp_self_btn: Button = _panel.get_blueprint_button(BP_SELF)
	var bp_base_btn: Button = _panel.get_blueprint_button(BP_BASE)
	_check(bp_self_btn != null and bp_base_btn != null, "B1 蓝图卡控件存在", "null")
	_check(bp_self_btn.disabled, "B2 intel_cov=0 → bp_self 锁定（unlock_intel_cov=0.6）", "not disabled")
	_check(not bp_base_btn.disabled, "B3 bp_baseline 可选（unlock_intel_cov=0）", "disabled")
	# 提到 intel_cov=0.6 后重开 → bp_self 解锁 + 选中
	await _prep_node(0.6, BP_SELF)
	bp_self_btn = _panel.get_blueprint_button(BP_SELF)
	_check(not bp_self_btn.disabled, "B4 intel_cov=0.6 → bp_self 解锁", "still disabled")
	_check(bp_self_btn.button_pressed, "B5 bp_self 高亮（blueprint_declared → toggle pressed）", "not pressed")
	_check(_engine.get_selected_blueprint() == BP_SELF, "B6 引擎 selected_blueprint=bp_self", "got %s" % _engine.get_selected_blueprint())


# ───────────────────────── C. special_flags 旁白 ─────────────────────────

func _test_c_special_flag_narration() -> void:
	# 沿用 B 末态（bp_self 已选 → blueprint_declared 已发 → 意图旁白含 self_replacement）
	_check(_panel.get_intent_narration_text().find("功劳归于穿越者本人") >= 0, "C1 self_replacement 触发特殊旁白", "got '%s'" % _panel.get_intent_narration_text())


# ───────────────────────── D. 实时预览（verb_executed） ─────────────────────────

func _test_d_preview_on_verb() -> void:
	await _prep_node(0.6, BP_SELF)
	EventBus.verb_executed.emit(VERB_SMASH, &"scene_altar", true)
	await get_tree().process_frame
	_check(_panel._preview_vars_label.text.find("v_altar") >= 0 and _panel._preview_vars_label.text.find("被毁") >= 0, "D1 预览 v_altar=smashed(被毁)", "got '%s'" % _panel._preview_vars_label.text)
	_check(_panel.get_displayed_delta() == 20, "D2 预览 Δ=20（w0.2·d1.0·100）", "got %d" % _panel.get_displayed_delta())
	_check(_panel._preview_delta_label.text.find("notable") >= 0, "D3 Δ 档位 notable", "got '%s'" % _panel._preview_delta_label.text)
	_check(_panel._attempts_value_label.text == "1/3", "D4 attempts_used=1/3", "got '%s'" % _panel._attempts_value_label.text)
	# 预览不发 CP（控制器 _pending 不含结算，因 is_preview=true）
	_check(not _controller._pending.has(String(N2_ID)), "D5 预览(is_preview=true) 不累积控制器结算", "pending=%s" % str(_controller._pending))


# ───────────────────────── E. 确认改写 ─────────────────────────

func _test_e_commit_guard_and_emit() -> void:
	# E1: 已选 bp_self → 确认 emit node_committed
	await _prep_node(0.6, BP_SELF)
	_committed.clear()
	_panel._on_commit_pressed()
	await get_tree().process_frame
	_check(_committed.size() == 1 and _committed[0] == N2_ID, "E1 已选蓝图 → 确认 emit node_committed(n2)", "got %s" % str(_committed))
	_check(not _panel.is_open(), "E2 node_resolved → 面板收起（让位演出）", "still open")
	# E3: 未选蓝图 → 拦截（不 emit + 警告）
	await _prep_node(0.0)
	_committed.clear()
	_panel._on_commit_pressed()
	await get_tree().process_frame
	_check(_committed.is_empty(), "E3 未选蓝图 → 确认拦截（不 emit node_committed）", "emitted %s" % str(_committed))
	_check(_panel._special_flag_label.text.find("未声明意图") >= 0, "E4 拦截时显警告", "got '%s'" % _panel._special_flag_label.text)
	_check(_panel.is_open(), "E5 拦截后面板保持开（不误关）", "closed")


# ───────────────────────── F. minor 档（不进 STG，短横幅） ─────────────────────────

func _test_f_minor_banner() -> void:
	await _prep_node(0.7, BP_SELF)
	# verb_self_borrow_wind: v_wind=southeast(=baseline) → Δ=0 → minor
	EventBus.verb_executed.emit(VERB_SELF_WIND, &"scene_altar", true)
	await get_tree().process_frame
	EventBus.node_committed.emit(N2_ID)
	await get_tree().process_frame
	_check(_ts.is_playing(), "F1 minor → ts 可见（横幅）", "not visible")
	_check(_ts.is_minor_banner_visible(), "F2 minor → MinorBanner 显示（不进 STG）", "stage panel instead")
	_check(not _ts.is_stage_visible(), "F3 minor → 不进 STG 卷轴", "stage visible")
	_check(_ts._minor_banner_label.text.find("历史线维持") >= 0, "F4 minor X1 旁白（横幅文案）", "got '%s'" % _ts._minor_banner_label.text)


# ───────────────────────── G. notable 档（STG + 结算屏） ─────────────────────────

func _test_g_notable_stage() -> void:
	await _prep_node(0.7, BP_SELF)
	EventBus.verb_executed.emit(VERB_SMASH, &"scene_altar", true)   # v_altar=smashed → Δ=20 notable
	await get_tree().process_frame
	EventBus.node_committed.emit(N2_ID)
	await get_tree().process_frame
	_check(_ts.is_stage_visible(), "G1 notable → STG 卷轴显示", "not visible")
	_check(_ts.is_glitch_active() == false, "G2 notable → 无 glitch（仅 critical 有）", "glitch active")
	var settle: SettlementScreen = _ts.get_settlement()
	_check(settle.get_delta_text().find("20") >= 0, "G3 结算屏 Δ=20", "got '%s'" % settle.get_delta_text())
	_check(settle.get_tier_text().find("notable") >= 0, "G4 结算屏 tier=notable", "got '%s'" % settle.get_tier_text())
	_check(settle.is_worldline_visible() == false, "G5 notable → 无世界线震荡警告", "visible")
	_check(_ts.get_narration_text().find("偏差已记录") >= 0, "G6 notable X1 旁白", "got '%s'" % _ts.get_narration_text())
	# CP 打字机跳动：M=0.7, Δ=20 → CP=round(120·0.7·1.1)=92（headless 帧时间不定，强制完成动画后验证终值）
	_check(settle.get_target_cp() == 92, "G7 结算屏 CP 目标值=92（§4.2 round(120·0.7·1.1)）", "got %d" % settle.get_target_cp())
	settle.finish_cp_anim()
	_check(settle.get_cp_text().find("92") >= 0, "G7b 结算屏 CP 打字机终值到 92", "got '%s'" % settle.get_cp_text())


# ───────────────────────── H. critical 档（glitch + 世界线震荡） ─────────────────────────

func _test_h_critical_glitch() -> void:
	await _prep_node(0.0, BP_BASE)
	# verb_block_kongming: v_wind=none + v_kong=dead → Δ=80 critical
	EventBus.verb_executed.emit(VERB_BLOCK, &"enemy_kongming", true)
	await get_tree().process_frame
	EventBus.node_committed.emit(N2_ID)
	await get_tree().process_frame
	_check(_ts.is_stage_visible(), "H1 critical → STG 卷轴显示", "not visible")
	_check(_ts.is_glitch_active(), "H2 critical → glitch 激活", "no glitch")
	var settle: SettlementScreen = _ts.get_settlement()
	_check(settle.get_tier_text().find("critical") >= 0, "H3 结算屏 tier=critical", "got '%s'" % settle.get_tier_text())
	_check(settle.is_worldline_visible(), "H4 critical → 世界线震荡警告显示", "not visible")
	_check(_ts.get_narration_text().find("世界线剧烈震荡") >= 0, "H5 critical X1 世界线旁白", "got '%s'" % _ts.get_narration_text())


# ───────────────────────── I. 连续 critical 降级压缩 ─────────────────────────

func _test_i_consecutive_critical_degrade() -> void:
	# 第 1 次 critical（consecutive 0→1，不压缩）
	await _prep_node(0.0, BP_BASE)
	EventBus.verb_executed.emit(VERB_BLOCK, &"enemy_kongming", true)
	await get_tree().process_frame
	EventBus.node_committed.emit(N2_ID)
	await get_tree().process_frame
	_check(_controller.get_consecutive_critical() == 1, "I1 第1次 critical → consecutive=1", "got %d" % _controller.get_consecutive_critical())
	_check(not _ts.is_compress_note_visible(), "I2 第1次 critical → 不压缩", "compress note shown")
	# 第 2 次 critical（consecutive 1→2，压缩；注意不 reset consecutive）
	_controller._pending.clear()
	_engine.debug_reset_runtime()
	if _panel.is_open():
		_panel._close_panel()
	_ts._hide_all()
	_engine.debug_set_intel_cov(0.0)
	EventBus.node_activated.emit(N2_ID)
	await get_tree().process_frame
	_engine.select_blueprint(N2_ID, BP_BASE)
	await get_tree().process_frame
	EventBus.verb_executed.emit(VERB_BLOCK, &"enemy_kongming", true)
	await get_tree().process_frame
	EventBus.node_committed.emit(N2_ID)
	await get_tree().process_frame
	_check(_ts.is_compress_note_visible(), "I3 第2次连续 critical → 降级压缩提示", "no compress note")
	_check(_controller.get_consecutive_critical() == 2, "I4 consecutive_critical=2", "got %d" % _controller.get_consecutive_critical())
	# notable → 计数重置 0
	await _prep_node(0.7, BP_SELF)
	EventBus.verb_executed.emit(VERB_SMASH, &"scene_altar", true)
	await get_tree().process_frame
	EventBus.node_committed.emit(N2_ID)
	await get_tree().process_frame
	_check(_controller.get_consecutive_critical() == 0, "I5 notable 后 consecutive_critical 重置 0", "got %d" % _controller.get_consecutive_critical())


# ───────────────────────── J. 预览 vs 锁定区分 ─────────────────────────

func _test_j_preview_vs_lock() -> void:
	await _prep_node(0.7, BP_SELF)
	# 仅发预览态 deviation（is_preview=true）→ 控制器不演出
	EventBus.deviation_recomputed.emit(N2_ID, 50, true)
	await get_tree().process_frame
	_check(not _ts.is_playing(), "J1 is_preview=true deviation → 控制器不演出", "playing")
	# 结算态（is_preview=false）累积但不触发 node_resolved → 仍不演出
	EventBus.deviation_recomputed.emit(N2_ID, 50, false)
	await get_tree().process_frame
	_check(not _ts.is_playing(), "J2 仅 deviation(is_preview=false) 无 node_resolved → 不演出", "playing")
	_check(_controller._pending.has(String(N2_ID)), "J3 结算 deviation 已累积 _pending", "empty")


# ───────────────────────── K. 蓝图不可达兜底（M=0 → CP≈0 + 意图落空） ─────────────────────────

func _test_k_unreachable_fallback() -> void:
	await _prep_node(0.0)   # 不选蓝图
	EventBus.verb_executed.emit(VERB_SMASH, &"scene_altar", true)
	await get_tree().process_frame
	# 测试直接 emit node_committed（模拟任务级强制 / §5.5 兜底；面板拦截不影响此路径）
	EventBus.node_committed.emit(N2_ID)
	await get_tree().process_frame
	var settle: SettlementScreen = _ts.get_settlement()
	_check(settle.get_match_text().find("0.00") >= 0, "K1 未选蓝图 → M=0.00", "got '%s'" % settle.get_match_text())
	settle.finish_cp_anim()
	_check(settle.get_cp_text().find("+0") >= 0, "K2 M=0 → CP≈0（不崩，§5.5）", "got '%s'" % settle.get_cp_text())
	_check(_ts.get_narration_text().find("意图落空") >= 0, "K3 意图落空旁白", "got '%s'" % _ts.get_narration_text())


# ───────────────────────── L. node_vanished ─────────────────────────

func _test_l_node_vanished() -> void:
	await _prep_node(0.7, BP_SELF)
	_check(_panel.is_open(), "L1 面板开", "closed")
	# 模拟下游节点 n3 消失（存在性不满足）→ 控制器播消失横幅
	EventBus.node_vanished.emit(N3_ID)
	await get_tree().process_frame
	_check(_ts.is_minor_banner_visible(), "L2 node_vanished(n3) → 消失横幅显示", "no banner")
	_check(_ts._minor_banner_label.text.find("从历史中消失") >= 0, "L3 消失旁白文案", "got '%s'" % _ts._minor_banner_label.text)
	# node_vanished 对当前激活节点 → 面板收起
	EventBus.node_vanished.emit(N2_ID)
	await get_tree().process_frame
	_check(not _panel.is_open(), "L4 node_vanished(当前节点) → 面板收起（无悬挂 UI）", "still open")


# ───────────────────────── M. 焦点链 + 信号生命周期 ─────────────────────────

func _test_m_focus_chain_and_signals() -> void:
	await _prep_node(0.6, BP_SELF)
	var bp_btn: Button = _panel.get_blueprint_button(BP_SELF)
	var verb_btn: Button = _panel.get_verb_button(VERB_SMASH)
	_check(bp_btn != null and bp_btn.focus_mode == Control.FOCUS_ALL, "M1 蓝图卡焦点可达", "focus_mode=%s" % (bp_btn.focus_mode if bp_btn else -1))
	_check(verb_btn != null and verb_btn.focus_mode == Control.FOCUS_ALL, "M2 动词行焦点可达", "focus_mode=%s" % (verb_btn.focus_mode if verb_btn else -1))
	_check(_panel._commit_button.focus_mode == Control.FOCUS_ALL, "M3 确认按钮焦点可达", "no")
	# 信号生命周期：面板/控制器 connect 恰 1 次（无重复 connect）
	var pc := EventBus.deviation_recomputed.get_connections().filter(func(c): return c.callable.get_object() == _panel)
	var cc := EventBus.deviation_recomputed.get_connections().filter(func(c): return c.callable.get_object() == _controller)
	_check(pc.size() == 1, "M4 面板 connect deviation_recomputed 恰 1 次", "got %d" % pc.size())
	_check(cc.size() == 1, "M5 控制器 connect deviation_recomputed 恰 1 次", "got %d" % cc.size())


# ───────────────────────── 辅助 ─────────────────────────

func _advance_frames(frames: int) -> void:
	for i in frames:
		await get_tree().process_frame


func _on_node_committed(node_id: StringName) -> void:
	_committed.append(node_id)


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
