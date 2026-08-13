extends Node

## tests/build/generate_project.gd — project.godot + 测试资产的可复现生成器（P3-2）。
##
## 运行（详见 game/README.md）：
##   $GODOT_BIN --headless --path game tests/build/setup.tscn
##
## 为什么用生成器而非手写 project.godot：
##   InputMap 的 Object(InputEventKey/JoypadMotion,...) 内联格式跨 Godot 4.x 易变且冗长，
##   手写极易出错。这里用 Godot 常量（KEY_* / JOY_BUTTON_* / JOY_AXIS_* / MOUSE_BUTTON_*）
##   构造事件，权威产出 project.godot，杜绝臆造键码/索引（control-manifest 知识诚实）。
##
## 产出：
##   - project.godot（设置 + InputMap 双绑定 + Autoload，对齐 architecture §2.3）
##   - assets/tilesets/test_tileset.tres（占位 TileSet，PlaceholderTexture2D，art-bible §8.1 64px）
##   - data/globals/player_movement_globals.tres（数据驱动移动参数占位）
## 另在 stdout 打印 §13 K1~K9 引擎 API 核对结论（供 docs/engine-reference/godot/4.7.md 采信）。

const DEADZONE_AXIS := 0.2  # adr-003 §决定2（手柄摇杆死区 0.2~0.3，取下限更跟手）


func _ready() -> void:
	_apply_project_settings()
	_apply_input_map()
	var err: int = ProjectSettings.save()
	_warn_if_err(err, "ProjectSettings.save")
	_build_test_tileset()
	_print_diagnostics()
	print("[generate_project] 完成：project.godot / test_tileset.tres 已生成（player_movement_globals.tres 为手写数据驱动资源，见 game/README.md）。")
	get_tree().quit()


# ───────────────────────── 项目设置（architecture §2.3） ─────────────────────────

func _apply_project_settings() -> void:
	# application
	ProjectSettings.set_setting("application/config/name", "赤壁·改写者 (垂直切片)")
	ProjectSettings.set_setting("application/config/description", "2D 俯视角开放世界 ARPG · 改写/因果系统 · 三国·赤壁 · 垂直切片 (Phase 3 P3-2 工程骨架)")
	ProjectSettings.set_setting("application/run/main_scene", "res://scenes/boot.tscn")
	ProjectSettings.set_setting("application/config/features", PackedStringArray(["4.7", "GL Compatibility"]))

	# 视口（art-bible §3.1 = 1920×1080）
	ProjectSettings.set_setting("display/window/size/viewport_width", 1920)
	ProjectSettings.set_setting("display/window/size/viewport_height", 1080)

	# 拉伸（AGENTS.md 锁定 canvas_items；adr-001 expand）
	ProjectSettings.set_setting("display/window/stretch/mode", "canvas_items")
	ProjectSettings.set_setting("display/window/stretch/aspect", "expand")

	# 渲染（adr-001 K1：gl_compatibility；2D 友好 / PC 全兼容 / 移动愿景铺路）
	ProjectSettings.set_setting("rendering/renderer/rendering_method", "gl_compatibility")
	ProjectSettings.set_setting("rendering/renderer/rendering_method.mobile", "gl_compatibility")

	# Autoload（architecture §8.1 / adr-004；"*" 前缀 = 启用单例；本 issue 仅 EventBus/DynastyLoader/SaveManager 三占位）
	ProjectSettings.set_setting("autoload/EventBus", "*res://scripts/autoload/event_bus.gd")
	ProjectSettings.set_setting("autoload/DynastyLoader", "*res://scripts/autoload/dynasty_loader.gd")
	ProjectSettings.set_setting("autoload/SaveManager", "*res://scripts/autoload/save_manager.gd")


# ───────────────────────── InputMap（adr-003 §决定1，双绑定） ─────────────────────────

func _apply_input_map() -> void:
	# 持久化要点：ProjectSettings.save() 只序列化 ProjectSettings 属性库，不读取 InputMap 单例。
	# 故须把每动作镜像写入 input/* 设置；Godot 启动时从 [input] 装载回 InputMap。
	# events 内的 InputEvent 对象由 Godot 序列化为权威 Object(InputEvent*,...) 内联格式。

	var ax := DEADZONE_AXIS
	# 每行：[动作名, 死区, [键鼠事件, 手柄事件]]（每个动作双绑定，control-manifest 输入硬规则）。
	var table: Array = [
		# —— 移动（WASD + 左摇杆）——
		["move_up", ax, [_key(KEY_W), _joy_axis(JOY_AXIS_LEFT_Y, -1.0)]],
		["move_down", ax, [_key(KEY_S), _joy_axis(JOY_AXIS_LEFT_Y, 1.0)]],
		["move_left", ax, [_key(KEY_A), _joy_axis(JOY_AXIS_LEFT_X, -1.0)]],
		["move_right", ax, [_key(KEY_D), _joy_axis(JOY_AXIS_LEFT_X, 1.0)]],
		# —— 姿态 ——
		["sprint", 0.5, [_key(KEY_SHIFT), _joy_btn(JOY_BUTTON_LEFT_STICK)]],
		["crouch", 0.5, [_key(KEY_CTRL), _joy_btn(JOY_BUTTON_RIGHT_STICK)]],
		# —— 战斗（adr-003：basic=鼠标左/□；skill=鼠标右/RB）——
		["basic_attack", 0.5, [_mouse(MOUSE_BUTTON_LEFT), _joy_btn(JOY_BUTTON_X)]],
		["skill_1", 0.5, [_mouse(MOUSE_BUTTON_RIGHT), _joy_btn(JOY_BUTTON_RIGHT_SHOULDER)]],
		# —— 交互 / 对话 ——
		["interact", 0.5, [_key(KEY_E), _joy_btn(JOY_BUTTON_Y)]],
		["dialogue_next", 0.5, [_key(KEY_SPACE), _joy_btn(JOY_BUTTON_A)]],
		# —— UI（继承 + 扩展；手柄焦点导航复用左摇杆，与 move_* 同源不冲突）——
		["ui_accept", 0.5, [_key(KEY_ENTER), _joy_btn(JOY_BUTTON_A)]],
		["ui_cancel", 0.5, [_key(KEY_ESCAPE), _joy_btn(JOY_BUTTON_B)]],
		["ui_menu", 0.5, [_key(KEY_TAB), _joy_btn(JOY_BUTTON_BACK)]],
		["ui_pause", 0.5, [_key(KEY_P), _joy_btn(JOY_BUTTON_START)]],
		["panel_tab_next", 0.5, [_key(KEY_Q), _joy_btn(JOY_BUTTON_LEFT_SHOULDER)]],
		["ui_left", ax, [_key(KEY_LEFT), _joy_axis(JOY_AXIS_LEFT_X, -1.0)]],
		["ui_right", ax, [_key(KEY_RIGHT), _joy_axis(JOY_AXIS_LEFT_X, 1.0)]],
		["ui_up", ax, [_key(KEY_UP), _joy_axis(JOY_AXIS_LEFT_Y, -1.0)]],
		["ui_down", ax, [_key(KEY_DOWN), _joy_axis(JOY_AXIS_LEFT_Y, 1.0)]],
	]

	for row in table:
		var action_name: String = row[0]
		var deadzone: float = row[1]
		var events: Array = row[2]
		ProjectSettings.set_setting("input/%s" % action_name, {"deadzone": deadzone, "events": events})


# ───────────────────────── 事件构造（用 Godot 常量，不臆造） ─────────────────────────

func _key(code: int) -> InputEventKey:
	var ev := InputEventKey.new()
	ev.device = -1  # 任意键盘（与编辑器录入 InputMap 的惯例一致；-1=any device）
	ev.keycode = code
	return ev


func _mouse(button: int) -> InputEventMouseButton:
	var ev := InputEventMouseButton.new()
	ev.device = -1  # 任意鼠标
	ev.button_index = button
	return ev


func _joy_axis(axis: int, value: float) -> InputEventJoypadMotion:
	var ev := InputEventJoypadMotion.new()
	ev.device = -1  # 任意手柄
	ev.axis = axis
	ev.axis_value = value
	return ev


func _joy_btn(button: int) -> InputEventJoypadButton:
	var ev := InputEventJoypadButton.new()
	ev.device = -1  # 任意手柄
	ev.button_index = button
	return ev


# ───────────────────────── 测试资产生成 ─────────────────────────

func _build_test_tileset() -> void:
	var ts := TileSet.new()
	ts.tile_size = Vector2i(64, 64)  # art-bible §8.1
	var src := TileSetAtlasSource.new()
	var tex := PlaceholderTexture2D.new()
	tex.size = Vector2i(64, 64)
	src.texture = tex
	src.create_tile(Vector2i(0, 0))  # 图块占据整个 64×64 占位纹理
	ts.add_source(src)
	var err: int = ResourceSaver.save(ts, "res://assets/tilesets/test_tileset.tres")
	_warn_if_err(err, "ResourceSaver(test_tileset)")


# player_movement_globals.tres 为手写数据驱动资源（字段显式，便于审阅/调参），不在此生成。


# ───────────────────────── §13 K1~K9 引擎 API 核对诊断 ─────────────────────────

func _print_diagnostics() -> void:
	var v: Dictionary = Engine.get_version_info()
	print("=== P3-2 引擎 API 核对（architecture §13 K1~K9）===")
	print("ENGINE_VERSION: ", v.get("major"), ".", v.get("minor"), ".", v.get("patch"), " (", v.get("status", ""), ")")
	print("[K1] rendering_method='gl_compatibility' 已写入 project.godot（headless import 不初始化 GL，仅为目标设置值）。")
	print("[K2] TileMapLayer class exists: ", ClassDB.class_exists("TileMapLayer"), " | legacy TileMap exists: ", ClassDB.class_exists("TileMap"))
	print("[K3] standalone YSort class exists: ", ClassDB.class_exists("YSort"), " | Node2D.y_sort_enabled prop: ", _has_prop("Node2D", "y_sort_enabled"))
	print("[K4] NavigationRegion2D class exists: ", ClassDB.class_exists("NavigationRegion2D"))
	print("[K5] typed signal 语法见 EventBus/engine-reference（Godot 4 原生支持 signal name(a: T, b: T)）。")
	print("[K8] InputEventJoypadMotion has 'deadzone' prop: ", _has_prop("InputEventJoypadMotion", "deadzone"), "（false=死区为动作级 InputMap.add_action(action, deadzone)）")
	print("[K9] Camera2D props:")
	for p in ["zoom", "position_smoothing_enabled", "position_smoothing_speed", "position_smoothing_draw_damping", "position_smoothing_keep_offset"]:
		print("       - ", p, ": ", _has_prop("Camera2D", p))
	print("[misc] TileSet.get_source_id: ", _has_method("TileSet", "get_source_id"), " | tile_size prop: ", _has_prop("TileSet", "tile_size"))
	print("[misc] TileMapLayer.set_cell: ", _has_method("TileMapLayer", "set_cell"), " | tile_set prop: ", _has_prop("TileMapLayer", "tile_set"))


func _has_prop(cls: String, prop: String) -> bool:
	for p in ClassDB.class_get_property_list(cls):
		if p.get("name", "") == prop:
			return true
	return false


func _has_method(cls: String, method_name: String) -> bool:
	for m in ClassDB.class_get_method_list(cls):
		if m.get("name", "") == method_name:
			return true
	return false


func _warn_if_err(err: int, label: String) -> void:
	if err != OK:
		push_warning("[generate_project] %s 失败 err=%d" % [label, err])
