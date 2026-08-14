class_name QuestNodeDispatchData
extends Resource
## QuestNodeDispatchData · 节点派发表（生命周期/派发/文案）（数据驱动 · S2 · mainline-quest §3.2）。
##
## 落 data/quests/nodes/<node_id>.tres。本资源只存 S2 拥有的生命周期/派发/文案字段；**不含** S1 内部
## 数值态（vars/blueprints/verbs/delta_critical 等，那些在 RewriteNodeData）。两段式（mainline §3.4）。
##
## 被 QuestSystem.can_dispatch / _dispatch_node / _t_dispatch_satisfied / get_objective_* 读。
## enum TDispatch 被 QuestSystem 用 `QuestNodeDispatchData.TDispatch.ON_CHAPTER_ENTER` 引用（match 派发时机）。
## 参考：architecture §6.2；adr-002。

## 派发时机（mainline §3.2 `t_dispatch`）。
enum TDispatch {
	ON_CHAPTER_ENTER = 0,         # 章节进入即派发（MVP 的 N2 即此）
	ON_PREDECESSOR_RESOLVED = 1,  # 前序节点全确认后派发
	ON_PLAYER_REACH = 2,          # 玩家到达目标场所后派发（需 S5 player_at_scene 信号，MVP 未接）
}

## 节点 id（与 RewriteNodeData.node_id 按 node_id 关联）。
@export var node_id: StringName = &""

## 朝代命名空间（dyn_threekingdoms_chibi；热切换 key）。
@export var dynasty: StringName = &""

## 所属章节 id（引用 data/quests/chapters/<chapter_id>.tres）。
@export var chapter_id: StringName = &""

## 派发时机（见 TDispatch 枚举；int 以兼容 .tres 整数加载）。
@export var t_dispatch: int = TDispatch.ON_CHAPTER_ENTER

## 前序节点 id 集（全部 已确认 才满足派发；§4.2；MVP 多为空）。
@export var prereq_nodes: Array[StringName] = []

## 存在性依赖 link id（引用 CausalLinkData；空 = 无存在性依赖；§4.2 existence gate）。
@export var existence_dep_ref: StringName = &""

## 目标场所 id（S5 据此布置冷光环/触发器；§6.2；空 = 无特定场所）。
@export var target_scene: StringName = &""

## §4.1 CP 加成参数：quest_reward_mult（S2 声明，应用归 S3 账户）。
@export var quest_reward_mult: float = 1.0

## §4.1 CP 加成参数：quest_cp_flat_bonus（点；S2 声明，应用归 S3）。
@export var quest_cp_flat_bonus: int = 0

## 任务目标短文案（HUD/任务 Tab 用，mainline §6.2）。
@export var objective_short: String = ""

## 任务目标长文案（任务详情用，mainline §6.2）。
@export var objective_long: String = ""

## 派单旁白文案（X1 冷光记录员，mainline §6.3）。
@export var system_dispatch_voice: String = ""

## 完成旁白文案（节点确认后，mainline §6.3）。
@export var system_complete_voice: String = ""

## 消失旁白文案（存在性不满足时，mainline §6.3）。
@export var system_vanish_voice: String = ""

## 因果预览提示（UI 用，如「借东风成败 → 决定华容道是否出现」）。
@export var causal_preview_hint: String = ""
