class_name VerbEffectSet
extends Resource
## VerbEffectSet · 改写动词作用条目（数据驱动 · S1 · rewrite-causality §3.5 effect.set 子资源）。
##
## 落 data/verbs/<verb_id>.tres 的 effect_sets[]：动词执行成功后，把某 var_id 设为指定取值（§5.3 DAG：
## S1 据本表改 v_i，S4/S5 不直写）。被 RewriteVerbData.get_effect_map 读（聚合成 {var_id: value}）。
## 参考：architecture §6.2；adr-002。

## 作用的目标变量 id（指向 data/variables/<var_id>.tres）。
@export var var_id: StringName = &""

## 动词执行成功后赋给该变量的取值（ENUM: 取值键字符串；NUMERIC: 数值字符串）。
@export var value: String = ""
