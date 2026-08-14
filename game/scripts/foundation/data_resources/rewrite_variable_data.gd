class_name RewriteVariableData
extends Resource
## RewriteVariableData · 关键变量 v_i（数据驱动 · S1 唯一所有者 · rewrite-causality §3.1）。
##
## 落 data/variables/<var_id>.tres。决定改写节点走向的离散/数值状态量；含 baseline + 偏离度模型。
## 字段契约对齐 rewrite-causality §3.1 / §4.1；architecture §6.2；adr-002 §决定1。
##
## 被 RewriteCausalityEngine（C1）读：_deviation_for_var / _compute_intent_match_for_node；
## 被 UI（rewrite_panel.gd）读 entries（枚举显示名查表）。
## enum VarType 被 C1 用 `RewriteVariableData.VarType.NUMERIC` 引用（match 分派偏离度算法）。

## 变量类型（rewrite-causality §3.1 `type: enum | ordered | numeric`）。
enum VarType {
	ENUM = 0,     # 离散枚举（查 entries 表得 d_i）
	ORDERED = 1,  # 有序（同枚举查表，M 用数值距离）
	NUMERIC = 2,  # 数值（d_i = |actual−baseline|/range）
}

## 变量 id（snake_case；与 node/蓝图/动词 effect_sets 的 var_id 引用一致）。
@export var var_id: StringName = &""

## 变量显示名（UI 用，如「风向」「七星坛状态」）。
@export var display_name: String = ""

## 朝代命名空间（dyn_threekingdoms_chibi；多朝代热切换 key，rewrite-causality §3.7）。
@export var dynasty: StringName = &""

## 变量类型（见 VarType 枚举；int 以兼容 .tres 整数加载，C1 据 VarType.NUMERIC 分派）。
@export var type: int = VarType.ENUM

## 枚举/有序取值条目（ENUM/ORDERED 用；NUMERIC 可留空）。
@export var entries: Array[RewriteEnumValueData] = []

## 数值范围/步长（NUMERIC 用；ENUM 时为信息性占位）。
@export var value_min: float = 0.0
@export var value_max: float = 1.0
@export var value_step: float = 1.0

## 数值型 baseline（NUMERIC 的 d_i 基准，§4.1）。
@export var baseline_numeric: float = 0.0

## baseline 取值（ENUM/ORDERED：取值键；恒为 d=0 的史实基准，§4.1）。
@export var baseline: StringName = &""


## 取某值的偏离度 d_i ∈ [0,1]（镜像 C1._deviation_for_var；供测试/校验直接调）。
## ENUM/ORDERED 查 entries 表（未命中回 1.0 = 数据错误守门，§5.5）；NUMERIC 用距离公式。
func get_deviation_for(value: String) -> float:
	match type:
		VarType.NUMERIC:
			var rng := value_max - value_min
			if is_zero_approx(rng):
				return 0.0
			return clampf(absf(float(value) - baseline_numeric) / rng, 0.0, 1.0)
		_:
			for e in entries:
				if e != null and String(e.key) == value:
					return clampf(e.deviation, 0.0, 1.0)
			return 1.0
