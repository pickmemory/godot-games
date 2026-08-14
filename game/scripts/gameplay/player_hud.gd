class_name PlayerHud
extends Control

## 玩家 HUD：HP/BF 双条（左下角）。监听 EventBus.hp_changed/bf_changed（C4 权威发出）。
## 纯表现层：不持有数值，只缓存显示值。HP 朱砂（轨道 A 生机）/ BF 青蓝（系统战意）。

var hp: int = 0
var hp_max: int = 1
var bf: int = 0
var bf_max: int = 1
var _dead: bool = false
var _death_layer: ColorRect = null
var _death_label: Label = null
var _death_armed: bool = false   # 黑屏淡入到位后才接受重试输入（防误触）

const _BAR_W: float = 300.0
const _BAR_H: float = 16.0
const _MARGIN: float = 28.0
const _FONT_SIZE: int = 15


func _ready() -> void:
	EventBus.hp_changed.connect(_on_hp_changed)
	EventBus.bf_changed.connect(_on_bf_changed)
	set_anchors_preset(Control.PRESET_BOTTOM_LEFT)


func _exit_tree() -> void:
	if EventBus.hp_changed.is_connected(_on_hp_changed):
		EventBus.hp_changed.disconnect(_on_hp_changed)
	if EventBus.bf_changed.is_connected(_on_bf_changed):
		EventBus.bf_changed.disconnect(_on_bf_changed)


func _on_hp_changed(new_hp: int, max_hp: int) -> void:
	hp = new_hp
	hp_max = max_hp
	queue_redraw()
	if hp <= 0 and not _dead:
		_dead = true
		_show_death()


func _on_bf_changed(new_bf: int, max_bf: int) -> void:
	bf = new_bf
	bf_max = max_bf
	queue_redraw()


func _draw() -> void:
	if _dead:
		return   # 死亡黑屏接管，隐藏血条（血条已空无意义）
	var y0: float = -_MARGIN - (_BAR_H + 8.0) * 2.0
	_draw_bar(Vector2(_MARGIN, y0), hp, hp_max, Color(0.85, 0.25, 0.2), "HP")
	_draw_bar(Vector2(_MARGIN, y0 + _BAR_H + 8.0), bf, bf_max, Color(0.35, 0.8, 0.95), "BF")


# ───────────────────── 倒下处理（S5 respawn 占位：重载本段；不扣 CP/存档） ─────────────────────

## 玩家 HP=0：黑屏淡入 + 「按任意键重整旗鼓」→ 重载当前场景。CombatSystem._enter_downed 仅置态
## （重生归 S5 TODO），本处理防「倒地后永久锁输入 = 假卡死」（主创反馈：中遂卡死）。
func _show_death() -> void:
	var layer := ColorRect.new()
	layer.color = Color(0.02, 0.02, 0.04, 0.0)
	layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(layer)
	_death_layer = layer
	var lbl := Label.new()
	lbl.text = "你倒下了\n\n—— 历史不会记住失败者 ——\n\n按 任意键 重整旗鼓（重试本段）"
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	lbl.add_theme_font_size_override("font_size", 30)
	lbl.add_theme_color_override("font_color", Color(0.92, 0.86, 0.78, 1))
	lbl.set_anchors_preset(Control.PRESET_FULL_RECT)
	layer.add_child(lbl)
	_death_label = lbl
	var tw := create_tween()
	tw.tween_property(layer, "color:a", 0.82, 1.2)
	tw.tween_callback(func(): _death_armed = true)


func _unhandled_input(event: InputEvent) -> void:
	if _dead and _death_armed and event.pressed and (event is InputEventKey or event is InputEventMouseButton):
		get_viewport().set_input_as_handled()
		Engine.time_scale = 1.0   # 保险：残留 time_scale 归位（历史 bug：命中停顿残留 → 假死）
		get_tree().reload_current_scene()


func _draw_bar(pos: Vector2, val: int, max_val: int, col: Color, label: String) -> void:
	if max_val <= 0:
		return
	var ratio: float = clampf(float(val) / float(max_val), 0.0, 1.0)
	# 底槽
	draw_rect(Rect2(pos, Vector2(_BAR_W, _BAR_H)), Color(0.04, 0.05, 0.08, 0.8), true)
	# 填充（低值闪红警示）
	var fill_col: Color = col
	if ratio < 0.25:
		fill_col = Color(1.0, 0.3, 0.2, 0.95) if (Time.get_ticks_msec() / 300) % 2 == 0 else col
	draw_rect(Rect2(pos + Vector2(2, 2), Vector2((_BAR_W - 4.0) * ratio, _BAR_H - 4.0)), fill_col, true)
	# 边框
	draw_rect(Rect2(pos, Vector2(_BAR_W, _BAR_H)), Color(0.75, 0.8, 0.9, 0.35), false, 1.0)
	# 文字
	var font := ThemeDB.fallback_font
	var txt: String = "%s  %d / %d" % [label, val, max_val]
	draw_string(font, pos + Vector2(8, _BAR_H * 0.5 + 5), txt,
		HORIZONTAL_ALIGNMENT_LEFT, -1, _FONT_SIZE, Color(0.95, 0.97, 1.0))
