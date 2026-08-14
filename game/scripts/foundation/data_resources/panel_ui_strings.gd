class_name PanelUiStrings
extends Resource
## PanelUiStrings · 面板静态文案（数据驱动 · S3 面板/成长 · panel-progression §3.5 / architecture §6.2）。
##
## 落 data/panel/ui_strings.tres。系统「冷峻记录员」语气倾向（game-concept §9① 待审批）；改语气只改本
## 资源，不改面板逻辑。被 system_panel.gd（SystemPanelController）只读。
## 参考：adr-002；panel-progression §3.5。

## 朝代命名空间（dyn_threekingdoms_chibi；art-bible §9.1）。
@export var dynasty: StringName = &"dyn_threekingdoms_chibi"

## 面板标题 / CP 余额标签 / CP 单位 / CP 数值滚动动画时长（秒）。
@export var panel_title: String = ""
@export var cp_balance_label: String = ""
@export var cp_unit: String = ""
@export var cp_anim_duration: float = 0.3

## 五个 Tab 名（偏差 / 技能树 / 兑换 / 情报 / 任务）。
@export var tab_deviation: String = ""
@export var tab_skill_tree: String = ""
@export var tab_exchange: String = ""
@export var tab_intel: String = ""
@export var tab_quest: String = ""

## 偏差区标签 + 空值占位 + 偏差标签 + 预览/已结算后缀。
@export var deviation_node_label: String = ""
@export var deviation_node_none: String = ""
@export var deviation_label: String = ""
@export var deviation_preview_suffix: String = ""
@export var deviation_settled_suffix: String = ""

## 章节区标签 + 空值占位 + 进度标签。
@export var chapter_label: String = ""
@export var chapter_none: String = ""
@export var progress_label: String = ""

## 任务区标签 + 空值占位 + 暂无目标占位。
@export var quest_node_label: String = ""
@export var quest_node_none: String = ""
@export var quest_objective_none: String = ""

## 占位提示文案（待实现 Tab / TODO(p-followup)）。
@export var todo_placeholder: String = ""

## 系统语气标记（cold_recordist = 冷峻记录员；game-concept §9①）。
@export var system_tone: StringName = &"cold_recordist"
