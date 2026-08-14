class_name BlueprintVarEntry
extends Resource
## BlueprintVarEntry · 蓝图内变量目标条目（数据驱动 · S1 · rewrite-causality §3.3 target_vars[] 子资源）。
##
## 落 data/blueprints/<bp_id>.tres 的 vars[]：声明蓝图对某 var_id 的目标取值 + 蓝图内权重 w'_i（算 M）。
## 被 RewriteCausalityEngine._compute_intent_match_for_node / UI（rewrite_panel.gd._format_target_vars）读。
## 参考：architecture §6.2；adr-002。

## 引用的变量 id（指向 data/variables/<var_id>.tres）。
@export var var_id: StringName = &""

## 该蓝图对此变量的目标取值（ENUM: 取值键字符串；NUMERIC: 数值字符串）。
@export var target_value: String = ""

## 蓝图内变量权重 w'_i ∈ [0,1]（蓝图内 Σw'_i = 1.0，§4.2 算 M 用）。
@export var m_weight: float = 0.0
