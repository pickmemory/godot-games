class_name RewriteNodeFlowData
extends Resource
## RewriteNodeFlowData · 改写节点场景编排配置（数据驱动 · issue #19 · RewriteNodeDirector 读取）。
##
## 落 data/scenes/rewrite_node_chibi/<flow_id>.tres。串联某改写节点的端到端 Loop A 编排参数：
## 线索采集点集 + 任务门 + 术士授术 + 七星坛交互 + 各阶段目标文案。
##
## ⚠️ 引用不重定义：node_id/chapter_id/verb_id/ability_id 仅引用 S1/S2/S4 既有数据，本资源不含
## vars/blueprints 等内部数值态。被 RewriteNodeDirector（rewrite_node_chibi 场景）读。
## 参考：architecture §6.2；adr-002。

## 编排 id（snake_case；赤壁 = east_wind）。
@export var flow_id: StringName = &""

## 朝代命名空间（dyn_threekingdoms_chibi；热切换 key）。
@export var dynasty: StringName = &""

## 关联改写节点 id（引用 data/nodes/<node_id>.tres / data/quests/nodes/<node_id>.tres）。
@export var node_id: StringName = &""

## 关联章节 id（引用 data/quests/chapters/<chapter_id>.tres）。
@export var chapter_id: StringName = &""

## 线索采集点集（引用 data/intel/*.tres 的 IntelPOIData）。
@export var clue_pois: Array[IntelPOIData] = []

## 术士允许触发改写所需的线索条数（任务门，issue §2.3）。
@export var required_clue_count: int = 0

## 线索达标后术士授予的能力 id（引用 data/skills/<ability_id>.tres；rewrite_proxy）。
@export var granted_ability_id: StringName = &""

## 七星坛交互动词 id（引用 data/verbs/<verb_id>.tres；S5 交互 → verb_executed）。
@export var altar_verb_id: StringName = &""

## 七星坛场所 id（verb_executed 的 target 场所语义）。
@export var altar_scene_id: StringName = &""

## 玩家出生坐标（S5 初始化玩家位置）。
@export var player_start_position: Vector2 = Vector2.ZERO

## 术士坐标 + 交互半径（px）。
@export var shaman_position: Vector2 = Vector2.ZERO
@export var shaman_interact_radius_px: float = 96.0

## 七星坛坐标 + 交互半径（px）。
@export var altar_position: Vector2 = Vector2.ZERO
@export var altar_interact_radius_px: float = 96.0

## 各阶段任务目标文案（S5 → S3 UI 显示）。
@export var objective_explore: String = ""
@export var objective_rewrite: String = ""
@export var objective_complete: String = ""

## 线索不足提示（{n} = 所需条数，.format 注入）。
@export var hint_clues_needed: String = ""
