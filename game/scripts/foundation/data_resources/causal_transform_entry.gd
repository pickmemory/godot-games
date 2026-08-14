class_name CausalTransformEntry
extends Resource
## CausalTransformEntry · 因果链值映射条目（数据驱动 · S1 · rewrite-causality §3.4 transform 子资源）。
##
## 落 data/causal_links/*.tres 的 link.transform_entries[]：上游 v_i 取值 → 下游输入/字段值的映射。
## 被 CausalLinkData.transform_value 查表（命中 from_value → 返回 to_value，未命中回 transform_fallback）。
## 参考：architecture §6.2；adr-002。

## 上游取值（匹配上游 var 的取值键，如 "southeast"）。
@export var from_value: String = ""

## 映射到的下游值（下游 input/field 取值，如 "high" / 数值字符串）。
@export var to_value: String = ""
