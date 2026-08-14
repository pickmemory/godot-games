class_name RewriteFeedbackController
extends Node

## 改写/因果反馈控制器 · Loop A「反馈」环调度中枢（issue #18 · rewrite-causality §2.8 / panel-progression §2.5）。
##
## 职责：把 C1 引擎（#17）锁结算时发出的**一组结算信号**（§6.1）翻译成「历史线分叉演出 + 结算屏」
## 的呈现调度，按 feedback_tier 三档选量级（minor/notable/critical），并对**连续 critical 降级压缩**
## 防疲劳（panel §2.5 / §5.6）。旁白文案由 RewriteNarrationData 提供（X1 冷光记录员语气，配音归 P6-1）。
##
## 信号驱动（ux-spec §10.1 / control-manifest「禁轮询」）：订阅 EventBus 结算信号；_exit_tree disconnect。
## 消费（S1→S3）：deviation_recomputed(is_preview=false)/intent_match_computed/cp_awarded/feedback_tier/
##   critical_deviation_triggered/causal_link_propagated/node_resolved/node_vanished。
## **不发出任何信号**（纯消费 → 驱动 TimelineStage 视觉）；玩家确认归 RewritePanelView 发 node_committed。
##
## 累积语义：C1 `_settle_node` 内同步顺序发结算信号组，node_resolved 在最后；本控制器按 node_id
## 累积 _pending，于 node_resolved 一次性 flush 给 TimelineStage（避免逐信号抖动演出）。
##
## 挂载：world.tscn Systems/（与 RewriteCausalityEngine 同范式，class_name Node 非 Autoload，K10）。
@export var narration_data: RewriteNarrationData
@export var timeline_stage_path: NodePath = NodePath("../../L5_SystemCanvas/TimelineStage")   # World/Systems/本节点 → World/L5_SystemCanvas/TimelineStage
@export var debug_log: bool = false

const TIER_MINOR := 0
const TIER_NOTABLE := 1
const TIER_CRITICAL := 2

# 连续 critical 演出降级：第 2 次起压缩（panel §2.5 防疲劳）。阈值=1 表示「上一也是 critical」时本次压缩。
const CONSECUTIVE_CRITICAL_DEGRADE_THRESHOLD := 1

var _timeline_stage: TimelineStage = null
var _pending: Dictionary = {}             # {String node_id -> Dictionary 累积结算数据}
var _consecutive_critical: int = 0        # 连续 critical 计数（防疲劳降级用）
var _engine: RewriteCausalityEngine = null


func _ready() -> void:
	if narration_data == null:
		var nd_path := "res://systems/rewrite/rewrite_narration_chibi.tres"
		if ResourceLoader.exists(nd_path):
			narration_data = load(nd_path)
	# adr-004：消费方 _ready 主动 connect；_exit_tree disconnect 防悬挂回调。
	EventBus.deviation_recomputed.connect(_on_deviation_recomputed)
	EventBus.intent_match_computed.connect(_on_intent_match_computed)
	EventBus.cp_awarded.connect(_on_cp_awarded)
	EventBus.feedback_tier.connect(_on_feedback_tier)
	EventBus.critical_deviation_triggered.connect(_on_critical_deviation_triggered)
	EventBus.causal_link_propagated.connect(_on_causal_link_propagated)
	EventBus.node_resolved.connect(_on_node_resolved)
	EventBus.node_vanished.connect(_on_node_vanished)


func _exit_tree() -> void:
	for sig in [EventBus.deviation_recomputed, EventBus.intent_match_computed, EventBus.cp_awarded,
			EventBus.feedback_tier, EventBus.critical_deviation_triggered, EventBus.causal_link_propagated,
			EventBus.node_resolved, EventBus.node_vanished]:
		for c in sig.get_connections():
			if c.callable.get_object() == self:
				sig.disconnect(c.callable)


func _get_timeline_stage() -> TimelineStage:
	if _timeline_stage != null and is_instance_valid(_timeline_stage):
		return _timeline_stage
	if timeline_stage_path != NodePath("") and has_node(timeline_stage_path):
		var n: Node = get_node(timeline_stage_path)
		if n is TimelineStage:
			_timeline_stage = n
			return _timeline_stage
	# 兜底：按类查找（兼容不同挂载点）
	for n in get_tree().get_nodes_in_group("timeline_stage"):
		if n is TimelineStage:
			_timeline_stage = n
			return n
	return null


func _get_engine() -> RewriteCausalityEngine:
	if _engine != null and is_instance_valid(_engine):
		return _engine
	var n: Node = get_tree().get_first_node_in_group("rewrite_engine")
	if n is RewriteCausalityEngine:
		_engine = n
		return _engine
	_engine = null
	return null


# 测试注入。
func debug_set_timeline_stage(ts: TimelineStage) -> void:
	_timeline_stage = ts
	add_to_group("timeline_stage_host")
func debug_set_engine(eng: RewriteCausalityEngine) -> void:
	_engine = eng
func debug_set_narration(nd: RewriteNarrationData) -> void:
	narration_data = nd


# ───────────────────────── EventBus 订阅（累积 _pending） ─────────────────────────

func _on_deviation_recomputed(node_id: StringName, delta_node: int, is_preview: bool) -> void:
	# 仅结算态（is_preview=false）累积；预览态（true）归 RewritePanelView（§2.7）。
	if is_preview:
		return
	_ensure_pending(node_id)["delta"] = delta_node


func _on_intent_match_computed(node_id: StringName, m: float) -> void:
	_ensure_pending(node_id)["m"] = m


func _on_cp_awarded(_amount: int, node_id: StringName, reason: String) -> void:
	_ensure_pending(node_id)["reason"] = reason


func _on_feedback_tier(node_id: StringName, tier: int) -> void:
	_ensure_pending(node_id)["tier"] = tier


func _on_critical_deviation_triggered(node_id: StringName, delta_node: int) -> void:
	var p: Dictionary = _ensure_pending(node_id)
	p["critical"] = true
	p["critical_delta"] = delta_node


func _on_causal_link_propagated(_link_id: StringName, _source_node: StringName, resolved_value: String, target: StringName) -> void:
	if target == &"":
		return
	var p: Dictionary = _ensure_pending(_last_pending_node if _last_pending_node != &"" else target)
	var arr: Array = p.get("causal", [])
	arr.append({"value": resolved_value, "target": target})
	p["causal"] = arr


# causal_link_propagated 不带 node_id；用最近 pending 节点归属（C1 `_settle_node` 内同步发出，单节点结算）。
var _last_pending_node: StringName = &""


func _ensure_pending(node_id: StringName) -> Dictionary:
	if not _pending.has(String(node_id)):
		_pending[String(node_id)] = {"critical": false, "causal": [], "tier": TIER_MINOR, "m": 0.0, "delta": 0}
	_last_pending_node = node_id
	return _pending[String(node_id)]


# ───────────────────────── Flush（node_resolved 触发演出） ─────────────────────────

func _on_node_resolved(node_id: StringName, final_vars: Dictionary, delta_node: int, cp_earned: int) -> void:
	var key: String = String(node_id)
	var p: Dictionary = _pending.get(key, {})
	var tier: int = int(p.get("tier", TIER_MINOR))
	var m: float = float(p.get("m", 0.0))
	var critical: bool = bool(p.get("critical", false))
	var reason: String = String(p.get("reason", "committed"))

	# 连续 critical 降级压缩（panel §2.5 防疲劳）
	var compressed := false
	if tier == TIER_CRITICAL:
		compressed = (_consecutive_critical >= CONSECUTIVE_CRITICAL_DEGRADE_THRESHOLD)
		_consecutive_critical += 1
	else:
		_consecutive_critical = 0

	var data: Dictionary = _build_settlement_data(node_id, final_vars, delta_node, cp_earned, tier, m, critical, p, compressed)
	var ts: TimelineStage = _get_timeline_stage()
	if ts != null:
		ts.play(data, compressed)
		if debug_log:
			print("[RewriteFeedbackController] played tier=%d compressed=%s Δ=%d CP=%d" % [tier, compressed, delta_node, cp_earned])
	else:
		push_warning("RewriteFeedbackController: TimelineStage 未找到（node_resolved 演出未呈现）")
	# 清理本节点 pending
	_pending.erase(key)
	_last_pending_node = &""


func _on_node_vanished(node_id: StringName) -> void:
	# 存在性不满足：播消失短横幅（无结算，§6.4 minor 量级）
	_pending.erase(String(node_id))
	var ts: TimelineStage = _get_timeline_stage()
	if ts == null or narration_data == null:
		return
	var voice: String = narration_data.node_vanished_voice.format({"node": String(node_id)})
	ts.play_vanish_banner(voice)


# ───────────────────────── 结算数据组装（旁白文案格式化） ─────────────────────────

func _build_settlement_data(node_id: StringName, final_vars: Dictionary, delta_node: int,
		cp_earned: int, tier: int, m: float, critical: bool, p: Dictionary, compressed: bool) -> Dictionary:
	var nd: RewriteNarrationData = narration_data
	var eng := _get_engine()
	# 节点显示名（读 C1 节点数据 display_title）
	var display_title: String = String(node_id)
	if eng != null:
		var rd: RewriteNodeData = eng.get_node_data(node_id)
		if rd != null and rd.display_title != "":
			display_title = rd.display_title

	# 旁白文案（X1 冷光记录员语气，配音归 P6-1）
	var narration := ""
	if nd != null:
		if m < 0.01:
			narration = nd.intent_unreachable_voice + " " + nd.get_settle_voice(tier)
		else:
			narration = nd.get_settle_voice(tier)
		if critical:
			narration += " " + nd.worldline_shaken_voice

	# 因果→下游播报（causal_link_propagated existence: met→出现 / unmet→消失）
	var downstream_lines: PackedStringArray = []
	var causal: Array = p.get("causal", [])
	for c in causal:
		var value: String = String(c.get("value", ""))
		var target: String = String(c.get("target", ""))
		var target_disp: String = target
		if eng != null and target != "":
			var td: RewriteNodeData = eng.get_node_data(StringName(target))
			if td != null and td.display_title != "":
				target_disp = td.display_title
		if nd != null:
			match value:
				"met":
					downstream_lines.append(nd.causal_downstream_appear.format({"target": target_disp}))
				"unmet":
					downstream_lines.append(nd.causal_downstream_vanish.format({"target": target_disp}))
				_:
					if target != "":
						downstream_lines.append("→ %s（%s）" % [target_disp, value])

	return {
		"node_id": String(node_id),
		"node_label_text": "%s · 已确认" % display_title,
		"delta": delta_node,
		"m": m,
		"cp": cp_earned,
		"tier": tier,
		"critical": critical,
		"reason": String(p.get("reason", "committed")),
		"narration": narration,
		"baseline_branch": "基准：历史原线（Δ=0）",
		"actual_branch": "改写：偏差 %d 已注入" % delta_node,
		"worldline_text": nd.worldline_shaken_voice if (critical and nd != null) else "",
		"downstream_text": "  ".join(downstream_lines),
		"cp_label_text": "CP_earned",
		"compress_note": nd.consecutive_critical_note if (compressed and nd != null) else "",
	}


# ───────────────────────── 公共查询（测试） ─────────────────────────

func get_consecutive_critical() -> int:
	return _consecutive_critical
