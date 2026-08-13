# 面板/成长系统 GDD · 《赤壁·改写者》

> 阶段：Phase 2 · 系统设计（P2-4，S3）　|　执行角色：文策渊（design-strategist）
> 文档版本：v0.1（首版，待主创评审）　|　状态：可评审
> 基线锚点：`AGENTS.md`「设计基线」表、`docs/project-charter.md`「核心循环 Loop A · 反馈→成长」、`docs/roadmap.md` P2-4。
> 设计依赖（**显式引用**，本 GDD 与之保持一致，不另立术语/信号/产出源）：
> - `docs/design/gdd/game-concept.md`（P1-1）——**术语 §1、设计支柱 §2（支柱②主）、系统动词 §3.1、核心循环 §5（反馈/成长环）、范围分层 §7、待审批 §9（③奖励曲线 / ①系统人格）**。本文凡引用写作 `game-concept §x`。
> - `docs/design/gdd/systems-index.md`（P2-1）——**S3 行 §2、依赖 DAG §3、Loop A 映射 §4（反馈行）、支柱对齐 §5（S3 行）、横切实体归属 §6（CP 两段式 / 历史线演出两段式 / 玩家能力技能）、认知过载红线 §8**。本文凡引用写作 `systems-index §x`。
> - `docs/design/gdd/systems/rewrite-causality.md`（P2-2，✅已完成）——**§0 符号（CP/Δ/disc/intel_cov/RE/M/I）、§2.7 偏差呈现（预览+反馈）、§2.8 反馈回成长面板的钩子、§4.2 CP 产出公式、§4.3 RE 消耗与再生【待审批】、§4.4 反馈档位 I、§6.1 S1→S3 信号、§6.2 S3→S1 信号、§7.2 反向耦合确认**。本文凡引用写作 `rewrite-causality §x`。
> - `docs/design/gdd/systems/mainline-quest.md`（P2-3，✅已完成）——**§4.1 任务奖励 CP 加成（`quest_reward_mult`/`quest_cp_flat_bonus`、CP_credited 公式、应用方待 S3 确认）、§6.2 S2→S3 信号（任务目标/进度/奖励/消失）、§2.1 注 node_committed 触发源**。本文凡引用写作 `mainline-quest §x`。
> - `docs/design/art/art-bible.md`（P1-2）——**§0 双轨反差、§2.5 Δ 视觉三档、§3.3 信息焦点、§6.1 系统材质、§6.2 关键界面视觉、§6.3 字体可访问性、§6.4 litRPG 面板气质纪律、§9 命名空间（`dyn_threekingdoms_chibi`）**。本文凡引用写作 `art-bible §x`。
> 本系统边界以 `systems-index §2`（S3 行）为准；术语以 `game-concept §1` 为准；与 S1/S2 的信号契约**严格对齐 `rewrite-causality §6.1/§7.1` 与 `mainline-quest §6.1/§6.2`，零新增冲突信号**。本文件是面板/成长系统的**完整八节 GDD**，是核心循环 Loop A「任务→探索→改写→**反馈→成长**」的**反馈与成长出口**（`systems-index §4` 反馈行；`charter` 核心循环第 4-5 环）。

---

## 0. 公式符号与单位约定（全篇统一）

> 为杜绝跨文档/跨公式符号漂移，本节定义本 GDD 用的符号、单位与取值域。**第 4 节所有公式均回引本表符号**，不另造。**与 S1/S2 共享的符号（`Δ_node`/`CP_earned`/`CP_credited`/`disc`/`intel_cov`/`RE`/`M`/`I` 等）沿用 `rewrite-causality §0` / `mainline-quest §0` 定义，本表不重定义**，只列本系统**新增**符号并显式标注来源。

| 符号 | 含义 | 单位 | 取值域 / 类型 | 来源 |
|---|---|---|---|---|
| `CP_earned` | S1 产出的因果点（**只读引用**） | 点 | ≥ 0 整数 | `rewrite-causality §4.2` |
| `CP_credited` | 含 S2 加成的入账因果点（**应用归 S3**，§4.1） | 点 | ≥ 0 整数 | `mainline-quest §4.1` |
| `CP_balance` | **S3 账户余额**（S3 唯一持有） | 点 | ≥ 0 整数 | §3.3（**本系统新增**） |
| `CP_spent` | 累计已消耗 CP（经济曲线诊断用） | 点 | ≥ 0 整数 | §3.3（**本系统新增**） |
| `disc` | 改写能力折扣（S3 成长 → S1 读取，封顶 0.5） | 无量纲 | [0, 0.5] | `rewrite-causality §0` |
| `intel_cov` | 情报覆盖率（S5 产出 / S1 消费） | 无量纲 | [0, 1] | `rewrite-causality §0` |
| `RE` / `RE_max` | 改写能量 / 其上限（S1 持有数值态，S3 只读显示 + 提供补充出口） | 点 | [0, RE_max] | `rewrite-causality §0` |
| `I` | 反馈强度档位（驱动演出量级） | 枚举 {`minor`,`notable`,`critical`} | — | `rewrite-causality §4.4` |
| `cost_skill` | 技能节点解锁消耗（CP 计价） | 点 | ≥ 0 整数 | §4.3（**本系统新增**） |
| `growth` | 技能成本几何递增系数（防"全点一条"主导策略） | 无量纲 | 全局默认 1.5 | §4.3（**本系统新增**） |
| `disc_per_tier` | 效率分支每级对 `disc` 的贡献 | 无量纲 | 全局默认 0.1 | §4.4（**本系统新增**） |
| `intel_gain_mult` | 情报强化对 S5 采集速率的乘子（S3→S5 只读契约） | 无量纲 | [1.0, 2.0] | §4.5（**本系统新增**） |
| `blueprint_insight` | 情报强化对 S1 蓝图可见门槛的下调量（S3→S1 只读契约） | 无量纲 | [0, 0.3] | §4.5（**本系统新增**） |
| `re_node_reset` | 节点确认时 RE 重置旗标（S3 兑换出口之一） | 布尔 | true/false | §4.6（**本系统新增**） |
| `cost_re_refill` | CP 兑换 RE 补充的单次消耗 | 点 | ≥ 0 整数，随次数递增 | §4.6（**本系统新增**） |
| `branch` | 技能树分支枚举 | 枚举 {`efficiency`,`magic`,`cognition`} | — | §2.2（**本系统新增**） |

**命名 / 数据约定**：所有落到 `game/data/panel/*.tres|*.json`、`game/data/progression/*.tres` 的字段、ID 一律 `snake_case`；朝代命名空间固定 `dyn_threekingdoms_chibi`（与 `art-bible §9.1` 一致），多朝代扩展换命名空间即可（见 §3.6 热切换口）。**存疑的引擎精确实现一律标 `[待程基岩确认]`，本文不臆造 Godot API**。

> ⚠️ **本系统不持有任何 CP 产出源**（守 `systems-index §6` CP 两段式：产出归 S1、加成参数归 S2、账户兑换归 S3）。本系统**只**经 `cp_awarded` 接收 S1 产出、按 `mainline-quest §4.1` 应用 S2 加成得 `CP_credited` 入账，再**花**在技能/兑换/情报强化上。**严禁**另立"日常 CP""成就 CP""面板签到"等产出源——那是经济失衡的直接成因。

---

## 1. 概述

### 1.1 系统定位

面板/成长系统是核心循环 Loop A 的**「反馈」环与「成长」出口**（`systems-index §4` 反馈行；`charter` 核心循环第 4-5 环）。它把改写引擎（S1）算出的**抽象数值**（`Δ`/`CP`/`M`/世界状态）**翻译成玩家可读的系统面板**，并提供**技能树 / CP 兑换 / 情报强化**三条成长出口，让玩家把"偏差收益"转成"下一节点更强的改写能力"——从而**闭环** Loop A（成长→更难/更隐秘的改写，`game-concept §5.2`）。

- **它管什么**（边界以 `systems-index §2` S3 行为准）：`Δ`/`CP`/`M`/`RE`/世界状态的**可视化呈现**（系统面板、HUD）；`CP` 的**账户与兑换**（技能树/系统术法/情报强化）；玩家**改写能力的升级数值**（`disc`/`intel_gain_mult`/`blueprint_insight` 等只读契约，供 S1/S5 读取）；**历史线分叉演出的表现层**（视觉资产/脚本，`art-bible §6.2`）；意图匹配度 `M`（若设为玩家显式输入）的**输入接口**（蓝图选择 UI，承接 `rewrite-causality §2.1③`、`§6.3` 改写面板）。
- **它不管什么**：`Δ`/`CP`/`M` 怎么**算出来**（→ S1，`rewrite-causality §4`）；技能/术法的**战斗执行**（→ S4，`systems-index §6` 玩家能力技能行）；面板**美术资产**（→ 林绘澄，遵循 `art-bible §6`）；任务何时派发/文案语义（→ S2，`mainline-quest §1.2`）；情报**从哪来**（→ S5 采集，`systems-index §6` 情报行）；旁白的**配音/字幕演出表现**（→ X1，`systems-index §1.2`）。
- **它不是**：不是一套独立经济系统（CP 产出完全依赖 S1/S2，本系统只管账户与花销）；不是喧宾夺主的"面板游戏"（守 `game-concept §2` 支柱②反例「系统吐槽盖过正剧」、`systems-index §8` 支柱漂移——面板是改写/因果心脏的**可读化外层**，不是心脏本身）。

### 1.2 玩家动词（本系统承接的系统动词）

本系统承接 `game-concept §3.1`「系统动词」集合（区别于改写/战斗/探索动词），对玩家暴露的是**反馈与成长类**动词：

| 动词 | 作用 | 触发 | 所属系统动词类别 |
|---|---|---|---|
| **查看偏差 Δ** | 读当前节点 Δ 预览 / 历史结算 Δ（HUD + 改写面板） | 玩家主动 / 节点结算自动 | 反馈 |
| **查看 CP / 余额** | 读 CP 账户余额与累计收支 | 玩家主动 | 反馈 |
| **升级技能树** | 花 CP 解锁技能节点（三分支） | 玩家在面板点选 | 成长 |
| **兑换 CP** | 花 CP 换一次性资源（RE 补充等） | 玩家在面板点选 | 成长 |
| **情报强化** | 花 CP 购买情报能力被动升级 | 玩家在面板点选 | 成长 |
| **使用系统术法** | 战斗/改写中释放已解锁术法（执行归 S4/S1） | 玩家在战斗/改写场景触发 | 成长产物（执行非本系统） |
| **选择改写蓝图** | 在改写面板声明意图（`rewrite-causality §2.4`，触发 `blueprint_declared`） | 玩家在改写面板点选 | 反馈/输入接口 |

> 📌 **设计意图**：S3 对玩家的"动词面"集中在**反馈读取 + 成长配置**，且大量是**非战斗时的"军师时刻"**（营寨休整/章节间隙）。战斗内的系统术法**执行**归 S4，本系统只**配置**（解锁/数值）——这把"成长决策"与"动作执行"分层，避免面板喧宾夺主（守 `systems-index §8` 支柱漂移）。

### 1.3 与核心循环 Loop A 的接口

本系统承担 Loop A 的**「反馈」**环（`Δ`→`CP`→演出），并向**「成长」**回灌（CP→技能→更强改写能力→下一节点），同时把成长数值经**只读契约**回流到 S1/S5（不改其内部态，守 `systems-index §3.1` DAG 无环）：

```
… ──③S1 发 Δ+CP+分叉演出信号──▶ 【S3 面板/成长系统】 ──⑤成长数值(disc/intel_gain_mult/blueprint_insight)只读回流──▶ S1/S5
                                        │
                                        ├── 反馈呈现：Δ 条 / CP 入账动效 / 历史线分叉演出(视觉资产) / X1 旁白(配音)
                                        └── 成长出口：技能树(三分支) / CP 兑换(RE补充) / 情报强化
                                                  │
                                                  └── 更强改写能力 → 进入下一节点的「改写」环(S1)  [Loop A 闭环]
```

- **入（← 反馈环）**：来自 S1 的结算信号组（`cp_awarded`/`deviation_recomputed`/`intent_match_computed`/`feedback_tier`/`critical_deviation_triggered`/`blueprint_declared`，`rewrite-causality §6.1`）；来自 S2 的任务目标/进度/奖励信号（`quest_objective_updated`/`quest_progress_updated`/`quest_reward_declared`/`quest_node_vanished_voiced`，`mainline-quest §6.2`）；来自 S4 的 HP/资源只读显示（`systems-index §6` 玩家战斗状态行）。
- **出（→ 下游）**：`CP_balance`（账户，玩家可见）；成长只读契约（`disc`→S1、`intel_gain_mult`→S5、`blueprint_insight`→S1，经 `ability_changed` 类信号，§6）；`node_committed`（玩家经改写面板确认锁定 → S1，§6.2）；历史线分叉演出**视觉表现**（演出资产，X1 配旁白，§2.4）。

### 1.4 「系统」人格触点分工（与 X1 叙事层的两段式）

「系统」（`game-concept §1`）在 S3 的角色是**呈现者 / 记账员 / 配置台**。本系统与横切叙事层 X1（`systems-index §1.2` X1 行）分工如下，**严格守住「数据/资产归属」与「旁白表现归属」两段式**：

| 归属方 | 职责 | 落点 |
|---|---|---|
| **S3（数据/资产归属）** | 持有面板内**静态文案**（技能名/描述、CP 兑换提示、数值标签、演出视觉资产与脚本）；驱动**数值跳动动效**与**历史线分叉演出的视觉层**（横向卷轴时间轴 + 冷光偏差节点，`art-bible §6.2`）。 | `game/data/panel/*.tres`、`game/data/progression/*.tres` + 演出场景 |
| **X1（旁白表现归属）** | 把"系统观测"**以冷光旁白演出出来**：配音 / 字幕样式 / 出场动效 / 节奏；承接 S1 Δ 反馈旁白、S2 派单/完成/消失旁白（`mainline-quest §6.3`）、Loop A 分叉旁白（`game-concept §9①` 待审批）。 | X1 运行时（`systems-index §6`「系统人格」行） |

> ⚠️ **边界红线**：S3 **只产面板静态文案与演出视觉资产/脚本**，不做旁白的**配音/字幕演出**（那是 X1）；X1 **不擅自改写 S3 的数值/技能语义**（可加语气润色，不改数值/标签）。系统人格**基调本身待主创审批**（`game-concept §9①`），本系统按"冷峻记录员 / 记账员"倾向撰写面板文案（如「偏差已记录」「因果点已入账」「能力已校准」），**留接口**待定稿——若主创改语气，只改 `game/data/panel/*.tres` 文案字段，不改 S3 逻辑（与 `mainline-quest §6.3` 同口径）。

---

## 2. 机制

### 2.1 面板层级与信息密度分级（认知过载红线 · 对齐 `systems-index §8` / `art-bible §3.3`）

> 面板是"系统把赤壁翻译成可读变量"的化身（`game-concept §2` 支柱②）。但 `v_i`/`Δ`/`CP`/`M`/`RE`/情报/因果链同屏涌入会**认知过载**（`systems-index §8`）。本系统采用**三层信息分级**（沿用 `rewrite-causality §6.3` / `mainline-quest §2.4` 已定的分级口径，不另造）：

| 层级 | 内容 | 呈现位置（`art-bible §6.2`） | 默认态 |
|---|---|---|---|
| **核心（常驻 HUD）** | HP（S4 只读）、CP 余额、当前节点名 + Δ 指示条、RE 条 | 极简贴边冷光条，**不挡世界**（`art-bible §6.2` HUD 行） | 常驻 |
| **进阶（系统面板，按需展开）** | ①偏差详情（Δ_node/M/I）；②技能树三分支；③CP 兑换；④情报强化；⑤章节进度（读 S2 `P_ch`） | 系统材质面板（`art-bible §6.1`），玩家主动打开 | 收起 |
| **隐藏（默认折叠，供硬核玩家）** | 完整收支账本（CP_spent 明细）、`disc`/`intel_cov` 数值、技能数值推导、因果链条件（读 S1/S2 只读契约） | 面板内折叠区 | 折叠 |

> **认知过载红线**：核心层**恒定 ≤ 5 个信息单元**（HP/CP/节点名/Δ 条/RE 条），进阶层**按 Tab 分页**（偏差 / 技能 / 兑换 / 情报 / 任务 5 页），隐藏层默认折叠。**严禁**把 `d_i`/`w_i` 权重、`condition` 表达式等内部数值塞进核心/进阶层（那是 S1/S2 的隐藏层契约，本系统只做"折叠可查"的表现）。这呼应 `art-bible §6.3` 可访问性（系统文字 ≥150% 缩放可读）。

### 2.2 成长出口一：技能树（三分支 · 杜绝主导策略）

> 这是本系统的**核心成长机制**。CP 花在技能树上**永久**解锁玩家能力。**三分支**设计直接服务 `game-concept §5.4` 防主导策略——每分支放大 Loop A 的**不同环节**，单点一条必在另两环吃亏，逼玩家据自己的改写风格做取舍。

| 分支 `branch` | 主题 | 放大的 Loop A 环节 | 代表性能力（每级解锁） | 对外只读契约 |
|---|---|---|---|---|
| **`efficiency`（改写效率）** | 让改写"更省、更多次" | 改写环 | 降低 `cost_RE`（提升 `disc`，封顶 0.5）；增加 `max_attempts`（读 S1 节点数据，本系统不下发改写规则，仅作 UI 显示的"次数预警"）；提升 `RE_max` | `disc`→S1（`ability_changed`） |
| **`magic`（系统术法）** | 解锁战斗术法 + 改写动词 | 改写环 / Loop B 战斗 | 解锁系统术法（青蓝，`art-bible §2.4`），如 `ability_system_magic_wind`（自借东风前置，`rewrite-causality §3.5`）、战斗术法（执行归 S4） | 能力解锁旗标→S4/S1（`requires.ability` 校验） |
| **`cognition`（认知/情报）** | 让探索→改写的桥更宽 | 探索环→改写环 | 提升 `intel_gain_mult`（S5 采集更快）；提升 `blueprint_insight`（蓝图可见门槛下调，更易见精确蓝图）；因果链预览更详细（UI 表现） | `intel_gain_mult`→S5、`blueprint_insight`→S1 |

**防主导策略的三道保险**（守 `game-concept §5.4` / `systems-index §8`）：

1. **跨环互补**：三分支服务不同环节，**没有任何一条能单独通关**。例：全点 `efficiency` → `disc` 封顶 0.5 后再投资无收益（边际归零），且没术法无法自借东风、没情报看不见精确蓝图；全点 `magic` → RE 烧不起、改写次数不够；全点 `cognition` → 看得见蓝图但执行（战斗/潜行/改写消耗）跟不上。
2. **几何成本递增**（§4.3 `growth=1.5`）：同分支越往高级越贵，**逼分散投资**而非堆叠一条。
3. **封顶硬约束**：`disc` 封顶 0.5（`rewrite-causality §4.3`）、`intel_gain_mult` 封顶 2.0、`blueprint_insight` 封顶 0.3（§4.4/§4.5）——成长有天花板，后期不能"碾压"心脏数值，守支柱②"看得见天平"而非"碾压天平"。

> 📌 **技能树视觉**（`art-bible §6.2` 系统面板行）：冷光节点连线图，三分支用**同色系不同明度**区分（非阵营色，避免与 `art-bible §2.3` 阵营色混淆）；已解锁节点亮、可解锁节点描边脉动、锁定节点暗。**杜绝**任何"最优路径高亮"提示（那是主导策略的帮凶）。

### 2.3 成长出口二：CP 兑换（一次性资源 · RE 补充）

> CP 兑换是**即时消耗型**出口，与技能树的**永久**出口互补。MVP 范围内**唯一**的兑换项是 **RE 补充**（呼应 `rewrite-causality §4.3` RE 再生【待审批】——本系统给出落地）：

- **`cost_re_refill`（CP→RE）**：玩家花 CP 立即回 RE。**单次消耗随该节点内兑换次数递增**（§4.6），防"无限兑换刷改写次数"（与 `rewrite-causality §5.1` 防"按次刷分"同源红线）。
- **不在 MVP 的兑换项**（目标态/愿景）：情报条目直接购买（与 S5 采集冲突，**愿景外**）、消耗道具（基线无道具系统，`charter` 范围严守）。

> ⚠️ **RE 再生落地的完整方案**（回应 `rewrite-causality §4.3`【待审批】，本 GDD 给倾向值）：
> - **节点确认时免费重置**：节点 `已确认`（收 `node_resolved`）→ S3 触发 `re_node_reset=true`，S1 把 `RE` 重置到 `RE_max`。这是**主线节奏**给的免费补给（节点间天然休整）。
> - **营寨休整事件补充**（目标态，S5 场所触发）：玩家回营寨触发休整事件 → 回部分 RE（具体比例 `[待审批]`）。
> - **CP 兑换 RE 补充**（本系统出口）：节点内应急补给，消耗 CP 且递增。
> - **明确不做**：纯时间挂机再生（防 AFK 刷分，`rewrite-causality §5.1`）。
> 该方案须与 S1（`rewrite-causality §4.3`）联合确认，本 GDD 已给倾向值；若主创倾向"纯按节点重置、删 CP 兑换"，则 §4.6 公式与 §2.3 出口需同步调整（列入 §9 待审批）。

### 2.4 成长出口三：情报强化（被动升级 · 探索→改写桥）

> 情报强化是**被动型**出口：花 CP 永久提升玩家的**情报能力**，强化"探索→改写"的桥（`game-concept §3.2` 情报→改写收益回路）。**严格守两段式**（`systems-index §6` 情报行）：情报**采集归 S5**、情报**使用降 diff/解锁蓝图归 S1**；本系统的情报强化是"**玩家情报能力的元升级**"，经只读契约回流，**不替代** S5 采集、**不改** S1 的 `diff`/`unlock_intel_cov` 数据字段。

| 强化项 | 效果 | 回流方（只读契约） | 边界 |
|---|---|---|---|
| **采集速率** | `intel_gain_mult`↑（S5 把采集到的原始情报量 ×此乘子） | S3→S5（`ability_changed` 类） | S5 仍决定"情报点在哪、长什么样"（`systems-index §2` S5 行） |
| **蓝图洞察** | `blueprint_insight`↑（S1 算蓝图可见性时用 `max(0, unlock_intel_cov − insight)` 作有效门槛） | S3→S1（`ability_changed` 类） | S1 仍持有 `unlock_intel_cov` 数据（`rewrite-causality §3.3`），本系统只给"下调量" |
| **因果链预览** | 任务面板/改写面板的因果链自然语言预览更详细（UI 表现） | S3 自身 UI（读 S2 `causal_preview_hint`，`mainline-quest §3.2`） | 不改 S2 文案语义，只"展开更多行" |

> 📌 **为何这是"桥"而非"采集/使用"**：情报强化**不创造情报**（那是 S5 的探索产出），也**不直接降 diff**（那是 S1 读 `intel_cov` 算的）。它只是让"同样的探索产出更高 intel_cov、同样的蓝图门槛更易见"——是**放大器**，不是**源头**。这把成长严格约束在 DAG 边 S3→S5 / S3→S1 的只读契约上，无环（守 `systems-index §3.1/§3.3`）。

### 2.5 反馈呈现钩子：如何接 S1 §2.8 的结算信号组（历史线分叉演出）

> 落地 `game-concept §5.2` 反馈环 + `rewrite-causality §2.8` 反馈回成长面板的钩子。节点锁定后，S1 发**一组结算信号**（`rewrite-causality §6.1`），S3 据此做**三层反馈呈现**：

```
S1 发 cp_awarded(amount, node_id, reason)
   │  └─ S3: CP_balance += amount（先入 S1 产出，再叠加 S2 加成得 CP_credited，§4.1）
   │        + HUD/面板 CP 数值跳动动效（litRPG 爽感，art-bible §6.1 打字机/滚动）
   ▼
S1 发 deviation_recomputed(node_id, delta_node, is_preview=false) + intent_match_computed(node_id, M)
   │  └─ S3: 结算屏显示 Δ_node / M / CP_credited（核心层数值）
   ▼
S1 发 feedback_tier(node_id, tier=I)
   │  └─ S3: 按 I 选演出量级（art-bible §2.5 三档 / rewrite-causality §4.4）：
   │        minor  → 仅数值跳动 + 短冷光提示
   │        notable → 短历史线分叉演出（横向卷轴，3s 内）+ X1 短旁白
   │        critical→ 长演出（4-6s）+ 世界线震荡 glitch（art-bible §2.5 critical）+ X1 长旁白
   ▼
（若 Δ_node ≥ Δ_critical）S1 发 critical_deviation_triggered(node_id, delta_node)
      └─ S3: 触发"世界线震荡"专属演出（橙红警示 + glitch 撕裂，art-bible §6.1/§7.2）
         + X1 播"世界线剧烈震荡"旁白（game-concept §6.3）
```

**历史线分叉演出的两段式所有权**（`systems-index §6` 历史线行 + `rewrite-causality §4.4`）：
- **判定归 S1**（哪条历史线、是否 critical）——本系统只读 `feedback_tier`/`critical_deviation_triggered`。
- **演出视觉资产/脚本归 S3**（横向卷轴：墨色历史线 + 冷光偏差节点 + 分叉动画，`art-bible §6.2`）。
- **旁白配音/字幕归 X1**（基于 S1/S3 触发，文案可读 S2 `system_complete_voice`，`mainline-quest §3.2`）。

> 📌 **演出节制的认知过载防线**：`critical` 演出**不连续刷屏**——若玩家连续多节点 critical（`rewrite-causality §5.2` 震荡级联风险），S3 对后续 critical 演出做**降级压缩**（缩短时长、合并旁白），避免"每节点都长演出"的疲劳（守 `game-concept §2` 支柱②「正剧底色」不被 litRPG 爽感淹没，呼应 `systems-index §5` 跨系统张力）。

### 2.6 改写面板：意图匹配度的输入接口（承接 S1 §2.4 蓝图方案）

> `rewrite-causality §2.4` 的"改写蓝图=显式意图"方案（【提议方案，待主创审批】）需要一个**玩家选蓝图的输入界面**——这正是 S3 的改写面板职责（`systems-index §2` S3 行「意图匹配度的输入接口」）。改写面板的**内容契约**已在 `rewrite-causality §6.3` 定好（当前节点+派单语气、可用蓝图按 `intel_cov` 过滤、蓝图 target_vars、动词+cost_RE 预览、Δ 实时预览条、M 预估、"确认改写"按钮）：

- **S3 改写面板只做"输入与显示"**：列蓝图、显预览、收玩家点击 → 发 `blueprint_declared`（经 S1 §6.1，实际由 S1 持有蓝图数据，S3 只读渲染）。
- **"确认改写"按钮归 S3**：玩家点 → S3 发 `node_committed(node_id)`（**S3→S1**，§6.2；对齐 `mainline-quest §2.1` 注：玩家确认归 S3 发，不经 S2）。
- **蓝图数据归 S1**（`rewrite-causality §3.3`），S3 **不重定义**蓝图，只按 `intel_cov`（含本系统 `blueprint_insight` 调整后的有效门槛）过滤渲染。

> ⚠️ **改写面板 vs 系统面板的分页**：改写面板是**节点激活时**的情境化界面（叠在 L5 系统叠层，`art-bible §3.2`），系统面板（技能树/兑换/情报）是**非战斗时**的配置界面。二者**不同时全屏**（避免认知过载），改写面板可呼出系统面板的"快速兑换 RE"子页（§2.3）。

---

## 3. 数据（为落 `game/data/panel/*.tres|*.json`、`game/data/progression/*.tres` 铺路）

> 遵循 `AGENTS.md` 数据驱动约定 + `art-bible §9` 命名规范（`snake_case` + 朝代命名空间）。下列为**设计侧字段契约**，是给程基岩 P3 架构的输入；**`.tres` 资源类名、Godot 类型映射标 `[待程基岩确认]`**，本文只定"要存什么、叫什么"。

### 3.1 技能节点 —— `game/data/progression/skills/<skill_id>.tres`

```yaml
skill_id: skill_eff_re_discount_t1            # efficiency 分支 · RE 折扣 第1级
dynasty: dyn_threekingdoms_chibi               # 朝代命名空间（art-bible §9.1，多朝代换此字段）
branch: efficiency                             # efficiency | magic | cognition（§2.2）
tier: 1                                        # 分支内层级（几何成本递增用，§4.3）
display_name: "改写节能·初阶"
description: "降低改写能量消耗。系统注释：能效校准已完成。"
cost_base: 20                                  # 基础 CP 消耗（点，§4.3 cost_skill 用）
prereq: []                                     # 前置技能 id（同分支上一 tier；跨分支可空）
# —— 对外只读契约（解锁后生效，经 ability_changed 下发，§6.2）——
grants:                                        # 解锁后下发给对应系统的只读契约
  - { target: s1_rewrite_engine, key: disc_delta, value: 0.1 }     # disc += 0.1（封顶 0.5）
  # 或
  # - { target: s4_combat, key: ability_unlocked, value: ability_system_magic_wind }
  # - { target: s5_open_world, key: intel_gain_mult_delta, value: 0.2 }
  # - { target: s1_rewrite_engine, key: blueprint_insight_delta, value: 0.1 }
```

> **设计意图**：`grants[]` 是技能树向 S1/S4/S5 下发**只读契约增量**的统一格式（`ability_changed` 信号载荷据此，§6.2）。**本系统绝不直写 S1/S4/S5 内部态**——只发"我解锁了 X，请你自己更新你的只读契约"，由对方系统读取应用（守 `systems-index §3.1` DAG 无环，与 `rewrite-causality §7.2` disc 解耦同口径）。

### 3.2 技能树定义（三分支聚合）—— `game/data/progression/skill_tree.tres`

```yaml
tree_id: skill_tree_traveler                   # 穿越者技能树（本切片唯一）
dynasty: dyn_threekingdoms_chibi
growth: 1.5                                    # 几何成本递增系数（§4.3，全局默认，可手调）
branches:
  efficiency:
    cap_disc: 0.5                              # disc 硬封顶（对齐 rewrite-causality §4.3）
    disc_per_tier: 0.1                         # 每级 disc 贡献（§4.4）
    nodes: [skill_eff_re_discount_t1, skill_eff_re_discount_t2, skill_eff_re_discount_t3,
            skill_eff_more_attempts, skill_eff_re_max_up]
  magic:
    nodes: [skill_magic_wind_borrow,           # 解锁 ability_system_magic_wind（自借东风前置）
            skill_magic_combat_burst,          # 战斗术法（执行归 S4）
            skill_magic_stealth_disrupt]       # 潜行破坏术法（rewrite-causality §1.2 物理破坏类）
  cognition:
    cap_intel_gain_mult: 2.0                   # intel_gain_mult 硬封顶
    cap_blueprint_insight: 0.3                 # blueprint_insight 硬封顶
    nodes: [skill_cog_intel_gain_t1, skill_cog_intel_gain_t2,
            skill_cog_blueprint_insight_t1, skill_cog_blueprint_insight_t2,
            skill_cog_causal_preview]
```

> ⚠️ **封顶字段是经济防线**（§4.4/§4.5）：`cap_*` 确保成长有天花板，不会让后期 `disc`/`intel_gain_mult` 碾压 S1 心脏数值。**删封顶 = 经济失衡**（红线）。

### 3.3 CP 账户与收支账本（S3 运行时持有）—— 非持久态映射，给 X4 存档

> 存档所有权在工程（X4，`systems-index §1.2`）。本系统声明**需被持久化的账户状态**（设计侧契约，给程基岩）。**CP 余额/已购技能是 S3 唯一持有的持久态**（产出/加成不在此，归 S1/S2 运行时）。

```yaml
save_state_panel_progression:
  active_dynasty: dyn_threekingdoms_chibi
  cp_balance: 180                              # 当前余额（点）— S3 唯一持有
  cp_spent_total: 320                          # 累计已消耗（经济曲线诊断，§4.2）
  cp_credited_total: 500                       # 累计入账（= 余额 + 已消耗，对账用）
  unlocked_skills:                             # 已解锁技能 id 集合（决定只读契约生效集）
    - skill_eff_re_discount_t1
    - skill_cog_intel_gain_t1
  re_refills_this_node: 0                      # 本节点内 RE 兑换次数（cost_re_refill 递增用，§4.6）
  # —— 派生只读契约（不持久化，读档后由 unlocked_skills 重建）——
  effective_disc: 0.1                          # = Σ efficiency tiers × disc_per_tier，clamp [0,0.5]
  effective_intel_gain_mult: 1.2               # = 1 + Σ cognition intels，clamp [1,2]
  effective_blueprint_insight: 0.0             # = Σ cognition insights，clamp [0,0.3]
```

> ⚠️ **跨系统存档一致性**：S3 的 `cp_credited_total` 必须 == S1 历次 `cp_awarded` 之和（经 S2 加成后）——否则账户对不上账。X4 存档须把 S1 `resolved_nodes`（`rewrite-causality §3.6`）与 S3 账户**原子写入**，读档后做"`cp_credited_total == Σ(cp_awarded × quest_reward_mult) + Σ(quest_cp_flat_bonus)`"对账校验（§5.4 边缘情况）。

### 3.4 CP 兑换项定义 —— `game/data/panel/exchange_items.tres`

```yaml
items:
  - item_id: exchange_re_refill
    dynasty: dyn_threekingdoms_chibi
    display_name: "改写能量补给"
    description: "立即回复部分改写能量。系统注释：能量缓释中。"
    kind: re_refill                            # re_refill | (目标态: consumable/...)
    effect: { target: s1_rewrite_engine, key: re_refill_amount, value: 40 }   # 回 40 RE（S1 应用）
    cost_formula: re_refill_rising             # 递增定价（§4.6），非固定
    cost_base: 25                              # 首次消耗（点）
    cost_growth: 1.6                           # 每次兑换后下一次 ×1.6
    reset_trigger: node_resolved               # 节点确认时 re_refills_this_node 归零（§2.3）
```

### 3.5 面板文案与演出资产引用 —— `game/data/panel/ui_strings.tres` / 演出场景

```yaml
# 面板静态文案（系统语气，X1 只做配音/字幕表现，不改语义）
ui_strings:
  panel_title_system: "改写者系统 · 观测台"
  cp_balance_label: "因果点余额"
  cp_credited_toast: "因果点已入账"             # CP 入账动效文案
  delta_label: "历史偏差"
  skill_unlocked_toast: "能力已校准"           # 技能解锁动效文案
  re_refill_toast: "能量缓释完成"
  system_voice_tone: cold_recordist            # 系统语气基调（待审批 game-concept §9①）
# 历史线分叉演出资产引用（art-bible §6.2 横向卷轴）
timeline_branch_scenes:
  minor:  res://scenes/panel/timeline_minor.tscn    # [待程基岩确认] 路径规约
  notable: res://scenes/panel/timeline_notable.tscn
  critical: res://scenes/panel/timeline_critical.tscn
```

> ⚠️ **演出资产归 S3，旁白归 X1**（§1.4）：`timeline_*_scenes` 是 S3 的视觉演出（墨色线 + 冷光节点 + 分叉动画）；其内的旁白配音/字幕由 X1 在运行时叠加（读 S2 `system_complete_voice` + S1 Δ 数据）。S3 不在演出场景里硬编码旁白语音（那是 X1 的资产）。

### 3.6 朝代热切换口（多朝代扩展铺路，**本切片不实现**）

> 落地 `AGENTS.md` Godot 约定「朝代 = TileSet + 遭遇表 + BGM 组合热切换」+ `game-concept §7.3` 愿景。

**本系统的热切换契约**：
- 技能树、技能节点、兑换项、面板文案均带 `dynasty` 命名空间字段；引擎按 `active_dynasty` 加载对应面板/成长数据包。
- **CP 账户/技能解锁是"穿越者维度"**（不属于某朝代），跨朝代沿用——`save_state_panel_progression` 不按朝代分组（与 `rewrite-causality §3.6` resolved_nodes 的"按朝代分组"愿景不同，本系统的成长是穿越者本体属性）。**[待审批]** 是否允许"每朝代独立技能树"（愿景，本切片不做，但 `skill_tree.tres` 的 `dynasty` 字段已为多树铺路）。
- **成长公式（§4）朝代无关**（纯数值，不含朝代硬编码）——换朝代只换技能数据包，不换公式。

> ✅ **预留验收**：本切片结构满足"换面板/技能数据包即可换朝代"，不挡多朝代扩展（与 `rewrite-causality §3.7` / `mainline-quest §3.5` 一致）。

---

## 4. 公式（统一格式 · 标变量与单位）

> 本节是本系统的数值定稿。所有符号见 §0。每条公式给出：**公式式 → 变量说明 → 设计意图/防红线注释**。**本系统的公式与 S1/S2 的 CP 总量口径严格自洽**：产出全来自 S1（`rewrite-causality §4.2`），加成参数全来自 S2（`mainline-quest §4.1`），本系统只管"入账 + 花销"。

### 4.1 CP 入账（应用 S2 加成 · 回应 `mainline-quest §4.1` 待审批）

> 严格守 `systems-index §6` CP 两段式。**本 GDD 确认：S2 加成在 S3 账户侧应用**（`CP_credited` 由 S3 算并入账）——这是 `mainline-quest §9③` 的待审批项，本系统作为账户所有方**采纳 S2 的建议**（不触碰 S1 已锁的 §4.2 产出公式）。

```
CP_credited = round( CP_earned · quest_reward_mult ) + quest_cp_flat_bonus     [点]，整数 ≥ 0
CP_balance  = CP_balance + CP_credited                                         [点]
```

| 变量 | 含义 | 单位 | 来源 / 归属 |
|---|---|---|---|
| `CP_earned` | S1 产出的因果点 | 点 | **`rewrite-causality §4.2`**（S1 产出，本系统只读） |
| `quest_reward_mult` | 任务奖励 CP 倍率 | 无量纲 [1.0, 2.0] | **`mainline-quest §4.1`**（S2 数据，本系统按 node_id 查 S2 章节数据） |
| `quest_cp_flat_bonus` | 任务完成固定 CP | 点 | **`mainline-quest §4.1`**（S2 数据，本系统按 node_id 查） |
| `CP_credited` | 实际入账 CP（含加成） | 点 | **本系统（S3）计算并入账** |
| `CP_balance` | 账户余额 | 点 | **本系统（S3）唯一持有** |

**触发流程**：S1 发 `cp_awarded(CP_earned, node_id, reason)` → S3 收到后，按 `node_id` 查 S2 章节数据取加成参数 → 算 `CP_credited` → `CP_balance += CP_credited` → 播入账动效 + 刷新技能树可用性。**S1 发完即放手，S2 不经手余额**（两段式无重复）。

**防红线（经济失衡）**：
- 本系统**绝不**在 `CP_earned`/`quest_reward_mult`/`quest_cp_flat_bonus` 之外加任何 CP（无"面板加成""成就 CP"）——守 `systems-index §6` CP 产出唯一性。
- 若 S2 数据缺加成参数（默认 `quest_reward_mult=1.0`/`quest_cp_flat_bonus=0`），则 `CP_credited = CP_earned`，**不崩**（数据兜底）。

### 4.2 CP 收支总账（经济曲线诊断 · 跨章节平衡检查）

```
CP_credited_total = Σ_{n ∈ resolved_nodes} CP_credited(n)                       [点]
CP_spent_total    = Σ( cost_skill 已购 ) + Σ( cost_re_refill 已兑换 )            [点]
对账恒等式:        CP_balance == CP_credited_total − CP_spent_total             [点]
```

**设计意图**：给出可被 QA（严守真 P5/P6）与 Playtest 诊断的**经济曲线检查式**。一个健康的经济应满足（**[提议方案，待主创审批]** 的目标区间，非冻结值）：

| 指标 | 目标区间（全章节 N1+N2+N3） | 设计理由 |
|---|---|---|
| `CP_credited_total`（全章节总入账） | ≈ 400–700 点 | 3 节点 ×（CP_node≈120 × M≈0.7 × (1+k·Δ/Δ_cap) + S2 加成）的典型量级 |
| 技能树**总造价**（三分支全满） | ≈ 750–900 点 | **刻意高于单章节总入账**，逼玩家跨"章节/周目"或取舍，杜绝"一章节全满" |
| 玩家单章节可解锁技能数 | ≈ 4–6 个节点 | 证明 Loop A 成长感（MVP 至少 1 个，`game-concept §7.1`） |

> **跨章节平衡检查**（防经济失衡红线）：若 Playtest 显示玩家在**单章节内全满技能树** → 说明 `CP_credited` 过高或 `cost_skill` 过低 → 调 `quest_reward_mult`（S2）/ `growth`（S3）。若玩家**长期 CP 闲置花不出** → 说明出口造价过高或出口吸引力不足 → 调 `growth` 或新增出口。**本系统不预先冻结数值**，只给出诊断框架与倾向区间。

### 4.3 技能节点解锁消耗（几何递增 · 防主导策略）

```
cost_skill(skill) = round( cost_base(skill) · growth^(tier(skill) − 1) )        [点]，整数 ≥ 0
可解锁判定:         CP_balance ≥ cost_skill(skill)  ∧  prereq(skill) 全已解锁     [布尔]
解锁动作:           CP_balance −= cost_skill(skill) ; unlocked_skills += skill   ; 下发 grants[]
```

| 变量 | 含义 | 单位 | 来源 |
|---|---|---|---|
| `cost_base(skill)` | 技能基础消耗 | 点 | 技能数据（§3.1） |
| `growth` | 几何递增系数 | 无量纲 | 技能树数据（§3.2），全局默认 1.5 |
| `tier(skill)` | 技能在分支内的层级 | 整数 ≥ 1 | 技能数据（§3.1） |

**防主导策略解读（守 `game-concept §5.4`）**：
- **几何递增**（`growth=1.5`）使同分支第 1 级便宜（如 20）、第 5 级贵（如 20×1.5⁴≈101）——**逼分散投资**。一个全点 efficiency 的玩家，第 4-5 级的边际 CP/收益比会劣于去点 magic/cognition 的第 1-2 级，自然形成"广度优于深度"的均衡。
- **三分支跨环互补**（§2.2）：再叠加几何成本，**不存在单一最优路径**。
- **`[提议方案，待主创审批] growth=1.5`**：1.3 偏平（深度仍优）、1.7 偏陡（深度过罚）。须 P5/P6 Playtest 校准。

### 4.4 改写效率分支：`disc` 聚合（S3→S1 只读契约 · 封顶 0.5）

```
effective_disc = clamp( Σ_{s ∈ unlocked, s.branch==efficiency} disc_per_tier(s) , 0, cap_disc )     [无量纲]
```

| 变量 | 含义 | 单位 | 默认 |
|---|---|---|---|
| `disc_per_tier(s)` | efficiency 技能每级 disc 贡献 | 无量纲 | 0.1（§3.2） |
| `cap_disc` | disc 硬封顶 | 无量纲 | **0.5**（对齐 `rewrite-causality §4.3`） |

**下发**：技能解锁时 S3 发 `ability_changed(ability_id=disc, disc_delta=+0.1)`（S3→S1，§6.2）。**S1 读取并自行 clamp 到 0.5**（`rewrite-causality §4.3`）——S3 的 `cap_disc` 与 S1 的封顶是**双保险**，任一侧都不会让 disc 越界。

**设计意图**：`disc` 是 `systems-index §3.3` 唯一警惕的反向耦合（成长→改写更强）。本系统通过**封顶 0.5 + 几何成本 + efficiency 分支有限节点数**三重约束，确保成长"让改写更省"但**永远不免费**（最多打 5 折，`cost_RE` 仍 ≥ `cost_base·diff·0.5`）。**这是 Loop A 闭环（成长反哺改写）与防经济失衡的平衡点**（呼应 `rewrite-causality §7.2` 已确认的反向耦合解耦）。

### 4.5 认知分支：`intel_gain_mult` / `blueprint_insight` 聚合（S3→S5 / S3→S1）

```
effective_intel_gain_mult = clamp( 1 + Σ_{s ∈ unlocked, s.grants.intel_gain_mult_delta} delta , 1, cap_intel_gain_mult )   [无量纲]
effective_blueprint_insight = clamp( Σ_{s ∈ unlocked, s.grants.blueprint_insight_delta} delta , 0, cap_blueprint_insight ) [无量纲]
# S1 算蓝图可见性时的有效门槛（S3→S1 只读契约）：
effective_unlock_intel_cov(blueprint) = max( 0, unlock_intel_cov(blueprint) − effective_blueprint_insight )                [无量纲]
```

| 变量 | 含义 | 单位 | 默认/封顶 |
|---|---|---|---|
| `cap_intel_gain_mult` | 采集速率乘子封顶 | 无量纲 | 2.0（§3.2） |
| `cap_blueprint_insight` | 蓝图洞察封顶 | 无量纲 | 0.3（§3.2） |
| `unlock_intel_cov(blueprint)` | 蓝图原始可见门槛 | 无量纲 [0,1] | **S1 数据**（`rewrite-causality §3.3`） |

**下发与边界**：
- `intel_gain_mult` → S5（`ability_changed` 类）：S5 把采集到的原始情报量 ×此乘子得 `intel_cov`。**S5 仍决定情报点/形态**（`systems-index §2` S5 行）。
- `blueprint_insight` → S1（`ability_changed` 类）：S1 渲染改写面板蓝图列表时，用 `effective_unlock_intel_cov` 过滤（而非原始 `unlock_intel_cov`）。**S1 仍持有原始门槛数据**，本系统只给"下调量"。

**设计意图（守两段式）**：情报强化是"放大器"——**不创造情报**（S5 产）、**不直接降 diff**（S1 读 intel_cov 算）。它只让"同样的探索产出更高 intel_cov、同样的蓝图更易见"。这把成长严格约束在只读契约边，无环（§7.3/§7.4 交叉确认）。

### 4.6 RE 补充定价（CP 兑换出口 · 递增防刷）

```
cost_re_refill(k) = round( cost_base · cost_growth^(k − 1) )                    [点]，整数 ≥ 0；k = re_refills_this_node + 1
解锁动作:         CP_balance −= cost_re_refill(k) ; RE += re_refill_amount      ; re_refills_this_node += 1
重置时机:         收 node_resolved → re_refills_this_node = 0                   （节点间天然休整，§2.3）
```

| 变量 | 含义 | 单位 | 默认（§3.4） |
|---|---|---|---|
| `k` | 本次是本节点内第 k 次兑换 | 整数 ≥ 1 | 运行时 |
| `cost_base` | 首次兑换消耗 | 点 | 25 |
| `cost_growth` | 每次兑换递增系数 | 无量纲 | 1.6 |
| `re_refill_amount` | 单次回 RE 量 | 点 | 40（S1 应用） |

**防红线（经济失衡 / 防刷）**：
- **递增定价**：本节点内越兑越贵（25 → 40 → 64 → 102 …），逼玩家"省着用 RE"而非"无限兑 RE 刷改写次数"。这与 `rewrite-causality §5.1` 的 `max_attempts` 封顶共同防"按次刷分"。
- **节点确认时重置**：`re_refills_this_node` 在 `node_resolved` 时归零——下个节点又是首兑价。这呼应"按节点重置"的 RE 再生倾向（§2.3），让 CP 兑换是"节点内应急"而非"全局无限"。
- **`[提议方案，待主创审批]`** `cost_growth=1.6` 与 `re_refill_amount=40`：须与 S1 `RE_max`/`cost_base(verb)` 联合定，确保"兑一次 RE 够一次中等改写动词"而非"兑一次够改写一整节点"。

### 4.7 公式总览（一眼速查）

| 量 | 公式 | 单位 | 归属 |
|---|---|---|---|
| CP 入账 | `CP_credited = round(CP_earned·quest_reward_mult) + quest_cp_flat_bonus` | 点 | **应用归 S3**（参数归 S2，产出归 S1） |
| 对账恒等 | `CP_balance == CP_credited_total − CP_spent_total` | 点 | S3（诊断） |
| 技能消耗 | `cost_skill = round(cost_base·growth^(tier−1))` | 点 | S3 |
| disc 聚合 | `effective_disc = clamp(Σ disc_per_tier, 0, 0.5)` | 无量纲 | S3→S1 只读 |
| 情报乘子 | `effective_intel_gain_mult = clamp(1+Σδ, 1, 2.0)` | 无量纲 | S3→S5 只读 |
| 蓝图洞察 | `effective_blueprint_insight = clamp(Σδ, 0, 0.3)` | 无量纲 | S3→S1 只读 |
| RE 补充 | `cost_re_refill(k) = round(cost_base·1.6^(k−1))` | 点 | S3 |

---

## 5. 边缘情况（≥3 类，逐类给判定与处理）

### 5.1 CP 通胀 / 通缩（经济失衡红线 · 跨章节平衡）

- **现象（通胀）**：玩家在单章节内 CP 余额远超技能树总造价，成长失去张力（"反正买得起，随便点"）。
- **现象（通缩）**：玩家 CP 长期不够买任何有意义的能力，Loop A 成长环断裂（"改写了但没变强"），支柱②胜任感崩塌。
- **判定/处理**：
  1. **诊断式对账**（§4.2）：QA 用 `CP_credited_total` vs 技能树总造价的比值判定。健康区间见 §4.2 表（入账 < 总造价，逼取舍）。
  2. **通胀缓解**：上调 `growth`（技能更贵）/下调 S2 `quest_reward_mult`（须经 S2，**本系统不擅改 S2 数据**）/ 新增高阶出口（目标态）。
  3. **通缩缓解**：下调 `growth` / 调 S1 `CP_node`（须经 S1）/ 调 S2 加成（须经 S2）。
- **红线标注**：此条是**经济失衡**的总阀门。**严禁**用"面板签到/日常 CP"治通缩（那是另立产出源，违反 `systems-index §6` CP 唯一性）。通缩只能从 S1/S2 侧调产出/加成，本系统侧调消耗——**三段式各管各的**。

### 5.2 技能点洗点 / respec（玩家自主 vs 经济一致）

- **现象**：玩家解锁了 efficiency 分支几级后，发现更适合 magic 流，要求"退技能退 CP 重投"。
- **判定/处理**：
  1. **MVP 不做 respec**（守 `game-concept §7.1` 收窄）：技能解锁即历史事实（呼应"历史已改写"叙事，与 `rewrite-causality §5.4`/`mainline-quest §5.3` 已锁定不回滚同口径）。
  2. **目标态 respec【待审批】**（§9）：若主创要求，倾向"**有代价 respec**"——退技能只返还部分 CP（如 50%），且封顶次数，防"无限洗点试遍所有 build"（那是主导策略的温床）。**绝不免费全额 respec**。
  3. **降认知过载的替代方案**：技能树**预览**功能（解锁前看满级效果），让玩家"先想后点"，降低 respec 需求。
- **红线标注**：免费全额 respec 会破坏 §4.3 几何成本的"取舍"意义——玩家可零成本试遍所有 build，主导策略风险复活。**respec 必须有代价**。

### 5.3 情报强化与 S5 世界状态 / S1 蓝图门槛的冲突（系统一致性红线）

- **现象**：玩家点了 `blueprint_insight` 后，S1 改写面板仍按原始 `unlock_intel_cov` 过滤蓝图（"我升级了洞察但蓝图还是看不见"）；或 S5 未应用 `intel_gain_mult`（"我升级了采集但 intel_cov 涨速不变"）。
- **判定/处理**：
  1. **只读契约的同步责任在消费方**：S3 发 `ability_changed` 后，**S1/S5 必须接收并应用**到各自的 `effective_*` 计算。若 S1/S5 未应用，属其 bug，非本系统责任——**本系统只保证"正确下发 grants[]"**（§6.2）。
  2. **封顶双保险**：S3 的 `cap_*` 与 S1/S5 的读取 clamp 各自独立——即便一侧漏判，另一侧封顶兜底（如 S3 漏 clamp，S1 仍 clamp disc 到 0.5，`rewrite-causality §4.3`）。
  3. **数据契约校验 [待程基岩确认]**：建议 P3 在 `ability_changed` 处理链加断言——消费方收到 `disc_delta`/`intel_gain_mult_delta`/`blueprint_insight_delta` 后，其 `effective_*` 必须更新；未更新则告警。
- **红线标注**：此条守**DAG 无环 + 跨系统一致性**；若只读契约不同步，成长"看似生效实则没用"，玩家胜任感（支柱②）崩塌。

### 5.4 面板认知过载（认知过载红线 · 对齐 `systems-index §8` / `art-bible §3.3`）

- **现象**：玩家打开系统面板，被 Δ/CP/M/RE/disc/intel_cov/三分支/因果链同时轰炸，读不懂"我该买什么"。
- **判定/处理**：
  1. **三层信息分级**（§2.1）：核心层 ≤5 单元常驻 HUD；进阶层 5 Tab 分页；隐藏层折叠。**严禁**把内部数值（d_i/w_i/condition）塞进核心/进阶。
  2. **技能树"推荐"克制**：面板**不主动推荐**最优路径（那是主导策略帮凶）。可给"未满足前置"的灰色提示，但不给"该点哪个"的引导箭头。
  3. **双轨反差的可读性**（`art-bible §0/§12`）：冷光面板半透明（10-20% 不透明），透出背后世界，强化"叠加观测"而非"全屏挡世界"。若面板过 opaque 会抢正剧沉浸（支柱②反例）。
- **红线标注**：此条守**认知过载 + 支柱漂移**；面板一旦变成"全屏数据墙"，玩家从"读赤壁棋局"退化成"读表格"，支柱③/②崩塌。

### 5.5 `disc` 封顶后的成长出路（经济曲线长尾）

- **现象**：玩家 efficiency 分支点满，`effective_disc=0.5`（封顶），后续 efficiency 投资**边际归零**（"再点也没用了"）。
- **判定/处理**：
  1. **封顶是设计意图**（§4.4）：防 disc 碾压心脏数值。封顶后 efficiency 分支**自然停止吸引投资**，玩家转向 magic/cognition——这是三分支互补设计的**自调节**（非 bug）。
  2. **UI 明示封顶**：技能树面板在 `effective_disc` 达 0.5 时，efficiency 分支高阶节点标"已达上限，继续投资无效"（冷光灰显），**防玩家误投**。
  3. **不在封顶后加"突破上限"付费项**：那会破坏 `rewrite-causality §4.3` 的经济防线。**封顶就是封顶**。
- **红线标注**：此条守**经济失衡**；"突破封顶"的氪金/付费设计是基线明确不做的（`charter` 范围：不做商城氪金）。

### 5.6 演出过频抢沉浸（双轨张力 · 对齐 `systems-index §5` 跨系统张力）

- **现象**：玩家连续多节点触发 `critical`，S3 频繁播长历史线分叉演出 + 世界线震荡 glitch，litRPG 爽感盖过赤壁正剧沉浸（支柱②反例）。
- **判定/处理**：
  1. **演出降级压缩**（§2.5）：连续 critical 时，后续 critical 演出缩短时长/合并旁白，避免疲劳。
  2. **震荡级联封顶联动**：与 `rewrite-causality §5.2` 的"震荡下游惩罚封顶 2-3 次"联动——演出频率也随震荡标记封顶。
  3. **可访问性开关**（X5 横切）：设置面板提供"演出时长偏好"（完整/精简），精简模式跳过长演出只留数值反馈——对重 Playtest 反馈"演出太长"的玩家友好。
- **红线标注**：此条守**支柱②正剧底色**；演出是 Loop A 情感峰值（`game-concept §5.2`），但峰值过频即非峰值。须 P4-1 UX + Playtest 校准节奏。

---

## 6. UI 接口（信号 / 事件契约，衔接 P4-1 UX 规格）

> 本系统**对内消费 S1/S2 信号、向 S1/S5 下发只读契约、向 S4/X1/P4-1 衔接**。下列是**设计侧的事件/信号契约**，落地用 Godot 信号（`AGENTS.md`「信号优先于全局单例滥用」）。**与 S1/S2 的信号逐条回引 `rewrite-causality §6.1/§7.1` 与 `mainline-quest §6.1/§6.2`，零新增冲突信号**；S3 自有信号（向 S1/S5/S4）单独列出，明确不与 S1↔S2 契约冲突。**Godot 信号精确签名标 `[待程基岩确认]`**。

### 6.1 S3 消费 S1 的信号（逐条回引 `rewrite-causality §6.1`，**零新增**）

| 信号（沿用 S1 命名） | 方向 | 载荷 | S3 响应 | 回引 |
|---|---|---|---|---|
| `cp_awarded(amount, node_id, reason)` | **S1 → S3** | CP_earned、节点、原因 | 查 S2 加成 → 算 `CP_credited` → `CP_balance +=` → 动效（§4.1） | `rewrite-causality §6.1` |
| `deviation_recomputed(node_id, delta_node, is_preview)` | **S1 → S3** | 节点、Δ、是否预览 | `is_preview=true`：HUD Δ 条实时跳；`false`：结算屏显示 | `rewrite-causality §6.1` |
| `intent_match_computed(node_id, m)` | **S1 → S3** | 节点、M | 结算屏显示 M | `rewrite-causality §6.1` |
| `feedback_tier(node_id, tier)` | **S1 → S3** | 节点、档位 I | 选演出量级（§2.5）→ 播对应 `timeline_*_scene` | `rewrite-causality §6.1` |
| `critical_deviation_triggered(node_id, delta_node)` | **S1 → S3** | 节点、Δ | 触发世界线震荡专属演出（橙红+glitch） | `rewrite-causality §6.1` |
| `blueprint_declared(node_id, blueprint_id)` | **S1 → S3**（S1 持有蓝图，经 S3 输入） | 节点、蓝图 | 改写面板高亮所选蓝图意图（§2.6） | `rewrite-causality §6.1` |

> ✅ **验收**：上表 6 个信号**与 `rewrite-causality §6.1` 完全一致，零新增、零改名**。

### 6.2 S3 消费 S2 的信号（逐条回引 `mainline-quest §6.2`，**零新增**）

| 信号（沿用 S2 命名） | 方向 | 载荷 | S3 响应 | 回引 |
|---|---|---|---|---|
| `quest_objective_updated(node_id, objective_short, objective_long)` | **S2 → S3** | 节点、短/长目标 | 任务面板/HUD 显示目标（§2.1 进阶层） | `mainline-quest §6.2` |
| `quest_progress_updated(chapter_id, p_ch)` | **S2 → S3** | 章节、进度 | 章节进度条显示 | `mainline-quest §6.2` |
| `quest_reward_declared(node_id, quest_reward_mult, quest_cp_flat_bonus)` | **S2 → S3** | 节点、加成参数 | 存供 §4.1 入账查用（或按 node_id 查 S2 数据，`mainline-quest §6.2` 注） | `mainline-quest §6.2` |
| `quest_node_vanished_voiced(node_id, system_vanish_voice)` | **S2 → S3** | 节点、消失文案 | UI 标记节点消失（移除目标显示） | `mainline-quest §6.2` |

> ✅ **验收**：上表 4 个信号**与 `mainline-quest §6.2` 完全一致，零新增**。`quest_reward_declared` 可由"S3 按 node_id 查 S2 数据"替代为数据查询（`mainline-quest §6.2` 注），两种方式都守"不新增冲突信号"。

### 6.3 S3 向 S1 / S5 下发的只读契约信号（**本系统自有，不与 S1↔S2 冲突**）

> 这些是 S3 在自己权责内（成长数值下发）发出的信号，**不在 S1↔S2 清单内，也不与之冲突**（S1↔S2 清单只管节点/数值契约；S3→S1 的 `ability_changed` 已在 `rewrite-causality §6.2` 预留为"S3 成长"来源）。本 GDD **具体化** `ability_changed` 的载荷形态。

| 信号（建议） | 方向 | 载荷 | 触发时机 | 消费方响应 |
|---|---|---|---|---|
| `ability_changed(ability_id, contract_key, value_delta)` | **S3 → S1/S5** | 能力 id、契约键、增量值 | 技能解锁（§4.3 grants[]） | S1：更新 `effective_disc`/`effective_blueprint_insight`；S5：更新 `effective_intel_gain_mult` |
| `ability_unlocked(ability_id)` | **S3 → S4/S1** | 能力 id（如 `ability_system_magic_wind`） | magic 分支技能解锁 | S4/S1：该校验 `requires.ability` 时放行（`rewrite-causality §3.5`） |
| `node_committed(node_id)` | **S3 → S1** | 节点 | 玩家在改写面板点"确认改写"（§2.6） | S1：进入锁定结算（`rewrite-causality §6.2`） |

> ⚠️ **`node_committed` 触发源澄清**（对齐 `mainline-quest §2.1` 注 / `rewrite-causality §6.2`）：本 GDD **确认**：**玩家经 S3 改写面板确认** → S3 发 `node_committed`（S3→S1，不经 S2）；S2 发 `node_committed` 仅用于任务级强制锁定；耗尽 `max_attempts` 由 S1 内部触发（不经 `node_committed`）。**本 GDD 不新增信号，仅确认 S3 是"玩家确认"的发出方**（回应 `mainline-quest §9②` 待审批）。

### 6.4 S3 向 X1 / P4-1 UX 的衔接信号

| 信号（建议） | 方向 | 载荷 | 触发时机 | 消费方 |
|---|---|---|---|---|
| `timeline_branch_play(tier, node_id, scene_ref)` | **S3 → X1** | 档位、节点、演出场景引用 | `feedback_tier` notable/critical 时（§2.5） | **X1**（叠加旁白配音/字幕） |
| `cp_balance_changed(new_balance, delta)` | **S3 → HUD** | 新余额、增量 | 入账/消耗后 | HUD（CP 数值动效） |
| `skill_unlocked_toast(skill_id, display_name)` | **S3 → HUD/X1** | 技能、显示名 | 技能解锁（§4.3） | HUD（冷光提示）+ X1（可选旁白） |

### 6.5 与 P4-1 UX 规格的衔接点（给文策渊 Phase 4 自己）

> 本节是给未来 P4-1（关键屏幕 UX 规格）的**输入清单**，定义"系统面板"各 Tab 须呈现的信息：

- **核心 HUD**（极简，`art-bible §6.2`）：HP（S4 只读）+ CP 余额 + 当前节点名 + Δ 指示条 + RE 条。贴边冷光，不挡世界。
- **系统面板 · 偏差 Tab**：当前节点 `Δ_node`/`M`/`I`；历史结算记录（读 S1 resolved）；世界线震荡标记。
- **系统面板 · 技能树 Tab**：三分支冷光节点连线图；已解锁/可解锁/锁定三态；节点 hover 显 `cost_skill` + `grants[]` 预览；**无最优路径引导**（§5.4）。
- **系统面板 · 兑换 Tab**：RE 补充项（显 `cost_re_refill` 递增预览 + 本节点已兑次数）；目标态扩展位。
- **系统面板 · 情报 Tab**：`effective_intel_gain_mult`/`effective_blueprint_insight` 当前值；情报强化可购项。
- **系统面板 · 任务 Tab**（读 S2）：章节进度条 + 当前节点目标 + 因果链预览（`mainline-quest §2.4`）。
- **改写面板**（节点激活时叠层，`rewrite-causality §6.3`）：蓝图列表 + 动词 + Δ 预览 + 确认按钮（§2.6）。
- ⚠️ **信息密度分级**（§2.1）：5 Tab 分页，核心常驻，隐藏折叠。对齐 `art-bible §6.3` 可访问性（≥150% 缩放可读）。

---

## 7. 依赖（与 S1/S2/S5/X1/X4/P4-1 的边界与数据流）

> 边界以 `systems-index §2` 为准；本节做**面板/成长视角的交叉确认**，尤其落实 `systems-index §3.3` 的反向耦合（成长→改写更强）与 CP 两段式。

### 7.1 与 S1 改写/因果引擎（P2-2 · 已完成）

- **S1 → S3**：`cp_awarded`/`deviation_recomputed`/`intent_match_computed`/`feedback_tier`/`critical_deviation_triggered`/`blueprint_declared`（`rewrite-causality §6.1`）。
- **S3 → S1**：`ability_changed`（下发 `disc`/`blueprint_insight` 只读契约，§6.3）、`ability_unlocked`（magic 能力解锁，供 `requires.ability` 校验）、`node_committed`（玩家确认锁定，§6.3）。
- **边界 1（CP 两段式，`systems-index §6`）**：**产出归 S1（`rewrite-causality §4.2`），账户/兑换归 S3**。S3 经 `cp_awarded` 收 `CP_earned`，应用 S2 加成得 `CP_credited` 入账；**S3 绝不反向改 `CP_earned`，S1 不持有余额**。
- **边界 2（反向耦合确认，`systems-index §3.3` + `rewrite-causality §7.2`）**：成长使 `disc↑` → 改写消耗↓ → 玩家更强。已通过"`disc` 作为 S3 暴露的**只读契约**、S1 读取（非控制反转）+ 封顶 0.5 双保险"解耦，**仍是 DAG 边 S1←S3 的数据契约，无环**。**本 GDD 的 `effective_disc` 聚合（§4.4）+ `ability_changed` 下发（§6.3）即该解耦的 S3 侧落地，✅ 与 `rewrite-causality §7.2` 已确认的口径一致。**
- **引用**：`rewrite-causality §4.2`（CP 产出）、§4.3（disc 封顶/RE 再生）、§4.4（I 档位）、§6.1（S1→S3 信号）、§6.2（S3→S1 信号）、§7.2（反向耦合）。

### 7.2 与 S2 主线任务系统（P2-3 · 已完成）

- **S2 → S3**：`quest_objective_updated`/`quest_progress_updated`/`quest_reward_declared`/`quest_node_vanished_voiced`（`mainline-quest §6.2`）。
- **S3 → S2**：（无直接；玩家经 S3 改写面板确认 → S3 发 `node_committed`（S3→S1，不经 S2，§6.3））。
- **边界（CP 加成应用方，`mainline-quest §4.1/§9③`）**：**本 GDD 确认：S2 加成在 S3 账户侧应用**（§4.1）。S3 按 `node_id` 查 S2 章节数据取 `quest_reward_mult`/`quest_cp_flat_bonus`，算 `CP_credited` 入账，**不触碰 S1 §4.2 产出公式**。这**回应并采纳** `mainline-quest §9③` 的待审批建议。
- **边界（任务目标显示）**：S2 产文案数据，S3 产 UI 表现（`art-bible §6`）。任务 Tab 读 S2 文案（§6.5）。
- **引用**：`mainline-quest §4.1`（CP 加成）、§6.2（S2→S3 信号）、§9③（加成应用方待审批——本 GDD 已回应）。

### 7.3 与 S5 开放世界/朝代地图（P2-6 · 未开始）

- **S3 → S5**：`ability_changed(intel_gain_mult_delta)`（情报采集乘子只读契约，§4.5）。
- **S5 → S3**：（无直接；S5 产情报 → S1 降 `diff`/解锁蓝图，`rewrite-causality §7.4`，不经 S3；HP/资源状态归 S4，S3 只读显示）。
- **边界（情报采集 vs 情报强化）**：**情报采集归 S5**（情报点/形态/产出），**情报强化归 S3**（采集乘子元升级）。S5 应用 `effective_intel_gain_mult` 到其采集量，**S5 仍决定"情报从哪来"**（`systems-index §6` 情报行）。**S3 不创造情报**，只放大采集。
- **引用**：`systems-index §2` S5 行、§6 情报行、`rewrite-causality §7.4`（S5→S1 情报）。

### 7.4 与 S4 实时战斗系统（P2-5 · 未开始）

- **S3 → S4**：`ability_unlocked(ability_id)`（magic 分支解锁战斗术法，§6.3）。
- **S4 → S3**：HP/资源状态只读（S3 HUD 显示，`systems-index §6` 玩家战斗状态行）。
- **边界（能力解锁 vs 战斗执行，`systems-index §6` 玩家能力技能行）**：**解锁/数值归 S3，执行归 S4**。S3 解锁 `ability_system_magic_wind` 等，S4 在战斗中执行术法（伤害/命中归 S4）；S1 改写动词 `requires.ability` 校验读 S3 解锁集（`rewrite-causality §3.5`）。**S3 不算伤害、不执行术法**。
- **引用**：`systems-index §6` 玩家能力技能行、玩家战斗状态行。

### 7.5 与 X1 系统叙事层（横切）

- **S3 → X1**：`timeline_branch_play`（演出场景引用，§6.4）+ 面板静态文案数据（§3.5）。
- **X1 → S3**：（无；X1 只消费 S3 演出资产做旁白表现）。
- **边界（资产 vs 旁白，§1.4）**：**演出视觉资产/脚本归 S3，旁白配音/字幕归 X1**。X1 可润色语气，不改数值/标签语义。系统人格基调待审批（`game-concept §9①`），S3 文案按"冷峻记录员"倾向撰写，留接口。
- **引用**：`systems-index §1.2` X1 行、§6「系统人格」行、`mainline-quest §6.3`（X1 衔接）、`art-bible §6.1`（系统材质）。

### 7.6 与 X4 存档（横切）

- **S3 声明的持久态**：`save_state_panel_progression`（§3.3）——CP 余额/已购技能/RE 兑换计数。
- **跨系统一致性**：S3 `cp_credited_total` == S1 历次 `cp_awarded`（经 S2 加成）之和（§3.3/§5.4）。X4 须把 S1 `resolved_nodes` 与 S3 账户**原子写入**。
- **引用**：`systems-index §1.2` X4 行、`rewrite-causality §3.6`（S1 存档）、`mainline-quest §3.3/§5.5`（S2 存档账本一致性）。

### 7.7 与 P4-1 UX 规格（Phase 4）

- **S3 → P4-1**：§6.5 的面板各 Tab 信息清单是 P4-1「系统面板」UX 规格的直接输入。
- **P4-1 → S3**：UX 线框/流程定稿后反哺面板信息密度分级（§2.1）与演出节奏（§5.6）。
- **引用**：`art-bible §6`（系统材质/界面视觉）、§3.3（信息焦点）。

### 7.8 引用的前置文档（一致性锚）

- `game-concept.md`：§1 术语（系统/CP/Δ）、§2 支柱（②主/①③次）、§3.1 系统动词、§5 核心循环 Loop A（反馈/成长环）、§5.2 反馈驱动成长、§5.4 防主导策略、§7 范围（MVP 面板最小集）、§9 待审批（①人格/③奖励曲线）。
- `systems-index.md`：§2 S3 边界、§3 依赖 DAG（S3←S1/S2，反向耦合 S3→S1）、§4 Loop A 映射（反馈行）、§5 支柱对齐（S3 行漂移红线）、§6 横切实体归属（CP 两段式/历史线两段式/玩家能力技能/情报/系统人格）、§8 认知过载红线。
- `rewrite-causality.md`：§0 符号、§2.7/§2.8 偏差呈现与反馈钩子、§3.3 蓝图、§3.5 动词 requires.ability、§4.2 CP 产出、§4.3 RE/disc、§4.4 I 档位、§6.1/§6.2 信号清单、§7.2 反向耦合确认。
- `mainline-quest.md`：§4.1 CP 加成（应用方）、§6.2 S2→S3 信号、§2.1 注/§9② node_committed 触发源。
- `art-bible.md`：§0 双轨、§2.5 Δ 视觉三档、§3.3 信息焦点、§6.1/§6.2/§6.3/§6.4 系统材质与界面、§9 命名空间。
- `project-charter.md`：核心循环 Loop A 措辞、范围（垂直切片严守，不做商城氪金）。

---

## 8. 验收标准（可逐条勾选）

> 对照 issue 验收要点 + `team/design-strategist.md` 输出规范（八节齐全 / 公式标变量单位 / ≥3 类边缘情况）。

- [ ] **八节齐全**：概述(§1) / 机制(§2) / 数据(§3) / 公式(§4) / 边缘情况(§5) / UI 接口(§6) / 依赖(§7) / 验收标准(§8)，缺一不可。✅
- [ ] **公式统一格式、标变量与单位**：§0 符号表（含 S1/S2 沿用符号 + S3 新增符号分列）+ §4 七条公式均给式/变量/单位/域/归属，§4.7 速查表。✅
- [ ] **≥3 类边缘情况**：§5 给 6 类（CP 通胀通缩/技能洗点/情报强化与 S5/S1 冲突/面板认知过载/disc 封顶后出路/演出过频抢沉浸）。✅
- [ ] **CP 总量口径与 S1/S2 自洽**：§4.1 入账公式 = `mainline-quest §4.1` 的 `CP_credited`（应用归 S3）；产出全来自 S1 `rewrite-causality §4.2`，加成全来自 S2；**本系统不另立产出源**（§0/§4.1 防红线）。✅
- [ ] **与 S1/S2 信号契约逐条对齐、零新增冲突**：§6.1（S1→S3，6 条回引 `rewrite-causality §6.1`）、§6.2（S2→S3，4 条回引 `mainline-quest §6.2`）零新增；§6.3 S3 自有信号（`ability_changed`/`ability_unlocked`/`node_committed`）明确不与 S1↔S2 清单冲突，且 `ability_changed`/`node_committed` 在 S1/S2 GDD 中已预留来源。✅
- [ ] **CP 两段式边界正确**：产出(S1)/加成参数(S2)/账户兑换(S3)三段分离，§4.1/§7.1/§7.2 明确接口；S3 绝不反向改 CP_earned、不持产出源。✅
- [ ] **反向耦合（disc）已确认解耦**：§4.4 disc 聚合 + 封顶 0.5 + §6.3 `ability_changed` 只读下发，与 `rewrite-causality §7.2` 口径一致；§7.1 交叉确认 ✅。✅
- [ ] **设计理论红线已标注**：主导策略（§2.2 三分支跨环互补 + §4.3 几何成本 + §5.2 respec 代价）、经济失衡（§4.2 跨章节诊断/§4.6 RE 递增/§5.1 通胀通缩/§5.5 封顶）、认知过载（§2.1 三层分级/§5.4）、支柱漂移（§1.1/§5.4 面板不喧宾夺主/§5.6 演出节制）逐项标注并给缓解。✅
- [ ] **与 game-concept / systems-index / 前置 GDD 一致且显式引用**：§0/§1/§7 多处显式引用节号，术语逐字沿用（Δ/CP/v_i/改写节点/因果链/系统/Loop A），支柱名可追溯（②主）。✅
- [ ] **不脱离引擎能力**：数据驱动落 `game/data/panel/*`、`game/data/progression/*`（§3），引擎精确 API/资源类名一律标 `[待程基岩确认]`，未臆造。✅
- [ ] **朝代热切换留口**：§3.6 技能/面板数据带 `dynasty` 命名空间，公式朝代无关，多朝代独立技能树列为愿景（本切片不做），未越垂直切片。✅
- [ ] **待审批项显式标注**：§2.3（RE 再生方案）、§2.4（蓝图方案沿用 S1 待审批）、§4.2（经济目标区间）、§4.3（growth 值）、§4.6（RE 定价）、§5.2（respec）、§6.3（node_committed 触发源）、§3.6（跨朝代技能树）均标 `[待审批]`/`[提议方案，待主创审批]`/`[待程基岩确认]`/`[待与 S1/S2 联合确认]`，不擅自定稿。✅
- [ ] **状态标记**：文档头 v0.1（首版，待主创评审）/ 状态：可评审；提案性数值标【提议方案，待主创审批】。✅

---

## 9. 待主创审批项（发现设计张力，不擅自定稿）

> 沿用并细化 `game-concept §9` / `systems-index §10` / `rewrite-causality §9` / `mainline-quest §9` 中影响**本系统数值结构**的待定项。

1. **【CP 加成应用方】S3 账户侧 vs S1 产出侧？（§4.1 / §7.2）**
   - 来源：`mainline-quest §9③`。**本 GDD 采纳 S2 建议：S3 账户侧应用**（不触碰 S1 §4.2 产出公式）。请主创确认；若倾向 S1 侧应用，须同步扩展 `rewrite-causality §4.2`，**须 S1/S2/S3 三方联合确认**。
2. **【RE 再生曲线】按节点重置 + CP 兑换 + 营寨补充 vs 纯按节点重置？（§2.3 / §4.6）**
   - 来源：`rewrite-causality §4.3`【待审批】。本 GDD 给"按节点重置 + CP 兑换 + 营寨休整（目标态）"倾向方案，**不做时间挂机**。须与 S1 联合确认；若主创倾向"纯按节点重置、删 CP 兑换出口"，§4.6 与 §2.3 需同步调整。
3. **【技能成本递增系数 growth】1.5 是否拍板？（§4.3）**
   - 直接决定主导策略防线强度。1.3 偏平、1.7 偏陡。倾向 1.5，须 P5/P6 Playtest 校准。
4. **【技能点 respec】MVP 不做、目标态有代价 respec？（§5.2）**
   - 倾向 MVP 不做、目标态"退技能返 50% CP + 封顶次数"。绝不免费全额。请主创确认是否进目标态。
5. **【`node_committed` 触发源路由】S3 确认归属？（§6.3 / §7.2）**
   - 来源：`mainline-quest §9②`。本 GDD **确认**：玩家经 S3 改写面板确认 → S3 发 `node_committed`（S3→S1）。请主创/P3 架构与 S1/S2 联合盖章。
6. **【系统人格基调】沿用 `game-concept §9①`（§1.4 / §3.5）**
   - S3 面板文案按"冷峻记录员/记账员"倾向撰写（如「因果点已入账」「能力已校准」），留接口待定稿。与 S2 文案同口径。
7. **【跨朝代技能树】每朝代独立树 vs 穿越者通用树？（§3.6）**
   - 愿景项。倾向穿越者通用树（成长是本体属性），但 `skill_tree.tres` 的 `dynasty` 字段已为多树铺路。本切片不做。

---

## 10. 已知风险与取舍

1. **经济曲线未平衡**（§4 全部默认值）：`growth=1.5`/`cap_disc=0.5`/`cost_re_refill` 递增/经济目标区间均为首版倾向值，须 P5/P6 Playtest（严守真）迭代，本 GDD 不给"已平衡"承诺。诊断框架（§4.2）是给 QA 的工具。
2. **CP 兑换出口单薄**（§2.3）：MVP 仅 RE 补充一项。若 Playtest 显示"CP 闲置花不出"（通缩），需新增出口（目标态：情报条目直购/消耗道具）——但须守"不与 S5 采集冲突""基线无道具系统"（`charter` 范围）。
3. **反向耦合的长尾风险**（§4.4/§7.1）：即便 disc 封顶 0.5，后期玩家若 efficiency+cognition 双满，改写"又省又看得见蓝图"，可能让心脏难度感下降——靠 `max_attempts` 封顶（`rewrite-causality §5.1`）+ Δ_critical 震荡（`rewrite-causality §4.5`）+ 节点 diff_base 手调（S1）多层兜底，须 Playtest 监控。
4. **只读契约同步依赖消费方**（§5.3）：S3 下发 `ability_changed` 后，S1/S5 必须接收应用。若 P3 事件路由设计有遗漏，成长"看似生效实则没用"。建议 P3 加断言校验。
5. **面板与正剧的双轨张力**（§5.6）：litRPG 冷光面板/演出过强会抢赤壁正剧沉浸（`systems-index §5` 跨系统张力）——靠 §2.1 信息分级 + §5.6 演出降级 + `art-bible §6.1` 半透明约束缓解，须 P4-1 UX + Playtest 校准（与 `rewrite-causality §10` 同源风险）。
6. **跨系统存档一致性**（§3.3/§5.4）：S3 `cp_credited_total` 与 S1 `cp_awarded` 之和对账须 X4 原子写入，工程有要求，须程基岩 P3 存档设计对齐（与 `rewrite-causality §10`/`mainline-quest §10` 同源风险）。

---

## 11. 下一步建议（给主理人 · 游承峰）

1. **本 issue（P2-4）完成后**，请主创优先审批 **§9 第 1、2 项**（CP 加成应用方 / RE 再生曲线）——前者回应 `mainline-quest §9③`，后者回应 `rewrite-causality §4.3`，二者影响 P3 架构的事件路由与 S1/S3 经济接口设计。
2. **立即可派 P4-1（关键屏幕 UX 规格）**：本 GDD §6.5 已给出系统面板各 Tab 的信息清单 + §2.1 三层信息分级 + 改写面板契约（沿用 `rewrite-causality §6.3`），P4-1 据此做线框/流程即可（`systems-index §7` P4-1 顺序）。
3. **给程基岩（P3-1 架构）**：§3 数据契约（`panel/*`/`progression/*`）+ §6 信号契约 + §7 DAG 可直接作为系统边界与数据归属输入；§3.3 `save_state_panel_progression` + §5.4 对账恒等式是存档需求清单（与 `rewrite-causality §3.6`/`mainline-quest §3.3` 合并设计）。建议 P3-1 与本文 + S1/S2 交叉引用，在 ADR 中确认 `.tres` 资源类设计 + `ability_changed` 事件路由 + `node_committed` 触发源（回应 `mainline-quest §11`）。
4. **给严守真（QA）**：§4.2 经济诊断恒等式（`CP_balance == CP_credited_total − CP_spent_total`）+ §5.3 只读契约同步校验 + §8 验收项是 QA 清单雏形，建议 P5/P6 转为可执行断言（如"读档后 cp_credited_total == Σ(cp_awarded×quest_reward_mult)+Σ(flat_bonus)"自动对账）。
5. **跨 GDD 一致性已对齐**：本 GDD 与 `rewrite-causality §6.1/§6.2/§7.1`、`mainline-quest §4.1/§6.1/§6.2` 信号/CP 口径**逐条核对零冲突**（开写前已 grep 校验）；§9 第 1、5 项是对前置 GDD 待审批项的**正面回应**（采纳/确认），非新增张力。

---

*—— 文策渊（design-strategist）· Phase 2 系统设计（P2-4 · S3 面板/成长系统）· 待主创评审*
