class_name JuiceController
extends Node
## P6 juice 编排器 · art-director 最小视觉挂载代码
## 对齐：combat §6.5/§7.6 受击反馈多通道；art-bible §2.1/§2.5/§3.1；ux-spec §11.1 可访问性。
##
## 边界（issue 红线）：本节点【只做纯表现】，不读写 HP/BF/Δ/v_i 等玩法态，不改玩法数值/逻辑。
##   - 受击反馈：自动监听【已有】信号 EventBus.hp_changed，检测 HP 下降 → 触发朱赤边缘光 + 微震屏。
##     （HP 权威属 C4 CombatSystem；本节点只「观察」已有信号。）
##   - 命中停顿 / 拖尾触发：暴露 request_hit_stop() / request_shake() / pulse_vignette() 供玩法层
##     「命中/硬直」处调用（接线点见 docs/design/art/p6-polish-juice.md §6 + issue comment，交程基岩）。
##
## 可访问性（combat §7.6① / ux-spec §11.1「减少动效」）：
##   reduce_motion=true → 关闭震屏 + glitch；保留朱赤边缘光 + HP 条 + 音效（多通道，不靠单一颜色，
##   art-bible §2.3 可访问性红线）。预留 set_reduce_motion() 接设置菜单（接线点见 issue comment）。
##
## 接线（world.tscn 已做 additive 挂载，纯表现，零玩法改动）：
##   Systems/JuiceController（本节点）→ camera_path ../../Camera2D / screen_shake_path ../../Camera2D/ScreenShake
##                                   → vignette_path  ../../L5_SystemCanvas/DamageVignette

@export_group("Refs")
@export var camera_path: NodePath = ^"../../Camera2D"
@export var screen_shake_path: NodePath = ^"../../Camera2D/ScreenShake"
@export var vignette_path: NodePath = ^"../../L5_SystemCanvas/DamageVignette"

@export_group("Accessibility")
@export var reduce_motion: bool = false              # 「减少屏幕震」开关（combat §7.6① / ux-spec §11.1）

@export_group("Damage Feedback（art-bible §2.1/§3.1 节制）")
@export var damage_vignette_color: Color = Color(0.85, 0.12, 0.10, 1.0)   # 朱砂赤（art-bible §2.1 点睛 A）
@export var damage_vignette_peak: float = 1.0
@export var damage_vignette_rise: float = 0.07       # s（升）
@export var damage_vignette_fall: float = 0.38       # s（降）
@export var damage_trauma: float = 0.35              # 0..1（震屏 trauma 注入；trauma²×max_amp 得 px，节制）

@export_group("Hit Stop（art-bible §7.3 节奏）")
@export var hit_stop_scale: float = 0.06             # 命中停顿时的 time_scale（接近 0=近乎冻结）
@export var hit_stop_default_dur: float = 0.045      # s（命中停顿时长，短促给手感）

var _cam: Camera2D = null
var _shake: ScreenShake = null
var _vignette_mat: ShaderMaterial = null
var _prev_hp: int = -1
var _hit_stop_remaining: float = 0.0

func _ready() -> void:
	add_to_group("juice_controller")
	_resolve_refs()
	# 只「观察」已有跨系统信号（EventBus 已登记，architecture §7.2），不新增信号（adr-004 纪律）。
	if EventBus != null and EventBus.has_signal(&"hp_changed"):
		EventBus.hp_changed.connect(_on_hp_changed)

func _process(delta: float) -> void:
	# 命中停顿 time_scale 回退（reduce_motion 下不启动，见 request_hit_stop）
	if _hit_stop_remaining > 0.0:
		_hit_stop_remaining -= delta
		if _hit_stop_remaining <= 0.0:
			_hit_stop_remaining = 0.0
			Engine.time_scale = 1.0

func _exit_tree() -> void:
	# 防切场景卡死：本节点被释放时若命中停顿还压着 time_scale（如杀敌即切场景），
	# 恢复逻辑随节点消失 → 全局 6% 速度假死。此处强制归位。
	if Engine.time_scale != 1.0:
		Engine.time_scale = 1.0

# ───────────────────────── 受击反馈（观察 EventBus.hp_changed 的 HP 下降） ─────────────────────────
func _on_hp_changed(new_hp: int, _max_hp: int) -> void:
	if _prev_hp >= 0 and new_hp < _prev_hp:
		_play_damage_feedback()
	_prev_hp = new_hp

func _play_damage_feedback() -> void:
	# 多通道：朱赤边缘光（始终）+ 微震屏（reduce_motion 时关）。HP 条下沉由 HUD 自身监听同一信号处理。
	pulse_vignette(damage_vignette_color, damage_vignette_peak, damage_vignette_rise, damage_vignette_fall)
	if not reduce_motion and _shake != null:
		_shake.add_trauma(damage_trauma)

# ───────────────────────── 公开 API（玩法层「命中/硬直」接线点） ─────────────────────────
## 受击 / 命中红光脉冲（颜色可覆盖；reduce_motion 不影响——红光是颜色通道，保留）。
func pulse_vignette(color: Color = damage_vignette_color, peak: float = damage_vignette_peak,
		rise: float = damage_vignette_rise, fall: float = damage_vignette_fall) -> void:
	if _vignette_mat == null:
		return
	_vignette_mat.set_shader_parameter(&"glow_color", color)
	var tw := create_tween()
	tw.tween_method(_set_vignette_intensity, _get_vignette_intensity(), peak, rise)
	tw.tween_method(_set_vignette_intensity, peak, 0.0, fall)

## 注入震屏 trauma（0..1）。reduce_motion 时静默丢弃（art-bible §3.1 / ux-spec §11.1）。
func request_shake(trauma: float = damage_trauma) -> void:
	if reduce_motion or _shake == null:
		return
	_shake.add_trauma(trauma)

## 命中停顿：把 Engine.time_scale 暂时压低再回 1.0（art-bible §7.3 节奏给手感）。
## reduce_motion 时静默（时停属动效；ux-spec §11.1）。短促且自恢复，避免卡死。
func request_hit_stop(duration: float = -1.0, scale: float = -1.0) -> void:
	if reduce_motion:
		return
	var dur := hit_stop_default_dur if duration < 0.0 else duration
	var sc := hit_stop_scale if scale < 0.0 else scale
	# 取较长者，避免短停顿被更短的覆盖（手感连贯）。
	if dur > _hit_stop_remaining:
		Engine.time_scale = sc
		_hit_stop_remaining = dur

## 设置菜单接线点（combat §7.6① / ux-spec §11.1「减少动效」）。回退 time_scale 防卡死。
func set_reduce_motion(enabled: bool) -> void:
	reduce_motion = enabled
	if enabled:
		Engine.time_scale = 1.0
		_hit_stop_remaining = 0.0
		_set_vignette_intensity(0.0)
	if _shake != null:
		_shake.set_reduce_motion(enabled)

# ───────────────────────── 内部 ─────────────────────────
func _resolve_refs() -> void:
	_cam = get_node_or_null(camera_path) as Camera2D
	_shake = get_node_or_null(screen_shake_path) as ScreenShake
	var vignette := get_node_or_null(vignette_path)
	if vignette != null and vignette is CanvasItem and (vignette as CanvasItem).material != null:
		_vignette_mat = (vignette as CanvasItem).material as ShaderMaterial

func _set_vignette_intensity(v: float) -> void:
	if _vignette_mat != null:
		_vignette_mat.set_shader_parameter(&"intensity", v)

func _get_vignette_intensity() -> float:
	if _vignette_mat != null:
		return _vignette_mat.get_shader_parameter(&"intensity")
	return 0.0
