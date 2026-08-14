class_name SettlementScreen
extends Control

## 结算屏 · 改写节点锁定后的数值反馈层（ux-spec §9.2 / rewrite-causality §2.8）。
##
## 显示：Δ_node / M / CP_earned（打字机跳动，art-bible §7.3）/ feedback_tier /
##       （critical）世界线震荡警告 / 因果→下游播报（causal_link_propagated existence）。
##
## 归属：S3 反馈层视觉（演出资产归 S3，panel-progression §1.4）；旁白配音归 X1（P6-1）。
## 由 RewriteFeedbackController 在 node_resolved 后驱动（控制器决定何时显示/隐藏/降级），
## **不直连引擎信号**（避免与控制器双重调度）。
##
## 视觉：art-bible §6.1 系统材质（半透明网格墨蓝底 + 青蓝硬边 + 数据白等宽 + 冷光青标签）；
##       critical 档叠橙红警示（§2.5/§4.5）。
##
## 数据驱动：标签文案由调用方传入（控制器格式化自 RewriteNarrationData），本控件不硬编码叙事文案。

@onready var _node_label: Label = %NodeIdLabel
@onready var _delta_label: Label = %DeltaLabel
@onready var _match_label: Label = %MatchLabel
@onready var _cp_label: Label = %CpLabel
@onready var _tier_label: Label = %TierLabel
@onready var _worldline_label: Label = %WorldlineLabel
@onready var _downstream_label: Label = %DownstreamLabel

@onready var _cp_tween: Tween = null
var _cp_displayed: int = 0
var _target_cp: int = 0

const _TIER_NAMES := {0: "minor", 1: "notable", 2: "critical"}
const _COLOR_TIER := {
	0: Color(0.85, 0.9, 0.98, 1),   # minor 色温稳（数据白）
	1: Color(0.6, 0.85, 1, 1),      # notable 冷光青
	2: Color(1.0, 0.45, 0.35, 1),   # critical 警示橙红（art-bible §2.5）
}


func _ready() -> void:
	visible = false


## 展示结算（由控制器调用）。data 字段：node_id/delta/m/cp/tier/critical/downstream_text/worldline_text/cp_label_text。
func show_settlement(data: Dictionary) -> void:
	visible = true
	var node_id: String = String(data.get("node_id", ""))
	var delta: int = int(data.get("delta", 0))
	var m: float = float(data.get("m", 0.0))
	var cp: int = int(data.get("cp", 0))
	_target_cp = cp
	var tier: int = int(data.get("tier", 0))
	var critical: bool = bool(data.get("critical", false))

	_node_label.text = "%s · %s" % [data.get("node_label_text", "节点已确认"), node_id] if node_id != "" else String(data.get("node_label_text", "节点已确认"))
	_delta_label.text = "Δ_node  %d/100" % delta
	_match_label.text = "意图匹配 M  %.2f" % m
	_tier_label.text = "feedback_tier:  %s" % (_TIER_NAMES.get(tier, "minor"))
	# tier 着色（art-bible §2.5 Δ 三档）
	var col: Color = _COLOR_TIER.get(tier, _COLOR_TIER[0])
	_delta_label.add_theme_color_override("font_color", col)
	_tier_label.add_theme_color_override("font_color", col)

	# CP 打字机跳动（art-bible §7.3）
	var cp_text: String = String(data.get("cp_label_text", "CP_earned"))
	_cp_displayed = 0
	_cp_label.text = "%s  +0" % cp_text
	_animate_cp(cp, cp_text)

	# critical 世界线震荡警告
	var worldline_text: String = String(data.get("worldline_text", ""))
	_worldline_label.visible = (critical and worldline_text != "")
	if _worldline_label.visible:
		_worldline_label.text = "⚠ %s" % worldline_text

	# 因果→下游播报
	_downstream_label.text = String(data.get("downstream_text", ""))
	_downstream_label.visible = (_downstream_label.text != "")


func hide_screen() -> void:
	visible = false
	if _cp_tween != null:
		_cp_tween.kill()
		_cp_tween = null


func get_delta_text() -> String:
	return _delta_label.text
func get_match_text() -> String:
	return _match_label.text
func get_cp_text() -> String:
	return _cp_label.text
func get_tier_text() -> String:
	return _tier_label.text
func get_downstream_text() -> String:
	return _downstream_label.text
func is_worldline_visible() -> bool:
	return _worldline_label.visible
func get_cp_displayed() -> int:
	return _cp_displayed
func get_target_cp() -> int:
	return _target_cp
## 强制完成 CP 打字机（测试/跳过用：跳到终值）。
func finish_cp_anim() -> void:
	if _cp_tween != null:
		_cp_tween.kill()
	_set_cp_text(_target_cp, "CP_earned")
	_cp_displayed = _target_cp
	_cp_tween = null


func is_cp_anim_done() -> bool:
	return _cp_tween == null or not _cp_tween.is_valid()


# CP 数值跳动（art-bible §7.3 滚动/打字机；单 tween 串行，hide 时 kill）。
func _animate_cp(target_cp: int, cp_text: String) -> void:
	if _cp_tween != null:
		_cp_tween.kill()
	_cp_tween = create_tween()
	var from: int = _cp_displayed
	_cp_tween.tween_method(_set_cp_text.bind(cp_text), from, target_cp, 0.45)
	_cp_tween.tween_callback(func() -> void:
		_cp_displayed = target_cp
		_cp_tween = null)


func _set_cp_text(v: int, cp_text: String) -> void:
	_cp_displayed = v
	_cp_label.text = "%s  +%d" % [cp_text, v]
