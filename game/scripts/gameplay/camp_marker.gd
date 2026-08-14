class_name CampMarker
extends Node2D

## 营地目标标记（世界空间脉冲环 + 文字）。遭遇清空后隐藏。
## 用途：给玩家一个「去哪」的视觉锚点（ux 焦点引导，替代小地图 MVP）。

@export var label: String = "山贼营地"
@export var radius: float = 52.0
@export var color: Color = Color(0.88, 0.32, 0.22, 0.85)

var _t: float = 0.0


func _ready() -> void:
	z_index = 5
	EventBus.encounter_cleared.connect(_on_encounter_cleared)


func _exit_tree() -> void:
	if EventBus.encounter_cleared.is_connected(_on_encounter_cleared):
		EventBus.encounter_cleared.disconnect(_on_encounter_cleared)


func _process(delta: float) -> void:
	_t += delta
	queue_redraw()


func _draw() -> void:
	var pulse: float = 0.5 + 0.5 * sin(_t * 2.2)
	# 双环脉冲（内环稳定 + 外环扩散）
	draw_arc(Vector2.ZERO, radius * 0.6, 0, TAU, 40, Color(color.r, color.g, color.b, 0.5), 2.5)
	draw_arc(Vector2.ZERO, radius * (0.7 + 0.35 * pulse), 0, TAU, 48,
		Color(color.r, color.g, color.b, 0.75 - 0.5 * pulse), 3.0)
	var font := ThemeDB.fallback_font
	draw_string(font, Vector2(-40, -radius - 14), label,
		HORIZONTAL_ALIGNMENT_CENTER, 80, 17, Color(0.98, 0.85, 0.75, 0.95))


func _on_encounter_cleared(_encounter_id: StringName) -> void:
	hide()
	set_process(false)
