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

# ── 以下为 issue #16（P5-4 主线任务系统 S2/C2）登记的 §7.2 契约信号（按总表实现，非私加；
# control-manifest 信号节：新增跨系统信号须 ADR/issue 评审，本 issue 即评审载体）。
# 信号名/载荷逐条对齐 mainline-quest §6.1/§6.2 + rewrite-causality §7.1 + architecture §7.2，
# 零新增、零改名（adr-004 / issue #16 验收要点 7）。
# **C2(QuestSystem) 为本批信号的 S2 侧所有者**：S2→S1 信号由 C2 emit；S1→S2 信号由 C2 connect（emit 侧归 C1/S1，待 P5-5）。

## S2→S1（mainline §6.1 / rewrite-causality §7.1）：C2 派发节点时 emit；C1 收后初始化 v_i=baseline 进入可改写。
## 载荷：node_id（改写节点）。
signal node_activated(node_id: StringName)

## S2→S1（mainline §6.1 / §2.1 注）：C2 任务级强制锁定时 emit（玩家确认归 S3、耗尽 attempts 归 S1 内部）。
## 载荷：node_id。
signal node_committed(node_id: StringName)

## S1→S2（mainline §6.1 / rewrite-causality §7.1）：节点确认回告，C2 connect 置「已确认」+ 推进章节进度。
## 载荷：node_id、final_vars（最终 v_i 取值 Dictionary）、delta_node（历史偏差分 [0,100]）、cp_earned（S1 产出 CP，C2 只读引用）。
## **emit 侧归 C1/S1，待 P5-5 落地**；C2 仅 connect，测试用手动 emit 驱动（不写 S1 桩，知识诚实红线）。
signal node_resolved(node_id: StringName, final_vars: Dictionary, delta_node: int, cp_earned: int)

## S1→S2（mainline §6.1 / §2.3 两段式）：因果链传递，C2 connect；type=existence 时 C2 做「派发/消失」决策。
## 载荷：link_id（因果链 id）、source_node（源节点）、resolved_value（解析值字符串，如 "high"）、target（下游节点/输入）。
## existence 规则（condition/on_false）归 S1，C2 只读 + 决策，绝不重定义（control-manifest DAG 守护）。
## **emit 侧归 C1/S1，待 P5-5 落地**；C2 仅 connect，测试用手动 emit 驱动。
signal causal_link_propagated(link_id: StringName, source_node: StringName, resolved_value: String, target: StringName)

## S1→S2（mainline §6.1 / rewrite-causality §7.1）：存在性不满足回告，C2 connect 置「已消失」+ 更新账本。
## 载荷：node_id。**emit 侧归 C1/S1，待 P5-5 落地**；C2 仅 connect，测试用手动 emit 驱动。
signal node_vanished(node_id: StringName)

## S2→S5（mainline §6.2）：节点目标场所设置，C5 据此布置冷光环/触发器（art-bible §3.3）。
## 载荷：node_id、target_scene（场所 id，如 scene_altar）。
signal quest_target_scene_set(node_id: StringName, target_scene: StringName)

## S2→X1（mainline §6.2/§6.3）：派单旁白文案，X1 以冷光记录员演出（文案归 S2，表现归 X1，§1.2 两段式）。
## 载荷：node_id、system_dispatch_voice（文案字符串）。
signal quest_dispatch_voiced(node_id: StringName, system_dispatch_voice: String)

## S2→X1/S3/S5（mainline §6.2）：消失节点文案 + UI/场所移除通知。
## 载荷：node_id、system_vanish_voice（文案字符串）。
signal quest_node_vanished_voiced(node_id: StringName, system_vanish_voice: String)

## S2→S3（mainline §6.2，可选信号）：节点已确认后声明 CP 加成参数，供 S3 账户侧应用（§4.1 CP 两段式）。
## **选「信号」而非「查表」**（issue #16 验收要点 7 注）：control-manifest「信号驱动禁轮询」，
## C3 落地时 connect 即可，无需主动轮询 C2；C2 亦暴露 get_quest_reward_* getter 供调试/查表兜底。
## 载荷：node_id、quest_reward_mult（倍率 [1.0,2.0]）、quest_cp_flat_bonus（固定 CP 点 ≥0）。
signal quest_reward_declared(node_id: StringName, quest_reward_mult: float, quest_cp_flat_bonus: int)

# ── 以下为 issue #17（P5-5 改写/因果引擎 C1/S1）登记的 §7.2 契约信号（按总表实现，非私加；
# control-manifest 信号节：新增跨系统信号须 ADR/issue 评审，本 issue 即评审载体）。
# 信号名/载荷逐条对齐 rewrite-causality §6.1/§6.2 + architecture §7.2，零新增、零改名。
# **C1(RewriteCausalityEngine) 为本批信号的 S1 侧所有者**：S1→S2/S3/S5 信号由 C1 emit；
# S5→S1 的 intel_updated 由 C5 emit、C1 connect（emit 侧归 C5，待 C5 issue 落地）。

## S1→S3(S3)/HUD/X1：蓝图声明（rewrite-causality §6.1 / panel-progression §6.1）。
## 玩家进改写面板选蓝图 = 显式声明意图（§2.4）。载荷：node_id、blueprint_id。
signal blueprint_declared(node_id: StringName, blueprint_id: StringName)

## S1→S3/S5：关键变量改变（rewrite-causality §6.1 / open-world §6.5 world_visual 切换）。
## 载荷：var_id、old_value、new_value（枚举键字符串；NUMERIC 字符串化）、is_preview（true=改写预览，false=锁定结算）。
## **DAG 硬契约**：v_i 真值唯一所有者 C1；S4/S5 不直写 v_i，必经 verb_executed 由 C1 自改（§5.3）。
signal variable_changed(var_id: StringName, old_value: String, new_value: String, is_preview: bool)

## S1→S3(S3)：意图匹配度（rewrite-causality §6.1 / §4.2）。锁定时算 M。载荷：node_id、m（∈[0,1]）。
signal intent_match_computed(node_id: StringName, m: float)

## S1→S3（CP 账户入账，两段式）：因果点产出（rewrite-causality §6.1 / §4.2 / systems-index §6）。
## **CP 两段式**：产出归 C1（§4.2 公式），账户/兑换归 C3；C1 发完即放手，不持余额。
## 载荷：amount（本次产出 CP，点，≥0）、node_id、reason（committed/max_attempts_exhausted/...）。
signal cp_awarded(amount: int, node_id: StringName, reason: String)

## S1→S3/X1：反馈档位（rewrite-causality §6.1 / §4.4 / art-bible §2.5 Δ 视觉三档）。
## 载荷：node_id、tier（int 枚举：0=minor / 1=notable / 2=critical，见 RewriteCausalityEngine.FeedbackTier）。
## 演出资产/脚本归 S3+X1（systems-index §6 历史线两段式）；本信号只触发，不含资产引用。
signal feedback_tier(node_id: StringName, tier: int)

## S1→S3/S2：重大偏差 / 世界线震荡（rewrite-causality §6.1 / §4.5）。
## 触发：Δ_node ≥ Δ_critical 且 tier=critical。**不双倍 CP**（防「震荡=高收益」反激励），风险转嫁下游。
## 载荷：node_id、delta_node（历史偏差分 [0,100]）。
signal critical_deviation_triggered(node_id: StringName, delta_node: int)

## S5→S1：情报更新（rewrite-causality §6.2 / §7.4 / open-world §6.1）。
## C5 探索产出情报 → C1 更新 intel_cov（降 diff、门控蓝图可见性，§2.4/§4.3）。
## 载荷：intel_cov（覆盖率 ∈[0,1]）、new_intels（新情报条目 id 数组）。
## **emit 侧归 C5(S5)，待 C5 issue 落地**；C1 仅 connect，测试用手动 emit 驱动（不写 C5 桩，知识诚实红线）。
signal intel_updated(intel_cov: float, new_intels: Array)
