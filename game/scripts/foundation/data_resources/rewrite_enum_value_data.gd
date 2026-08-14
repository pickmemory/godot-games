class_name RewriteEnumValueData
extends Resource
## RewriteEnumValueData · 关键变量取值条目（数据驱动 · S1 唯一所有者 · rewrite-causality §3.1）。
##
## 落 data/variables/*.tres 的 RewriteVariableData.entries[] 子资源。每条 = 一个枚举取值 + 其偏离度 d_i。
## 字段契约严格对齐 rewrite-causality §3.1「deviation_table」（每取值手调 d_i，baseline 恒 0）。
##
## 被 RewriteCausalityEngine.compute_var_deviation_enum / RewriteVariableData.get_deviation_for 读。
## 参考：architecture §6.2；adr-002 §决定1（自定义 Resource）。

## 枚举取值键（snake_case，与变量取值空间一致，如 "southeast" / "dead" / "smashed"）。
@export var key: StringName = &""

## 取值显示名（UI 用，如「东南风」「被截杀」）。
@export var display: String = ""

## 偏离度 d_i ∈ [0,1]（baseline 取值恒为 0.0；见 rewrite-causality §4.1）。
@export var deviation: float = 0.0

## 给 S5 的只读视觉契约 token（art-bible §9.5 视觉映射；视觉化所有权在 S5，systems-index §6）。
@export var world_visual_token: StringName = &""
