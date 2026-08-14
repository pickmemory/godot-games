class_name NodeVarEntryData
extends Resource
## NodeVarEntryData · 节点内变量条目（数据驱动 · S1 · rewrite-causality §3.2 vars[] 子资源）。
##
## 落 data/nodes/<node_id>.tres 的 vars[]：引用某 var_id + 该变量在 Δ 计算中的权重 w_i（§4.1）。
## 被 RewriteNodeData.sum_weights / RewriteCausalityEngine._compute_delta_for_node 读。
## 参考：architecture §6.2；adr-002。

## 引用的变量 id（指向 data/variables/<var_id>.tres 的 RewriteVariableData）。
@export var var_id: StringName = &""

## 该变量在节点 Δ 计算中的权重 w_i ∈ [0,1]，节点内 Σw_i = 1.0（§4.1 归一化）。
@export var weight: float = 0.0
