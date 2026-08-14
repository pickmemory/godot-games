class_name QuestSystem
extends Node

## QuestSystem · 主线任务编排器核心层 C2（S2 权威逻辑所有者）。
## 参考：architecture §3.2 C2 / §4.1 分层单向 / §4.2 DAG / §7.2 信号总表；mainline-quest.md 全篇；adr-004。
##
## 部署形态（issue #16「参照 combat_system.gd 既有范式」+ Godot 4.7 K10：Autoload 不能加 class_name）：
##   - C2 = **class_name Node**（与 C4 CombatSystem 同范式），挂 world.tscn Systems/QuestSystem；
##     _ready 加入分组 "quest_system" 供玩法层经 get_tree().get_first_node_in_group("quest_system") 定位。
##   - 架构 §8.1 列 C2 为 Autoload（持跨场景 Loop A 态）；本切片单 world 场景，class_name 场景节点即可，
##     且 class_name 让本类可在测试 QuestSystem.new() 独立实例化（A7 可测试，control-manifest）。
##     跨场景持久化由 save_state 契约（§3.3）+ SaveManager 承载（待 P4-X4）。
##
## 拥有（唯一真值，mainline §3.3）：
##   - 节点生命周期账本 node_lifecycle_ledger（5 态 §2.1）
##   - 章节进度 P_ch（§4.3）、已消失节点集 vanished_nodes、已解析存在性条件 existence_condition_met
##   - 当前追踪节点（§1.3 主线同一时刻仅 1 个可改写节点）
##
## DAG 硬契约（红线 · mainline §3.4 / control-manifest DAG 守护）：
##   - **不重定义 existence condition**（规则归 S1/C1）：只引用 link_id，据 S1 回告做派发/消失决策（§2.3 两段式）。
##   - **不算 CP_earned**（归 S1）、**不持 CP 余额**（归 S3）：只读 cp_earned + 声明加成参数（§4.1）。
##   - **不布置世界触发器**（归 S5）、**不做旁白演出**（归 X1）：只发目标场所/文案信号。
##
## 信号契约（adr-004 / architecture §7.2，总表登记非私加）：
##   - 发出（S2→）：node_activated/node_committed（→S1）；quest_objective_updated/quest_progress_updated/
##     quest_target_scene_set/quest_dispatch_voiced/quest_node_vanished_voiced/quest_reward_declared（→S3/S5/X1）。
##   - 接收（S1→S2）：node_resolved/causal_link_propagated/node_vanished（_ready connect，_exit_tree disconnect）。
##   - S1 侧 emit 待 P5-5；本类不臆造 C1 API（知识诚实红线），测试用手动 emit 驱动。
##
## 知识诚实（A5）：Godot 4.7 API 不确定处标 [待确认]/TODO，不臆造。

# ── 生命周期态（mainline §2.1，5 态；与 rewrite-causality §2.3 表左列 S2 列一致）──
enum LifecycleState {
	UNACTIVATED,  # 未激活：尚未派发，不在玩家任务列表
	REWRITABLE,   # 可改写：S2 已派发，S1 已置 v_i=baseline，玩家可介入
	EXECUTING,    # 执行中：玩家正在改写（v_i 随改写单元变化，未锁定）
	CONFIRMED,    # 已确认：玩家确认锁定 / 耗尽 max_attempts，S1 已结算
	VANISHED,     # 已消失：存在性依赖不满足，节点不会到来
}
const _STATE_NAMES := {
	LifecycleState.UNACTIVATED: "未激活",
	LifecycleState.REWRITABLE: "可改写",
	LifecycleState.EXECUTING: "执行中",
	LifecycleState.CONFIRMED: "已确认",
	LifecycleState.VANISHED: "已消失",
}

## existence 满足性判定 token（P5-5 联合确认已落地：condition 精确评估归 S1/C1，rewrite-causality §7.1 两段式）。
## C1(RewriteCausalityEngine, issue #17) 已落地 existence condition 精确评估：节点确认后 C1 据
## causal_links 的 condition 表达式（如 "fire_power==high"）评估，发 canonical token "met"/"unmet"。
## C2 不重定义 condition（control-manifest DAG 守护），只读 C1 给的 canonical token 做派发/消失决策。
## 故本 token 集精简为 ["met"]（C1 canonical 满足输出）；"unmet"/其余 → 不满足 → 消失决策。
const _EXISTENCE_SATISFYING_TOKENS := ["met"]

@export var chapter_data: ChapterData
@export var debug_log: bool = false

# ── 运行时态（mainline §3.3，QuestSystem 拥有；非 .tres，走 save_state）──
var _ledger: Dictionary = {}                 # node_id(StringName) -> { state:int, dispatched_at:int, resolved_at:int }
var _vanished_nodes: Array[StringName] = []  # 已消失节点（曾派发或曾可派发）
var _existence_condition_met: Dictionary = {}  # node_id(StringName) -> bool（存在性条件是否满足）
var _existence_link_to_node: Dictionary = {}   # link_id(StringName) -> node_id(StringName)（C2 登记的 existence 链）
var _dispatch_cache: Dictionary = {}           # node_id(StringName) -> QuestNodeDispatchData（.tres 缓存）
var _chapter_entered: bool = false
var _chapter_progress: float = 0.0             # P_ch（§4.3）
var _current_tracked_node: StringName = &""    # 当前 可改写/执行中 节点（§1.3 主线同时仅 1 个可改写）


func _ready() -> void:
	add_to_group("quest_system")
	if chapter_data == null:
		push_warning("QuestSystem: chapter_data 未赋值，跳过章节进入（world.tscn 须 @export 赋值）")
	# adr-004：消费方在 _ready 主动 connect S1→S2 信号；_exit_tree disconnect 防悬挂回调。
	EventBus.node_resolved.connect(_on_node_resolved)
	EventBus.causal_link_propagated.connect(_on_causal_link_propagated)
	EventBus.node_vanished.connect(_on_node_vanished)
	# 数据校验 + 章节进入 + MVP 派发（architecture §6.3 boot 数据校验；issue #16 验收要点 12）
	# 注：chapter_data 为空时不静默回退加载（守 A5 知识诚实 / 测试需要「未进入章节」实例）；
	# world.tscn 经 @export 显式赋值，测试按需赋值或留空测 chapter_not_entered 分支。
	if chapter_data != null:
		var vr := validate_chapter(chapter_data)
		if not vr.ok:
			push_error("QuestSystem: 章节数据校验失败 %s — %s" % [chapter_data.chapter_id, str(vr.errors)])
			return
		_build_existence_index()
		enter_chapter()


func _exit_tree() -> void:
	# adr-004：切场景/销毁时 disconnect 防悬挂回调（只断本对象自己的连接）。
	for sig in [EventBus.node_resolved, EventBus.causal_link_propagated, EventBus.node_vanished]:
		for c in sig.get_connections():
			if c.callable.get_object() == self:
				sig.disconnect(c.callable)


# ───────────────────────── 章节进入 + MVP 派发（mainline §2.2/§2.5） ─────────────────────────

## 进入章节：派发 t_dispatch=on_chapter_enter 的节点（MVP 的 N2 即此，game-concept §7.1）。
## 对 on_predecessor_resolved 节点，在此也尝试派发（无前序/前序已确认者满足时机）。
func enter_chapter() -> void:
	if chapter_data == null:
		push_warning("QuestSystem: enter_chapter 无章节数据")
		return
	_chapter_entered = true
	# MVP 收窄（game-concept §7.1）：只激活 mvp_subset；mvp_subset 为空则用 ordered_nodes 全集（目标态）。
	var active_ids: Array[StringName] = _active_node_ids()
	for nid in active_ids:
		_ensure_ledger(nid)
	_try_dispatch_pending()
	if debug_log:
		print("[QuestSystem] enter_chapter %s (active=%s) tracked=%s" % [chapter_data.chapter_id, str(active_ids), _current_tracked_node])


## 尝试派发所有 can_dispatch 满足的 未激活 节点（§4.2 判定 + §2.1 派发动作）。
func _try_dispatch_pending() -> void:
	for nid in _active_node_ids():
		_try_dispatch(nid)


## 单节点派发尝试：评估 can_dispatch，满足则 _dispatch_node（§4.2/§2.1）。
func _try_dispatch(node_id: StringName) -> void:
	var chk := can_dispatch(node_id)
	if chk.ok and _ledger.get(node_id, {}).get("state", LifecycleState.UNACTIVATED) == LifecycleState.UNACTIVATED:
		_dispatch_node(node_id)


## 实际派发动作（mainline §2.1）：未激活 → 可改写，emit S2→S1 node_activated + S2→S3/S5/X1 文案/场所信号。
func _dispatch_node(node_id: StringName) -> bool:
	var d: QuestNodeDispatchData = get_dispatch_data(node_id)
	if d == null:
		push_warning("QuestSystem: 派发失败，无 dispatch 数据 %s" % node_id)
		return false
	_ensure_ledger(node_id)
	if _ledger[node_id]["state"] != LifecycleState.UNACTIVATED:
		return false  # 只能从未激活派发（§2.1）
	_ledger[node_id]["state"] = LifecycleState.REWRITABLE
	_ledger[node_id]["dispatched_at"] = _tick()
	_current_tracked_node = node_id  # §1.3：主线同一时刻仅 1 个可改写节点，追踪即指向它
	# S2→S1：派发（rewrite-causality §7.1 / architecture §7.2）—— C1 收后置 v_i=baseline。
	EventBus.node_activated.emit(node_id)
	# S2→S3：任务目标文案（mainline §6.2 / panel-progression §6.2）—— G7 任务 Tab 显示真实数据。
	EventBus.quest_objective_updated.emit(node_id, d.objective_short, d.objective_long)
	# S2→S5：目标场所（mainline §6.2）—— S5 布置冷光环/触发器（art-bible §3.3）。
	if d.target_scene != &"":
		EventBus.quest_target_scene_set.emit(node_id, d.target_scene)
	# S2→X1：派单旁白文案（mainline §6.3）—— X1 冷光记录员演出（表现归 X1，§1.2）。
	if d.system_dispatch_voice != "":
		EventBus.quest_dispatch_voiced.emit(node_id, d.system_dispatch_voice)
	if debug_log:
		print("[QuestSystem] dispatched %s -> 可改写 (target=%s)" % [node_id, d.target_scene])
	return true


# ───────────────────────── 派发前置条件判定（mainline §4.2 公式） ─────────────────────────

## §4.2：can_dispatch = 前序全确认 ∧ 存在性满足 ∧ 章节解锁 ∧ 时机到（四条件全「与」）。
## 返回 { ok:bool, reason:String }，供日志/测试逐分支断言（A7）。
func can_dispatch(node_id: StringName) -> Dictionary:
	var reason := ""
	var d: QuestNodeDispatchData = get_dispatch_data(node_id)
	if d == null:
		return {"ok": false, "reason": "no_data"}
	if not _chapter_entered:
		return {"ok": false, "reason": "chapter_not_entered"}
	# ① 前序节点全部 已确认
	if not _prereqs_all_confirmed(d):
		reason = "prereq_unconfirmed"
	# ② 存在性依赖满足（无依赖则恒真）
	elif not _existence_gate_satisfied(node_id, d):
		reason = "existence_unmet"
	# ③ 章节解锁（本切片单章恒真；多章节门控留 §3.5/§5）
	elif not _chapter_unlocked():
		reason = "chapter_locked"
	# ④ T_dispatch 时机已到（§2.5）
	elif not _t_dispatch_satisfied(d):
		reason = "t_dispatch_not_yet"
	else:
		return {"ok": true, "reason": "ok"}
	return {"ok": false, "reason": reason}


func _prereqs_all_confirmed(d: QuestNodeDispatchData) -> bool:
	for p in d.prereq_nodes:
		var st: int = int(_ledger.get(p, {}).get("state", LifecycleState.UNACTIVATED))
		if st != LifecycleState.CONFIRMED:
			return false
	return true


func _existence_gate_satisfied(node_id: StringName, d: QuestNodeDispatchData) -> bool:
	# §4.2：existence_dep_ref == null(空) OR condition_met == true
	if d.existence_dep_ref == &"":
		return true
	return bool(_existence_condition_met.get(node_id, false))


func _chapter_unlocked() -> bool:
	# MVP 单章恒真（game-concept §7.1）；多章节门控（完成上一章）留目标态。
	return true


func _t_dispatch_satisfied(d: QuestNodeDispatchData) -> bool:
	if not _chapter_entered:
		return false
	match d.t_dispatch:
		QuestNodeDispatchData.TDispatch.ON_CHAPTER_ENTER:
			return true
		QuestNodeDispatchData.TDispatch.ON_PREDECESSOR_RESOLVED:
			return _prereqs_all_confirmed(d)
		QuestNodeDispatchData.TDispatch.ON_PLAYER_REACH:
			# TODO(S5): 需 player_at_scene 信号（open-world §6.5），S5 未接线 → MVP 不派发该类节点。
			return false
	return false


# ───────────────────────── 生命周期推进（mainline §2.1 状态机） ─────────────────────────

## 可改写 → 执行中（§2.1：玩家开始改写，S1 进入内部执行中数值态）。
## ⚠️ 当前 S1↔S2 契约无专用「开始改写」信号（5 条信号无此条），触发源 [待 S3/S1 联合确认]；
## MVP 由调用方（改写面板打开 / 测试）显式推进。状态机完整性所需，非新增跨系统信号。
func advance_to_executing(node_id: StringName) -> bool:
	_ensure_ledger(node_id)
	var st: int = int(_ledger[node_id]["state"])
	if st != LifecycleState.REWRITABLE:
		return false
	_ledger[node_id]["state"] = LifecycleState.EXECUTING
	if debug_log:
		print("[QuestSystem] %s 可改写 -> 执行中" % node_id)
	return true


## S2 任务级强制锁定（§2.1 注）：emit node_committed（S2→S1）。
## 「玩家确认」归 S3 发、「耗尽 attempts」归 S1 内部触发；本方法仅 S2 任务级强制（如任务超时）。
func force_commit_node(node_id: StringName) -> bool:
	_ensure_ledger(node_id)
	var st: int = int(_ledger[node_id]["state"])
	if st == LifecycleState.CONFIRMED or st == LifecycleState.VANISHED:
		return false
	EventBus.node_committed.emit(node_id)
	if debug_log:
		print("[QuestSystem] force_commit %s (S2 任务级锁定)" % node_id)
	return true


# ───────────────────────── EventBus 接收（S1→S2，mainline §6.1 / rewrite-causality §7.1） ─────────────────────────

## S1→S2：节点确认回告。置「已确认」+ 推进章节进度（§4.3）+ emit quest_progress_updated + quest_reward_declared。
## final_vars/delta_node/cp_earned 由 S1 给，C2 只读引用（cp_earned 用于 §4.1 加成参数声明，不算 CP）。
func _on_node_resolved(node_id: StringName, _final_vars: Dictionary, _delta_node: int, _cp_earned: int) -> void:
	_ensure_ledger(node_id)
	var st: int = int(_ledger[node_id]["state"])
	if st == LifecycleState.VANISHED:
		if debug_log:
			print("[QuestSystem] ignore node_resolved for vanished %s" % node_id)
		return
	_ledger[node_id]["state"] = LifecycleState.CONFIRMED
	_ledger[node_id]["resolved_at"] = _tick()
	if _current_tracked_node == node_id:
		_current_tracked_node = &""
	# §4.3 P_ch 重算 + emit（仅变化时发，防噪声）
	var new_p := _recompute_chapter_progress()
	if not is_equal_approx(new_p, _chapter_progress):
		_chapter_progress = new_p
		EventBus.quest_progress_updated.emit(_active_chapter_id(), new_p)
	# §4.1 CP 加成参数声明（应用归 S3 账户侧，C2 不持余额/不算 CP_credited）
	var d: QuestNodeDispatchData = get_dispatch_data(node_id)
	if d != null:
		EventBus.quest_reward_declared.emit(node_id, d.quest_reward_mult, d.quest_cp_flat_bonus)
	# 前序确认后，尝试派发后续待派发节点（on_predecessor_resolved 时机，§2.5）
	_try_dispatch_pending()
	if debug_log:
		print("[QuestSystem] %s -> 已确认 (P_ch=%.2f)" % [node_id, _chapter_progress])


## S1→S2：因果链传递（§2.3 两段式）。规则归 S1，决策归 S2；C2 只对 existence 型做派发/消失决策。
## value/difficulty 型因果链不归 C2 处理（归 S1 自身数值调整，C2 无 v_i/diff 字段）。
func _on_causal_link_propagated(link_id: StringName, _source_node: StringName, resolved_value: String, _target: StringName) -> void:
	if not _existence_link_to_node.has(link_id):
		return  # 非 C2 登记的 existence 链（可能是 value/difficulty 型）→ 归 S1，忽略
	var node_id: StringName = _existence_link_to_node[link_id]
	_ensure_ledger(node_id)
	var condition_met: bool = _is_existence_satisfied(resolved_value)
	_existence_condition_met[node_id] = condition_met
	if condition_met:
		# §2.3 ④a：满足 → 待派发（仍需 can_dispatch 其余条件：t_dispatch/prereq/章节）
		_try_dispatch(node_id)
		if debug_log:
			print("[QuestSystem] existence link %s -> %s 满足，尝试派发" % [link_id, node_id])
	else:
		# §2.3 ④b：不满足 → 消失决策
		_set_node_vanished(node_id)
		if debug_log:
			print("[QuestSystem] existence link %s -> %s 不满足，置已消失" % [link_id, node_id])


## S1→S2：存在性不满足回告。置「已消失」+ 更新账本 + emit 消失文案（§2.1/§6.3）。
func _on_node_vanished(node_id: StringName) -> void:
	_set_node_vanished(node_id)


func _set_node_vanished(node_id: StringName) -> void:
	_ensure_ledger(node_id)
	if int(_ledger[node_id]["state"]) == LifecycleState.VANISHED:
		return  # 幂等
	_ledger[node_id]["state"] = LifecycleState.VANISHED
	if not _vanished_nodes.has(node_id):
		_vanished_nodes.append(node_id)
	if _current_tracked_node == node_id:
		_current_tracked_node = &""
	# S2→X1/S3/S5：消失文案（mainline §6.3）—— X1 播旁白 / S3 标记移除 / S5 场所移除
	var d: QuestNodeDispatchData = get_dispatch_data(node_id)
	if d != null and d.system_vanish_voice != "":
		EventBus.quest_node_vanished_voiced.emit(node_id, d.system_vanish_voice)
	if debug_log:
		print("[QuestSystem] %s -> 已消失" % node_id)


# ───────────────────────── existence 满足性判定（P5-5 已确认：C1 canonical token 精确评估） ─────────────────────────

## P5-5 联合确认（issue #17 落地）：C1 已做 existence condition 精确评估，发 canonical token "met"/"unmet"。
## C2 只读该 token 做派发/消失决策（不重定义 condition，control-manifest DAG 守护 / rewrite-causality §7.1）。
## bool 直传（C1 评估结果）也接受；字符串命中 _EXISTENCE_SATISFYING_TOKENS("met") 视为满足，其余视为不满足。
func _is_existence_satisfied(resolved_value: String) -> bool:
	var s := resolved_value.to_lower()
	return _EXISTENCE_SATISFYING_TOKENS.has(s)


# ───────────────────────── 章节进度（mainline §4.3） ─────────────────────────

## §4.3：P_ch = Σ_{n ∈ 已确认节点} w_node(n) ∈ [0,1]。用已确认节点加权（非 Δ），避免玩家为刷进度盲改 Δ。
func _recompute_chapter_progress() -> float:
	if chapter_data == null:
		return 0.0
	var p := 0.0
	for entry in chapter_data.ordered_nodes:
		if entry == null:
			continue
		var rec: Dictionary = _ledger.get(entry.node_id, {})
		if int(rec.get("state", LifecycleState.UNACTIVATED)) == LifecycleState.CONFIRMED:
			p += entry.weight
	return clampf(p, 0.0, 1.0)


# ───────────────────────── 数据加载 / 校验 / 索引 ─────────────────────────

## 按 node_id 加载（缓存）QuestNodeDispatchData（.tres，data/quests/nodes/<node_id>.tres，architecture §6.2）。
func get_dispatch_data(node_id: StringName) -> QuestNodeDispatchData:
	if node_id == &"":
		return null
	if _dispatch_cache.has(node_id):
		return _dispatch_cache[node_id]
	var path := "res://data/quests/nodes/%s.tres" % node_id
	if not ResourceLoader.exists(path):
		return null
	var d: QuestNodeDispatchData = load(path) as QuestNodeDispatchData
	if d != null:
		_dispatch_cache[node_id] = d
	return d


## boot 章节数据校验（architecture §6.3 / issue #16 验收要点 12）：
## ① ordered_nodes 的 weight 之和 == 1.0（§4.3 归一化）；② mvp_subset ⊆ ordered_nodes 的 node_id。
## existence_dep_ref 不在此重定义（只校验它是 StringName 引用）。失败即返回 {ok:false, errors}。
func validate_chapter(chap: ChapterData) -> Dictionary:
	var errors: Array[String] = []
	if chap == null:
		return {"ok": false, "errors": ["chapter_data is null"]}
	var sum_w := chap.sum_weights()
	if not is_equal_approx(sum_w, 1.0):
		errors.append("Σw_node=%.4f ≠ 1.0（§4.3 归一化）" % sum_w)
	var ordered_ids: Dictionary = {}
	for entry in chap.ordered_nodes:
		if entry != null:
			ordered_ids[entry.node_id] = true
	for nid in chap.mvp_subset:
		if not ordered_ids.has(nid):
			errors.append("mvp_subset 引用非法 node_id：%s（不在 ordered_nodes）" % nid)
	return {"ok": errors.is_empty(), "errors": errors}


## 从已加载 dispatch 数据构建 existence 链索引：link_id -> node_id。
## 仅基于 C2 自己的 dispatch 数据的 existence_dep_ref（引用，非重定义规则）。
func _build_existence_index() -> void:
	_existence_link_to_node.clear()
	for nid in _active_node_ids():
		var d: QuestNodeDispatchData = get_dispatch_data(nid)
		if d != null and d.existence_dep_ref != &"":
			_existence_link_to_node[d.existence_dep_ref] = nid


## MVP 激活节点集：mvp_subset 非空用之，否则 ordered_nodes 全集（目标态）。
func _active_node_ids() -> Array[StringName]:
	var ids: Array[StringName] = []
	if chapter_data == null:
		return ids
	if not chapter_data.mvp_subset.is_empty():
		for nid in chapter_data.mvp_subset:
			ids.append(nid)
	else:
		for entry in chapter_data.ordered_nodes:
			if entry != null:
				ids.append(entry.node_id)
	return ids


func _ensure_ledger(node_id: StringName) -> void:
	if not _ledger.has(node_id):
		_ledger[node_id] = {"state": LifecycleState.UNACTIVATED, "dispatched_at": 0, "resolved_at": 0}


func _tick() -> int:
	# 单调时间戳（毫秒），存档可序列化；<tick> 见 mainline §3.3 账本示例。
	return Time.get_ticks_msec()


func _active_chapter_id() -> StringName:
	return chapter_data.chapter_id if chapter_data != null else &""


# ───────────────────────── 任务日志只读 API（mainline §1.3/§2.4，供 G7 UI/HUD 查；禁轮询） ─────────────────────────
# 设计纪律（control-manifest 信号节「信号驱动禁轮询」）：UI 经 EventBus 信号刷新展示态，
# 仅在需要快照（如面板打开/调试）时调 getter 读当前值；不每帧轮询。

func get_active_chapter_id() -> StringName:
	return _active_chapter_id()

func get_active_dynasty() -> StringName:
	return chapter_data.dynasty if chapter_data != null else &""

func get_chapter_data() -> ChapterData:
	return chapter_data

## 当前追踪节点（§1.3：主线同时仅 1 个可改写节点）。无可改写/执行中节点时返回空。
func get_current_tracked_node_id() -> StringName:
	return _current_tracked_node

func get_chapter_progress() -> float:
	return _chapter_progress

func get_node_lifecycle_state(node_id: StringName) -> int:
	return int(_ledger.get(node_id, {}).get("state", LifecycleState.UNACTIVATED))

func get_node_lifecycle_state_name(node_id: StringName) -> String:
	return _STATE_NAMES.get(get_node_lifecycle_state(node_id), "未激活")

## 账本快照（深拷贝，只读；调用方修改不影响 C2 内部态）。
func get_node_lifecycle_ledger() -> Dictionary:
	var snap: Dictionary = {}
	for nid in _ledger:
		var rec: Dictionary = _ledger[nid]
		snap[nid] = {
			"state": int(rec.get("state", LifecycleState.UNACTIVATED)),
			"state_name": _STATE_NAMES.get(int(rec.get("state", LifecycleState.UNACTIVATED)), "未激活"),
			"dispatched_at": int(rec.get("dispatched_at", 0)),
			"resolved_at": int(rec.get("resolved_at", 0)),
		}
	return snap

func get_vanished_nodes() -> Array[StringName]:
	return _vanished_nodes.duplicate()

func get_objective_short(node_id: StringName) -> String:
	var d: QuestNodeDispatchData = get_dispatch_data(node_id)
	return d.objective_short if d != null else ""

func get_objective_long(node_id: StringName) -> String:
	var d: QuestNodeDispatchData = get_dispatch_data(node_id)
	return d.objective_long if d != null else ""

## §4.1 CP 加成参数（只读；应用归 S3 账户侧）。
func get_quest_reward_mult(node_id: StringName) -> float:
	var d: QuestNodeDispatchData = get_dispatch_data(node_id)
	return d.quest_reward_mult if d != null else 1.0

func get_quest_cp_flat_bonus(node_id: StringName) -> int:
	var d: QuestNodeDispatchData = get_dispatch_data(node_id)
	return d.quest_cp_flat_bonus if d != null else 0


# ───────────────────────── 存档态契约（mainline §3.3 save_state_mainline_quest） ─────────────────────────
# SaveManager 集成待 P4-X4；本处声明结构 + 原子写由 SaveManager 承载（control-manifest 存档节）。

## 序列化 C2 持久态（active_chapter/chapter_progress/node_lifecycle_ledger/vanished_nodes）。
func serialize() -> Dictionary:
	var ledger_snap: Dictionary = {}
	for nid in _ledger:
		var rec: Dictionary = _ledger[nid]
		ledger_snap[String(nid)] = {
			"state": int(rec.get("state", LifecycleState.UNACTIVATED)),
			"dispatched_at": int(rec.get("dispatched_at", 0)),
			"resolved_at": int(rec.get("resolved_at", 0)),
		}
	var vanished_snap: Array[String] = []
	for v in _vanished_nodes:
		vanished_snap.append(String(v))
	return {
		"schema": "mainline_quest.v1",
		"active_dynasty": String(get_active_dynasty()),
		"active_chapter": String(_active_chapter_id()),
		"chapter_progress": _chapter_progress,
		"node_lifecycle_ledger": ledger_snap,
		"vanished_nodes": vanished_snap,
	}

## 从存档态恢复 C2 运行时态。调用方（SaveManager）负责原子读档 + 一致性校验编排。
func deserialize(data: Dictionary) -> void:
	_ledger.clear()
	_vanished_nodes.clear()
	var ledger_snap: Dictionary = data.get("node_lifecycle_ledger", {})
	for key in ledger_snap:
		var nid := StringName(key)
		var rec: Dictionary = ledger_snap[key]
		_ledger[nid] = {
			"state": int(rec.get("state", LifecycleState.UNACTIVATED)),
			"dispatched_at": int(rec.get("dispatched_at", 0)),
			"resolved_at": int(rec.get("resolved_at", 0)),
		}
	_chapter_progress = float(data.get("chapter_progress", 0.0))
	_chapter_entered = true
	for v in data.get("vanished_nodes", []):
		var vn := StringName(v)
		if not _vanished_nodes.has(vn):
			_vanished_nodes.append(vn)
	# 读档后重算追踪节点（若有 可改写/执行中 节点）
	_current_tracked_node = &""
	for nid in _ledger:
		var st: int = int(_ledger[nid]["state"])
		if st == LifecycleState.REWRITABLE or st == LifecycleState.EXECUTING:
			_current_tracked_node = nid
			break
	# P5-5 联合确认已落地（issue #17）：C2 已确认集 == C1 resolved_nodes 一致性校验。
	# C1(RewriteCausalityEngine) 已暴露 get_resolved_node_ids() + static check_save_consistency(rewrite_snap, quest_snap)。
	# 一致性校验由 SaveManager(X4) 在读档编排时调用：读 C1/C2 快照 → check_save_consistency →
	# 不一致即拒读档报错（control-manifest 存档节 / architecture §9.2 / mainline §3.3）。
	# SaveManager 仍为占位（autoload 已注册）；本类不直接调 C1（守 DAG：跨系统经 EventBus/存档编排，非直接引用）。
	_resync_ui_after_load()


## 读档后向 UI 重发当前展示态（信号驱动；防 UI 展示态与 C2 态失同步）。
func _resync_ui_after_load() -> void:
	if _current_tracked_node != &"":
		var d: QuestNodeDispatchData = get_dispatch_data(_current_tracked_node)
		if d != null:
			EventBus.quest_objective_updated.emit(_current_tracked_node, d.objective_short, d.objective_long)
	EventBus.quest_progress_updated.emit(_active_chapter_id(), _chapter_progress)


# ───────────────────────── 测试/调试辅助（A7 可测试；不绕过 DAG，仅注入测试态） ─────────────────────────

## 注册测试节点（不入 mvp_subset 的 node_id）：建账本 + 缓存 dispatch 数据 + 登记 existence 链。
## 供 can_dispatch 各分支 / existence 决策测试，无需真实 .tres（镜像 combat_system.debug_grant_ability 范式）。
func debug_register_node(node_id: StringName, dispatch_data: QuestNodeDispatchData = null) -> void:
	_ensure_ledger(node_id)
	var d: QuestNodeDispatchData = dispatch_data
	if d == null:
		d = QuestNodeDispatchData.new()
		d.node_id = node_id
		d.t_dispatch = QuestNodeDispatchData.TDispatch.ON_CHAPTER_ENTER
	_dispatch_cache[node_id] = d
	if d.existence_dep_ref != &"":
		_existence_link_to_node[d.existence_dep_ref] = node_id

## 测试辅助：直接置 existence 条件结果（模拟 S1 已判定），驱动 can_dispatch existence 分支。
func debug_set_existence_condition(node_id: StringName, met: bool) -> void:
	_existence_condition_met[node_id] = met

## 测试辅助：重置运行时态（账本/消失集/进度/追踪），保留章节数据与缓存。
func debug_reset_runtime() -> void:
	_ledger.clear()
	_vanished_nodes.clear()
	_existence_condition_met.clear()
	_chapter_progress = 0.0
	_current_tracked_node = &""
