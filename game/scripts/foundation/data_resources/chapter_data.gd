class_name ChapterData
extends Resource
## ChapterData · 章节表（数据驱动 · S2 章节编排 · mainline-quest §3.1 / architecture §6.2）。
##
## 落 data/quests/chapters/<chapter_id>.tres。S2（QuestSystem）的唯一章节数据：节点顺序 + 权重归一化 +
## MVP 子集。被 QuestSystem._ready（validate_chapter + enter_chapter）/ _recompute_chapter_progress 读。
## 参考：adr-002。

## 章节 id（snake_case；赤壁 = ch_chibi_war）。
@export var chapter_id: StringName = &""

## 朝代命名空间（dyn_threekingdoms_chibi；art-bible §9.1）。
@export var dynasty: StringName = &""

## 章节显示标题（UI 用，如「赤壁之战」）。
@export var display_title: String = ""

## 章节全部节点（有序；权重 w_node 章节内 Σ=1.0，§4.3 归一化）。
@export var ordered_nodes: Array[ChapterNodeEntryData] = []

## MVP 激活子集（game-concept §7.1；非空则只激活这些节点，空则用 ordered_nodes 全集）。
@export var mvp_subset: Array[StringName] = []

## 替代节点 id 集（目标态：存在性不满足时 S2 派替代，game-concept §9④；MVP 不激活）。
@export var alternative_nodes: Array[StringName] = []

## 章末收敛节点 id（目标态预留，game-concept §9④ / mainline §5.4；MVP 不激活）。
@export var convergence: StringName = &""


## 章节内 Σw_node（§4.3 归一化校验；boot validate_chapter / QA 用）。返回类型显式标注（修 quest_system:369 类型推断）。
func sum_weights() -> float:
	var s: float = 0.0
	for entry in ordered_nodes:
		if entry != null:
			s += entry.weight
	return s
