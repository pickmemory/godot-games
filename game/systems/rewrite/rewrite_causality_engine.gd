class_name RewriteCausalityEngine
extends Node

## RewriteCausalityEngine · 改写/因果引擎核心层 C1（S1 权威逻辑所有者 · 项目「系统心脏」）。
## 参考：architecture §3.2 C1 / §4.1 分层单向 / §4.2 DAG / §7.2 信号总表 / §9 存档；
##       rewrite-causality.md 全篇（八节 GDD，本 issue 的需求唯一真值）；adr-002/adr-004/adr-005；control-manifest。
##
## 部署形态（issue #17「参照 quest_system.gd/combat_system.gd 既有范式」+ Godot 4.7 K10：
##   Autoload 不能加 class_name）：
##   - C1 = **class_name Node**（与 C2 QuestSystem / C4 CombatSystem 同范式），挂 world.tscn Systems/；
##     _ready 加入分组 "rewrite_engine" 供玩法层经 get_tree().get_first_node_in_group("rewrite_engine") 定位。
##   - 本切片单 world 场景，跨场景持久化走 save_state 契约（§3.6）+ SaveManager autoload 承载（与 C2 一致）。
##
## 拥有（唯一真值，rewrite-causality §3.6 / systems-index §6）：
##   - 关键变量 v_i 真值（working_vars / resolved final_vars）
##   - 历史偏差 Δ_node 计算（§4.1）+ 意图匹配度 M（§4.2）+ 因果点 CP_earned 产出（§4.2）
##   - 因果链解析（§2.5）+ existence condition 评估（§7.1 规则归 S1）
##   - 改写能量 RE（§4.3）+ 节点内部数值态（可改写/执行中/已确认，§2.3）
##
## DAG 硬契约（红线 · rewrite-causality §5.3/§7 / control-manifest DAG 守护）：
##   - **CP 仅产出，余额/账户归 S3（两段式）**：算出 CP_earned → 发 cp_awarded → 放手，不持余额。
##   - **S4/S5 不直写 v_i/Δ**：只收 verb_executed 事件，据 verbs[].effect_sets 自行改 v_i 后算 Δ。
##   - **existence 规则归 S1，派发决策归 S2**：S1 评估 condition 发 canonical token，S2 决定派发/消失。
##   - **disc/intel_cov 只读契约**：S1 读 S3(disc)/S5(intel_cov) 暴露的契约值，非控制反转（无环，§7.2）。
##
## 信号契约（adr-004 / architecture §7.2，总表登记非私加；零新增/零改名）：
##   - 接收（→S1）：node_activated/node_committed（S2）、verb_executed（S4/S5）、intel_updated（S5）。
##   - 发出（S1→）：blueprint_declared/variable_changed/deviation_recomputed/intent_match_computed/
##     cp_awarded/feedback_tier/critical_deviation_triggered/causal_link_propagated/node_resolved/node_vanished。
##
## 知识诚实（A5）：Godot 4.7 API 不确定处标 [待确认]/TODO，不臆造。

# ── §0 符号表全局默认值（rewrite-causality §0 / §4.6 速查）──
const DEFAULT_K: float = 0.5              # Δ 加成系数（防「盲改最大」，§4.2）
const DEFAULT_DELTA_CAP: float = 100.0   # Δ 加成饱和上限（§4.2）
const DEFAULT_DELTA_CRITICAL: float = 80.0   # 重大偏差阈值（§4.5；节点可覆盖）
const DEFAULT_DELTA_MINOR: float = 20.0   # 轻微偏差上限（§4.4）
const DISC_CAP: float = 0.5              # 改写能力折扣封顶（§4.3 经济防线）
const DEFAULT_RE_MAX: int = 100          # RE 上限兜底（节点 re_max 缺省时）

# ── 反馈强度档位 I（§4.4，驱动演出；演出资产归 S3+X1，本系统只发 feedback_tier 信号）──
enum FeedbackTier { MINOR = 0, NOTABLE = 1, CRITICAL = 2 }
const _TIER_NAMES := {
	FeedbackTier.MINOR: "minor",
	FeedbackTier.NOTABLE: "notable",
	FeedbackTier.CRITICAL: "critical",
}

# ── 节点内部数值态（§2.3，与 S2 生命周期态协同）──
enum NodeNumState { INACTIVE, REWRITABLE, EXECUTING, CONFIRMED }

## 因果链聚合表路径（dyn_threekingdoms_chibi）。@export 供 world.tscn 赋值/测试覆盖。
@export var causal_links_path: String = "res://data/causal_links/causal_links_chibi.tres"
@export var debug_log: bool = false

# ── 运行时态（rewrite-causality §3.6，本系统持有；走 save_state）──
var _active_node_id: StringName = &""            # 当前可改写/执行中节点（§1.3 主线同时仅 1 个）
var _active_node_state: int = NodeNumState.INACTIVE
var _working_vars: Dictionary = {}               # {StringName var_id -> String value}（未锁定 v_i，§5.4 可回滚）
var _selected_blueprint_id: StringName = &""     # 已选蓝图（§5.1 锁定后不可换）
var _blueprint_locked: bool = false
var _attempts_used: int = 0
var _intel_cov: float = 0.0                      # 情报覆盖率（S5 只读契约；S5 未落地占位 0，TODO）
var _disc: float = 0.0                           # 改写能力折扣（S3 只读契约；S3 未落地占位 0，TODO）
var _re: int = 0                                 # 当前改写能量（点）

var _resolved_nodes: Dictionary = {}             # {String node_id -> {final_vars, delta_node, cp_earned, blueprint}}
var _causal_resolved_inputs: Dictionary = {}     # {String node_id -> {String input -> String value}}
var _critical_flags: Dictionary = {"worldline_shaken": false, "shake_count": 0}
var _active_dynasty: StringName = &"dyn_threekingdoms_chibi"

# ── 数据缓存（adr-002 §决定5；静态 .tres 只读，运行时态不写回）──
var _node_cache: Dictionary = {}                 # node_id -> RewriteNodeData
var _var_cache: Dictionary = {}                  # var_id -> RewriteVariableData
var _bp_cache: Dictionary = {}                   # blueprint_id -> RewriteBlueprintData
var _verb_cache: Dictionary = {}                 # verb_id -> RewriteVerbData
var _causal_links: CausalLinksData = null
var _test_mode: bool = false                     # 测试模式：跳过 .tres 强加载，用 debug 注入


func _ready() -> void:
	add_to_group("rewrite_engine")
	# adr-004：消费方 _ready 主动 connect；_exit_tree disconnect 防悬挂回调。
	EventBus.node_activated.connect(_on_node_activated)
	EventBus.node_committed.connect(_on_node_committed)
	EventBus.verb_executed.connect(_on_verb_executed)
	EventBus.intel_updated.connect(_on_intel_updated)
	# 加载因果链聚合表（朝代命名空间；换朝代换数据包，adr-005）
	if not _test_mode:
		_load_causal_links()


func _exit_tree() -> void:
	# adr-004：切场景/销毁时 disconnect 防悬挂回调（只断本对象自己的连接）。
	for sig in [EventBus.node_activated, EventBus.node_committed, EventBus.verb_executed, EventBus.intel_updated]:
		for c in sig.get_connections():
			if c.callable.get_object() == self:
				sig.disconnect(c.callable)


# ═══════════════════════════ §4 公式（纯函数，可独立单测 · A7） ═══════════════════════════

## §4.1：Δ_node = Σ_i(w_i · d_i) · 100，结果 ∈ [0,100] 分。
## weighted_deviations: Array of {w:float, d:float}（节点内 Σw=1.0 归一化由数据保证）。
static func compute_node_deviation(weighted_deviations: Array) -> float:
	var sum: float = 0.0
	for e in weighted_deviations:
		if e is Dictionary:
			sum += float(e.get("w", 0.0)) * float(e.get("d", 0.0))
	return clampf(sum * 100.0, 0.0, 100.0)

## §4.1 单变量偏离度（ENUM/ORDERED 查表）：deviation_table[current]，baseline 恒 0。
## entries: Array[RewriteEnumValueData]；未命中回 1.0（数据错误守门，§5.5）。
static func compute_var_deviation_enum(current: String, entries: Array) -> float:
	for e in entries:
		if e != null and String(e.key) == current:
			return clampf(e.deviation, 0.0, 1.0)
	return 1.0

## §4.1 单变量偏离度（NUMERIC）：d = clamp(|actual−baseline|/range, 0,1)。
static func compute_var_deviation_numeric(actual: float, baseline: float, vmin: float, vmax: float) -> float:
	var range_: float = vmax - vmin
	if is_zero_approx(range_):
		return 0.0
	return clampf(absf(actual - baseline) / range_, 0.0, 1.0)

## §4.2：意图匹配度 M = Σ_i(w'_i · match_i)，结果 ∈ [0,1]。
## weighted_matches: Array of {w:float, match:float}（蓝图内 Σw'=1.0 由数据保证）。
static func compute_intent_match(weighted_matches: Array) -> float:
	var sum: float = 0.0
	for e in weighted_matches:
		if e is Dictionary:
			sum += float(e.get("w", 0.0)) * float(e.get("match", 0.0))
	return clampf(sum, 0.0, 1.0)

## §4.2 单变量吻合度（ENUM）：1.0 if actual==target else 0.0。
static func compute_match_enum(actual: String, target: String) -> float:
	return 1.0 if actual == target else 0.0

## §4.2 单变量吻合度（NUMERIC/ORDERED）：clamp(1 − |actual−target|/range, 0,1)。
static func compute_match_numeric(actual: float, target: float, vmin: float, vmax: float) -> float:
	var range_: float = vmax - vmin
	if is_zero_approx(range_):
		return 1.0 if is_equal_approx(actual, target) else 0.0
	return clampf(1.0 - absf(actual - target) / range_, 0.0, 1.0)

## §4.2：CP_earned = round(CP_node · M · (1 + k · min(Δ,Δ_cap)/Δ_cap))，整数 ≥0。
static func compute_cp_earned(cp_node: int, m: float, delta_node: float, k: float, delta_cap: float) -> int:
	var cap: float = delta_cap if delta_cap > 0.0 else 1.0
	var bonus: float = 1.0 + k * min(delta_node, cap) / cap
	return max(0, int(round(cp_node * clampf(m, 0.0, 1.0) * bonus)))

## §4.3：cost_RE = cost_base · diff_base · (1 − intel_cov) · (1 − disc)，整数 ≥0。
## disc 封顶 0.5（经济防线）；intel_cov ∈ [0,1]（S5 只读契约）。
static func compute_verb_cost(cost_base: int, diff_base: float, intel_cov: float, disc: float) -> int:
	var d: float = clampf(disc, 0.0, DISC_CAP)
	var i: float = clampf(intel_cov, 0.0, 1.0)
	var raw: float = float(cost_base) * diff_base * (1.0 - i) * (1.0 - d)
	return max(0, int(round(raw)))

## §4.3：节点有效难度 diff = diff_base · (1 − intel_cov) ∈ [0.5·(1), 2.0·1]（量纲无量纲）。
static func compute_effective_difficulty(diff_base: float, intel_cov: float) -> float:
	return diff_base * (1.0 - clampf(intel_cov, 0.0, 1.0))

## §4.4：反馈档位 I（minor/notable/critical），阈值映射。
static func compute_feedback_tier(delta_node: float, delta_minor: float, delta_critical: float) -> int:
	if delta_node >= delta_critical:
		return FeedbackTier.CRITICAL
	if delta_node >= delta_minor:
		return FeedbackTier.NOTABLE
	return FeedbackTier.MINOR

static func feedback_tier_name(tier: int) -> String:
	return _TIER_NAMES.get(tier, "minor")


# ═══════════════════════════ EventBus 接收（→S1） ═══════════════════════════

## S2→S1：节点派发（rewrite-causality §7.1）。初始化 v_i=baseline，进入「可改写」数值态。
func _on_node_activated(node_id: StringName) -> void:
	var nd: RewriteNodeData = get_node_data(node_id)
	if nd == null:
		push_warning("RewriteCausalityEngine: node_activated 无节点数据 %s（测试需 debug_register_node 注入）" % node_id)
		return
	if _active_node_id != &"" and _active_node_id != node_id and _active_node_state != NodeNumState.CONFIRMED:
		push_warning("RewriteCausalityEngine: 新节点 %s 激活时旧节点 %s 未确认（覆盖）" % [node_id, _active_node_id])
	_active_node_id = node_id
	_active_node_state = NodeNumState.REWRITABLE
	_active_dynasty = nd.dynasty
	# 初始化 working_vars = 各 var 的 baseline（§2.3 首次 v_i=baseline）
	_working_vars.clear()
	for ve in nd.vars:
		if ve == null:
			continue
		var vd: RewriteVariableData = get_variable_data(ve.var_id)
		var base_val: String = String(vd.baseline) if vd != null else ""
		_working_vars[ve.var_id] = base_val
	_selected_blueprint_id = &""
	_blueprint_locked = false
	_attempts_used = 0
	# RE 按节点重置（§4.3 [待审批] 再生曲线；MVP 进节点满 RE）
	_re = nd.re_max if nd.re_max > 0 else DEFAULT_RE_MAX
	# existence_dep 预检：若本节点有存在性依赖且未满足，理论上 S2 不会派发；此处不重复判定（决策归 S2）。
	if debug_log:
		print("[RewriteCausalityEngine] activated %s -> 可改写 (vars=%s re=%d)" % [node_id, str(_working_vars.keys()), _re])


## S4/S5→S1：动词执行结果（rewrite-causality §7.3/§7.4 DAG 硬契约）。
## 成功则据 verbs[].effect_sets 改 v_i（S4/S5 不直写 v_i），重算 Δ 预览，发 variable_changed/deviation_recomputed。
## 失败/非本节点动词 → 忽略（不改 v_i，§2.1⑤ Loop B 微观风险可重试）。
func _on_verb_executed(verb_id: StringName, _target: StringName, success: bool) -> void:
	if not success:
		return   # 执行失败不改 v_i（§2.1⑤）
	if _active_node_id == &"" or _active_node_state == NodeNumState.INACTIVE or _active_node_state == NodeNumState.CONFIRMED:
		return   # 无激活节点 / 已确认 → 忽略（防悬挂事件，§5.3）
	var nd: RewriteNodeData = get_node_data(_active_node_id)
	if nd == null or not nd.verb_ids.has(verb_id):
		return   # 非本节点可用动词 → 忽略
	var vd: RewriteVerbData = get_verb_data(verb_id)
	if vd == null:
		push_warning("RewriteCausalityEngine: verb_executed 无动词数据 %s" % verb_id)
		return
	# max_attempts 封顶（§5.1 经济防线）：已达上限则忽略新改写单元（不结算，等 node_committed）
	if _attempts_used >= nd.max_attempts:
		if debug_log:
			print("[RewriteCausalityEngine] verb %s ignored: max_attempts=%d 已耗尽" % [verb_id, nd.max_attempts])
		return
	# 应用 effect.set 改 v_i（§5.3 DAG：S1 据本表改，S4/S5 不直写）
	_active_node_state = NodeNumState.EXECUTING
	var changed: Dictionary = vd.get_effect_map()
	for var_id in changed:
		var new_val: String = String(changed[var_id])
		var old_val: String = String(_working_vars.get(var_id, ""))
		if old_val != new_val:
			_working_vars[var_id] = new_val
			EventBus.variable_changed.emit(var_id, old_val, new_val, true)   # is_preview=true（§2.7 实时预览）
	_attempts_used += 1
	# 实时 Δ 预览（§2.7，is_preview=true；不发 CP、不锁因果链）
	var delta_preview := _compute_delta_for_node(nd, _working_vars)
	EventBus.deviation_recomputed.emit(_active_node_id, int(round(delta_preview)), true)
	if debug_log:
		print("[RewriteCausalityEngine] verb %s applied; attempts=%d/%d Δ_preview=%.1f" % [verb_id, _attempts_used, nd.max_attempts, delta_preview])
	# §5.1：耗尽 max_attempts → 自动进入锁定结算（S1 内部触发，非 node_committed）
	if _attempts_used >= nd.max_attempts:
		_settle_node("max_attempts_exhausted")


## S3/S2→S1：玩家确认锁定 / 任务级强制（rewrite-causality §6.2 / mainline §9②）。
## 「玩家确认」归 S3 发、「任务级强制」归 S2 发、「耗尽 attempts」归 S1 内部触发（§2.3）。
func _on_node_committed(node_id: StringName) -> void:
	if node_id != _active_node_id:
		return   # 非当前节点 → 忽略
	if _active_node_state == NodeNumState.CONFIRMED or _active_node_state == NodeNumState.INACTIVE:
		return
	_settle_node("committed")


## S5→S1：情报更新（rewrite-causality §7.4）。更新 intel_cov（降 diff、门控蓝图可见性）。
func _on_intel_updated(intel_cov: float, _new_intels: Array) -> void:
	_intel_cov = clampf(intel_cov, 0.0, 1.0)
	if debug_log:
		print("[RewriteCausalityEngine] intel_cov -> %.2f" % _intel_cov)


# ═══════════════════════════ 改写流程 API（玩法层/S3 面板调） ═══════════════════════════

## §2.1③ 玩家选蓝图 = 显式声明意图（§2.4）。§5.1：选定后本节点不可更换（防刷最优 M）。
## 返回 {ok:bool, reason:String}。unlock_intel_cov 门控（§2.4 探索→改写回路）。
func select_blueprint(node_id: StringName, blueprint_id: StringName) -> Dictionary:
	if node_id != _active_node_id:
		return {"ok": false, "reason": "not_active_node"}
	if _active_node_state == NodeNumState.CONFIRMED:
		return {"ok": false, "reason": "already_confirmed"}
	if _blueprint_locked and _selected_blueprint_id != blueprint_id:
		return {"ok": false, "reason": "blueprint_locked"}   # §5.1 防换蓝图
	var nd: RewriteNodeData = get_node_data(node_id)
	if nd == null or not nd.blueprint_ids.has(blueprint_id):
		return {"ok": false, "reason": "blueprint_not_in_node"}
	var bp: RewriteBlueprintData = get_blueprint_data(blueprint_id)
	if bp == null:
		return {"ok": false, "reason": "no_blueprint_data"}
	# §2.4 intel_cov 门控
	if _intel_cov + 1e-6 < bp.unlock_intel_cov:
		return {"ok": false, "reason": "intel_cov_too_low"}
	_selected_blueprint_id = blueprint_id
	_blueprint_locked = true
	EventBus.blueprint_declared.emit(node_id, blueprint_id)   # S1→S3/X1（§6.1）
	if debug_log:
		print("[RewriteCausalityEngine] blueprint declared: %s @ %s" % [blueprint_id, node_id])
	return {"ok": true, "reason": "ok"}

## §2.1④/§4.3 改写能量校验：RE ≥ cost_RE？返回 {ok, reason, cost}。供 S3 面板/S4 释放前查。
## （C1 不阻断 S4 物理执行——DAG 下 S4 自行校验 requires.ability；本方法供面板预览/门控。）
func can_execute_verb(verb_id: StringName) -> Dictionary:
	if _active_node_id == &"" or _active_node_state == NodeNumState.CONFIRMED:
		return {"ok": false, "reason": "no_active_node", "cost": 0}
	var nd: RewriteNodeData = get_node_data(_active_node_id)
	if nd == null or not nd.verb_ids.has(verb_id):
		return {"ok": false, "reason": "verb_not_in_node", "cost": 0}
	var vd: RewriteVerbData = get_verb_data(verb_id)
	if vd == null:
		return {"ok": false, "reason": "no_verb_data", "cost": 0}
	if _attempts_used >= nd.max_attempts:
		return {"ok": false, "reason": "max_attempts_exhausted", "cost": 0}
	var cost: int = compute_verb_cost(vd.cost_base, nd.diff_base, _intel_cov, _disc)
	if _re < cost:
		return {"ok": false, "reason": "no_re", "cost": cost}
	return {"ok": true, "reason": "ok", "cost": cost}


# ═══════════════════════════ 节点锁定结算（§2.1⑦⑧ / §4 全公式 / §2.5 因果链） ═══════════════════════════

## 锁定结算：算 Δ_node / M / CP_earned / tier / critical → 发结算信号组 → 因果链解析 → 存 resolved。
## reason: "committed" | "max_attempts_exhausted"（日志用）。CP 仅锁定时结算一次（§5.1）。
func _settle_node(reason: String) -> void:
	if _active_node_id == &"" or _active_node_state == NodeNumState.CONFIRMED:
		return
	var nd: RewriteNodeData = get_node_data(_active_node_id)
	if nd == null:
		push_warning("RewriteCausalityEngine: settle 无节点数据 %s" % _active_node_id)
		return
	_active_node_state = NodeNumState.CONFIRMED

	# §4.1 Δ_node（结算，is_preview=false）
	var delta_node: float = _compute_delta_for_node(nd, _working_vars)
	# §4.2 M（蓝图方案前提；未选蓝图 → M=0，§5.5 兜底仍按公式发 CP≈0 不崩）
	var m: float = _compute_intent_match_for_node(nd, _selected_blueprint_id, _working_vars)
	# §4.2 CP_earned（产出归 S1，账户归 S3 两段式）
	var cp_earned: int = compute_cp_earned(nd.cp_node, m, delta_node, DEFAULT_K, DEFAULT_DELTA_CAP)
	# §4.4 反馈档位
	var tier: int = compute_feedback_tier(delta_node, DEFAULT_DELTA_MINOR, nd.delta_critical)
	# §4.5 重大偏差 / 世界线震荡（不双倍 CP，风险转嫁下游）
	var is_critical: bool = (tier == FeedbackTier.CRITICAL) and delta_node >= nd.delta_critical
	if is_critical:
		_critical_flags["worldline_shaken"] = true
		_critical_flags["shake_count"] = int(_critical_flags.get("shake_count", 0)) + 1

	# final_vars 快照（深拷贝 working_vars 的 String 值）
	var final_vars: Dictionary = {}
	for k in _working_vars:
		final_vars[String(k)] = String(_working_vars[k])

	# ── 发结算信号组（S1→S3/S2/S5/X1，rewrite-causality §6.1）──
	# is_preview=false 结算 Δ（§2.7）；S3 据 deviation_recomputed 刷新结算屏。
	EventBus.deviation_recomputed.emit(_active_node_id, int(round(delta_node)), false)
	EventBus.intent_match_computed.emit(_active_node_id, m)
	# CP 两段式：产出归 S1，发 cp_awarded 即放手（账户归 S3）。
	EventBus.cp_awarded.emit(cp_earned, _active_node_id, reason)
	EventBus.feedback_tier.emit(_active_node_id, tier)
	if is_critical:
		EventBus.critical_deviation_triggered.emit(_active_node_id, int(round(delta_node)))
	# 因果链解析（§2.5）—— existence 型 condition 评估归 S1，发 canonical token；派发决策归 S2。
	_resolve_causal_chain(_active_node_id, final_vars)
	# 节点确认回告（S1→S2/S3/X4，§6.1）—— C2 据此推进章节 + X4 触发存档。
	EventBus.node_resolved.emit(_active_node_id, final_vars, int(round(delta_node)), cp_earned)

	# 存 resolved_nodes（§3.6；已锁定不可回滚，§5.4）
	_resolved_nodes[String(_active_node_id)] = {
		"final_vars": final_vars,
		"delta_node": int(round(delta_node)),
		"cp_earned": cp_earned,
		"blueprint": String(_selected_blueprint_id),
	}
	if debug_log:
		print("[RewriteCausalityEngine] settled %s (%s): Δ=%d M=%.2f CP=%d tier=%s critical=%s" %
			[_active_node_id, reason, int(round(delta_node)), m, cp_earned, feedback_tier_name(tier), is_critical])
	# 清激活态（节点已确认；下次 node_activated 重置）
	_active_node_state = NodeNumState.INACTIVE
	# 注：_active_node_id 保留至下次激活（供查询最近确认节点）；working_vars 保留供读档回滚快照


# ═══════════════════════════ 因果链解析（§2.5 / §3.4，限 3 节点最小链、存在性最多一层） ═══════════════════════════

## 节点确认后沿因果链解析下游（§2.5）。两遍：先 value/difficulty（产出下游输入），再 existence（消费输入）。
func _resolve_causal_chain(source_node: StringName, final_vars: Dictionary) -> void:
	if _causal_links == null:
		_load_causal_links()
	if _causal_links == null:
		return   # 无因果链数据（测试可能未注入）→ 跳过
	var out_links: Array[CausalLinkData] = _causal_links.get_outgoing_links(source_node)
	# 本解析批的 resolved inputs（value 链产出，供 existence 链消费；§3.4 source 可依赖输入）
	var resolved_inputs: Dictionary = {}
	# 第一遍：value / difficulty（产出下游输入 + 存 resolved_inputs）
	for l in out_links:
		if l.type == CausalLinkData.LinkType.VALUE:
			var upstream_val: String = String(final_vars.get(String(l.source_var), ""))
			var mapped: String = l.transform_value(upstream_val)
			if l.target_node != &"" and l.target_input != &"":
				resolved_inputs[String(l.target_input)] = mapped
				# 持久化到下游节点的 resolved inputs（§3.6 causal_resolved_inputs）
				var key: String = String(l.target_node)
				if not _causal_resolved_inputs.has(key):
					_causal_resolved_inputs[key] = {}
				(_causal_resolved_inputs[key] as Dictionary)[String(l.target_input)] = mapped
			EventBus.causal_link_propagated.emit(l.link_id, source_node, mapped, l.target_node)
		elif l.type == CausalLinkData.LinkType.DIFFICULTY:
			var upstream_val2: String = String(final_vars.get(String(l.source_var), ""))
			var mapped2: String = l.transform_value(upstream_val2)
			# difficulty 型：改下游 diff_base（下游未激活则记入 resolved_inputs 待用；目标态 S2 应用）
			if l.target_node != &"":
				var key2: String = String(l.target_node)
				if not _causal_resolved_inputs.has(key2):
					_causal_resolved_inputs[key2] = {}
				(_causal_resolved_inputs[key2] as Dictionary)["diff_mod:" + String(l.target_field)] = mapped2
			EventBus.causal_link_propagated.emit(l.link_id, source_node, mapped2, l.target_node)
	# 第二遍：existence（消费 resolved_inputs / final_vars，评估 condition；§7.1 规则归 S1）
	for l in out_links:
		if l.type == CausalLinkData.LinkType.EXISTENCE:
			var met: bool = _evaluate_existence_condition(l.condition, resolved_inputs, final_vars)
			var token: String = "met" if met else "unmet"   # canonical token（C2 据 _EXISTENCE_SATISFYING_TOKENS 决策）
			EventBus.causal_link_propagated.emit(l.link_id, source_node, token, l.target_node)
			if not met:
				# §2.3 ④b：存在性不满足 → S1 发 node_vanished（回告；§6.1 / mainline §2.3 澄清 S1 发）
				EventBus.node_vanished.emit(l.target_node)
			if debug_log:
				print("[RewriteCausalityEngine] existence %s -> %s : %s" % [l.link_id, l.target_node, token])


## existence condition 评估（§3.4 condition "name==value"）。name 先查 resolved inputs，再查 final_vars。
## 评估归 S1（§7.1 两段式：规则归 S1，派发决策归 S2）。
func _evaluate_existence_condition(condition: String, resolved_inputs: Dictionary, final_vars: Dictionary) -> bool:
	condition = condition.strip_edges()
	if condition == "":
		return true   # 无 condition → 恒满足（数据兜底）
	# 语法 "<name>==<value>"（§3.4 示例 "fire_power==high"）
	var sep_idx: int = condition.find("==")
	if sep_idx < 0:
		push_warning("RewriteCausalityEngine: existence condition 语法不支持（仅 name==value）：%s" % condition)
		return true   # 不崩：视为满足（数据错误兜底，§5.5）
	var name_: String = condition.substr(0, sep_idx).strip_edges()
	var target_val: String = condition.substr(sep_idx + 2).strip_edges()
	var actual_val: String = ""
	# 先查本批 resolved inputs（value 链产出，如 fire_power），再查节点 final_vars（原始 v_i）
	if resolved_inputs.has(name_):
		actual_val = String(resolved_inputs[name_])
	elif final_vars.has(name_):
		actual_val = String(final_vars[name_])
	else:
		return false   # 引用的 name 不存在 → 不满足（数据错误，倾向保守不派发）
	return actual_val == target_val


# ═══════════════════════════ Δ / M 计算（实例侧，读数据缓存） ═══════════════════════════

## §4.1 实例侧：据节点数据 + 当前 vars 取值算 Δ_node。
func _compute_delta_for_node(nd: RewriteNodeData, var_values: Dictionary) -> float:
	var weighted: Array = []
	for ve in nd.vars:
		if ve == null:
			continue
		var vd: RewriteVariableData = get_variable_data(ve.var_id)
		if vd == null:
			continue   # 缺变量数据 → 跳过（不崩）
		var cur: String = String(var_values.get(ve.var_id, String(vd.baseline)))
		var d: float = _deviation_for_var(vd, cur)
		weighted.append({"w": ve.weight, "d": d})
	return compute_node_deviation(weighted)

## 单变量偏离度（按 type 分派，§4.1）。
func _deviation_for_var(vd: RewriteVariableData, current: String) -> float:
	if vd == null:
		return 0.0
	match vd.type:
		RewriteVariableData.VarType.NUMERIC:
			var actual: float = float(current)
			return compute_var_deviation_numeric(actual, vd.baseline_numeric, vd.value_min, vd.value_max)
		_:
			# ENUM / ORDERED 查表
			return compute_var_deviation_enum(current, vd.entries)

## §4.2 实例侧：据选中蓝图 + 当前 vars 取值算 M。未选蓝图 → 0.0（§5.5 兜底）。
func _compute_intent_match_for_node(nd: RewriteNodeData, blueprint_id: StringName, var_values: Dictionary) -> float:
	if blueprint_id == &"":
		return 0.0
	var bp: RewriteBlueprintData = get_blueprint_data(blueprint_id)
	if bp == null:
		return 0.0
	var weighted: Array = []
	for ve in bp.vars:
		if ve == null:
			continue
		var vd: RewriteVariableData = get_variable_data(ve.var_id)
		if vd == null:
			continue
		var actual: String = String(var_values.get(ve.var_id, String(vd.baseline)))
		var match_v: float
		if vd.type == RewriteVariableData.VarType.NUMERIC:
			match_v = compute_match_numeric(float(actual), float(ve.target_value), vd.value_min, vd.value_max)
		else:
			match_v = compute_match_enum(actual, ve.target_value)
		weighted.append({"w": ve.m_weight, "match": match_v})
	return compute_intent_match(weighted)


# ═══════════════════════════ 数据加载 / 缓存（adr-002 §决定5） ═══════════════════════════

func _load_causal_links() -> void:
	if _causal_links != null:
		return
	if ResourceLoader.exists(causal_links_path):
		_causal_links = load(causal_links_path) as CausalLinksData
	else:
		if debug_log:
			print("[RewriteCausalityEngine] causal_links 不存在 %s（测试模式可 debug_set_causal_links 注入）" % causal_links_path)

func get_node_data(node_id: StringName) -> RewriteNodeData:
	if node_id == &"":
		return null
	if _node_cache.has(node_id):
		return _node_cache[node_id]
	var path: String = "res://data/nodes/%s.tres" % node_id
	if not ResourceLoader.exists(path):
		return null
	var nd: RewriteNodeData = load(path) as RewriteNodeData
	if nd != null:
		_node_cache[node_id] = nd
	return nd

func get_variable_data(var_id: StringName) -> RewriteVariableData:
	if var_id == &"":
		return null
	if _var_cache.has(var_id):
		return _var_cache[var_id]
	var path: String = "res://data/variables/%s.tres" % var_id
	if not ResourceLoader.exists(path):
		return null
	var vd: RewriteVariableData = load(path) as RewriteVariableData
	if vd != null:
		_var_cache[var_id] = vd
	return vd

func get_blueprint_data(bp_id: StringName) -> RewriteBlueprintData:
	if bp_id == &"":
		return null
	if _bp_cache.has(bp_id):
		return _bp_cache[bp_id]
	var path: String = "res://data/blueprints/%s.tres" % bp_id
	if not ResourceLoader.exists(path):
		return null
	var bp: RewriteBlueprintData = load(path) as RewriteBlueprintData
	if bp != null:
		_bp_cache[bp_id] = bp
	return bp

func get_verb_data(verb_id: StringName) -> RewriteVerbData:
	if verb_id == &"":
		return null
	if _verb_cache.has(verb_id):
		return _verb_cache[verb_id]
	var path: String = "res://data/verbs/%s.tres" % verb_id
	if not ResourceLoader.exists(path):
		return null
	var vd: RewriteVerbData = load(path) as RewriteVerbData
	if vd != null:
		_verb_cache[verb_id] = vd
	return vd


# ═══════════════════════════ 只读查询 API（玩法层/UI/测试；禁轮询，control-manifest 信号节） ═══════════════════════════

func get_active_node_id() -> StringName:
	return _active_node_id

func get_active_node_state() -> int:
	return _active_node_state

func get_working_vars() -> Dictionary:
	return _working_vars.duplicate(true)

func get_working_var(var_id: StringName) -> String:
	return String(_working_vars.get(var_id, ""))

func get_selected_blueprint() -> StringName:
	return _selected_blueprint_id

func get_attempts_used() -> int:
	return _attempts_used

func get_re() -> int:
	return _re

func get_intel_cov() -> float:
	return _intel_cov

func get_disc() -> float:
	return _disc

func is_worldline_shaken() -> bool:
	return bool(_critical_flags.get("worldline_shaken", false))

func get_shake_count() -> int:
	return int(_critical_flags.get("shake_count", 0))

func get_active_dynasty() -> StringName:
	return _active_dynasty

## 实时 Δ 预览（面板用；is_preview=true 同口径）。无激活节点回 0。
func get_deviation_preview() -> int:
	if _active_node_id == &"":
		return 0
	var nd: RewriteNodeData = get_node_data(_active_node_id)
	if nd == null:
		return 0
	return int(round(_compute_delta_for_node(nd, _working_vars)))

## 实时 M 预览（面板用）。无蓝图回 0。
func get_intent_match_preview() -> float:
	if _active_node_id == &"" or _selected_blueprint_id == &"":
		return 0.0
	var nd: RewriteNodeData = get_node_data(_active_node_id)
	if nd == null:
		return 0.0
	return _compute_intent_match_for_node(nd, _selected_blueprint_id, _working_vars)

func is_node_resolved(node_id: StringName) -> bool:
	return _resolved_nodes.has(String(node_id))

func get_resolved_node(node_id: StringName) -> Dictionary:
	return _resolved_nodes.get(String(node_id), {})

func get_resolved_node_ids() -> Array[StringName]:
	var ids: Array[StringName] = []
	for k in _resolved_nodes:
		ids.append(StringName(k))
	return ids

func get_causal_resolved_inputs(node_id: StringName) -> Dictionary:
	return (_causal_resolved_inputs.get(String(node_id), {}) as Dictionary).duplicate(true)


# ═══════════════════════════ 存档态契约（rewrite-causality §3.6 save_state_rewrite_engine） ═══════════════════════════
# SaveManager 集成待 X4；本处声明结构 + serialize/deserialize，原子写由 SaveManager 承载（control-manifest 存档节）。

## 序列化 C1 持久态（resolved_nodes/unresolved_node_snapshot/causal_resolved_inputs/critical_flags/re）。
func serialize() -> Dictionary:
	var snap_unresolved: Dictionary = {}
	if _active_node_id != &"" and _active_node_state != NodeNumState.CONFIRMED and _active_node_state != NodeNumState.INACTIVE:
		var wv: Dictionary = {}
		for k in _working_vars:
			wv[String(k)] = String(_working_vars[k])
		snap_unresolved = {
			"node_id": String(_active_node_id),
			"working_vars": wv,
			"attempts_used": _attempts_used,
			"blueprint": String(_selected_blueprint_id),
		}
	return {
		"schema": "rewrite_engine.v1",
		"active_dynasty": String(_active_dynasty),
		"resolved_nodes": _resolved_nodes.duplicate(true),
		"unresolved_node_snapshot": snap_unresolved,
		"causal_resolved_inputs": _causal_resolved_inputs.duplicate(true),
		"critical_flags": _critical_flags.duplicate(true),
		"re": _re,
		"intel_cov": _intel_cov,
		"disc": _disc,
	}

## 从存档态恢复 C1 运行时态。调用方（SaveManager）负责原子读档 + 一致性校验编排。
func deserialize(data: Dictionary) -> void:
	_resolved_nodes.clear()
	_causal_resolved_inputs.clear()
	var rn: Dictionary = data.get("resolved_nodes", {})
	for k in rn:
		_resolved_nodes[k] = (rn[k] as Dictionary).duplicate(true)
	var cri: Dictionary = data.get("causal_resolved_inputs", {})
	for k in cri:
		_causal_resolved_inputs[k] = (cri[k] as Dictionary).duplicate(true)
	_critical_flags = data.get("critical_flags", {"worldline_shaken": false, "shake_count": 0})
	_re = int(data.get("re", 0))
	_intel_cov = float(data.get("intel_cov", 0.0))
	_disc = clampf(float(data.get("disc", 0.0)), 0.0, DISC_CAP)
	_active_dynasty = StringName(data.get("active_dynasty", "dyn_threekingdoms_chibi"))
	# 恢复未锁定快照（§5.4 未锁定可回滚，不结算 Δ/CP）
	var snap: Dictionary = data.get("unresolved_node_snapshot", {})
	_working_vars.clear()
	_active_node_id = &""
	_active_node_state = NodeNumState.INACTIVE
	_selected_blueprint_id = &""
	_blueprint_locked = false
	_attempts_used = 0
	if not snap.is_empty():
		_active_node_id = StringName(snap.get("node_id", ""))
		_active_node_state = NodeNumState.EXECUTING   # 读档回到执行中（未锁定）
		var wv: Dictionary = snap.get("working_vars", {})
		for k in wv:
			_working_vars[StringName(k)] = String(wv[k])
		_attempts_used = int(snap.get("attempts_used", 0))
		_selected_blueprint_id = StringName(snap.get("blueprint", ""))
		_blueprint_locked = _selected_blueprint_id != &""
	# 读档后向 UI 重发当前展示态（信号驱动；防 UI 与 C1 失同步）
	_resync_ui_after_load()


## 读档后向 UI 重发当前展示态（deviation 预览/结算）。
func _resync_ui_after_load() -> void:
	if _active_node_id != &"" and _active_node_state == NodeNumState.EXECUTING:
		var nd: RewriteNodeData = get_node_data(_active_node_id)
		if nd != null:
			var dp: float = _compute_delta_for_node(nd, _working_vars)
			EventBus.deviation_recomputed.emit(_active_node_id, int(round(dp)), true)


## 读档一致性校验：C2 已确认集 == C1 resolved_nodes（control-manifest 存档节 / architecture §9.2）。
## 由 SaveManager 在读档编排时调用（读两系统快照比对，不一致即拒读档报错）。
## rewrite_snap = RewriteCausalityEngine.serialize()；quest_snap = QuestSystem.serialize()。
static func check_save_consistency(rewrite_snap: Dictionary, quest_snap: Dictionary) -> Dictionary:
	var errors: Array[String] = []
	var c1_resolved: Dictionary = rewrite_snap.get("resolved_nodes", {})
	var c1_ids: Dictionary = {}
	for k in c1_resolved:
		c1_ids[k] = true
	# C2 ledger 中 state == CONFIRMED(3) 的 node_id 集
	var c2_ledger: Dictionary = quest_snap.get("node_lifecycle_ledger", {})
	var c2_confirmed: Dictionary = {}
	for k in c2_ledger:
		var rec: Dictionary = c2_ledger[k]
		if int(rec.get("state", -1)) == 3:   # QuestSystem.LifecycleState.CONFIRMED == 3
			c2_confirmed[k] = true
	# 双向比对
	for k in c1_ids:
		if not c2_confirmed.has(k):
			errors.append("C1 resolved 但 C2 未 confirmed：%s" % k)
	for k in c2_confirmed:
		if not c1_ids.has(k):
			errors.append("C2 confirmed 但 C1 未 resolved：%s" % k)
	return {"ok": errors.is_empty(), "errors": errors}


# ═══════════════════════════ 测试/调试辅助（A7 可测试；不绕过 DAG，仅注入测试态） ═══════════════════════════

## 测试模式：注入节点数据（绕过 .tres 加载；镜像 QuestSystem.debug_register_node 范式）。
func debug_register_node(node_id: StringName, nd: RewriteNodeData) -> void:
	_node_cache[node_id] = nd

func debug_register_variable(var_id: StringName, vd: RewriteVariableData) -> void:
	_var_cache[var_id] = vd

func debug_register_blueprint(bp_id: StringName, bp: RewriteBlueprintData) -> void:
	_bp_cache[bp_id] = bp

func debug_register_verb(verb_id: StringName, vd: RewriteVerbData) -> void:
	_verb_cache[verb_id] = vd

func debug_set_causal_links(cl: CausalLinksData) -> void:
	_causal_links = cl

## 测试辅助：注入 disc（S3 未落地，模拟 S3 只读契约；正式走 ability_changed 信号待 S3 issue）。
func debug_set_disc(d: float) -> void:
	_disc = clampf(d, 0.0, DISC_CAP)

## 测试辅助：注入 intel_cov（S5 未落地，模拟 S5 只读契约）。
func debug_set_intel_cov(i: float) -> void:
	_intel_cov = clampf(i, 0.0, 1.0)

## 测试辅助：注入 RE。
func debug_set_re(re: int) -> void:
	_re = maxi(0, re)

## 测试辅助：手动激活节点（绕过 EventBus.node_activated，供公式/流程单测）。
func debug_activate_node(node_id: StringName) -> void:
	_on_node_activated(node_id)

## 测试辅助：手动触发动词（绕过 EventBus.verb_executed）。
func debug_apply_verb(verb_id: StringName, success: bool = true) -> void:
	_on_verb_executed(verb_id, &"", success)

## 测试辅助：手动触发锁定结算（绕过 EventBus.node_committed）。
func debug_settle_active_node() -> void:
	_settle_node("debug")

## 测试辅助：重置运行时态（保留数据缓存）。
func debug_reset_runtime() -> void:
	_active_node_id = &""
	_active_node_state = NodeNumState.INACTIVE
	_working_vars.clear()
	_selected_blueprint_id = &""
	_blueprint_locked = false
	_attempts_used = 0
	_intel_cov = 0.0
	_disc = 0.0
	_re = 0
	_resolved_nodes.clear()
	_causal_resolved_inputs.clear()
	_critical_flags = {"worldline_shaken": false, "shake_count": 0}

## 测试辅助：开启测试模式（_ready 不强加载 .tres）。
func debug_set_test_mode() -> void:
	_test_mode = true
