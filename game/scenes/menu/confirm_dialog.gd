class_name ConfirmDialog
extends Control

## ConfirmDialog · 通用确认弹窗（ux-spec §9.1，模态·居中·遮罩 60%）。
## 参考：ux-spec §9.1（高危动作二次确认：覆盖存档槽/确认改写/返回主菜单/退出游戏）。
##
## 设计纪律（§9.1）：
##   - 焦点默认在「取消」（防误触高危）；高危项标冷光橙红描边。
##   - 复用场景：主菜单 / 未来暂停菜单 / 改写确认（issue #15 暂用 RewritePanel 自带，本类供 MM/PS）。
##   - 双设备（adr-003）：ui_accept=确认 / ui_cancel=取消；焦点链完整（control-manifest 焦点链节）。
##   - 模态：open 时 grab 焦点 + 拦截 ui_cancel/ui_accept（_unhandled_input）；close 释放焦点。
##
## 用法：confirm_dialog.request_confirm("标题", "后果说明", on_confirm_callable)
##       on_confirm_callable 在玩家点「确认」时调用；点「取消」/ui_cancel 仅关闭。

signal confirmed
signal cancelled

const _COLOR_CYAN := Color(0.6, 0.85, 1, 1)
const _COLOR_DATA := Color(0.92, 0.96, 1, 1)
const _COLOR_WARN := Color(1.0, 0.45, 0.35, 1)

@onready var _dim: ColorRect = %DimRect
@onready var _panel: PanelContainer = %DialogPanel
@onready var _title_label: Label = %TitleLabel
@onready var _body_label: Label = %BodyLabel
@onready var _confirm_button: Button = %ConfirmButton
@onready var _cancel_button: Button = %CancelButton

var _on_confirm: Callable = Callable()


func _ready() -> void:
	_confirm_button.pressed.connect(_on_confirm_pressed)
	_cancel_button.pressed.connect(_on_cancel_pressed)
	_confirm_button.focus_mode = Control.FOCUS_ALL
	_cancel_button.focus_mode = Control.FOCUS_ALL
	visible = false


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("ui_cancel"):
		_on_cancel_pressed()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_accept"):
		# ui_accept 走当前焦点按钮的 pressed；若焦点在取消则取消，符合「默认焦点=取消」防误触。
		# 这里不额外处理（Button 自身响应 ui_accept），仅标记已处理避免穿透到下层。
		get_viewport().set_input_as_handled()


## 显示确认弹窗。on_confirm：玩家确认时调用的 Callable（高危动作）。
func request_confirm(title: String, body: String, on_confirm: Callable, warn: bool = true) -> void:
	_title_label.text = "⚠ " + title if warn else title
	_title_label.add_theme_color_override("font_color", _COLOR_WARN if warn else _COLOR_CYAN)
	_body_label.text = body
	_on_confirm = on_confirm
	visible = true
	# 默认焦点=取消（防误触高危，§9.1）
	_cancel_button.grab_focus()


func _on_confirm_pressed() -> void:
	visible = false
	var cb := _on_confirm
	_on_confirm = Callable()
	if cb.is_valid():
		cb.call()
	confirmed.emit()


func _on_cancel_pressed() -> void:
	visible = false
	_on_confirm = Callable()
	cancelled.emit()


## 测试辅助：模拟玩家点确认。
func debug_press_confirm() -> void:
	_on_confirm_pressed()
