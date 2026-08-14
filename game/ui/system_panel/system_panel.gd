class_name SystemPanelController
extends Control

## SystemPanel · 系统面板 UI（玩法层 G7 · architecture §3.3 / §8.3 / ux-spec §6）。
##
## 参考：
##   - architecture §3.3 G7 系统面板 UI / §8.2-§8.3 场景叠层（RewritePanel CanvasLayer，覆于 L5 之上）
##     / §7.2 信号总表 / adr-004（信号优先，消费方主动 connect）。
##   - ux-spec §6（系统面板：§6.1 归属节点 / §6.2 打开层级「不暂停游戏，仅 UI 聚焦」
##     / §6.5 系统 Tab 子形态）/ §8.1 输入映射总表 / §10.1「禁轮询」。
##   - panel-progression §6.1/§6.2（消费 S1→S3/S2→S3 信号）/ §6.4（cp_balance_changed S3→HUD）
##     / §2.1 信息密度分级 / §6.5 系统 Tab 清单。
##   - control-manifest「数据驱动」「信号驱动禁轮询」「UI 焦点链」节。
##
## 本 issue（P5-3）范围 = 呼出/关闭 + 四项核心只读显示：
##   1. CP 余额（cp_balance_changed，S3→HUD；panel §6.4）—— 头部常驻 + 数值动效（art-bible §7.3 滚动）
##   2. 等级/章节进度（quest_progress_updated，S2→S3；panel §6.2）—— 任务 Tab
##   3. 当前任务/节点目标（quest_objective_updated，S2→S3；panel §6.2）—— 任务 Tab
##   4. 历史偏差 Δ（deviation_recomputed，S1→S3；panel §6.1，is_preview 区分实时预览/结算）—— 偏差 Tab
##
## 越界子形态（改写面板操作台/技能树解锁交互/CP 兑换交互/情报强化交互/历史线分叉演出 STG）
## 一律 TODO(p-followup)，留 P5-5/P5-6；对应 Tab 显占位文案（ui_strings.todo_placeholder），不实现交互。
##
## 信号纪律（adr-004 / event_bus.gd 注释 / control-manifest 信号节）：
##   - 消费的 S1→S3/S2→S3 信号逐条对齐 panel-progression §6.1/§6.2 + architecture §7.2，零新增、零改名。
##   - S1(C1)/S2(C2)/C3(PanelProgression) 的 emit 侧待 P5-4/P5-5 核心层落地；本面板只 connect 做只读显示，
##     不臆造 S1/S2 实现（知识诚实红线）。未接线前面板显示初值占位（从 ui_strings 读「—」类兜底文案）。
##
## 数据驱动（control-manifest「数据驱动」/ ux-spec §10.1「禁轮询」）：
##   - 静态文案/标签读 game/data/panel/ui_strings.tres（PanelUiStrings），无硬编码字符串。
##   - 运行时数值仅 EventBus 信号订阅刷新，零轮询（每帧不读生产方属性）。
##
## 输入（adr-003 / ux-spec §6.2/§8.1）：
##   - ui_menu（Tab/Select）打开/收起；ui_cancel（Esc/B）收起；面板内 ui_left/right（方向键/D-pad）焦点导航切 Tab；
##     panel_tab_next（Q/LB）循环切 Tab。打开时不暂停游戏，仅 UI 聚焦（ux-spec §6.2）。

enum Tab { DEVIATION, SKILL_TREE, EXCHANGE, INTEL, QUEST }

@export var ui_strings: PanelUiStrings
@export var initial_tab: Tab = Tab.QUEST
@export var debug_log: bool = false

# ── 当前展示态（信号驱动；初值占位，S1/S2/C3 接线后由信号覆盖）──
var _cp_balance: int = 0
var _deviation_node_id: StringName = &""
var _deviation_value: int = 0
var _deviation_is_preview: bool = false
var _quest_node_id: StringName = &""
var _quest_short: String = ""
var _quest_long: String = ""
var _chapter_id: StringName = &""
var _chapter_progress: float = 0.0

# 内部选中 Tab（int，避免 enum/int 赋值摩擦；与 Tab 枚举值比较）
var _active_tab: int = Tab.QUEST

# CP 数值动效（art-bible §7.3 滚动；create_tween 绑定本节点，close 时 kill）
var _cp_displayed: int = 0
var _cp_tween: Tween = null

# 场景唯一节点引用（%Name，与容器嵌套深度解耦）
@onready var _title_label: Label = %TitleLabel
@onready var _cp_key_label: Label = %CPKeyLabel
@onready var _cp_value_label: Label = %CPValueLabel
@onready var _tab_buttons: Array[BaseButton] = [
	%TabDeviation, %TabSkillTree, %TabExchange, %TabIntel, %TabQuest,
]
@onready var _tab_views: Array[Control] = [
	%DeviationView, %SkillTreeView, %ExchangeView, %IntelView, %QuestView,
]
@onready var _dev_node_label: Label = %DevNodeLabel
@onready var _dev_value_label: Label = %DevValueLabel
@onready var _dev_mode_label: Label = %DevModeLabel
@onready var _skill_placeholder: Label = %SkillPlaceholderLabel
@onready var _exchange_placeholder: Label = %ExchangePlaceholderLabel
@onready var _intel_placeholder: Label = %IntelPlaceholderLabel
@onready var _chapter_label: Label = %ChapterLabel
@onready var _progress_label: Label = %ProgressLabel
@onready var _quest_node_label: Label = %QuestNodeLabel
@onready var _quest_short_label: Label = %QuestShortLabel
@onready var _quest_long_label: Label = %QuestLongLabel


func _ready() -> void:
	if ui_strings == null:
		push_warning("SystemPanel: ui_strings 未赋值，回退 res://data/panel/ui_strings.tres")
		ui_strings = load("res://data/panel/ui_strings.tres")
	_apply_strings()
	# adr-004 §后果：消费方在 _ready 主动 connect EventBus；_exit_tree disconnect 防悬挂回调。
	EventBus.cp_balance_changed.connect(_on_cp_balance_changed)
	EventBus.deviation_recomputed.connect(_on_deviation_recomputed)
	EventBus.quest_objective_updated.connect(_on_quest_objective_updated)
	EventBus.quest_progress_updated.connect(_on_quest_progress_updated)
	# Tab 按钮：toggle 视觉高亮当前 Tab（手动管理 set_pressed_no_signal，不触发信号）；
	# focus_mode=ALL 让方向键/D-pad 焦点可达（control-manifest 焦点链；手柄无鼠标）。
	for i in range(_tab_buttons.size()):
		var btn: BaseButton = _tab_buttons[i]
		btn.toggle_mode = true
		btn.focus_mode = Control.FOCUS_ALL
		btn.pressed.connect(_select_tab.bind(i))
	_active_tab = int(initial_tab)
	_refresh_all_displays()
	_select_tab(_active_tab, false)
	visible = false  # 默认关闭（world 场景内由 ui_menu 呼出）


func _exit_tree() -> void:
	# adr-004：切场景/销毁时 disconnect 防悬挂回调（只断本对象自己的连接）。
	for sig in [EventBus.cp_balance_changed, EventBus.deviation_recomputed,
			EventBus.quest_objective_updated, EventBus.quest_progress_updated]:
		for c in sig.get_connections():
			if c.callable.get_object() == self:
				sig.disconnect(c.callable)


func _apply_strings() -> void:
	_title_label.text = ui_strings.panel_title
	_cp_key_label.text = ui_strings.cp_balance_label
	_tab_buttons[Tab.DEVIATION].text = ui_strings.tab_deviation
	_tab_buttons[Tab.SKILL_TREE].text = ui_strings.tab_skill_tree
	_tab_buttons[Tab.EXCHANGE].text = ui_strings.tab_exchange
	_tab_buttons[Tab.INTEL].text = ui_strings.tab_intel
	_tab_buttons[Tab.QUEST].text = ui_strings.tab_quest
	# 占位 Tab：本 issue 不实现的子形态（TODO(p-followup)）
	_skill_placeholder.text = ui_strings.todo_placeholder
	_exchange_placeholder.text = ui_strings.todo_placeholder
	_intel_placeholder.text = ui_strings.todo_placeholder


# ───────────────────────── 输入：呼出/关闭/切 Tab（ux-spec §6.2/§8.1） ─────────────────────────

func _unhandled_input(event: InputEvent) -> void:
	# ui_menu（Tab/Select）打开/收起；ui_cancel（Esc/B）收起（ux-spec §3.2 跳转矩阵 SP(系统)→HUD）。
	# panel_tab_next（Q/LB）面板内循环切 Tab（ux-spec §6.2/§8.1）。
	# set_input_as_handled：本面板已处理，阻止后续节点重复响应同一输入。
	if event.is_action_pressed("ui_menu"):
		toggle_panel()
		get_viewport().set_input_as_handled()
	elif visible and event.is_action_pressed("ui_cancel"):
		close_panel()
		get_viewport().set_input_as_handled()
	elif visible and event.is_action_pressed("panel_tab_next"):
		_select_tab((_active_tab + 1) % _tab_buttons.size())
		get_viewport().set_input_as_handled()


func toggle_panel() -> void:
	if visible:
		close_panel()
	else:
		open_panel()


func open_panel() -> void:
	# ux-spec §6.2：打开时不暂停游戏（不置 SceneTree.paused），仅 UI 聚焦（grab_focus 供手柄/键盘导航）。
	visible = true
	_select_tab(_active_tab, true)
	if debug_log:
		print("[SystemPanel] opened (game NOT paused; UI focused)")


func close_panel() -> void:
	visible = false
	if _cp_tween != null:
		_cp_tween.kill()
		_cp_tween = null
	release_focus()
	if debug_log:
		print("[SystemPanel] closed")


func _select_tab(idx: int, grab: bool = true) -> void:
	if idx < 0 or idx >= _tab_buttons.size():
		return
	_active_tab = idx
	# 切 view 可见性（进阶层按 Tab 分页，panel-progression §2.1）
	for i in range(_tab_views.size()):
		_tab_views[i].visible = (i == idx)
	# Tab 按钮高亮（toggle 状态，不触发 pressed 信号）
	for i in range(_tab_buttons.size()):
		_tab_buttons[i].set_pressed_no_signal(i == idx)
	# 焦点（control-manifest 焦点链：手柄/键盘方向键导航；面板可见时才抢焦）
	if grab and visible:
		_tab_buttons[idx].grab_focus()


# ───────────────────────── EventBus 信号订阅（只读显示，禁轮询 · ux-spec §10.1） ─────────────────────────

func _on_cp_balance_changed(new_balance: int, _delta: int) -> void:
	_cp_balance = new_balance
	_animate_cp(new_balance)

func _on_deviation_recomputed(node_id: StringName, delta_node: int, is_preview: bool) -> void:
	_deviation_node_id = node_id
	_deviation_value = delta_node
	_deviation_is_preview = is_preview
	_refresh_deviation()

func _on_quest_objective_updated(node_id: StringName, objective_short: String, objective_long: String) -> void:
	_quest_node_id = node_id
	_quest_short = objective_short
	_quest_long = objective_long
	_refresh_quest()

func _on_quest_progress_updated(chapter_id: StringName, p_ch: float) -> void:
	_chapter_id = chapter_id
	_chapter_progress = clampf(p_ch, 0.0, 1.0)
	_refresh_quest()


# ───────────────────────── 显示刷新（数据驱动：文案读 ui_strings，数值来自信号） ─────────────────────────

func _refresh_all_displays() -> void:
	_set_cp_text(_cp_balance)
	_refresh_deviation()
	_refresh_quest()


func _refresh_deviation() -> void:
	var node_text: String = ui_strings.deviation_node_none
	if _deviation_node_id != &"":
		node_text = String(_deviation_node_id)
	_dev_node_label.text = "%s: %s" % [ui_strings.deviation_node_label, node_text]
	_dev_value_label.text = "%s: %d/100" % [ui_strings.deviation_label, _deviation_value]
	_dev_mode_label.text = ui_strings.deviation_preview_suffix if _deviation_is_preview else ui_strings.deviation_settled_suffix


func _refresh_quest() -> void:
	var chap: String = String(_chapter_id) if _chapter_id != &"" else ui_strings.chapter_none
	_chapter_label.text = "%s: %s" % [ui_strings.chapter_label, chap]
	var pct: int = int(round(_chapter_progress * 100.0))
	_progress_label.text = "%s: %d%%" % [ui_strings.progress_label, pct]
	var node_text: String = String(_quest_node_id) if _quest_node_id != &"" else ui_strings.quest_node_none
	_quest_node_label.text = "%s: %s" % [ui_strings.quest_node_label, node_text]
	_quest_short_label.text = _quest_short if _quest_short != "" else ui_strings.quest_objective_none
	_quest_long_label.text = _quest_long


# CP 数值跳动动效（art-bible §7.3 打字机/滚动；litRPG 爽感，单 tween 串行，close 时 kill）
func _animate_cp(new_balance: int) -> void:
	if _cp_tween != null:
		_cp_tween.kill()
	_cp_tween = create_tween()
	_cp_tween.tween_method(_set_cp_text, _cp_displayed, new_balance, ui_strings.cp_anim_duration)
	_cp_tween.tween_callback(func() -> void:
		_cp_displayed = new_balance
		_cp_tween = null)


func _set_cp_text(v: int) -> void:
	_cp_displayed = v
	_cp_value_label.text = "%d %s" % [v, ui_strings.cp_unit]


# ───────────────────────── 公共查询（测试/调试；G7 UI 不持游戏态，仅暴露展示态） ─────────────────────────

func is_open() -> bool:
	return visible

func get_active_tab() -> int:
	return _active_tab

func get_cp_displayed() -> int:
	return _cp_displayed

func get_cp_balance() -> int:
	return _cp_balance

func get_deviation_value() -> int:
	return _deviation_value

func is_deviation_preview() -> bool:
	return _deviation_is_preview
