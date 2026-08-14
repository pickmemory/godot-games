class_name TimelineStage
extends Control

## 历史线分叉演出 STG · Loop A 反馈环情感峰值（ux-spec §6.4 / rewrite-causality §4.4 / art-bible §6.2）。
##
## 强模态（压制其他面板跳转，ux-spec §3.2）。按 feedback_tier 三档呈现：
##   - minor（Δ<20）：**不进 STG**，仅短横幅（§5.6）+ 短旁白。自动消退。
##   - notable（20≤Δ<80）：短横向卷轴演出（≤3s）+ X1 短旁白 + 结算屏。
##   - critical（Δ≥80）：长演出（4–6s）+ 世界线震荡 glitch（橙红边缘撕裂，art-bible §2.5）+ X1 长旁白 + 结算屏。
##
## 跳过（ux-spec §6.4）：ui_accept/ui_cancel 跳过**演出动画**，但**不可跳过**结算数值显示
## （结算屏停留等 ui_accept 继续）。连续 critical 由控制器传入 compressed=true 降级压缩（panel §2.5 防疲劳）。
##
## 归属：演出视觉资产/脚本归 S3 反馈层（本类）；旁白配音/字幕归 X1（P6-1）。由 RewriteFeedbackController 驱动。
## 视觉：art-bible §6.1 系统材质 + §6.2「横向卷轴：墨色历史线 + 冷光偏差节点 + 分叉」。

const TIER_MINOR := 0
const TIER_NOTABLE := 1
const TIER_CRITICAL := 2

# 演出时长（秒，ux-spec §6.4 量级）。compressed 时 notable/critical 各缩至一半（panel §2.5 防疲劳）。
const DURATION_NOTABLE := 2.5
const DURATION_CRITICAL := 5.0
const MINOR_BANNER_DURATION := 2.5

@onready var _overlay: ColorRect = %OverlayDim
@onready var _glitch: ColorRect = %GlitchOverlay
@onready var _stage_panel: PanelContainer = %StagePanel
@onready var _title_label: Label = %TitleLabel
@onready var _scroll: Control = %BranchScroll
@onready var _baseline_label: Label = %BaselineBranchLabel
@onready var _actual_label: Label = %ActualBranchLabel
@onready var _narration_label: Label = %NarrationLabel
@onready var _settlement = $CenterWrap/StagePanel/Margin/VBox/SettlementScreen   # SettlementScreen 实例（显式路径，避免 typed-% 赋值摩擦）
@onready var _hint_label: Label = %HintLabel
@onready var _compress_note: Label = %CompressNoteLabel
@onready var _minor_banner: PanelContainer = %MinorBanner
@onready var _minor_banner_label: Label = %MinorBannerLabel

var _phase: int = 0   # 0=idle, 1=animating演出, 2=awaiting-accept (settlement shown)
var _play_tween: Tween = null
var _glitch_tween: Tween = null


func _ready() -> void:
	add_to_group("timeline_stage")   # 供 RewriteFeedbackController 按类/组定位（与 mount 路径解耦）
	visible = false
	_minor_banner.visible = false
	_glitch.visible = false
	_compress_note.visible = false


## 播放（由 RewriteFeedbackController 调用）。data 字段见控制器；compressed=连续 critical 降级。
func play(data: Dictionary, compressed: bool) -> void:
	var tier: int = int(data.get("tier", TIER_MINOR))
	_kill_tweens()
	if tier == TIER_MINOR:
		_play_minor(data)
	else:
		_play_stage(data, tier, compressed)


## 由控制器调用：显示节点消失短横幅（node_vanished，无结算）。
func play_vanish_banner(text: String) -> void:
	_kill_tweens()
	visible = true
	_overlay.visible = false
	_stage_panel.visible = false
	_minor_banner.visible = true
	_minor_banner_label.text = text
	_minor_banner_label.add_theme_color_override("font_color", Color(0.6, 0.85, 1, 1))
	_phase = 1
	_play_tween = create_tween()
	_play_tween.tween_interval(MINOR_BANNER_DURATION)
	_play_tween.tween_callback(_hide_all)


# ───────────────────────── 分档演出 ─────────────────────────

func _play_minor(data: Dictionary) -> void:
	visible = true
	_overlay.visible = false
	_stage_panel.visible = false
	_minor_banner.visible = true
	_minor_banner_label.text = String(data.get("narration", ""))
	_minor_banner_label.add_theme_color_override("font_color", Color(0.85, 0.9, 0.98, 1))
	_phase = 1
	_play_tween = create_tween()
	_play_tween.tween_interval(MINOR_BANNER_DURATION)
	_play_tween.tween_callback(_hide_all)


func _play_stage(data: Dictionary, tier: int, compressed: bool) -> void:
	visible = true
	_overlay.visible = true
	_stage_panel.visible = true
	_minor_banner.visible = false
	_narration_label.text = String(data.get("narration", ""))
	_baseline_label.text = String(data.get("baseline_branch", "基准：历史原线"))
	_actual_label.text = String(data.get("actual_branch", "改写：偏差已注入"))
	_title_label.text = "历史线分叉演出 · %s" % ("critical" if tier == TIER_CRITICAL else "notable")
	_compress_note.visible = compressed
	if compressed:
		_compress_note.text = String(data.get("compress_note", ""))

	# 结算屏（不可跳过的数值显示）
	_settlement.show_settlement(data)

	# 演出动画（冷光扫描展开，art-bible §7.3 200–350ms；分叉动画）
	_animate_stage_in(tier)

	var base_dur: float = DURATION_CRITICAL if tier == TIER_CRITICAL else DURATION_NOTABLE
	if compressed:
		base_dur *= 0.5
	_phase = 1
	_hint_label.text = "[ ui_accept / ui_cancel 跳过演出 ]"

	# critical 世界线震荡 glitch（橙红边缘撕裂，art-bible §2.5）
	if tier == TIER_CRITICAL:
		_start_glitch()

	_play_tween = create_tween()
	_play_tween.tween_interval(base_dur)
	_play_tween.tween_callback(_enter_settle_phase)


## 演出动画结束 → 进入结算停留阶段（等 ui_accept 继续）。
func _enter_settle_phase() -> void:
	_phase = 2
	_stop_glitch()
	_glitch.visible = false
	_hint_label.text = "[ ui_accept 继续 ]"


func _hide_all() -> void:
	_kill_tweens()
	_stop_glitch()
	visible = false
	_stage_panel.visible = false
	_minor_banner.visible = false
	_glitch.visible = false
	_overlay.visible = false
	_settlement.hide_screen()
	_phase = 0


# ───────────────────────── 演出动效 ─────────────────────────

# 冷光扫描展开（art-bible §6.1 开合 200–350ms）：分支标签从透明淡入 + 轻微下移；卷轴横向展开。
func _animate_stage_in(tier: int) -> void:
	var tween := create_tween()
	_scroll.modulate.a = 0.0
	_actual_label.modulate.a = 0.0
	tween.set_parallel(true)
	tween.tween_property(_scroll, "modulate:a", 1.0, 0.32)
	tween.tween_property(_actual_label, "modulate:a", 1.0, 0.35).set_delay(0.18)
	# critical 边缘橙红警示脉冲
	if tier == TIER_CRITICAL:
		tween.chain().tween_property(_title_label, "modulate", Color(1.0, 0.45, 0.35, 1), 0.25)


# critical glitch（橙红边缘撕裂，art-bible §2.5）：GlitchOverlay alpha 脉冲 + 面板轻微抖动。
func _start_glitch() -> void:
	_glitch.visible = true
	_glitch.color = Color(1.0, 0.32, 0.22, 0.0)
	_glitch_tween = create_tween().set_loops()
	_glitch_tween.tween_property(_glitch, "color:a", 0.28, 0.12)
	_glitch_tween.tween_property(_glitch, "color:a", 0.05, 0.10)
	_glitch_tween.tween_property(_glitch, "color:a", 0.32, 0.08)


func _stop_glitch() -> void:
	if _glitch_tween != null:
		_glitch_tween.kill()
		_glitch_tween = null


func _kill_tweens() -> void:
	if _play_tween != null:
		_play_tween.kill()
		_play_tween = null
	_stop_glitch()


# ───────────────────────── 输入：跳过 / 继续 ─────────────────────────

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("ui_accept"):
		_on_accept()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed("ui_cancel"):
		# 跳过演出动画（结算数值不可跳过 → 仅在 phase1 生效；phase2 不响应 cancel）
		if _phase == 1:
			_kill_tweens()
			_enter_settle_phase()
		get_viewport().set_input_as_handled()


func _on_accept() -> void:
	match _phase:
		1:
			_kill_tweens()
			_enter_settle_phase()   # 跳过演出 → 直入结算停留（数值不可跳过）
		2:
			_hide_all()             # 继续 → 关闭


# ───────────────────────── 公共查询（测试） ─────────────────────────

func is_playing() -> bool:
	return visible
func get_phase() -> int:
	return _phase
func is_glitch_active() -> bool:
	return _glitch_tween != null and _glitch_tween.is_valid()
func is_stage_visible() -> bool:
	return _stage_panel.visible
func is_minor_banner_visible() -> bool:
	return _minor_banner.visible
func get_settlement() -> SettlementScreen:
	return _settlement
func get_narration_text() -> String:
	return _narration_label.text
func is_compress_note_visible() -> bool:
	return _compress_note.visible
