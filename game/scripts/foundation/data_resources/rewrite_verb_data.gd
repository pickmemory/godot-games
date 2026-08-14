class_name RewriteVerbData
extends Resource
## RewriteVerbData · 改写动词（数据驱动 · S1 · rewrite-causality §3.5 / §1.2）。
##
## 落 data/verbs/<verb_id>.tres。动词 = 玩家介入手段（杀/救/破坏/系统侧借风等）；物理执行归 S4/S5，
## 成功后发 verb_executed → C1 据本表 effect_sets 改 v_i（§5.3 DAG 硬契约）。
## 被 RewriteCausalityEngine._on_verb_executed / can_execute_verb / UI（rewrite_panel.gd）读。
## 参考：architecture §6.2；adr-002。

## 动词 id（snake_case；被 RewriteNodeData.verb_ids 引用）。
@export var verb_id: StringName = &""

## 朝代命名空间（dyn_threekingdoms_chibi；热切换 key）。
@export var dynasty: StringName = &""

## 动词显示名（UI 用，如「破坏七星坛」「截杀诸葛亮」）。
@export var display_name: String = ""

## 基础 RE 消耗 cost_base（点；§4.3 cost_RE = cost_base · diff · (1−intel_cov) · (1−disc)）。
@export var cost_base: int = 0

## 作用集合（var_id → 取值；成功后由 C1 应用改 v_i）。
@export var effect_sets: Array[VerbEffectSet] = []

## 动词 flag（如 system_side 系统侧介入 / triggers_self_replacement_voice）。
@export var effect_flags: PackedStringArray = PackedStringArray()

## 物理执行前置：所需能力 id（空 = 无；由 S4/S5 校验 requires.ability，combat §2.6）。
@export var requires_ability: StringName = &""

## 物理执行前置：所需场所 id（空 = 无；由 S5 校验 requires.scene）。
@export var requires_scene: StringName = &""


## 聚合 effect_sets 为 {var_id: value}（供 C1._on_verb_executed 批量应用改 v_i，§5.3 DAG）。
func get_effect_map() -> Dictionary:
	var m: Dictionary = {}
	for es in effect_sets:
		if es != null:
			m[es.var_id] = es.value
	return m
