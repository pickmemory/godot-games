extends Node
## （注：Autoload 脚本不加 class_name —— Godot 4.7 将 class_name 与同名 Autoload 冲突定为硬解析错误
## 「Class X hides an autoload singleton」，见 docs/engine-reference/godot/4.7.md K10。
## 单例以注册名 EventBus 作为全局句柄，class_name 冗余。）

## EventBus · 跨系统信号中枢（基础层 F5）。
## 参考：architecture §7 / §8.1；adr-004 §决定1。
##
## P3-2（本 issue）只建骨架 + Autoload 注册名占位：
##   - 不持有任何游戏态（纯路由，adr-004「单例不滥用」）。
##   - S1~S5 的跨系统 typed signals 严格按 architecture §7.2 总表登记，
##     留待对应核心层（C1~C5）issue 实现；本占位不预定义信号，避免私加跨系统信号。
##
## 设计纪律（adr-004 §5 / control-manifest 信号节）：
##   - 生产方 EventBus.xxx.emit(...)；消费方自愿 EventBus.xxx.connect(callable)。
##   - P5 不得私加跨系统信号（需 ADR/issue 评审）。
##   - 场景内高频信号走节点原生 signal / 节点分组，不塞总线。

# ── 已登记的 §7.2 跨系统信号（按总表实现，非私加；control-manifest：新增跨系统信号须 ADR/issue 评审）──

## C4→C5：遭遇清场（architecture §7.2 C4 发出表 / open-world §2.6）。
## 由战斗侧（C4/G5 EncounterSpawner）判定全灭或玩家脱战后发出；C5 据此更新遭遇 spawn_state。
## 载荷：encounter_id（遭遇表 id，StringName）。
signal encounter_cleared(encounter_id: StringName)

## C4→C1：战斗击杀/破坏改写目标，或 rewrite_proxy 术法释放（combat §6.1 / §2.9 / rewrite-causality §6.2）。
## **DAG 硬契约**：C4 只发事件，绝不直写 v_i/Δ（由 C1 据 verbs[].effect 自算，combat §5.3）。
## 载荷：verb_id（改写动词）、target（目标 enemy_id 或 requires_scene）、success（成败）。
signal verb_executed(verb_id: StringName, target: StringName, success: bool)

## C4→C1：警戒档位跨档（combat §6.1 / §2.7 / §4.5）。
## C4 拥有 alert 态机与 alert_mult；C1 是否应用、如何应用 [待与 S1 联合确认]（combat §7.7①）。
## 载荷：node_id（当前改写节点；MVP 暂可为空 StringName）、alert_level（0..3）、alert_mult（乘子）。
signal alert_state_changed(node_id: StringName, alert_level: int, alert_mult: float)

## C4→C3：玩家战斗状态只读显示（combat §6.2 / panel-progression §6.5 核心 HUD）。
## 状态机归 C4，只读显示归 C3（systems-index §6 玩家战斗状态行）。HP/BF 非持久态（combat §3.5）。
signal hp_changed(new_hp: int, max_hp: int)
signal bf_changed(new_bf: int, max_bf: int)

## C3→C4：能力解锁（combat §6.3 / panel-progression §6.3）。
## S3 解锁 → C4 加入已解锁集；玩家释放术法时 C4 查此集做 requires.ability 校验（combat §2.6）。
## 载荷：ability_id（join 键，snake_case）。
signal ability_unlocked(ability_id: StringName)

# ── 以下为 issue #15（P5-3 系统面板）消费侧登记的 §7.2 契约信号（按总表实现，非私加）。
# 信号名/载荷逐条对齐 panel-progression §6.1/§6.2 + rewrite-causality §6.1 + mainline-quest §6.2，
# 零新增、零改名（control-manifest 信号节 / adr-004）。
# **emit 侧归 C1(S1)/C2(S2)/C3(PanelProgression)，待 P5-4/P5-5 核心层落地**；
# 本 issue 仅 connect 做只读显示，不臆造 S1/S2 实现（知识诚实红线）。

## C1(S1)→C3(S3)/HUD：节点偏差重算（rewrite-causality §6.1 / panel-progression §6.1）。
## 载荷：node_id（改写节点）、delta_node（历史偏差分 ∈ [0,100]）、
##       is_preview（true=改写预览实时跳，ux-spec §6.3 Δ 预览；false=节点结算，§2.5/§9.2）。
signal deviation_recomputed(node_id: StringName, delta_node: int, is_preview: bool)

## C3(S3)→HUD：CP 账户余额变更（panel-progression §6.4）。
## 载荷：new_balance（账户余额，点，C3 唯一持有）、delta（本次变动量，点；入账为正/消耗为负）。
## **余额权威属 C3（PanelProgression 账户所有者，§3.3/§4.1），待 P5-4/P5-5 落地**；UI 只读显示。
signal cp_balance_changed(new_balance: int, delta: int)

## C2(S2)→C3(S3)：当前改写节点目标文案更新（mainline-quest §6.2 / panel-progression §6.2）。
## 载荷：node_id、objective_short（HUD/面板短目标，核心层）、objective_long（面板长目标，进阶层）。
signal quest_objective_updated(node_id: StringName, objective_short: String, objective_long: String)

## C2(S2)→C3(S3)：章节进度更新（mainline-quest §6.2 / panel-progression §6.2）。
## 载荷：chapter_id、p_ch（章节进度 ∈ [0,1]，systems-index 章节推进 P_ch）。
signal quest_progress_updated(chapter_id: StringName, p_ch: float)

# TODO(p-followup): 其余 §7.2 跨系统信号（cp_awarded/intent_match_computed/feedback_tier/
# critical_deviation_triggered/blueprint_declared/quest_reward_declared/quest_node_vanished_voiced/
# node_resolved/node_vanished/causal_link_propagated/...）随对应核心层（C1~C3/C5）issue 落地登记。
