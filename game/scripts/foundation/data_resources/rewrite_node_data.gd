class_name RewriteNodeData
extends Resource
## RewriteNodeData · 改写节点（数值模型）（数据驱动 · S1 唯一所有者 · rewrite-causality §3.2）。
##
## 落 data/nodes/<node_id>.tres。本资源只存 S1 拥有的内部数值态字段（vars/blueprints/verbs/
## causal_out/平衡参数）。S2 派发/生命周期/文案在 QuestNodeDispatchData（mainline §3.2 两段式）。
## 字段契约对齐 rewrite-causality §3.2 / §4.1；architecture §6.2；adr-002。
##
## 被 RewriteCausalityEngine（C1）读：_on_node_activated / _on_verb_executed / _settle_node /
## _compute_delta_for_node；被 UI（rewrite_panel.gd）读 blueprints/verbs/vars/max_attempts/re_max。

## 节点 id（snake_case；与 data/quests/nodes/<node_id>.tres 的 QuestNodeDispatchData 按 node_id 关联）。
@export var node_id: StringName = &""

## 朝代命名空间（dyn_threekingdoms_chibi；热切换 key，§3.7）。
@export var dynasty: StringName = &""

## 节点显示标题（UI 用，如「借东风」）。
@export var display_title: String = ""

## 节点关键变量集合（引用 var_id + Δ 权重 w_i；节点内 Σw_i = 1.0）。
@export var vars: Array[NodeVarEntryData] = []

## 可用改写蓝图 id 集（引用 data/blueprints/<bp_id>.tres；§3.3 意图声明可选项）。
@export var blueprint_ids: Array[StringName] = []

## 可用改写动词 id 集（引用 data/verbs/<verb_id>.tres；§3.5 物理执行映射）。
@export var verb_ids: Array[StringName] = []

## 对下游因果链出口 id 集（引用 data/causal_links/*.tres 的 link；§3.4）。
@export var causal_out_link_ids: Array[StringName] = []

## 本节点存在性依赖 link id（空 = 链首/无存在性依赖；§3.4 existence 型）。
@export var existence_dep_link_id: StringName = &""

## 重大偏差阈值 Δ_critical（分；超则世界线震荡，§4.4/§4.5；全局默认 80）。
@export var delta_critical: float = 80.0

## 节点因果点上限 CP_node（点；§4.2）。
@export var cp_node: int = 0

## 节点基础难度 diff_base ∈ [0.5, 2.0]（§4.3）。
@export var diff_base: float = 1.0

## 改写单元上限 max_attempts（防刷分，§5.1）。
@export var max_attempts: int = 3

## 改写能量上限 RE_max（点；§4.3）。
@export var re_max: int = 100

## 系统派单开场语气文案（X1 旁白用，game-concept §9① 待审批）。
@export var system_intro: String = ""


## 节点内 Σw_i（§4.1 归一化校验；validate/QA 用）。
func sum_weights() -> float:
	var s: float = 0.0
	for ve in vars:
		if ve != null:
			s += ve.weight
	return s
