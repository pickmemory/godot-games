class_name MainMenu
extends Control

## MainMenu · 主菜单（ux-spec §4 关键屏幕一 · MM）。
## 参考：ux-spec §4（§4.2 流程 / §4.3 线框 / §4.4 输入 / §4.5 litRPG 基调）；
##       architecture §8.4（启动序列：boot → 主菜单）；§9.2（开场链路注入）。
##
## 布局（§4.3 ASCII 线框）：
##   - 背景层（轨道 A 水墨）：greybox ColorRect 占位（P5-10 由 art-director 替换真实开场卷轴）。
##   - 标题区：《赤壁·改写者》+ 副标 [记录员·系统 v0.1 · 已就位]（litRPG 基调，§4.5）。
##   - 条目区：继续游戏 / 开始新游戏 / 存档槽位 / 设置 / 退出游戏（冷光描边焦点框）。
##   - 底部数据条：朝代 / 存档槽占用 / 版本 / 记录员一句话。
##
## 默认焦点（§4.2）：有存档 → 继续游戏；无存档 → 开始新游戏。
## 输入（§4.4）：ui_up/down 切条目（VBox 焦点链）；ui_accept 确认；ui_cancel 回上级（子面板→条目）；
##   主菜单**不响应 ui_pause**（§4.4）。双设备（键鼠+手柄，adr-003）。
##
## 设置（§4.2 MM 内嵌）：音量滑条（Master bus）/ 显示模式（全屏/窗口）—— 垂直切片最小，P5-10 美术替换。
## 退出：二次确认弹窗（§9.1）→ get_tree().quit()。

const _COLOR_CYAN := Color(0.6, 0.85, 1, 1)
const _COLOR_DATA := Color(0.92, 0.96, 1, 1)
const _COLOR_LABEL := Color(0.55, 0.78, 0.95, 1)
const _COLOR_DIM := Color(0.5, 0.55, 0.62, 1)
const _COLOR_WARN := Color(1.0, 0.45, 0.35, 1)

const _RECORDER_LINE := "历史基准线已载入。记录员待命。"
const _APP_VERSION := "v0.1"

@onready var _continue_button: Button = %ContinueButton
@onready var _new_game_button: Button = %NewGameButton
@onready var _slots_button: Button = %SlotsButton
@onready var _settings_button: Button = %SettingsButton
@onready var _exit_button: Button = %ExitButton
@onready var _status_label: Label = %StatusLabel
@onready var _save_slot_panel: SaveSlotPanel = %SaveSlotPanel
@onready var _settings_panel: Control = %SettingsPanel
@onready var _confirm_dialog: ConfirmDialog = %ConfirmDialog
@onready var _volume_slider: HSlider = %VolumeSlider
@onready var _volume_value_label: Label = %VolumeValueLabel
@onready var _display_mode_option: OptionButton = %DisplayModeOption


func _ready() -> void:
	for btn in [_continue_button, _new_game_button, _slots_button, _settings_button, _exit_button]:
		btn.focus_mode = Control.FOCUS_ALL
	_continue_button.pressed.connect(_on_continue_pressed)
	_new_game_button.pressed.connect(_on_new_game_pressed)
	_slots_button.pressed.connect(_on_slots_pressed)
	_settings_button.pressed.connect(_on_settings_pressed)
	_exit_button.pressed.connect(_on_exit_pressed)
	_save_slot_panel.entry_chosen.connect(_on_slot_entry_chosen)
	_save_slot_panel.closed.connect(_on_subpanel_closed)
	_save_slot_panel.visible = false
	_settings_panel.visible = false
	_confirm_dialog.visible = false
	# 设置：音量 + 显示模式（最小，§4.2 MM 内嵌）
	_setup_settings()
	_refresh_status()
	_apply_default_focus()
	AudioManager.play_music("menu")


func _unhandled_input(event: InputEvent) -> void:
	# 主菜单不响应 ui_pause（ux-spec §4.4）—— 此处不处理 ui_pause。
	# 子面板（存档槽位/确认弹窗）自处理 ui_cancel；设置面板在此处理 Esc 关闭。
	if _confirm_dialog.visible or _save_slot_panel.visible:
		return
	if _settings_panel.visible:
		if event.is_action_pressed("ui_cancel"):
			_on_subpanel_closed_with_focus()
			get_viewport().set_input_as_handled()
		return


# ───────────────────────── 默认焦点（§4.2：有存档→继续，无存档→新游戏） ─────────────────────────

func _apply_default_focus() -> void:
	var has_save := SaveManager.has_any_save()
	# 无存档时禁用「继续游戏」（灰禁，焦点跳过）。
	_continue_button.disabled = not has_save
	if has_save:
		_continue_button.grab_focus()
	else:
		_new_game_button.grab_focus()


# ───────────────────────── 菜单动作 ─────────────────────────

func _on_continue_pressed() -> void:
	var res := SaveManager.continue_game()
	if not res.ok:
		# 一致性校验失败/损坏：不崩，提示并禁用继续（§9.2 不静默修复，但主菜单不报错弹窗）。
		push_error("[MainMenu] 继续游戏失败：%s" % str(res))
		_continue_button.disabled = true
		_new_game_button.grab_focus()
		return
	_goto_world()


func _on_new_game_pressed() -> void:
	var res := SaveManager.new_game()
	if not res.ok:
		push_error("[MainMenu] 新游戏失败：%s" % str(res))
		return
	_goto_world()


func _on_slots_pressed() -> void:
	_save_slot_panel.open_panel()


func _on_settings_pressed() -> void:
	_open_settings()


func _on_exit_pressed() -> void:
	# 退出二次确认（§9.1）。退出 API：get_tree().quit()（Godot 4.7 标准，ux-spec §4.2 ⚠️待核已确认）。
	_confirm_dialog.request_confirm(
		"退出游戏",
		"确认退出至桌面？未保存的改写进度将在下次进入时丢失（进度于节点确认时自动存档）。",
		Callable(self, "_do_exit"),
		false)


func _do_exit() -> void:
	get_tree().quit()


func _on_slot_entry_chosen(_slot: int) -> void:
	# 槽位面板已 continue_slot/new_game_to_slot 设置好；统一跳 world。
	_goto_world()


func _on_subpanel_closed() -> void:
	# 子面板关闭后，焦点回主菜单条目。
	_apply_default_focus()


# ───────────────────────── 开场链路 → world（architecture §8.4/§9.2） ─────────────────────────

func _goto_world() -> void:
	# SaveManager 已注入 baseline（新游戏）或 _pending_load（继续）；world._ready 据 apply_pending_load 重同步。
	get_tree().change_scene_to_file("res://scenes/world/world.tscn")


# ───────────────────────── 底部数据条（§4.3 系统侧·记录员语气） ─────────────────────────

func _refresh_status() -> void:
	var slots: Array = SaveManager.list_slots()
	var used := 0
	for s in slots:
		if not bool((s as Dictionary).get("empty", true)):
			used += 1
	var dynasty := String(DynastyLoader.DEFAULT_DYNASTY)
	_status_label.text = "> 朝代: %s · 存档槽: %d/%d 已用 · %s\n> 「%s」" % [dynasty, used, SaveManager.NUM_SLOTS, _APP_VERSION, _RECORDER_LINE]


# ───────────────────────── 设置（§4.2 MM 内嵌·最小） ─────────────────────────

func _setup_settings() -> void:
	_volume_slider.min_value = 0
	_volume_slider.max_value = 100
	_volume_slider.step = 1
	# 初始化为当前 Master 音量（线性 0..1 → 0..100）。
	var bus_idx := AudioServer.get_bus_index("Master")
	var linear := 1.0
	if bus_idx >= 0:
		linear = db_to_linear(AudioServer.get_bus_volume_db(bus_idx))
	_volume_slider.value = clampi(int(round(linear * 100.0)), 0, 100)
	_volume_value_label.text = "%d%%" % int(_volume_slider.value)
	_volume_slider.value_changed.connect(_on_volume_changed)
	# 显示模式选项
	_display_mode_option.clear()
	_display_mode_option.add_item("窗口化", 0)
	_display_mode_option.add_item("全屏", 1)
	_display_mode_option.add_item("无边框窗口", 2)
	var mode := DisplayServer.window_get_mode()
	_display_mode_option.select(_mode_to_idx(mode))
	_display_mode_option.item_selected.connect(_on_display_mode_selected)
	# 设置面板内的返回/关闭按钮
	var close_btn: Button = %SettingsCloseButton
	close_btn.focus_mode = Control.FOCUS_ALL
	close_btn.pressed.connect(_on_subpanel_closed_with_focus)


func _open_settings() -> void:
	_settings_panel.visible = true
	%SettingsCloseButton.grab_focus()


func _on_volume_changed(value: float) -> void:
	_volume_value_label.text = "%d%%" % int(value)
	var bus_idx := AudioServer.get_bus_index("Master")
	if bus_idx >= 0:
		AudioServer.set_bus_volume_db(bus_idx, linear_to_db(value / 100.0))


func _on_display_mode_selected(idx: int) -> void:
	match idx:
		0:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED)
		1:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)
		2:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MAXIMIZED)
			DisplayServer.window_set_flag(DisplayServer.WINDOW_FLAG_BORDERLESS, true)
			# 注：无边框窗口在 Godot 4.7 无独立枚举，用 MAXIMIZED + BORDERLESS 近似（⚠️待核精确 API，占位）。


func _mode_to_idx(mode: int) -> int:
	match mode:
		DisplayServer.WINDOW_MODE_WINDOWED:
			return 0
		DisplayServer.WINDOW_MODE_FULLSCREEN:
			return 1
		_:
			return 2


func _on_subpanel_closed_with_focus() -> void:
	_settings_panel.visible = false
	_apply_default_focus()


# ───────────────────────── 测试/调试辅助 ─────────────────────────

## 测试辅助：刷新默认焦点 + 数据条（供外部驱动后刷新）。
func debug_refresh() -> void:
	_refresh_status()
	_apply_default_focus()
