extends Node

## tests/unit/test_system_panel.gd —— 系统面板 UI 最小控制器测试（issue #15 / engineering-lead.md：每个 Story 附测试证据）。
##
## 运行：$GODOT_BIN --headless --path game res://tests/unit/test_system_panel.tscn
##
## 覆盖（issue #15 验收要点）：
##   A. 初始闭合 + 默认 Tab=任务（initial_tab）+ 任务 Tab 只读占位文案。
##   B. 信号驱动只读显示（禁轮询，ux-spec §10.1）：
##        - cp_balance_changed → CP 标签更新 + 数值动效到达终值（art-bible §7.3 滚动）。
##        - deviation_recomputed（is_preview true/false）→ 偏差 Tab 节点/数值/模式标签。
##        - quest_objective_updated → 任务 Tab 节点/短目标/长目标。
##        - quest_progress_updated → 任务 Tab 章节/进度百分比。
##   C. 呼出/关闭输入（ux-spec §6.2/§8.1）：
##        - ui_menu（Tab/Select）打开 → 再按关闭（toggle）；不暂停游戏（SceneTree.paused 保持 false）。
##        - ui_cancel（Esc/B）关闭。
##   D. Tab 导航（control-manifest 焦点链 / ux-spec §6.5）：
##        - panel_tab_next（Q/LB）循环切 Tab（0→1→...→4→0）。
##        - 切 Tab 切 view 可见性；占位 Tab（技能树/兑换/情报）显 TODO(p-followup)。
##   E. 数据驱动（control-manifest「数据驱动」）：文案来自 ui_strings.tres，非硬编码（改 .tres 文案生效）。
##   F. 信号纪律（adr-004）：消费 S1→S3/S2→S3 信号逐条对齐 panel-progression §6.1/§6.2，零新增。

const PANEL_SCENE: PackedScene = preload("res://ui/system_panel/system_panel.tscn")
const UI_STRINGS: PanelUiStrings = preload("res://data/panel/ui_strings.tres")

var _passed: int = 0
var _failed: int = 0


func _ready() -> void:
	await _run()
	_summary()
	get_tree().quit(1 if _failed > 0 else 0)


func _run() -> void:
	_test_a_initial_closed_default_tab()
	await _test_b_cp_balance_signal_and_anim()
	_test_b2_deviation_signal_preview_settled()
	_test_b3_quest_objective_signal()
	_test_b4_quest_progress_signal()
	_test_c_toggle_via_input()
	_test_c2_cancel_closes()
	_test_d_tab_navigation()
	_test_e_data_driven_strings()


# ───────────────────────── A. 初始态 ─────────────────────────

func _test_a_initial_closed_default_tab() -> void:
	var p: SystemPanelController = _new_panel()
	_check(not p.is_open(), "A1 panel closed by default", "open=%s" % p.is_open())
	_check(p.get_active_tab() == SystemPanelController.Tab.QUEST, "A2 default tab = QUEST(4)", "got %d" % p.get_active_tab())
	# 任务 Tab 默认可见，其余隐藏
	_check(p._tab_views[SystemPanelController.Tab.QUEST].visible, "A3 QuestView visible by default", "not visible")
	_check(not p._tab_views[SystemPanelController.Tab.DEVIATION].visible, "A4 DeviationView hidden by default", "visible")
	p.queue_free()


# ───────────────────────── B. 信号驱动只读显示 ─────────────────────────

func _test_b_cp_balance_signal_and_anim() -> void:
	var p: SystemPanelController = _new_panel()
	# 初始 CP 显示 0
	_check(p.get_cp_displayed() == 0, "B1 initial cp displayed = 0", "got %d" % p.get_cp_displayed())
	# 发 cp_balance_changed（S3→HUD，占位 emit；C3 emit 侧待 P5-4/P5-5）
	EventBus.cp_balance_changed.emit(180, 180)
	# 数值动效（art-bible §7.3 滚动 ~0.3s）—— 等帧让 tween_method 推进到终值
	await _advance_frames(40)
	_check(p.get_cp_displayed() == 180, "B2 cp_balance_changed → displayed reaches 180", "got %d" % p.get_cp_displayed())
	_check(p._cp_value_label.text == "180 %s" % UI_STRINGS.cp_unit, "B3 cp label text data-driven", "got '%s'" % p._cp_value_label.text)
	_check(p.get_cp_balance() == 180, "B4 cp balance state = 180", "got %d" % p.get_cp_balance())
	# 游戏未暂停（ux-spec §6.2 打开层级「不暂停游戏」——此处仅校验信号不碰 paused）
	_check(not get_tree().paused, "B5 signal does NOT pause game", "paused=true")
	p.queue_free()


func _test_b2_deviation_signal_preview_settled() -> void:
	var p: SystemPanelController = _new_panel()
	# 预览态（is_preview=true，ux-spec §6.3 改写面板 Δ 实时预览）
	EventBus.deviation_recomputed.emit(&"n2_east_wind", 32, true)
	_check(p.get_deviation_value() == 32, "B5a deviation value = 32", "got %d" % p.get_deviation_value())
	_check(p.is_deviation_preview(), "B5b is_preview = true", "got false")
	_check(p._dev_node_label.text == "%s: n2_east_wind" % UI_STRINGS.deviation_node_label, "B5c dev node label", "got '%s'" % p._dev_node_label.text)
	_check(p._dev_value_label.text == "%s: 32/100" % UI_STRINGS.deviation_label, "B5d dev value label", "got '%s'" % p._dev_value_label.text)
	_check(p._dev_mode_label.text == UI_STRINGS.deviation_preview_suffix, "B5e dev mode = preview suffix", "got '%s'" % p._dev_mode_label.text)
	# 结算态（is_preview=false，§2.5/§9.2）
	EventBus.deviation_recomputed.emit(&"n2_east_wind", 58, false)
	_check(p.get_deviation_value() == 58, "B5f settled deviation = 58", "got %d" % p.get_deviation_value())
	_check(not p.is_deviation_preview(), "B5g is_preview = false (settled)", "got true")
	_check(p._dev_mode_label.text == UI_STRINGS.deviation_settled_suffix, "B5h dev mode = settled suffix", "got '%s'" % p._dev_mode_label.text)
	p.queue_free()


func _test_b3_quest_objective_signal() -> void:
	var p: SystemPanelController = _new_panel()
	EventBus.quest_objective_updated.emit(&"n2_east_wind", "前往七星坛，决定东风是否借成", "周瑜欲火攻却缺东南风…此节点成败将决定华容道是否出现")
	_check(p._quest_node_label.text == "%s: n2_east_wind" % UI_STRINGS.quest_node_label, "B6a quest node label", "got '%s'" % p._quest_node_label.text)
	_check(p._quest_short_label.text == "前往七星坛，决定东风是否借成", "B6b quest short label", "got '%s'" % p._quest_short_label.text)
	_check(p._quest_long_label.text == "周瑜欲火攻却缺东南风…此节点成败将决定华容道是否出现", "B6c quest long label", "got '%s'" % p._quest_long_label.text)
	p.queue_free()


func _test_b4_quest_progress_signal() -> void:
	var p: SystemPanelController = _new_panel()
	EventBus.quest_progress_updated.emit(&"ch_chibi_war", 0.4)
	_check(p._chapter_label.text == "%s: ch_chibi_war" % UI_STRINGS.chapter_label, "B7a chapter label", "got '%s'" % p._chapter_label.text)
	_check(p._progress_label.text == "%s: 40%%" % UI_STRINGS.progress_label, "B7b progress label 40%", "got '%s'" % p._progress_label.text)
	# clamp 上限
	EventBus.quest_progress_updated.emit(&"ch_chibi_war", 1.5)
	_check(p._progress_label.text == "%s: 100%%" % UI_STRINGS.progress_label, "B7c progress clamped to 100%", "got '%s'" % p._progress_label.text)
	p.queue_free()


# ───────────────────────── C. 呼出/关闭输入（ux-spec §6.2/§8.1） ─────────────────────────

func _test_c_toggle_via_input() -> void:
	var p: SystemPanelController = _new_panel()  # _new_panel 已 add_child 到场景树
	# ui_menu 打开
	_check(not p.is_open(), "C1 closed before ui_menu", "open")
	p._unhandled_input(_action_event("ui_menu", true))
	_check(p.is_open(), "C2 ui_menu opens panel", "still closed")
	_check(not get_tree().paused, "C3 open does NOT pause game (ux-spec §6.2)", "paused=true")
	# ui_menu 再按 → 关闭（toggle）
	p._unhandled_input(_action_event("ui_menu", true))
	_check(not p.is_open(), "C4 ui_menu toggles closed", "still open")
	p.queue_free()


func _test_c2_cancel_closes() -> void:
	var p: SystemPanelController = _new_panel()
	p.open_panel()
	_check(p.is_open(), "C5 opened", "closed")
	# ui_cancel 仅在打开时关闭
	p._unhandled_input(_action_event("ui_cancel", true))
	_check(not p.is_open(), "C6 ui_cancel closes open panel", "still open")
	# 关闭态 ui_cancel 不应打开
	p._unhandled_input(_action_event("ui_cancel", true))
	_check(not p.is_open(), "C7 ui_cancel does NOT open closed panel", "got open")
	p.queue_free()


# ───────────────────────── D. Tab 导航（control-manifest 焦点链 / ux-spec §6.5） ─────────────────────────

func _test_d_tab_navigation() -> void:
	var p: SystemPanelController = _new_panel()
	p.open_panel()
	# panel_tab_next 循环：QUEST(4) → DEVIATION(0)（% 5）
	p._unhandled_input(_action_event("panel_tab_next", true))
	_check(p.get_active_tab() == SystemPanelController.Tab.DEVIATION, "D1 panel_tab_next QUEST→DEVIATION", "got %d" % p.get_active_tab())
	_check(p._tab_views[SystemPanelController.Tab.DEVIATION].visible, "D2 DeviationView visible after switch", "not visible")
	_check(not p._tab_views[SystemPanelController.Tab.QUEST].visible, "D3 QuestView hidden after switch", "still visible")
	# 连续 panel_tab_next 走完一轮
	p._unhandled_input(_action_event("panel_tab_next", true))  # → SKILL_TREE(1)
	p._unhandled_input(_action_event("panel_tab_next", true))  # → EXCHANGE(2)
	p._unhandled_input(_action_event("panel_tab_next", true))  # → INTEL(3)
	_check(p.get_active_tab() == SystemPanelController.Tab.INTEL, "D4 panel_tab_next reaches INTEL", "got %d" % p.get_active_tab())
	# 占位 Tab 显 TODO(p-followup)
	_check(p._intel_placeholder.text == UI_STRINGS.todo_placeholder, "D5 intel placeholder = TODO(p-followup)", "got '%s'" % p._intel_placeholder.text)
	p._unhandled_input(_action_event("panel_tab_next", true))  # → QUEST(4)
	p._unhandled_input(_action_event("panel_tab_next", true))  # → DEVIATION(0)（循环）
	_check(p.get_active_tab() == SystemPanelController.Tab.DEVIATION, "D6 panel_tab_next wraps 4→0", "got %d" % p.get_active_tab())
	# 关闭态 panel_tab_next 不切（守输入边界）
	p.close_panel()
	var before: int = p.get_active_tab()
	p._unhandled_input(_action_event("panel_tab_next", true))
	_check(p.get_active_tab() == before, "D7 panel_tab_next ignored when closed", "changed %d→%d" % [before, p.get_active_tab()])
	p.queue_free()


# ───────────────────────── E. 数据驱动（control-manifest「数据驱动」） ─────────────────────────

func _test_e_data_driven_strings() -> void:
	var p: SystemPanelController = _new_panel()
	# 标题/Tab 名/标签均来自 ui_strings.tres，非脚本硬编码
	_check(p._title_label.text == UI_STRINGS.panel_title, "E1 title from ui_strings", "got '%s'" % p._title_label.text)
	_check(p._cp_key_label.text == UI_STRINGS.cp_balance_label, "E2 cp label from ui_strings", "got '%s'" % p._cp_key_label.text)
	_check(p._tab_buttons[SystemPanelController.Tab.DEVIATION].text == UI_STRINGS.tab_deviation, "E3 tab name from ui_strings", "got '%s'" % p._tab_buttons[SystemPanelController.Tab.DEVIATION].text)
	# 改 ui_strings 文案 → _apply_strings 后生效（证明无硬编码）
	p.ui_strings.panel_title = "临时改写·观测台"
	p._apply_strings()
	_check(p._title_label.text == "临时改写·观测台", "E4 title reflects changed ui_strings (no hardcode)", "got '%s'" % p._title_label.text)
	# 还原
	p.ui_strings.panel_title = UI_STRINGS.panel_title
	p.queue_free()


# ───────────────────────── 辅助 ─────────────────────────

func _new_panel() -> SystemPanelController:
	var p: SystemPanelController = PANEL_SCENE.instantiate()
	add_child(p)
	return p


func _advance_frames(frames: int) -> void:
	for i in frames:
		await get_tree().process_frame


func _action_event(action: String, pressed: bool) -> InputEventAction:
	# 构造 InputEventAction 喂给 _unhandled_input 做单测（无需真实设备输入）。
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = pressed
	return ev


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
