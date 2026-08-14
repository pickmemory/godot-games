class_name ChapterNodeEntryData
extends Resource
## ChapterNodeEntryData · 章节内节点条目（数据驱动 · S2 · mainline-quest §3.1 ordered_nodes[] 子资源）。
##
## 落 data/quests/chapters/<chapter_id>.tres 的 ordered_nodes[]：节点 id + 其章节进度权重 w_node（§4.3）。
## 被 QuestSystem._recompute_chapter_progress / validate_chapter / UI 读。
## 参考：architecture §6.2；adr-002。

## 节点 id（引用 data/nodes/<node_id>.tres / data/quests/nodes/<node_id>.tres）。
@export var node_id: StringName = &""

## 章节进度权重 w_node（§4.3 P_ch = Σ_{已确认} w_node，章节内归一化）。
@export var weight: float = 0.0
