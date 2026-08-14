class_name RewritePanelView
extends Control

## 改写面板 RewritePanel · Loop A「改写」环操作台（ux-spec §6.3 / rewrite-causality §6.3 / panel-progression §2.6）。
##
## 玩家在此：① 声明意图（选蓝图）→ ② 看动词 cost/ability 预览 → ③ 看实时 Δ 预览 → ④ 确认锁定。
##
## 信号驱动（ux-spec §10.1 / control-manifest「禁轮询」）：订阅 EventBus 信号刷新，_exit_tree disconnect。
## 消费（S1→S3）：node_activated（呼出）/ blueprint_declared（高亮+意图旁白）/ variable_changed（预览变量）/
##   deviation_recomputed(is_preview=true)（Δ 预览）/ node_vanished（收起+消失旁白）/ node_resolved（收起让位演出）。
## 发出（S3→S1）：**node_committed(node_id)**（玩家点「确认改写」，panel §6.3 确认 S3 为玩家确认发出方）。
##
## DAG 守护（rewrite-causality §5.3）：本面板**不**发 verb_executed（动词物理执行归 S4/S5，本切片面板仅预览）。
##
## 视觉：art-bible §6.1 系统材质（半透明网格墨蓝底 + 青蓝硬边 + 数据白等宽 + 冷光青标签 + 扫描开合）。
## 数据驱动：旁白文案读 RewriteNarrationData（.tres），节点/蓝图/动词读 C1 引擎数据缓存（get_node_data 等）。

@export var narration_data: RewriteNarrationData
@export var debug_log: bool = false

const _COLOR_CYAN := Color(0.6, 0.85, 1, 1)
const _COLOR_DATA := Color(0.92, 0.96, 1, 1)
const _COLOR_LABEL := Color(0.55, 0.78, 0.95, 1)
const _COLOR_DIM := Color(0.5, 0.55, 0.62, 1)
const _COLOR_WARN := Color(1.0, 0.45, 0.35, 1)

# 引擎（C1，world.tscn Systems/RewriteCausalityEngine，group "rewrite_engine"）。延迟查找以兼容测试注入顺序。
var _engine: RewriteCausalityEngine = null
var _engine_looked_up: bool = false

var _active_node_id: StringName = &""
var _active_node_data: RewriteNodeData = null
# 动态蓝图/动词控件（_populate 重建；存引用供高亮/刷新）
var _blueprint_buttons: Dictionary = {}   # {StringName bp_id -> Button}
var _verb_buttons: Dictionary = {}        # {StringName verb_id -> Button}
var _selected_verb_id: StringName = &""

@onready var _node_title_label: Label = %NodeTitleLabel
@onready var _dispatch_intro_label: Label = %DispatchIntroLabel
@onready var _intel_key_label: Label = %IntelKeyLabel
@onready var _intel_bar: ProgressBar = %IntelBar
@onready var _intel_value_label: Label = %IntelValueLabel
@onready var _intel_gate_label: Label = %IntelGateLabel
@onready var _blueprint_list: VBoxContainer = %BlueprintList
@onready var _verb_list: VBoxContainer = %VerbList
@onready var _re_key_label: Label = %ReKeyLabel
@onready var _re_bar: ProgressBar = %ReBar
@onready var _re_value_label: Label = %ReValueLabel
@onready var _attempts_value_label: Label = %AttemptsValueLabel
@onready var _preview_vars_label: Label = %PreviewVarsLabel
@onready var _preview_delta_label: Label = %PreviewDeltaLabel
@onready var _special_flag_label: Label = %SpecialFlagLabel
@onready var _exchange_sub_view: PanelContainer = %ExchangeSubView
@onready var _exchange_button: Button = %ExchangeButton
@onready var _commit_button: Button = %CommitButton


func _ready() -> void:
	if narration_data == null:
		var nd_path := "res://systems/rewrite/rewrite_narration_chibi.tres"
		if ResourceLoader.exists(nd_path):
			narration_data = load(nd_path)
	# adr-004：消费方 _ready 主动 connect；_exit_tree disconnect 防悬挂回调。
	EventBus.node_activated.connect(_on_node_activated)
	EventBus.blueprint_declared.connect(_on_blueprint_declared)
	EventBus.variable_changed.connect(_on_variable_changed)
	EventBus.deviation_recomputed.connect(_on_deviation_recomputed)
	EventBus.node_vanished.connect(_on_node_vanished)
	EventBus.node_resolved.connect(_on_node_resolved)
	_apply_static_labels()
	_commit_button.pressed.connect(_on_commit_pressed)
	_exchange_button.pressed.connect(_on_exchange_toggled)
	_commit_button.focus_mode = Control.FOCUS_ALL
	_exchange_button.focus_mode = Control.FOCUS_ALL
	visible = false
	_exchange_sub_view.visible = false


func _exit_tree() -> void:
	for sig in [EventBus.node_activated, EventBus.blueprint_declared, EventBus.variable_changed,
			EventBus.deviation_recomputed, EventBus.node_vanished, EventBus.node_resolved]:
		for c in sig.get_connections():
			if c.callable.get_object() == self:
				sig.disconnect(c.callable)


func _apply_static_labels() -> void:
	_node_title_label.text = "— · 改写面板（未激活）"
	_dispatch_intro_label.text = ""
	_intel_key_label.text = "情报覆盖率 intel_cov"
	_re_key_label.text = "改写能量 RE"


# ───────────────────────── 引擎定位 ─────────────────────────

func _get_engine() -> RewriteCausalityEngine:
	if _engine != null and is_instance_valid(_engine):
		return _engine
	_engine_looked_up = true
	var n: Node = get_tree().get_first_node_in_group("rewrite_engine")
	if n is RewriteCausalityEngine:
		_engine = n
		return _engine
	_engine = null
	return null


# 测试/调试注入引擎（绕过 group 查找）。
func debug_set_engine(eng: RewriteCausalityEngine) -> void:
	_engine = eng
	_engine_looked_up = true


# ───────────────────────── EventBus 订阅 ─────────────────────────

func _on_node_activated(node_id: StringName) -> void:
	var eng := _get_engine()
	if eng == null:
		push_warning("RewritePanelView: node_activated 无引擎（测试需 debug_set_engine 或挂 world.tscn）")
		return
	var nd: RewriteNodeData = eng.get_node_data(node_id)
	if nd == null:
		push_warning("RewritePanelView: node_activated 无节点数据 %s" % node_id)
		return
	_active_node_id = node_id
	_active_node_data = nd
	_open_panel()
	if debug_log:
		print("[RewritePanelView] opened @ %s" % node_id)


func _on_blueprint_declared(node_id: StringName, blueprint_id: StringName) -> void:
	if node_id != _active_node_id:
		return
	_refresh_blueprint_highlight()
	_refresh_intent_narration(blueprint_id)


func _on_variable_changed(var_id: StringName, _old: String, _new: String, is_preview: bool) -> void:
	# 预览态（is_preview=true）即时刷新变量显示（§2.7）；锁定态（false）由 node_resolved 收起，忽略。
	if not is_preview:
		return
	if not visible:
		return
	_refresh_preview_vars()
	_refresh_resources()   # verb 后 attempts_used / RE 变化（RE 由 C1 持有，本切片 C1 不扣减；attempts 递增）


func _on_deviation_recomputed(node_id: StringName, delta_node: int, is_preview: bool) -> void:
	if node_id != _active_node_id:
		return
	if not is_preview:
		return   # 结算态（is_preview=false）由反馈控制器接管，面板忽略
	if not visible:
		return
	_refresh_preview_delta(delta_node)
	_refresh_resources()


func _on_node_vanished(node_id: StringName) -> void:
	if node_id == _active_node_id:
		_close_panel()


func _on_node_resolved(node_id: StringName, _fv: Dictionary, _delta: int, _cp: int) -> void:
	# 节点锁定 → 收起面板，让位 STG/结算演出（ux-spec §6.4 强模态）。
	if node_id == _active_node_id:
		_close_panel()


# ───────────────────────── 开/关 ─────────────────────────

func _open_panel() -> void:
	visible = true
	_populate()
	_exchange_sub_view.visible = false
	# 焦点链：默认聚焦首个可选蓝图（control-manifest 焦点链，手柄无鼠标）
	var first_bp: Button = null
	for bp_id in _active_node_data.blueprint_ids:
		var btn: Button = _blueprint_buttons.get(bp_id)
		if btn != null and not btn.disabled:
			first_bp = btn
			break
	if first_bp != null:
		first_bp.grab_focus()
	else:
		_commit_button.grab_focus()


func _close_panel() -> void:
	visible = false
	_active_node_id = &""
	_active_node_data = null
	_selected_verb_id = &""
	release_focus()


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed("ui_cancel"):
		if _exchange_sub_view.visible:
			_exchange_sub_view.visible = false
		else:
			_close_panel()
		get_viewport().set_input_as_handled()


# ───────────────────────── 填充（数据驱动，读 C1 引擎） ─────────────────────────

func _populate() -> void:
	var eng := _get_engine()
	var nd: RewriteNodeData = _active_node_data
	# 头部：节点标题 + 派单语气开场（读节点 system_intro，冷光记录员语气）
	_node_title_label.text = "%s · %s" % [String(nd.node_id), nd.display_title]
	var intro: String = nd.system_intro
	if narration_data != null and narration_data.dispatch_prefix != "":
		intro = "%s%s" % [narration_data.dispatch_prefix, intro]
	_dispatch_intro_label.text = intro
	# intel_cov 情境化（ux-spec §5.7）
	var intel_cov: float = eng.get_intel_cov() if eng != null else 0.0
	_intel_bar.value = clampf(intel_cov, 0.0, 1.0) * 100.0
	_intel_value_label.text = "%.2f" % intel_cov
	# 资源：RE + attempts
	_refresh_resources()
	# 蓝图卡 + 动词列表（动态重建）
	_populate_blueprints()
	_populate_verbs()
	# 预览（初始 baseline 态）
	_refresh_preview_vars()
	var dp: int = eng.get_deviation_preview() if eng != null else 0
	_refresh_preview_delta(dp)
	_refresh_commit_state()


func _populate_blueprints() -> void:
	for c in _blueprint_list.get_children():
		c.queue_free()
	_blueprint_buttons.clear()
	var eng := _get_engine()
	var nd: RewriteNodeData = _active_node_data
	var intel_cov: float = eng.get_intel_cov() if eng != null else 0.0
	var selected_bp: StringName = eng.get_selected_blueprint() if eng != null else &""
	for bp_id in nd.blueprint_ids:
		var bp: RewriteBlueprintData = eng.get_blueprint_data(bp_id) if eng != null else null
		var btn: Button = Button.new()
		btn.focus_mode = Control.FOCUS_ALL
		btn.toggle_mode = true
		var locked: bool = (bp != null and intel_cov + 1e-6 < bp.unlock_intel_cov)
		btn.disabled = locked
		if bp != null:
			var m_preview: float = eng.get_intent_match_preview() if (eng != null and selected_bp == bp_id) else 0.0
			var m_text: String = ("M预估 %.2f" % m_preview) if selected_bp == bp_id else "M预估 —"
			btn.text = "[%s] %s  ·  %s  ·  %s" % [String(bp.blueprint_id), bp.intent_label, _format_target_vars(bp), m_text]
			if locked:
				btn.text += "  ·  ✕ 需 intel_cov≥%.1f" % bp.unlock_intel_cov
				btn.add_theme_color_override("font_color", _COLOR_DIM)
				btn.add_theme_color_override("font_disabled_color", _COLOR_DIM)
			btn.tooltip_text = "unlock_intel_cov=%.2f / current=%.2f" % [bp.unlock_intel_cov, intel_cov]
		else:
			btn.text = "[%s]（蓝图数据缺失）" % String(bp_id)
			btn.disabled = true
		btn.set_pressed_no_signal(selected_bp == bp_id)
		btn.pressed.connect(_on_blueprint_pressed.bind(bp_id))
		_blueprint_list.add_child(btn)
		_blueprint_buttons[bp_id] = btn


func _populate_verbs() -> void:
	for c in _verb_list.get_children():
		c.queue_free()
	_verb_buttons.clear()
	var eng := _get_engine()
	var nd: RewriteNodeData = _active_node_data
	for verb_id in nd.verb_ids:
		var vd: RewriteVerbData = eng.get_verb_data(verb_id) if eng != null else null
		var btn: Button = Button.new()
		btn.focus_mode = Control.FOCUS_ALL
		btn.toggle_mode = true
		if vd != null:
			var chk: Dictionary = eng.can_execute_verb(verb_id) if eng != null else {"ok": false, "reason": "no_engine", "cost": 0}
			var cost: int = int(chk.get("cost", vd.cost_base))
			var status: String = ""
			var warn: bool = false
			match String(chk.get("reason", "")):
				"no_re":
					status = "RE 不足"
					warn = true
				"max_attempts_exhausted":
					status = "尝试已耗尽"
					warn = true
				_:
					status = "可执行"
			var ability_note: String = ""
			if vd.requires_ability != &"":
				ability_note = " · 需 ability: %s" % String(vd.requires_ability)
			btn.text = "[%s] %s  ·  cost_RE: %d  ·  %s%s" % [String(vd.verb_id), vd.display_name, cost, status, ability_note]
			btn.add_theme_color_override("font_color", _COLOR_WARN if warn else _COLOR_DATA)
			btn.tooltip_text = "物理执行经 S4 战斗 / S5 交互（本切片面板仅预览，不发 verb_executed，DAG §5.3）"
		else:
			btn.text = "[%s]（动词数据缺失）" % String(verb_id)
			btn.disabled = true
		btn.set_pressed_no_signal(_selected_verb_id == verb_id)
		btn.pressed.connect(_on_verb_pressed.bind(verb_id))
		_verb_list.add_child(btn)
		_verb_buttons[verb_id] = btn


# ───────────────────────── 玩家操作 ─────────────────────────

func _on_blueprint_pressed(bp_id: StringName) -> void:
	var eng := _get_engine()
	if eng == null:
		return
	var r: Dictionary = eng.select_blueprint(_active_node_id, bp_id)
	if not r.ok:
		if debug_log:
			print("[RewritePanelView] select_blueprint %s rejected: %s" % [bp_id, r.reason])
		return
	# 成功 → 引擎发 blueprint_declared → _on_blueprint_declared 刷新高亮 + 意图旁白（信号驱动，不重复刷新）


func _on_verb_pressed(verb_id: StringName) -> void:
	# 动词「选中」仅更新预览焦点（DAG：物理执行归 S4/S5，面板不发 verb_executed，§5.3）
	_selected_verb_id = verb_id
	for v in _verb_buttons:
		_verb_buttons[v].set_pressed_no_signal(v == verb_id)


func _on_commit_pressed() -> void:
	if not visible or _active_node_id == &"":
		return
	var eng := _get_engine()
	if eng == null:
		return
	# §5.1 经济防线：未选蓝图则不可锁定（意图未声明）—— 但引擎兜底允许 M=0 结算；面板仍提示。
	if eng.get_selected_blueprint() == &"":
		_special_flag_label.text = "⚠ 未声明意图（未选蓝图）。锁定将得 M=0、CP≈0（§5.5）。"
		_special_flag_label.add_theme_color_override("font_color", _COLOR_WARN)
		return
	# panel §6.3：玩家确认归 S3 发出 node_committed（S3→S1），不经 S2。
	# 捕获到局部再 emit：本 emit 会同步触发引擎结算→node_resolved→本面板 _on_node_resolved
	# 重置 _active_node_id=&""；传局部副本避免后续 connect 者读到被重置的成员。
	var nid: StringName = _active_node_id
	EventBus.node_committed.emit(nid)
	if debug_log:
		print("[RewritePanelView] committed %s" % nid)


func _on_exchange_toggled() -> void:
	_exchange_sub_view.visible = not _exchange_sub_view.visible


# ───────────────────────── 刷新 ─────────────────────────

func _refresh_blueprint_highlight() -> void:
	var eng := _get_engine()
	var selected_bp: StringName = eng.get_selected_blueprint() if eng != null else &""
	# 重算每卡 M 预估（选中蓝图才有非零预估）
	for bp_id in _blueprint_buttons:
		var btn: Button = _blueprint_buttons[bp_id]
		btn.set_pressed_no_signal(bp_id == selected_bp)
		if btn.disabled:
			continue
		var bp: RewriteBlueprintData = eng.get_blueprint_data(bp_id) if eng != null else null
		if bp == null:
			continue
		var m_preview: float = eng.get_intent_match_preview() if (eng != null and bp_id == selected_bp) else 0.0
		var m_text: String = ("M预估 %.2f" % m_preview) if bp_id == selected_bp else "M预估 —"
		btn.text = "[%s] %s  ·  %s  ·  %s" % [String(bp.blueprint_id), bp.intent_label, _format_target_vars(bp), m_text]


func _refresh_intent_narration(blueprint_id: StringName) -> void:
	var eng := _get_engine()
	var bp: RewriteBlueprintData = eng.get_blueprint_data(blueprint_id) if eng != null else null
	if bp == null:
		return
	var voice: String = ""
	if narration_data != null:
		voice = narration_data.intent_voice_template.format({"label": bp.intent_label})
	# special_flags（如 self_replacement）触发系统特殊旁白提示（ux-spec §6.3）
	var flag_note: String = ""
	for f in bp.special_flags:
		if f == "triggers_self_replacement_voice" and narration_data != null:
			flag_note = narration_data.self_replacement_voice
			break
	if flag_note != "":
		_special_flag_label.text = "⚠ %s" % flag_note
		_special_flag_label.add_theme_color_override("font_color", _COLOR_CYAN)
	elif voice != "":
		_special_flag_label.text = voice
		_special_flag_label.add_theme_color_override("font_color", _COLOR_LABEL)
	else:
		_special_flag_label.text = ""


func _refresh_resources() -> void:
	var eng := _get_engine()
	var nd: RewriteNodeData = _active_node_data
	var re: int = eng.get_re() if eng != null else 0
	var re_max: int = nd.re_max if nd != null else 100
	_re_bar.max_value = max(1, re_max)
	_re_bar.value = clampi(re, 0, re_max)
	_re_value_label.text = "%d/%d" % [re, re_max]
	var used: int = eng.get_attempts_used() if eng != null else 0
	var mx: int = nd.max_attempts if nd != null else 3
	_attempts_value_label.text = "%d/%d" % [used, mx]
	if used >= mx:
		_attempts_value_label.add_theme_color_override("font_color", _COLOR_WARN)
	else:
		_attempts_value_label.add_theme_color_override("font_color", _COLOR_DATA)


func _refresh_preview_vars() -> void:
	var eng := _get_engine()
	if eng == null or _active_node_data == null:
		_preview_vars_label.text = ""
		return
	var lines: PackedStringArray = []
	for ve in _active_node_data.vars:
		if ve == null:
			continue
		var vd: RewriteVariableData = eng.get_variable_data(ve.var_id)
		var cur: String = eng.get_working_var(ve.var_id)
		var disp: String = _value_display(vd, cur) if vd != null else cur
		lines.append("%s: %s" % [String(ve.var_id), disp])
	_preview_vars_label.text = "\n".join(lines)


func _refresh_preview_delta(delta_node: int) -> void:
	var tier_name: String = _tier_name_for_delta(delta_node)
	_preview_delta_label.text = "Δ_node: %d/100 (%s)" % [delta_node, tier_name]
	var col: Color = _COLOR_DATA
	if delta_node >= 80:
		col = _COLOR_WARN
	elif delta_node >= 20:
		col = _COLOR_CYAN
	_preview_delta_label.add_theme_color_override("font_color", col)


func _refresh_commit_state() -> void:
	var eng := _get_engine()
	if eng == null or _active_node_id == &"":
		_commit_button.disabled = true
		return
	var state: int = eng.get_active_node_state()
	# 已确认（CONFIRMED=3）→ 禁用（节点已锁定）。REWRITABLE(1)/EXECUTING(2) 可确认。
	_commit_button.disabled = (state == RewriteCausalityEngine.NodeNumState.CONFIRMED
			or state == RewriteCausalityEngine.NodeNumState.INACTIVE)


# ───────────────────────── 辅助 ─────────────────────────

func _format_target_vars(bp: RewriteBlueprintData) -> String:
	var parts: PackedStringArray = []
	for ve in bp.vars:
		if ve != null:
			parts.append("%s=%s" % [String(ve.var_id), ve.target_value])
	return "target: " + ", ".join(parts)


func _value_display(vd: RewriteVariableData, key: String) -> String:
	for e in vd.entries:
		if e != null and String(e.key) == key:
			return "%s (%s)" % [e.display, key]
	return key


func _tier_name_for_delta(delta: int) -> String:
	if delta >= 80:
		return "critical"
	if delta >= 20:
		return "notable"
	return "minor"


# ───────────────────────── 公共查询（测试/调试） ─────────────────────────

func is_open() -> bool:
	return visible

func get_active_node_id() -> StringName:
	return _active_node_id

func get_selected_blueprint() -> StringName:
	var eng := _get_engine()
	return eng.get_selected_blueprint() if eng != null else &""

func get_selected_verb() -> StringName:
	return _selected_verb_id

func get_displayed_delta() -> int:
	var txt: String = _preview_delta_label.text
	var i0: int = txt.find(":")
	var i1: int = txt.find("/", i0)
	if i0 < 0 or i1 < 0:
		return 0
	return int(txt.substr(i0 + 1, i1 - i0 - 1).strip_edges())

func get_intent_narration_text() -> String:
	return _special_flag_label.text

func is_commit_disabled() -> bool:
	return _commit_button.disabled

func is_exchange_sub_view_visible() -> bool:
	return _exchange_sub_view.visible

func get_blueprint_button(bp_id: StringName) -> Button:
	return _blueprint_buttons.get(bp_id)

func get_verb_button(verb_id: StringName) -> Button:
	return _verb_buttons.get(verb_id)
