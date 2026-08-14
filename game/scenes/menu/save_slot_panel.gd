class_name SaveSlotPanel
extends Control

## SaveSlotPanel · 存档槽位子面板（ux-spec §4.3）。主菜单/未来暂停菜单共用（§15 风险3 DRY）。
## 参考：ux-spec §4.3（每槽：章节/Δ累计/世界线/时间/朝代；空槽直写、非空二次确认）；
##       §9.3（覆盖确认弹窗）；architecture §9.1（持久化范围）/ §9.3（多槽位）。
##
## 输入（ux-spec §4.4）：
##   - ui_left/ui_right：槽位面板内选槽（本面板 _unhandled_input 处理）。
##   - ui_accept：执行当前选中动作（载入/覆盖，由焦点按钮响应）。
##   - ui_cancel：返回（关闭面板）。
##
## 与 SaveManager 的契约：
##   - list_slots() 读摘要展示；continue_slot(slot)/new_game_to_slot(slot) 进 world。
##   - 非空槽「覆盖新存档」→ 二次确认（ConfirmDialog，§9.3）→ new_game_to_slot。
##   - 空槽「覆盖新存档」→ 直接 new_game_to_slot（无确认，§4.3 空槽直写）。
##
## 信号：进入 world 前发 entry_chosen(slot) 让 MainMenu 统一 change_scene_to(world)（避免本面板管场景跳转）。

signal closed
signal entry_chosen(slot: int)

const _COLOR_CYAN := Color(0.6, 0.85, 1, 1)
const _COLOR_DATA := Color(0.92, 0.96, 1, 1)
const _COLOR_LABEL := Color(0.55, 0.78, 0.95, 1)
const _COLOR_DIM := Color(0.5, 0.55, 0.62, 1)
const _COLOR_WARN := Color(1.0, 0.45, 0.35, 1)
const _COLOR_SELECTED := Color(0.6, 0.85, 1, 0.95)
const _COLOR_BG := Color(0.02, 0.05, 0.1, 0.6)

@onready var _dim: ColorRect = %DimRect
@onready var _slots_row: HBoxContainer = %SlotsRow
@onready var _hint_label: Label = %HintLabel
@onready var _load_button: Button = %LoadButton
@onready var _new_button: Button = %NewSaveButton
@onready var _back_button: Button = %BackButton
@onready var _confirm_dialog: ConfirmDialog = %ConfirmDialog

var _selected_slot: int = 0
var _summaries: Array = []
var _card_panels: Array = []   # 每槽对应的 PanelContainer（高亮用）


func _ready() -> void:
	for btn in [_load_button, _new_button, _back_button]:
		btn.focus_mode = Control.FOCUS_ALL
	_load_button.pressed.connect(_on_load_pressed)
	_new_button.pressed.connect(_on_new_pressed)
	_back_button.pressed.connect(_on_back_pressed)
	_confirm_dialog.visible = false


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	# 子确认弹窗可见时不处理（防穿透：Esc/导航交给 ConfirmDialog）。
	if _confirm_dialog.visible:
		return
	if event.is_action_pressed("ui_cancel"):
		_on_back_pressed()
		get_viewport().set_input_as_handled()
		return
	if event.is_action_pressed("ui_left"):
		_select_slot((_selected_slot - 1 + SaveManager.NUM_SLOTS) % SaveManager.NUM_SLOTS)
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_right"):
		_select_slot((_selected_slot + 1) % SaveManager.NUM_SLOTS)
		get_viewport().set_input_as_handled()


## 打开面板：刷新槽位摘要 + 默认选中最近槽（无则槽 0）+ grab 焦点到动作按钮。
func open_panel() -> void:
	_refresh()
	var recent := SaveManager.get_recent_slot()
	_select_slot(recent if recent >= 0 else 0)
	visible = true
	# 默认焦点：有存档选中载入，否则覆盖新存档。
	if _is_empty(_selected_slot):
		_new_button.grab_focus()
	else:
		_load_button.grab_focus()


func _refresh() -> void:
	_summaries = SaveManager.list_slots()
	for c in _slots_row.get_children():
		c.queue_free()
	_card_panels.clear()
	for s in _summaries:
		_card_panels.append(_build_card(s))
	# 朝代切换禁用提示已在场景静态 Label（§5.4 待审批·禁用预留入口）。


## 单槽卡片（章节/Δ累计/世界线/时间/朝代；空槽显示「新存档」）。
func _build_card(summary: Dictionary) -> PanelContainer:
	var card := PanelContainer.new()
	card.custom_minimum_size = Vector2(220, 180)
	var sb := StyleBoxFlat.new()
	sb.bg_color = _COLOR_BG
	sb.border_width_left = 2
	sb.border_width_top = 2
	sb.border_width_right = 2
	sb.border_width_bottom = 2
	sb.border_color = _COLOR_DIM
	sb.corner_radius_top_left = 4
	sb.corner_radius_top_right = 4
	sb.corner_radius_bottom_right = 4
	sb.corner_radius_bottom_left = 4
	card.add_theme_stylebox_override("panel", sb)
	var margin := MarginContainer.new()
	margin.add_theme_constant_override("margin_left", 14)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_right", 14)
	margin.add_theme_constant_override("margin_bottom", 12)
	card.add_child(margin)
	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	margin.add_child(vbox)
	var empty := bool(summary.get("empty", true))
	# 槽标题
	var title := Label.new()
	title.text = "槽 %d%s" % [int(summary.get("slot", 0)), (" ★最近" if _is_recent(summary) else "")]
	title.add_theme_color_override("font_color", _COLOR_CYAN)
	vbox.add_child(title)
	if empty:
		var ph := Label.new()
		ph.text = "（空）\n新存档"
		ph.add_theme_color_override("font_color", _COLOR_DIM)
		vbox.add_child(ph)
	else:
		vbox.add_child(_line("章节: %s" % String(summary.get("chapter_id", ""))))
		vbox.add_child(_line("章节进度: %d%%" % int(round(float(summary.get("chapter_progress", 0.0)) * 100.0))))
		vbox.add_child(_line("Δ 累计: %d" % int(summary.get("delta_total", 0))))
		var wl := _line("世界线: %s" % ("震荡" if bool(summary.get("worldline_shaken", false)) else "稳定"))
		wl.add_theme_color_override("font_color", _COLOR_WARN if bool(summary.get("worldline_shaken", false)) else _COLOR_DATA)
		vbox.add_child(wl)
		vbox.add_child(_line("时间: %s" % String(summary.get("saved_at_text", "—"))))
		vbox.add_child(_line("朝代: %s" % String(summary.get("dynasty", ""))))
	_slots_row.add_child(card)
	return card


func _line(text: String) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_color_override("font_color", _COLOR_DATA)
	return l


func _is_recent(summary: Dictionary) -> bool:
	return int(summary.get("slot", -1)) == SaveManager.get_recent_slot() and not bool(summary.get("empty", true))


func _is_empty(slot: int) -> bool:
	if slot < 0 or slot >= _summaries.size():
		return true
	return bool((_summaries[slot] as Dictionary).get("empty", true))


## 选中槽：更新高亮（冷光描边）+ 刷新动作按钮可用性。
func _select_slot(slot: int) -> void:
	_selected_slot = slot
	for i in _card_panels.size():
		var card: PanelContainer = _card_panels[i]
		var sb := card.get_theme_stylebox("panel") as StyleBoxFlat
		if sb is StyleBoxFlat:
			sb = (sb as StyleBoxFlat).duplicate()
			sb.border_color = _COLOR_SELECTED if i == slot else _COLOR_DIM
			sb.border_width_left = 3 if i == slot else 2
			sb.border_width_top = 3 if i == slot else 2
			sb.border_width_right = 3 if i == slot else 2
			sb.border_width_bottom = 3 if i == slot else 2
			card.add_theme_stylebox_override("panel", sb)
	# 动作可用性
	_load_button.disabled = _is_empty(slot)
	_hint_label.text = "选中槽 %d · ←/→ 选槽 · 载入(Enter)/覆盖/返回(Esc)" % slot


func _on_load_pressed() -> void:
	if _is_empty(_selected_slot):
		_hint_label.text = "槽 %d 为空，无法载入" % _selected_slot
		return
	var res := SaveManager.continue_slot(_selected_slot)
	if not res.ok:
		_hint_label.add_theme_color_override("font_color", _COLOR_WARN)
		_hint_label.text = "载入失败：%s（存档可能损坏/不一致）" % String(res.get("reason", ""))
		return
	_emit_entry(_selected_slot)


func _on_new_pressed() -> void:
	if _is_empty(_selected_slot):
		# 空槽直写（§4.3）
		var res := SaveManager.new_game_to_slot(_selected_slot)
		if res.ok:
			_emit_entry(_selected_slot)
		return
	# 非空槽二次确认（§9.3 覆盖弹窗）
	_confirm_dialog.request_confirm(
		"覆盖存档槽 %d" % _selected_slot,
		"该槽已有存档，覆盖将丢失原进度。系统注释：历史不可双写。",
		_on_overwrite_confirmed.bind(_selected_slot),
		true)


func _on_overwrite_confirmed(slot: int) -> void:
	var res := SaveManager.new_game_to_slot(slot)
	if res.ok:
		_emit_entry(slot)


func _on_back_pressed() -> void:
	visible = false
	closed.emit()


func _emit_entry(slot: int) -> void:
	visible = false
	entry_chosen.emit(slot)
