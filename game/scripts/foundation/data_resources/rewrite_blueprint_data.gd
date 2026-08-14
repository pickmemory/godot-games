class_name RewriteBlueprintData
extends Resource
## RewriteBlueprintData · 改写蓝图（意图声明）（数据驱动 · S1 · rewrite-causality §2.4/§3.3）。
##
## 落 data/blueprints/<bp_id>.tres（或嵌节点）。一条 = 一组 target_vars + 意图标签；玩家选蓝图 =
## 显式声明意图（§2.4）。被 RewriteCausalityEngine.select_blueprint / _compute_intent_match_for_node /
## UI（rewrite_panel.gd）读。参考：architecture §6.2；adr-002。

## 蓝图 id（snake_case；被 RewriteNodeData.blueprint_ids 引用）。
@export var blueprint_id: StringName = &""

## 朝代命名空间（dyn_threekingdoms_chibi；热切换 key）。
@export var dynasty: StringName = &""

## 系统风格意图标签（冷光旁白/UI 用，如「由你之手，借这阵东风」）。
@export var intent_label: String = ""

## 蓝图目标变量集合（var_id → target_value + 蓝图内权重 m_weight；§3.3 target_vars）。
@export var vars: Array[BlueprintVarEntry] = []

## 解锁所需情报覆盖率 intel_cov ∈ [0,1]（§2.4 探索→改写回路门控；0 = 始终可见）。
@export var unlock_intel_cov: float = 0.0

## 满足时触发的系统特殊旁白/演出 flag（如 triggers_self_replacement_voice）。
@export var special_flags: PackedStringArray = PackedStringArray()
