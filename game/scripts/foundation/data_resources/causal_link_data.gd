class_name CausalLinkData
extends Resource
## CausalLinkData · 单条因果链（数据驱动 · S1 · rewrite-causality §3.4 / §2.5）。
##
## 落 data/causal_links/*.tres 的 links[] 子资源。定义「上游节点某 var/input → 下游 input/field/存在性」
## 的传递关系。三种类型（§2.5）：value（值传递）/ existence（存在性，最重）/ difficulty（难度调制）。
##
## DAG 硬契约（rewrite-causality §7.1 两段式）：**规则与数据归 S1（本表）**，C1 评估 existence condition
## 发 canonical token；**派发/消失决策归 S2**（C2 据 token 决定下游节点）。
##
## 被 RewriteCausalityEngine._resolve_causal_chain 读（按 type 分派：value/difficulty 产出下游输入，
## existence 评估 condition）。参考：architecture §6.2；adr-002。

## 链类型（rewrite-causality §3.4 `type: value | existence | difficulty`）。
enum LinkType {
	VALUE = 0,       # 值传递：上游 var 解析值 → 下游 input
	EXISTENCE = 1,   # 存在性：上游结果决定下游节点是否存在（最重）
	DIFFICULTY = 2,  # 难度调制：上游结果改下游 diff_base/字段
}

## 链 id（snake_case；被 RewriteNodeData.causal_out_link_ids / existence_dep_link_id 引用）。
@export var link_id: StringName = &""

## 朝代命名空间（dyn_threekingdoms_chibi；热切换 key）。
@export var dynasty: StringName = &""

## 链类型（见 LinkType 枚举；int 以兼容 .tres 整数加载）。
@export var type: int = LinkType.VALUE

## 源节点 id（value/difficulty 拉取 var；existence 拉取 input）。
@export var source_node: StringName = &""

## 源变量 id（value/difficulty：取该 var 的解析值；existence 通常空，改用 source_input）。
@export var source_var: StringName = &""

## 源输入名（existence 链可依赖上游链产出的「输入变量」而非原始 var，§3.4；空 = 不用）。
@export var source_input: StringName = &""

## 目标节点 id（下游）。
@export var target_node: StringName = &""

## 目标输入名（value：作为下游 input；existence 通常空）。
@export var target_input: StringName = &""

## 目标字段名（difficulty：改下游哪个字段，如 diff_base；value/existence 通常空）。
@export var target_field: StringName = &""

## 值映射表（value/difficulty 用；from_value → to_value）。
@export var transform_entries: Array[CausalTransformEntry] = []

## 未命中 transform_entries 的回退值（value/difficulty；空字符串 = 无回退）。
@export var transform_fallback: String = ""

## existence 条件表达式（仅 EXISTENCE 用；语法 "<name>==<value>"，如 "fire_power==high"）。
## 评估归 S1（§7.1），name 先查本批 resolved inputs 再查 final_vars。
@export var condition: String = ""

## existence 不满足时 S2 的动作 token（如 spawn_alternative；目标态，C2 读后派替代节点）。
@export var on_false: StringName = &""


## 值映射（查 transform_entries，未命中回 transform_fallback）。供 C1._resolve_causal_chain 调。
func transform_value(upstream_value: String) -> String:
	for e in transform_entries:
		if e != null and e.from_value == upstream_value:
			return e.to_value
	return transform_fallback
