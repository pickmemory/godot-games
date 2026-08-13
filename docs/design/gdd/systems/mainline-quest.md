# 主线任务系统 GDD · 《赤壁·改写者》

> 阶段：Phase 2 · 系统设计（P2-3，S2）　|　执行角色：文策渊（design-strategist）
> 文档版本：v0.1（首版，待主创评审）　|　状态：可评审
> 基线锚点：`AGENTS.md`「设计基线」表、`docs/project-charter.md`「核心循环 Loop A」、`docs/roadmap.md` P2-3。
> 设计依赖（**显式引用**，本 GDD 与之保持一致，不另立术语/信号）：
> - `docs/design/gdd/game-concept.md`（P1-1）——**术语 §1、设计支柱 §2、核心循环 §5、三节点最小可工作样例 §6、范围分层 §7、待审批 §9**。本文凡引用写作 `game-concept §x`。
> - `docs/design/gdd/systems-index.md`（P2-1）——**S2 行 §2、依赖 DAG §3、Loop A 映射 §4、支柱对齐 §5、横切实体归属 §6（CP 两段式、节点「数据模型归 S1 / 生命周期归 S2」）、撰写顺序 §7**。本文凡引用写作 `systems-index §x`。
> - `docs/design/gdd/systems/rewrite-causality.md`（P2-2，✅已完成）——**§0 符号、§2.3 节点状态机（S2 生命周期态 / S1 内部数值态）、§3.4 存在性依赖规则数据、§7.1 与 S2 的边界与信号清单**。本文凡引用写作 `rewrite-causality §x`。
> - `docs/design/art/art-bible.md`（P1-2）——**§0 双轨反差、§6.1 系统材质、§6.2 关键界面视觉、§9 命名空间（`dyn_threekingdoms_chibi`）**。本文凡引用写作 `art-bible §x`。
> 本系统边界以 `systems-index §2`（S2 行）为准；术语以 `game-concept §1` 为准；与 S1 的信号契约**严格对齐 `rewrite-causality §7.1`，不新增冲突信号**。本文件是主线任务系统的**完整八节 GDD**，是核心循环 Loop A「任务→探索」的**起点**（`systems-index §4`）。

---

## 0. 公式符号与单位约定（全篇统一）

> 为杜绝跨文档/跨公式符号漂移，本节定义本 GDD 用的符号、单位与取值域。**第 4 节所有公式均回引本表符号**，不另造。与 S1 共享的符号（`Δ_node`/`CP`/`v_i` 等）**沿用 `rewrite-causality §0` 定义，本表不重定义**，仅列本系统新增符号。

| 符号 | 含义 | 单位 | 取值域 / 类型 | 来源 |
|---|---|---|---|---|
| `lifecycle_state` | 改写节点**生命周期态**（S2 所有） | 枚举 | {`未激活`, `可改写`, `执行中`, `已确认`, `已消失`} | S2 运行时（见 §2.1） |
| `P_ch` | 章节进度（已确认节点加权占比） | 无量纲 | [0, 1] | §4.3 |
| `w_node` | 节点在章节进度中的权重 | 无量纲 | [0, 1]，章节内 `Σw_node = 1.0` | 章节数据 |
| `quest_reward_mult` | 任务奖励 CP 倍率（S2「加成接口」参数） | 无量纲 | [1.0, 2.0]，默认 1.0 | 节点数据（S2 拥有） |
| `quest_cp_flat_bonus` | 任务完成固定 CP 奖励（S2「加成接口」参数） | 点 | ≥ 0 整数，默认 0 | 节点数据（S2 拥有） |
| `CP_earned` | S1 产出的因果点（**只读引用，不重定义**） | 点 | ≥ 0 整数 | `rewrite-causality §4.2` |
| `CP_credited` | 实际入账因果点（含 S2 加成，由 S3 入账） | 点 | ≥ 0 整数 | §4.1 |
| `condition_met` | 存在性依赖条件是否满足 | 布尔 | true / false | `causal_link_propagated` 载荷（S1 发） |
| `T_dispatch` | 节点派发时机策略 | 枚举 | {`on_chapter_enter`, `on_predecessor_resolved`, `on_player_reach`} | 节点数据 |
| `chapter_id` / `node_id` / `dynasty` | 标识符 | 字符串 | `snake_case`，朝代命名空间 `dyn_threekingdoms_chibi` | `art-bible §9.1` |

**命名 / 数据约定**：所有落到 `game/data/quests/*.tres|*.json` 的字段、ID 一律 `snake_case`；朝代命名空间固定 `dyn_threekingdoms_chibi`（与 `art-bible §9.1` 一致），多朝代扩展换命名空间即可（见 §3.7 热切换口）。**存疑的引擎精确实现一律标 `[待程基岩确认]`，本文不臆造 Godot API**。

> ⚠️ **本系统只定义节点的「生命周期态」，绝不复述 S1 的「内部数值态」**（`v_i`/`Δ_node`/`M`/`CP_earned`/`attempts_used` 等内部数值态的所有权与定义见 `rewrite-causality §0/§2.3/§3`）。本系统凡需引用这些量，一律**只读引用**，并显式标注来源节号。

---

## 1. 概述

### 1.1 系统定位

主线任务系统是核心循环 Loop A 的**「任务」环**——循环的**起点**（`systems-index §4` 映射表、「任务」行；`game-concept §5.1` 图①）。它以「系统」人格（`game-concept §1` 术语「系统」）向玩家**派发**改写节点，给玩家**目标与上下文**，管理节点**生命周期**，并据改写引擎（S1）算出的**因果链**决定**下游节点是否存在、何时到来**——从而把抽象的因果数值编排成玩家可接、可做、可读懂的主线。

- **它管什么**（边界以 `systems-index §2` S2 行为准）：改写节点的**派发时机与顺序**；节点的**生命周期状态机**（`未激活/可改写/执行中/已确认/已消失`，§2.1）；**存在性依赖的派发决策**（规则数据归 S1、**决策归 S2**，§2.3）；**任务目标文案与「系统」派单语气**；**主线章节编排**（顺序/分支/收敛，§2.2）。
- **它不管什么**：节点内部 `v_i` 怎么算 Δ（→ S1，`rewrite-causality §2.6`）；任务目标的**地理布置与触发器**（→ S5，`systems-index §2` S5 行）；完成后的**成长发放**（→ S3，CP 账户/兑换归 S3，`systems-index §6`）；旁白/演出的**表现层**（→ X1/S3）。
- **它不是**：不是开放世界问号清单（守 `game-concept §2` 支柱③反例「线性任务传送门」）；不是数值计算引擎（心脏是 S1）。

### 1.2 「系统」人格触点（与 X1 叙事层的分工）

「系统」（`game-concept §1`）在 S2 的角色是**派单者/任务发布者**。本系统与横切叙事层 X1（`systems-index §1.2` X1 行）分工如下，**严格守住「文本归属」与「表现归属」两段式**：

| 归属方 | 职责 | 落点 |
|---|---|---|
| **S2（文本归属）** | 撰写并持有「系统」**派单文案**：节点开场白、任务目标措辞、意图标签、派单/完成/消失的系统语气。这些是**数据**（§3.4 `system_dispatch_voice` / `objective_text`）。 | `game/data/quests/*.tres` |
| **X1（表现归属）** | 把 S2 的文案**以「冷峻记录员」旁白演出出来**：配音/字幕样式/出场动效/节奏；以及 Loop A 反馈环的 Δ 旁白、历史线分叉旁白（`game-concept §9①` 待审批）。 | X1 运行时（`systems-index §6`「系统人格」行） |

> ⚠️ **边界红线**：S2 **只产文案字符串与触发时机**，不做旁白的语音/演出表现（那是 X1）；X1 **不擅自改写 S2 的任务文案语义**（可加语气润色，不改目标/意图）。两者经「信号」协同（§6），不共享可变全局态（`systems-index §3.3`）。**系统人格基调本身待主创审批**（`game-concept §9①`），本系统按「冷峻第三方观测者/记录员」倾向撰写，留接口待定稿。

### 1.3 玩家动词（本系统对玩家暴露的动词）

本系统是 Loop A 的**起点**，对玩家暴露的是**任务管理类**动词（区别于 `game-concept §3.1` 的改写/战斗/探索动词，那些在下游环）：

| 动词 | 作用 | 触发 | 备注 |
|---|---|---|---|
| **查看任务目标** | 打开任务面板读当前节点目标/上下文 | 玩家主动 | UI 归 S3 表现（`art-bible §6.2`），数据归 S2 |
| **追踪任务** | 在 HUD 锁定一个主线节点为当前追踪 | 玩家主动 | 主线同一时刻**仅 1 个可改写节点**（§2.1），追踪即指向它 |
| **（隐式）接受派单** | 系统派发即视为接受（**MVP 不做"拒绝任务"**） | 系统自动 | 守 `game-concept §7.1` MVP 收窄；目标态可加"暂搁" |
| **确认改写 / 放弃** | 经 S3 改写面板触发锁定（→ `node_committed`，§6） | 玩家经 S3 | **S2 不直接持有"确认"按钮**，按钮归 S3 改写面板（`rewrite-causality §2.1③⑦`） |

> 📌 **设计意图**：S2 对玩家的"动词面"刻意**薄**——玩家感知到的是"系统派了任务 → 我去探索改写"，而不是繁琐的任务管理。任务管理的复杂度藏在 S2 内部（生命周期/章节编排），对玩家**不可见**（守 `systems-index §8` 认知过载红线）。

### 1.4 与核心循环 Loop A 的接口

本系统承担 Loop A 的**「任务」**环（`systems-index §4`），是循环的输入端与因果回灌端：

```
【S2 主线任务】 ──①派发改写节点(目标+上下文+派单语气)──▶ ②探索(S5) / 改写(S1) …
      ▲                                                                        │
      │                                                                ④因果链/节点存在性回灌
      └──────────── ③S1 反馈结算后：causal_link_propagated / node_resolved / node_vanished ──┘
                         （S2 据此决定下游节点派发/消失/章节推进）
```

- **出（→ 下游环）**：①派发信号 `node_activated(node_id)`（→ S1 初始化节点 + S3/S5 更新目标），随派发携带任务目标文案（→ S3 显示）、目标场所引用（→ S5 布置触发器）。
- **入（← 反馈环）**：③接收 S1 的 `node_resolved`（节点已确认 → 推进章节）、`causal_link_propagated`（含 existence 型 → S2 做下游派发/消失**决策**）、`node_vanished`（节点消失回告 → S2 更新生命周期账本）。信号清单逐条见 §6.1，**与 `rewrite-causality §7.1` 严格一致，不新增冲突信号**。

---

## 2. 机制

### 2.1 改写节点生命周期状态机（核心 · 与 S1 §7.1 信号逐条对齐）

> 这是本系统的**心脏**。节点的**生命周期态**所有权在 S2（`systems-index §2` S2 行、`systems-index §6`「改写节点」行：生命周期/派发归 S2）；节点的**内部数值态**（`v_i`/`Δ_node`/`M`/`CP_earned`/`attempts_used`）所有权在 S1（`rewrite-causality §2.3`）。**本系统只定义生命周期态，绝不复述内部数值态。**

**生命周期态（5 态，沿用 `rewrite-causality §2.3` 表左列的 S2 列）**：

| 态 | 含义 | 进入条件（触发信号） | S2 对外动作 |
|---|---|---|---|
| `未激活` | 节点尚未被派发，不在玩家任务列表 | 初始态 / 章节加载默认 | 无（不向 S1 持有数据，`rewrite-causality §2.3`） |
| `可改写` | S2 已派发，S1 已置 `v_i=baseline`，玩家可介入 | S2 判定派发条件满足（§2.5）后**发出 `node_activated(node_id)`（S2→S1）** | 派任务目标给 S3、目标场所给 S5、派单文案给 X1 |
| `执行中` | 玩家正在改写（`v_i` 随改写单元变化，未锁定） | 玩家开始改写（S1 进入内部「执行中」数值态，`rewrite-causality §2.3`） | HUD 追踪实时 Δ 预览（数据由 S1 经 `deviation_recomputed(is_preview=true)` 发，S3 显示，`rewrite-causality §6.1`） |
| `已确认` | 玩家确认锁定 / 耗尽 `max_attempts`，S1 已结算 | S1 发 `node_resolved(node_id, final_vars, delta_node, cp_earned)`（S1→S2） | 推进章节进度（§4.3）、据因果链决策下游（§2.3）、播完成旁白（X1） |
| `已消失` | 存在性依赖不满足，节点不会到来 | S1 发 `node_vanished(node_id)`（S1→S2，§2.3/§6.1）；S2 更新账本并决策是否派**替代节点** | 标记账本、通知 S3/S5 移除目标与场所、决策替代节点（§2.3，目标态） |

**状态转移图（ASCII，标注触发信号 + 方向，与 `rewrite-causality §7.1` 信号清单逐条对齐）**：

```
                         [章节加载]
                             │
                             ▼
                        ┌────────┐
              ┌────────▶│ 未激活  │
              │         └────┬───┘
              │   ①派发条件满足→S2 发 node_activated (S2→S1, rewrite-causality §7.1)
              │              │
              │              ▼
              │         ┌────────┐  玩家开始改写(S1 内部数值态→执行中)   ┌────────┐
              │         │ 可改写  │ ────────────────────────────────────▶│ 执行中  │
              │         └────────┘                                       └────┬───┘
              │              ▲                                                │
              │              │ ③S1 发 node_resolved (S1→S2) ◀──玩家确认(S3发node_committed)/耗尽max_attempts──┘
              │              ▼
              │         ┌────────┐
              │         │ 已确认  │ ──④S1 发 causal_link_propagated (S1→S2, 可能含 type=existence)
              │         └────┬───┘     └─S2 据此决策下游节点派发/消失 (派发决策归 S2)
              │              │
              │   (下游节点) │ 或 (本节点为章末)→章节推进
              │              ▼
              │      下一节点回 未激活→可改写（或）…
              │
              │   ②存在性不满足→S1 发 node_vanished (S1→S2)──┐
              │                                              ▼
              └────────────────────────────────────── ┌────────┐
                                                         │ 已消失  │ ──S2 决策是否派替代节点(目标态)
                                                         └────────┘
```

**与 S1 §7.1 信号契约逐条对齐表**（验收点：不新增冲突信号）：

| 信号（沿用 S1 命名） | 方向 | 触发 S2 的动作 | S1 侧对应（`rewrite-causality`） |
|---|---|---|---|
| `node_activated(node_id)` | **S2 → S1** | S2 决定派发时发出 | §6.2「S1 接收」：初始化 `v_i=baseline`，进入可改写 |
| `node_committed(node_id)` | **S2 → S1**（或 S3→S1 经由，见注） | S2 任务级强制锁定 / 玩家经任务界面确认时发出 | §6.2：进入锁定结算（§2.1⑦⑧） |
| `node_resolved(node_id, final_vars, delta_node, cp_earned)` | **S1 → S2** | S2 置 `已确认`、推进章节、读 `cp_earned`（只读）用于奖励加成（§4.1） | §6.1：锁定时发 |
| `causal_link_propagated(link_id, source_node, resolved_value, target)` | **S1 → S2** | S2 读 `target` + `type`：若 `type=existence`，S2 做**派发决策**（§2.3） | §6.1：节点锁定后发 |
| `node_vanished(node_id)` | **S1 → S2** | S2 置 `已消失`、更新账本、决策替代节点 | §6.1：存在性不满足时发 |

> ⚠️ **关于 `node_committed` 触发源的说明 [待与 S1/S3 联合确认]**：`rewrite-causality §6.2` 把 `node_committed` 的来源标为「S3（玩家点确认改写）/ S2（耗尽 attempts）」。但 `attempts_used` 由 S1 持有（`rewrite-causality §3.6`），「耗尽 attempts」更自然是 S1 内部触发。**本 GDD 的立场**：S2 发 `node_committed` 仅用于 **S2 任务级强制锁定**（如任务超时、玩家主动「锁定此节点」）；「玩家经 S3 改写面板确认」由 S3 发 `node_committed`（S3→S1，不经 S2）；「耗尽 max_attempts」由 S1 内部检测并直接进入结算（不经 `node_committed`）。最终触发源路由由 P3 架构与 S1/S3 联合确认，本 GDD 不擅自定稿，仅声明「S2 拥有任务级 commit 的发出权」。

### 2.2 主线章节编排（顺序 / 分支 / 收敛）

> 落地 `game-concept §6` 三节点最小可工作样例与 `game-concept §7.2` 目标态「3 节点串成赤壁主线」。**因果链限定在 3 节点最小链**（`rewrite-causality §2.5`），不做复杂因果网（`game-concept §7.4`）。

**章节（Chapter）= 一个朝代舞台内、有序排列的改写节点集合 + 分支/收敛规则。** 赤壁垂直切片只有 **1 个章节**（`ch_chibi_war`），含 3 个节点 + 1 个可能的替代节点 + 1 个章节收敛点：

```
章节 ch_chibi_war（dyn_threekingdoms_chibi）
   │
   ▼
 N1 连环计（链首，无存在性依赖）
   │  因果链: v_boat ──value──▶ N2 火攻威力输入；──difficulty──▶ N2 diff_base
   ▼
 N2 借东风（链中，无存在性依赖）
   │  因果链: fire_power ──existence──▶ N3 是否存在（条件: fire_power==high）
   ├──(条件满足)──▶ N3 华容道 ──┐
   │                            │
   └──(条件不满足)──▶ N3' 替代节点「曹操乘胜追击」(目标态) ──┐
                                                            ▼
                                                   章末收敛点 ch_end_chibi
                                                   （历史线分叉大演出 + 章节结算）
```

- **顺序（默认）**：N1 → N2 → N3，严格顺序派发（后节点 `on_predecessor_resolved`）。**MVP 只做 N2 单节点**（`game-concept §7.1`），即章节退化为「N2 → 章末」；N1/N3/替代节点属目标态（`game-concept §7.2`）。
- **分支（存在性驱动，非选择支驱动）**：分支**不是玩家选 A/B**，而是**因果链存在性**决定的——N2 火攻成败决定 N3 存在还是 N3' 替代节点存在（`game-concept §6.3`）。这是本作高概念卖点，**绝不退化成对话选择支**（守 `game-concept §2` 支柱①反例）。
- **收敛（章末）**：N3 与 N3' **都汇聚到同一个章末收敛点** `ch_end_chibi`（历史线分叉大演出 + 章节结算），保证章节**有终态**、玩家不会"卡在没有下文的分支里"。收敛点不是改写节点，是**演出+结算节点**（演出资产归 S3+X1，`systems-index §6` 历史线两段式）。

> 📌 **章节设计的多朝代铺路**：章节是「朝代舞台内的有序节点集」，与「朝代 = TileSet + 遭遇表 + BGM」（`AGENTS.md` Godot 约定）正交。换朝代 = 换一个 `chapter_id` + 换节点集（§3.7）。**本切片只 1 朝代 1 章节，但结构不挡多朝代扩展**（`game-concept §7.3` 愿景）。

### 2.3 因果链传递如何决定下游节点存在性（消费 S1 的 existence 链 · 两段式）

> 这是 S2 的**关键职责**，也是与 S1 的**核心接口**。两段式所有权（`systems-index §6`「因果链」行 + 「改写节点」行 + `rewrite-causality §3.4`）：**规则与数据归 S1，派发/消失的决策归 S2**。

**存在性依赖处理流程（节点 N_parent 确认后）**：

```
① S1 结算 N_parent → 发 causal_link_propagated(link, source=N_parent, resolved_value, target=N_child, type=existence, condition=<规则表达式>)  [S1→S2]
        │  （规则数据 condition 由 S1 持有，rewrite-causality §3.4；S2 不重定义规则）
        ▼
② S2 接收 → 读 type：若 == existence，进入"派发决策"
        │
        ▼
③ S2 评估 condition_met：比对 resolved_value 与 condition（S2 读 S1 给的规则数据，做布尔判定）
        │  （判定逻辑可由 S2 执行，或由 S1 在载荷里直接给 condition_met 布尔——[待程基岩确认] 评估方归属，
        │    但"是否据此派发/派替代"的决策权归 S2，两段式不可破）
        ▼
   ┌────────────────────┴────────────────────┐
   ▼ condition_met == true                    ▼ condition_met == false
④a S2 决策：派发 N_child                     ④b S2 决策：N_child 消失
   → S2 置 N_child 待派发                       → S1 发 node_vanished(N_child) [S1→S2，回告]
   → 待 T_dispatch 时机到，S2 发 node_activated  → S2 置 N_child=已消失，更新账本
   → (MVP/目标态) S2 决策是否派 N_child' 替代节点
       (existence_dep.on_false == spawn_alternative，rewrite-causality §3.4)
```

**关键约束（守范围 + 防级联，对齐 `rewrite-causality §5.2`）**：
1. **存在性依赖最多一层**（`rewrite-causality §2.5/§5.2`）：N3 依赖 N2，**不递归**（N3 的消失不再级联使 N4 消失）。本切片因果链限 3 节点最小链。
2. **替代节点（N3'）属目标态**：MVP 不做（`game-concept §7.1/§9④`），但**架构预留** `existence_dep.on_false` 字段（`rewrite-causality §3.4`）。
3. **决策权红线**：S2 **不修改** S1 的 existence 规则数据（condition），只**读 + 决策派发**；S1 **不替** S2 决定派不派（S1 只发事实/规则）。**两段式，无重复，无越权**（守 `systems-index §3.1` DAG 无环）。

> ⚠️ **`node_vanished` 归属的文档张力 [待主创/程基岩确认]**：`rewrite-causality §2.3` 表末行写「S2 发 `node_vanished`」，而 `rewrite-causality §6.1/§7.1` 与本 issue 显式依赖均把 `node_vanished` 列为 **S1 → S2**（S1 发，S2 收）。**本 GDD 以 issue 显式依赖为准**：`node_vanished` 由 S1 发出（S1 持有 existence 规则、做存在性判定后回告），S2 接收后做派发决策（不派该节点 / 决策替代节点）。建议在跨 GDD 一致性评审中修正 `rewrite-causality §2.3` 该行措辞为「S1 发 `node_vanished`（规则归 S1），S2 收后决策」。**本 GDD 不新增任何信号**，仅澄清归属。

### 2.4 任务目标与上下文如何呈现给玩家

> 「系统」派单时，S2 向玩家交付**目标 + 上下文**，让玩家「知道去哪、做什么、为什么」（守 `game-concept §2` 支柱②「看得见天平」）。呈现分**三层信息**，对应认知负荷分级（`systems-index §8` 认知过载红线）：

| 层级 | 内容 | 来源 | 呈现（UI 归 S3，`art-bible §6.2`） |
|---|---|---|---|
| **核心（常驻 HUD）** | 当前节点名 + 一句话目标 + 目标场所指引 | S2 `objective_short` + S5 场所 | HUD 极简冷光条（`art-bible §6.2` HUD 行） |
| **进阶（任务面板）** | 节点背景上下文 + 可用蓝图提示（受 `intel_cov` 门控的措辞）+ 因果链预览（"此节点将影响：N3 是否出现"） | S2 `objective_long` + 读 S1 蓝图/intel | 任务面板（系统材质，`art-bible §6.1`） |
| **隐藏（默认折叠）** | 完整因果链规则、存在性条件、节点权重 | S2 引用 S1 `causal_links`（只读） | 折叠详情，供硬核玩家（Explorer，`game-concept §4.2`） |

- **派单语气**：每个节点带一句「系统」开场白（`system_dispatch_voice`，§3.4），由 X1 以冷光旁白演出。例：N2 借东风派单 →「已锁定目标：借东风。当前节点偏差归零。记录员就位。」（沿用 `rewrite-causality §3.2` 示例语气）。
- **目标场所指引**：S2 持有节点的目标场所引用（`target_scene`，如 N2 的七星坛），交给 S5 在大地图/世界给出冷光环提示（`art-bible §3.3`）。**S2 不布置触发器**（→ S5，`systems-index §2`）。
- **因果链预览（防认知过载的关键设计）**：进阶层用**自然语言**告诉玩家"这个节点会影响什么"（如「借东风成败将决定华容道是否出现」），而非暴露 `condition` 表达式。这把抽象因果**翻译成可读叙事**（守 `game-concept §2` 支柱③可读性）。

### 2.5 节点派发时机（`T_dispatch`）与章节推进

> 何时把一个 `未激活` 节点变为 `可改写`（即何时发 `node_activated`）。派发时机策略 `T_dispatch` 是**节点数据字段**（§3.2），三种取值：

| `T_dispatch` | 含义 | 赤壁示例 | 设计意图 |
|---|---|---|---|
| `on_chapter_enter` | 章节开始即派发 | （本切片不用） | 给玩家自由选择先做哪个；本切片节点少，不用 |
| `on_predecessor_resolved` | 前序节点 `已确认` 后派发（默认） | N1 确认→派 N2；N2 确认→（存在性满足）派 N3 | **本切片默认**，保证因果链顺序与叙事节奏 |
| `on_player_reach` | 玩家抵达目标场所附近才派发 | （可选，目标态探索感） | 强化"探索发现任务"，但增加玩家迷路风险（认知过载），MVP 不用 |

**派发前置条件（全部为"与"，缺一不可，§4.2 给判定公式）**：
1. 前序节点全部 `已确认`（读 S1 `node_resolved` 历史）。
2. 存在性依赖满足（若该节点有 `existence_dep`，`condition_met == true`；否则无此项）。
3. 章节已解锁（章节门控，如"完成上一章"——本切片单章，恒真）。
4. `T_dispatch` 时机已到（按上表）。

满足后，S2 发 `node_activated(node_id)`（S2→S1），节点进入 `可改写`。

> 📌 **MVP 简化**：MVP 单节点 N2，`T_dispatch = on_chapter_enter`（章节开始即派 N2），无前序/存在性门控（`game-concept §7.1`）。

---

## 3. 数据（为落 `game/data/quests/*.tres` 铺路）

> 遵循 `AGENTS.md` 数据驱动约定 + `art-bible §9` 命名规范（`snake_case` + 朝代命名空间）。下列为**设计侧字段契约**，是给程基岩 P3 架构的输入；**`.tres` 资源类名、Godot 类型映射标 `[待程基岩确认]`**，本文只定"要存什么、叫什么"。**本节只定义「生命周期/派发/章节/任务文案」类字段；不复述 S1 的节点内部数值态字段**（`v_i`/`vars`/`blueprints`/`verbs`/`causal_out`/`existence_dep` 规则等见 `rewrite-causality §3.2~§3.4`）。

### 3.1 章节表 —— `game/data/quests/chapters/<chapter_id>.tres`

```yaml
chapter_id: ch_chibi_war                  # 赤壁之战章节
dynasty: dyn_threekingdoms_chibi          # 朝代命名空间（art-bible §9.1，多朝代换此字段）
display_title: "赤壁之战"
ordered_nodes:                            # 有序节点序列（顺序派发，T_dispatch=on_predecessor_resolved）
  - { node_id: n1_chain_scheme, weight: 0.3 }     # w_node，章节进度权重（§4.3），Σ=1.0
  - { node_id: n2_east_wind,    weight: 0.4 }
  - { node_id: n3_huarong,      weight: 0.3 }     # N3 带存在性依赖，可能消失
alternative_nodes:                        # 替代节点（目标态，game-concept §6.3）
  - { replaces: n3_huarong, alt_id: n3_alt_cao_victory, on_existence_false: true }
convergence: ch_end_chibi                 # 章末收敛点（演出+结算，非改写节点）
mvp_subset: [n2_east_wind]                # MVP 仅 N2（game-concept §7.1）；目标态用 ordered_nodes 全集
```

> **设计意图**：`mvp_subset` 字段让同一章节数据**按范围开关子集**，无需为 MVP 单独建章——数据驱动收窄范围（`game-concept §7.1/§7.2`）。

### 3.2 节点派发表（生命周期/派发字段，**不含内部数值态**）—— `game/data/quests/nodes/<node_id>.tres`

> ⚠️ 本文件**只存 S2 拥有的生命周期/派发/文案字段**。节点的 `vars`/`blueprints`/`verbs`/`causal_out`/`delta_critical`/`cp_node`/`diff_base`/`max_attempts` 等**内部数值态字段归 S1**（`rewrite-causality §3.2`）。两个文件**按 `node_id` 关联**（S2 派发表 ↔ S1 节点模型），各管各的，不重复定义。

```yaml
node_id: n2_east_wind                     # N2 借东风（与 rewrite-causality §3.2 的 node_id 一致）
dynasty: dyn_threekingdoms_chibi
chapter_id: ch_chibi_war
# —— 生命周期/派发（S2 拥有）——
lifecycle_state: 未激活                   # 运行时态，初值；5 态见 §2.1
t_dispatch: on_predecessor_resolved       # 派发时机策略（§2.5）
prereq_nodes: [n1_chain_scheme]           # 前序节点（须全部已确认）；MVP 的 N2 此处为 []
existence_dep_ref: link_fire_power_to_n3_existence   # 存在性依赖【引用】S1 §3.4 的 link_id，不重定义规则
target_scene: scene_altar                 # 目标场所引用（→ S5 布置触发器，systems-index §2 S5 行）
quest_reward_mult: 1.2                    # 任务奖励 CP 倍率（§4.1，S2 加成接口参数）
quest_cp_flat_bonus: 10                   # 任务完成固定 CP 奖励（点，§4.1）
# —— 任务文案（S2 拥有，X1 表现）——
objective_short: "前往七星坛，决定东风是否借成"
objective_long: "周瑜欲火攻却缺东南风。诸葛亮登坛借风。你可以破坏、截断、策反，或由你之手亲自借这阵风。此节点的成败将决定华容道是否出现。"
system_dispatch_voice: "已锁定目标：借东风。当前节点偏差归零。记录员就位。"   # 沿用 rewrite-causality §3.2 语气
system_complete_voice: "节点已确认。偏差已记录，因果已传递。"
system_vanish_voice: "目标节点未触发存在条件。世界线已重排。"
# —— 上下文提示（进阶层，§2.4）——
causal_preview_hint: "借东风成败 → 决定华容道是否出现"   # 自然语言因果预览（不暴露 condition 表达式）
```

### 3.3 节点生命周期运行时字段（S2 持有，**非持久数据，给 X4 存档消费**）

> 存档所有权在工程（X4，`systems-index §1.2`）。本系统声明**需被持久化的生命周期状态**（设计侧契约，给程基岩）。**只存生命周期态，不存内部数值态**（内部数值态的存档见 `rewrite-causality §3.6`）。

```yaml
save_state_mainline_quest:
  active_dynasty: dyn_threekingdoms_chibi
  active_chapter: ch_chibi_war
  chapter_progress: 0.4                   # P_ch（§4.3）
  node_lifecycle_ledger:                  # 全章节节点的生命周期账本（S2 拥有）
    n1_chain_scheme: { state: 已确认, resolved_at: <tick>, dispatched_at: <tick> }
    n2_east_wind:    { state: 执行中, dispatched_at: <tick> }   # 与 S1 的 unresolved_node_snapshot 对应（rewrite-causality §3.6）
    n3_huarong:      { state: 未激活 }
    n3_alt_cao_victory: { state: 未激活 } # 替代节点预留（目标态）
  vanished_nodes: []                      # 已消失节点（曾派发或曾可派发，因存在性不满足而消失）
  dispatched_alternatives: []             # 已派发的替代节点（目标态）
```

> ⚠️ **跨系统存档一致性要求**：S2 的 `node_lifecycle_ledger` 的 `已确认` 节点集合，**必须与** S1 `save_state_rewrite_engine.resolved_nodes`（`rewrite-causality §3.6`）**逐节点一致**——否则会出现"S2 认为已确认但 S1 未结算"或反之的撕裂。这是 X4 存档设计的硬约束（§5.5 边缘情况）。

### 3.4 存在性依赖：**引用** S1，不重定义

> **存在性依赖的规则与数据归 S1**（`rewrite-causality §3.4`，`type: existence` 的 `condition` / `on_false` / `transform`）。S2 **只引用** `link_id`（见 §3.2 的 `existence_dep_ref` 字段），**不复制 condition 表达式、不重定义规则**。两段式（`systems-index §6`）：规则数据归 S1 / 派发决策归 S2（§2.3）。

赤壁示例的存在性依赖（**规则在 S1**，此处仅示意引用关系）：
```yaml
# S1 拥有（rewrite-causality §3.4），S2 引用 link_id: link_fire_power_to_n3_existence
# condition: "fire_power == high"  ← 规则归 S1
# on_false: spawn_alternative       ← 规则归 S1；S2 据此决策派 n3_alt_cao_victory
```

### 3.5 朝代热切换口（多朝代扩展铺路，**本切片不实现**）

> 落地 `AGENTS.md` Godot 约定「朝代 = TileSet + 遭遇表 + BGM 组合热切换」+ `game-concept §7.3` 愿景。

**本系统的热切换契约**：
- 章节表、节点派发表均带 `dynasty` 命名空间字段；引擎按 `active_dynasty` 加载对应章节包（`game/data/quests/chapters/`、`game/data/quests/nodes/`）。
- **章节编排/派发/生命周期逻辑（§2）朝代无关**（纯流程，不含朝代硬编码）——换朝代只换章节数据，不换逻辑。
- **跨朝代主线累积**（一个穿越者的"主线总账"）列为愿景（`game-concept §7.3`），本切片**不做**，但 `save_state_mainline_quest` 的 `active_chapter` + 按 `dynasty` 分组结构已为"多朝代章节序列"留口（未来加 `dynasty_progress` 维度即可）。

> ✅ **预留验收**：本切片结构满足"换章节包即可换朝代"，不挡多朝代扩展的路（与 `rewrite-causality §3.7` 一致）。

---

## 4. 公式（统一格式 · 标变量与单位）

> 本节是本系统的数值定稿。所有符号见 §0。每条公式给出：**公式式 → 变量说明 → 设计意图/防红线注释**。**本系统的公式刻意"轻"**——S2 是流程编排系统，不做重数值计算；真正的数值心脏在 S1（`rewrite-causality §4`）。

### 4.1 任务奖励 CP 加成（S2 的**唯一** CP 接口 · CP 两段式）

> 严格守 `systems-index §6` CP 两段式：**产出归 S1、账户/兑换归 S3，S2 只做"任务奖励可加成"接口**。S2 **不计算 CP 产出**（那是 `rewrite-causality §4.2`），**不持有 CP 余额/兑换**（那是 S3）。S2 只**声明**节点级的加成参数（数据），由账户侧应用。

**S2 暴露的加成参数（节点数据，§3.2）**：
- `quest_reward_mult` ∈ [1.0, 2.0]（无量纲，默认 1.0）——任务完成 CP 倍率。
- `quest_cp_flat_bonus` ≥ 0（点，默认 0）——任务完成固定追加 CP。

**入账公式（由 S3 在账户侧应用，S2 只提供参数）**：

```
CP_credited = round( CP_earned · quest_reward_mult ) + quest_cp_flat_bonus     [点]，整数 ≥ 0
```

| 变量 | 含义 | 单位 | 来源 / 归属 |
|---|---|---|---|
| `CP_earned` | S1 产出的因果点 | 点 | **`rewrite-causality §4.2`**（S1 产出，S2 只读引用） |
| `quest_reward_mult` | 任务奖励 CP 倍率 | 无量纲 [1.0, 2.0] | S2 节点数据（§3.2），S2 拥有 |
| `quest_cp_flat_bonus` | 任务完成固定 CP | 点 | S2 节点数据（§3.2），S2 拥有 |
| `CP_credited` | 实际入账 CP（含加成） | 点 | S3 账户侧计算并入账（S3 拥有账户） |

**边界说明（守两段式，防越权）**：
- **S2 不计算 `CP_earned`**：那是 S1 §4.2 的 `CP_earned = round(CP_node·M·(1+k·min(Δ,Δ_cap)/Δ_cap))`，S2 只读其结果。
- **S2 不持有 CP 余额**：入账、兑换、消耗全归 S3（`systems-index §6`）。S2 发完加成参数即放手。
- **应用方归属 [待与 S3 P2-4 联合确认]**：本 GDD **建议**加成在 **S3 账户侧应用**（`CP_credited` 由 S3 算并入账），理由：账户归 S3，加成属于"如何入账"，落在 S3 权责内，且**不触碰 S1 已锁的 §4.2 产出公式**（避免回头改 S1）。S3 通过 `node_id` 从 S2 章节数据查 `quest_reward_mult`/`quest_cp_flat_bonus`，无需 S2 新增运行时信号（守"不新增冲突信号"）。若主创倾向由 S1 在产出侧应用，则需同步扩展 `rewrite-causality §4.2`，**须 S1/S2/S3 三方联合确认**，本 GDD 不擅自定。

**防红线（经济失衡）**：
- `quest_reward_mult` 封顶 2.0、`quest_cp_flat_bonus` 由数据手调——防任务奖励 CP 溢出冲垮 S3 经济曲线（`systems-index §8` 经济失衡红线）。具体平衡值待 P2-4（S3 经济曲线）+ P5/P6 Playtest 定。
- **奖励加成不与 Δ 挂钩**：S2 的加成是**任务完成度**奖励（节点确认即给），**不**因 `Δ` 大而加成更多——否则会诱发"为拿任务奖励而盲改大 Δ"，与 `rewrite-causality §5.1` 防刷分冲突。**任务奖励是"完成"的报酬，不是"偏差"的报酬**。

### 4.2 节点派发前置条件判定（逻辑式）

```
can_dispatch(node) = 
      ( ∀ p ∈ prereq_nodes(node): lifecycle_state[p] == 已确认 )
  AND ( existence_dep_ref(node) == null  OR  condition_met(node) == true )
  AND ( chapter_unlocked(chapter_id(node)) == true )
  AND ( t_dispatch_satisfied(node) == true )           # T_dispatch 时机已到（§2.5）
```

| 变量 | 含义 | 单位 | 来源 |
|---|---|---|---|
| `prereq_nodes(node)` | 节点的前序节点集合 | 节点 id 列表 | S2 节点数据（§3.2） |
| `lifecycle_state[p]` | 前序节点 p 的生命周期态 | 枚举 | S2 账本（§3.3） |
| `condition_met(node)` | 本节点存在性条件是否满足 | 布尔 | `causal_link_propagated` 载荷（S1 发，§2.3） |
| `chapter_unlocked` | 章节是否解锁 | 布尔 | S2 章节门控（本切片单章恒真） |
| `t_dispatch_satisfied` | T_dispatch 时机是否到 | 布尔 | §2.5 表 |

**设计意图**：所有前置条件为"与"，缺一不可，保证因果链顺序与叙事节奏。`can_dispatch == true` 时，S2 发 `node_activated(node)`（§2.1）。

### 4.3 章节进度曲线

```
P_ch = Σ_{n ∈ resolved_nodes_in_chapter} w_node(n)        [无量纲]，结果 ∈ [0, 1]
```

| 变量 | 含义 | 单位 | 来源 |
|---|---|---|---|
| `w_node(n)` | 节点 n 在章节中的进度权重 | 无量纲 | 章节数据（§3.1），章节内 `Σw_node = 1.0` |
| `resolved_nodes_in_chapter` | 本章节已 `已确认` 的节点集合 | 节点集合 | S2 账本（§3.3）∩ S1 `resolved_nodes`（`rewrite-causality §3.6`） |

**设计意图**：
- `P_ch` 是**玩家可见的章节进度条**（任务面板/HUD），用**已确认节点加权**而非 Δ——进度感来自"完成了几个历史节点"，而非"偏了多少"（避免玩家为刷进度而盲改 Δ，呼应 §4.1 防红线）。
- 替代节点（N3'）与原节点（N3）**共享同一 `w_node` 槽位**（§3.1）：无论走 N3 还是 N3' 分支，章节进度都推进同一份额——保证**分支不改变总进度**（防"走某分支进度更多"的主导策略）。
- **章节进度与奖励曲线解耦**：`P_ch` 只驱动**进度条显示**与**章节门控**，**不**直接放大 CP 奖励（CP 奖励由 §4.1 的节点级参数控制，与 P_ch 无关）——防"后期节点天然高奖励"的进度膨胀。

### 4.4 公式总览（一眼速查）

| 量 | 公式 | 单位 | 归属 |
|---|---|---|---|
| 任务奖励入账 | `CP_credited = round(CP_earned·quest_reward_mult) + quest_cp_flat_bonus` | 点 | 应用归 S3（参数归 S2） |
| 派发前置判定 | `can_dispatch = 前序全确认 ∧ 存在性满足 ∧ 章节解锁 ∧ 时机到` | 布尔 | S2 |
| 章节进度 | `P_ch = Σ_{已确认} w_node` | 无量纲 [0,1] | S2 |

---

## 5. 边缘情况（≥3 类，逐类给判定与处理）

### 5.1 玩家绕序 / 跳过节点（开放世界自由 vs 顺序派发）—— 认知过载 + 支柱③红线

- **现象**：玩家在 N1 未确认时，凭探索自由走到 N3 华容道区域（开放世界无空气墙，`game-concept §2` 支柱③）。
- **判定/处理**：
  1. **节点不会被提前激活**：N3 的 `can_dispatch` 因 `prereq_nodes` 不满足而为 false，S2 **不发** `node_activated`，N3 保持 `未激活`。S5 在该区域**不显示冷光环改写提示**（因节点未激活，S5 无目标场所激活）。
  2. **世界可自由探索但不产生改写**：玩家能逛华容道，但找不到"可改写"的介入点——系统以**自然语言旁白**提示（X1）"此地尚未成为历史的关键时刻"，引导玩家回主线。
  3. **绝不空气墙/传送**：守支柱③"开放世界即历史棋局"，不退化成线性传送门（`game-concept §2` 支柱③反例）。
- **红线标注**：若为"防止绕序"而加空气墙/强制传送，支柱③崩塌。**用"节点未激活则无可改写"的软引导，而非硬阻挡**。

### 5.2 因果链使下游节点消失，而玩家已身处其中 —— 系统一致性 + 叙事红线

- **现象**：玩家在 N2 借东风"执行中"（已开始改写、`v_wind` 已被改但未确认）时，某种路径使 N3 的存在性条件……（注：N3 的存在性取决于 N2 的**最终确认值**，N2 未确认前 N3 存在性悬而未决，故此情形实为"N2 确认后 N3 消失，但玩家已走到华容道附近"）。
- **判定/处理**：
  1. **消失只发生在前序确认后**：N3 的存在性依赖在 N2 `node_resolved` 时才判定（§2.3）。N2 未确认，N3 永远 `未激活`，不会"在玩家改写中途消失"。
  2. **N2 确认使 N3 消失的处理**：S1 发 `node_vanished(N3)`（S1→S2）→ S2 置 N3 `已消失` → 通知 S5 移除华容道场所的冷光环/触发器 → X1 播 `system_vanish_voice`（§3.2）解释"世界线已重排"→ S2 决策是否派 N3' 替代节点（目标态）。
  3. **若玩家已在华容道现场**：S5 平滑移除场所（无硬切），X1 旁白承接，**不打断玩家**——这是叙事惊奇（`game-concept §3.3` Narrative 美学），不是 bug。
- **红线标注**：此条守**叙事一致性**；消失节点的处理须由 X1 旁白"翻译"成可读叙事，否则玩家困惑（认知过载）。**严禁**让场所"凭空消失无解释"。

### 5.3 节点锁定后存档回溯（X4 协作）—— 数据一致性红线

- **现象**：玩家在 N2 `已确认` 后存档，读档后期望"重改 N2"。
- **判定/处理**：
  1. **已确认节点不可回滚**：S2 的 `node_lifecycle_ledger` 与 S1 的 `resolved_nodes`（`rewrite-causality §3.6`）一经写入即历史事实——呼应"历史已改写"的叙事（`rewrite-causality §5.4`）。
  2. **跨系统账本一致**：读档后 S2 的 `已确认` 集合必须 == S1 的 `resolved_nodes`（§3.3 一致性硬约束）。X4 存档须**原子写入**两个系统的状态，防撕裂。
  3. **"悔棋"列为独立功能 [待审批]**（`rewrite-causality §9⑤`）：本切片**不做**节点回滚；若主创要求，须作为独立"时间回溯"功能设计，且**不撤已入账 CP**（防刷分，与 `rewrite-causality §5.1/§5.4` 一致）。
- **红线标注**：此条守**经济一致 + 叙事一致**；开放节点回滚将直接破坏 S1 防刷分（`rewrite-causality §5.1`）。

### 5.4 多分支结局收敛（N3 vs N3' 替代节点）—— 流程完备性红线

- **现象**：N2 失败 → N3 消失 → N3' 替代节点（目标态）派出。两条分支（N3 / N3'）如何收束？
- **判定/处理**：
  1. **共用章末收敛点**：N3 与 N3' 都指向 `ch_end_chibi`（§2.2/§3.1），章末做历史线分叉大演出 + 章节结算。**无论走哪条分支，章节都有终态**。
  2. **进度等价**：N3 与 N3' 共享同一 `w_node` 槽位（§4.3），分支不改变总进度。
  3. **替代节点派发的存在性条件**：N3' 的 `can_dispatch` = `N3.vanished == true`（即 `existence_dep.on_false: spawn_alternative` 触发，`rewrite-causality §3.4`）。S2 据 `node_vanished(N3)` 决策派 N3'。
  4. **MVP 不做替代节点**（`game-concept §7.1/§9④`）：MVP 下 N2 失败 → N3 消失 → 直接进 `ch_end_chibi`（无 N3'），章节仍收敛，**架构已预留** N3' 字段。
- **红线标注**：此条守**流程完备性**；若分支无收敛点，玩家会"卡在死分支"。**每条分支必须通向同一个收敛点**。

### 5.5 节点生命周期账本与 S1 内部态的存档一致性 —— 跨系统红线

- **现象**：存档后读档，S2 显示 N2 `已确认`，但 S1 的 `resolved_nodes` 没有 N2（或反之）。
- **判定/处理**：
  1. **原子写入**：X4 存档须把 S2 账本与 S1 `save_state_rewrite_engine` **作为一个事务原子落盘**（§3.3）。
  2. **启动校验 [待程基岩确认]**：读档后引擎应做一次"S2 已确认集合 ⊆/== S1 resolved_nodes"的一致性校验；不一致则按"S1 为数值权威、S2 据此重建账本"的原则修复（S1 是根，`systems-index §3.1`）。
  3. **`执行中` 态对齐**：S2 的 `执行中` 必须对应 S1 的 `unresolved_node_snapshot`（`rewrite-causality §3.6`）——同一节点 id，一个在 S2 账本标 `执行中`，一个在 S1 快照有 `working_vars`。读档两边都恢复。
- **红线标注**：此条守**跨系统一致性**；账本撕裂会导致玩家"任务说完成但没拿到 CP"等恶性 bug。

### 5.6 玩家在节点「执行中」长时间不确认 —— 流程软引导

- **现象**：玩家在 N2 改了几次 `v_i`（未确认）就去做别的探索/战斗，长时间不 `node_committed`。
- **判定/处理**：
  1. **S2 不强制 commit**：节点可长期停留 `执行中`（S1 持有 `working_vars`，`rewrite-causality §3.6`）。这是玩家"先试后定"的掌控感（`game-concept §2` 支柱②）。
  2. **HUD 软提醒**：S2 经 X1 在玩家离开改写场所较久后，发一句冷光旁白"当前节点尚未确认，改动未生效"（§3.2 文案），**轻提示不强制**。
  3. **`max_attempts` 由 S1 管**：耗尽 attempts 的强制锁定是 S1 内部触发（§2.1 注），S2 不干预。
- **红线标注**：此条守**玩家自主**（SDT Autonomy，`game-concept §4.1`）；强制定时锁定会破坏掌控感。

---

## 6. UI 接口（信号 / 事件契约，衔接 P4-1 UX 规格）

> 本系统**对内发信号驱动 S1/S3/S5，对外（玩家）经 S3 UI 呈现**。下列是**设计侧的事件/信号契约**，落地用 Godot 信号（`AGENTS.md`「信号优先于全局单例滥用」）。**与 S1 的信号逐条回引 `rewrite-causality §7.1`，不新增冲突信号**；S2 自有的 UI/任务信号（向 S3/S5/X1）单独列出，明确不与 S1 冲突。**Godot 信号精确签名标 `[待程基岩确认]`**。

### 6.1 与 S1 的信号契约（逐条回引 `rewrite-causality §7.1`，**零新增**）

| 信号 | 方向 | 载荷 | S2 动作 | 回引 |
|---|---|---|---|---|
| `node_activated(node_id)` | **S2 → S1** | 节点 id | S2 派发时发出（§2.1/§2.5） | `rewrite-causality §6.2`、§7.1 |
| `node_committed(node_id)` | **S2 → S1** | 节点 id | S2 任务级强制锁定时发出（§2.1 注） | `rewrite-causality §6.2`、§7.1 |
| `node_resolved(node_id, final_vars, delta_node, cp_earned)` | **S1 → S2** | 节点、最终 v_i、Δ、CP | S2 置 `已确认`、推进章节、读 `cp_earned`（只读） | `rewrite-causality §6.1`、§7.1 |
| `causal_link_propagated(link_id, source_node, resolved_value, target)` | **S1 → S2** | 链、源、解析值、目标 | S2 读 `type`：existence 则做派发决策（§2.3） | `rewrite-causality §6.1`、§7.1 |
| `node_vanished(node_id)` | **S1 → S2** | 节点 | S2 置 `已消失`、决策替代节点（§2.3） | `rewrite-causality §6.1`、§7.1 |

> ✅ **验收**：上表 5 个信号**与 `rewrite-causality §7.1` 完全一致，零新增、零改名**。S2 不向 S1 发任何其他信号。

### 6.2 S2 自有的 UI/任务信号（向 S3/S5/X1，**不与 S1 冲突**）

> 这些是 S2 在自己的权责内（任务目标/追踪/派单文案）发出的信号，**不在 S1 §7.1 清单内，也不与之冲突**（S1 清单只管 S1↔S2 的数值/节点契约）。

| 信号（建议） | 载荷 | 触发时机 | 主消费方 |
|---|---|---|---|
| `quest_objective_updated(node_id, objective_short, objective_long)` | 节点、短/长目标文案 | S2 派发节点（`可改写`）时 | S3（任务面板/HUD 显示） |
| `quest_dispatch_voiced(node_id, system_dispatch_voice)` | 节点、派单文案 | S2 派发节点时 | **X1**（冷光旁白演出） |
| `quest_target_scene_set(node_id, target_scene)` | 节点、目标场所 | S2 派发节点时 | **S5**（场所布置/冷光环提示，`art-bible §3.3`） |
| `quest_progress_updated(chapter_id, p_ch)` | 章节、进度 | 节点 `已确认` 后 | S3（章节进度条） |
| `quest_node_vanished_voiced(node_id, system_vanish_voice)` | 节点、消失文案 | 收到 S1 `node_vanished` 后 | **X1**（消失旁白）、S3（UI 标记移除）、S5（场所移除） |
| `quest_reward_declared(node_id, quest_reward_mult, quest_cp_flat_bonus)` | 节点、加成参数 | 节点 `已确认` 后（供 S3 入账查用） | **S3**（应用 §4.1 加成） |

> 📌 `quest_reward_declared` 可由"S3 按 `node_id` 查 S2 章节数据"替代为数据查询，**不强制运行时信号**（[待程基岩确认] 选信号还是查表），以减少信号噪声。两种方式都守"不新增冲突信号"（不碰 S1 清单）。

### 6.3 「系统」旁白播报契约（X1 衔接）

> S2 产**文案**（§3.2 的 `system_dispatch_voice` / `system_complete_voice` / `system_vanish_voice`），X1 产**表现**（语气/字幕/动效/节奏）。三处旁白触点：

| 触点 | 触发 | S2 提供 | X1 表现 |
|---|---|---|---|
| **派单旁白** | `node_activated` 后 | `system_dispatch_voice` 字符串 | 冷光扫描展开 + 等宽字幕 +（可选）冷峻配音（`art-bible §6.1`） |
| **完成旁白** | `node_resolved` 后 | `system_complete_voice` 字符串 | 短冷光提示 + 历史线分叉演出（演出资产归 S3+X1，`systems-index §6`） |
| **消失旁白** | `node_vanished` 后 | `system_vanish_voice` 字符串 | 世界线 glitch + 冷光简报（`art-bible §2.5` critical 档） |

> ⚠️ **人格基调待审批**（`game-concept §9①`）：S2 的文案按"冷峻第三方观测者/记录员"倾向撰写（如「记录员就位」「世界线已重排」），**留接口**——若主创定"带点毒舌"，只改文案数据（§3.2），不改 S2 逻辑。

### 6.4 与 P4-1 UX 规格的衔接点（给文策渊 Phase 4 自己）

> 本节是给未来 P4-1（关键屏幕 UX 规格）的**输入清单**：

- **任务面板**（系统材质，`art-bible §6.1/§6.2`）需显示：①当前章节 + 章节进度条（`P_ch`）；②当前节点名 + 短/长目标（§2.4 核心层/进阶层）；③因果链预览自然语言（§2.4）；④可用蓝图提示（读 S1，按 `intel_cov` 门控措辞）；⑤（折叠）完整因果规则。
- **HUD 常驻**（极简，`art-bible §6.2`）：当前节点名 + 一句话目标 + 目标场所指引箭头；与 S1 的 Δ 指示条、RE 条并排（不抢焦点）。
- **信息密度分级**（守 `systems-index §8` 认知过载）：核心（节点名+目标）常驻；进阶（上下文+因果预览）按需；隐藏（规则）折叠。
- ⚠️ **任务管理 UI 刻意薄**（§1.3）：不做复杂任务日志/多线追踪界面，守 MVP 收窄（`game-concept §7.1`）。

---

## 7. 依赖（与 S1/S3/S5/X1 的边界与数据流）

> 边界以 `systems-index §2` 为准；本节做**主线任务视角的交叉确认**。**显式引用**前置文档节号。

### 7.1 与 S1 改写/因果引擎（P2-2 · 已完成）

- **S2 → S1**：`node_activated`（派发）、`node_committed`（任务级强制锁定）——`rewrite-causality §7.1`。
- **S1 → S2**：`node_resolved`（确认回告）、`causal_link_propagated`（含 existence 型，S2 据此做派发决策）、`node_vanished`（消失回告）——`rewrite-causality §7.1`。
- **边界 1（节点两段式，`systems-index §6`「改写节点」行）**：**数据模型归 S1**（`v_i`/`vars`/`blueprints`/`verbs`/`causal_out`/`delta_critical`/`cp_node`/`diff_base`/`max_attempts`，`rewrite-causality §3.2`），**生命周期/派发归 S2**（`lifecycle_state`/`t_dispatch`/`prereq_nodes`/文案，§3.2）。两文件按 `node_id` 关联，各管各的。
- **边界 2（存在性两段式，`systems-index §6` + `rewrite-causality §3.4`）**：**规则数据归 S1**（`condition`/`on_false`/`transform`），**派发决策归 S2**（§2.3）。S2 只引用 `link_id`，不重定义规则。
- **边界 3（CP 两段式，`systems-index §6`）**：S2 只读 `CP_earned`、只声明加成参数（§4.1），**不碰产出公式、不碰账户**。
- **引用**：`game-concept §6.3`（N3 存在性依赖）、`rewrite-causality §2.3`（状态机协作）、§3.4（存在性规则）、§7.1（信号清单）。

### 7.2 与 S3 面板/成长系统（P2-4 · 可并行）

- **S2 → S3**：`quest_objective_updated`、`quest_progress_updated`、`quest_reward_declared`（§6.2）；任务目标/进度由 S3 显示，CP 加成由 S3 应用（§4.1）。
- **S3 → S2**：（无直接；玩家经 S3 改写面板确认 → S3 发 `node_committed`（S3→S1，§2.1 注），S2 不经手）。
- **边界（CP 加成应用，§4.1）**：**加成参数归 S2（数据），入账应用归 S3（账户）**。S2 不持余额、不改产出公式。**[待与 S3 P2-4 联合确认]** 加成在 S3 账户侧应用（本 GDD 建议）还是 S1 产出侧应用。
- **边界（任务目标显示）**：S2 产文案数据，S3 产 UI 表现（`art-bible §6`）。
- **引用**：`systems-index §6`（CP 两段式、玩家能力/技能）、§7（S2/S3 可并行）。

### 7.3 与 S5 开放世界/朝代地图（P2-6）

- **S2 → S5**：`quest_target_scene_set(node_id, target_scene)`（§6.2）——S2 声明节点的目标场所，S5 布置触发器/冷光环提示（`art-bible §3.3`）；`quest_node_vanished_voiced` 触发 S5 移除消失节点的场所。
- **S5 → S2**：（无直接；S5 产情报 → S1 降 `diff`/解锁蓝图，`rewrite-causality §7.4`，不经 S2；玩家抵达场所由 S5 检测，但**不直接触发 S2 派发**——派发由 S2 的 `can_dispatch` 判定，§4.2）。
- **边界（任务目标 vs 场所布置）**：S2 说"目标在七星坛"（`target_scene`），S5 决定"七星坛长什么样、触发器怎么放"（`systems-index §2` S5 行）。S2 不布置触发器。
- **边界（绕序，§5.1）**：玩家可自由探索（S5 不挡），但节点未激活则 S5 不显示改写提示——软引导而非硬阻挡。
- **引用**：`systems-index §2` S5 行、`game-concept §2` 支柱③、`art-bible §3.3`（信息焦点）。

### 7.4 与 X1 系统叙事层（横切）

- **S2 → X1**：`quest_dispatch_voiced`、`quest_node_vanished_voiced`（§6.2）+ 文案数据（§3.2）。
- **X1 → S2**：（无；X1 只消费 S2 文案做表现）。
- **边界（文案 vs 表现，§1.2）**：**文案归 S2，表现归 X1**。X1 可润色语气，不改目标/意图语义。
- **人格基调待审批**（`game-concept §9①`）：S2 按倾向撰写，留接口。
- **引用**：`systems-index §1.2` X1 行、§6「系统人格」行（归属待定）、`game-concept §9①`、`art-bible §6.1`（系统材质）。

### 7.5 引用的前置文档（一致性锚）

- `game-concept.md`：§1 术语（系统/改写节点/因果链）、§2 支柱（②③）、§3.3 美学（Narrative/Discovery）、§4.1 SDT（自主/胜任）、§5 核心循环 Loop A（S2=任务环）、§6 三节点 MWP（N1/N2/N3 + N3 存在性）、§7 范围（MVP=N2）、§9 待审批（①人格、④消失节点）。
- `systems-index.md`：§2 S2 边界、§3 依赖 DAG（S2→S1）、§4 Loop A 映射（任务行）、§5 支柱对齐（S2 行）、§6 横切实体归属（改写节点/因果链/CP 两段式/系统人格）、§7 撰写顺序（S2 依赖 S1）。
- `rewrite-causality.md`：§2.3 状态机协作（S2 生命周期态）、§3.2/§3.4 节点模型与存在性规则、§3.6 存档状态、§5.1/§5.2/§5.4 边缘情况（防刷分/级联/回滚）、§7.1 **信号清单（本 GDD 逐条对齐）**、§9 待审批（④⑤）。
- `art-bible.md`：§0 双轨、§3.3 信息焦点、§6.1/§6.2 系统材质与界面、§9 命名空间（`dyn_threekingdoms_chibi`）。
- `project-charter.md`：核心循环 Loop A 措辞、范围（垂直切片严守）。

---

## 8. 验收标准（可逐条勾选）

> 对照 issue 验收要点 + `team/design-strategist.md` 输出规范（八节齐全 / 公式标变量单位 / ≥3 类边缘情况）。

- [ ] **八节齐全**：概述(§1) / 机制(§2) / 数据(§3) / 公式(§4) / 边缘情况(§5) / UI 接口(§6) / 依赖(§7) / 验收标准(§8)，缺一不可。✅
- [ ] **节点生命周期状态机与 S1 `rewrite-causality §7.1` 信号契约逐条对齐**：§2.1 状态转移图 + §6.1 信号表，5 个信号（`node_activated`/`node_committed` S2→S1；`node_resolved`/`causal_link_propagated`/`node_vanished` S1→S2）**零新增、零改名**；守住"生命周期态归 S2 / 内部数值态归 S1"（§0/§2.1/§3.2）。✅
- [ ] **CP 两段式边界正确**：S2 只暴露"任务奖励可加成"接口（§4.1 `quest_reward_mult`/`quest_cp_flat_bonus` 数据 + `CP_credited` 公式由 S3 应用），**不复述 S1 产出公式、不碰 S3 账户兑换**。✅
- [ ] **存在性依赖两段式**：规则数据归 S1（§3.4 仅引用 `link_id`）、派发决策归 S2（§2.3 流程 + §4.2 `condition_met`）。✅
- [ ] **公式统一格式、标变量与单位**：§0 符号表 + §4 三条公式均给式/变量/单位/域/归属，§4.4 速查表。✅
- [ ] **≥3 类边缘情况**：§5 给 6 类（绕序/消失身处其中/存档回滚/分支收敛/账本一致性/长时间不确认）。✅
- [ ] **与 game-concept / systems-index / rewrite-causality 一致且显式引用**：§0/§1/§7 多处显式引用节号，术语逐字沿用（系统/改写节点/因果链/Loop A），支柱名可追溯（②③）。✅
- [ ] **不与已有支柱/数值矛盾**：CP 加成不与 Δ 挂钩（§4.1 防红线）对齐 `rewrite-causality §5.1` 防刷分；分支进度等价（§4.3）对齐防主导策略；MVP=N2 单节点对齐 `game-concept §7.1`。✅
- [ ] **不脱离引擎能力**：数据驱动落 `game/data/quests/*.tres`（§3），引擎精确 API/资源类名一律标 `[待程基岩确认]`，未臆造。✅
- [ ] **设计理论红线已标注**：主导策略（§4.1/§4.3 奖励不挂 Δ、分支进度等价）、经济失衡（§4.1 倍率封顶）、认知过载（§2.4 信息分级/§5.1 软引导/§6.4 密度分级）、支柱漂移（§5.1 支柱③反空气墙）。✅
- [ ] **朝代热切换留口**：§3.5 章节表/节点表带 `dynasty` 命名空间，编排逻辑朝代无关，跨朝代主线累积留口（愿景，本切片不做）。✅
- [ ] **待审批项显式标注**：§1.2（人格基调）、§2.1 注（`node_committed` 触发源）、§2.3（`node_vanished` 归属张力）、§4.1（加成应用方）、§5.3（悔棋）、§6.2（信号 vs 查表）均标 `[待审批]`/`[待程基岩确认]`/`[待与 S1/S3 联合确认]`，不擅自定稿。✅
- [ ] **守范围**：因果链限 3 节点最小链（§2.2），存在性依赖最多一层（§2.3），替代节点目标态（§5.4），多朝代/跨朝代累积列为愿景（§3.5），未越垂直切片。✅

---

## 9. 待主创审批项（发现设计张力，不擅自定稿）

> 沿用并细化 `game-concept §9` / `systems-index §10` / `rewrite-causality §9` 中影响**本系统结构**的待定项。

1. **【`node_vanished` 归属】S1 文档内部措辞张力（§2.3 vs §6.1/§7.1）如何统一？**（§2.3）
   - `rewrite-causality §2.3` 写「S2 发 node_vanished」，§6.1/§7.1 + 本 issue 写「S1 发（S1→S2）」。本 GDD 以 issue 为准（S1 发、S2 收后决策）。**建议**跨 GDD 评审统一 `rewrite-causality §2.3` 措辞。倾向：S1 发（规则归 S1）。
2. **【`node_committed` 触发源路由】S2 / S3 / S1 各自何时发？**（§2.1 注）
   - `rewrite-causality §6.2` 把「玩家确认」归 S3、「耗尽 attempts」归 S2。但 attempts 由 S1 持有。倾向：S2 发任务级强制锁定；玩家确认归 S3；attempts 耗尽归 S1 内部。**待 P3 架构 + S1/S3 联合确认**。
3. **【CP 加成应用方】S3 账户侧 vs S1 产出侧？**（§4.1）
   - 倾向 S3 账户侧（不触碰 S1 已锁公式）。**待与 S3 P2-4 联合确认**。
4. **【系统人格基调】沿用 `game-concept §9①`**（§1.2/§6.3）
   - S2 文案按"冷峻记录员"倾向撰写，留接口待定稿。
5. **【替代节点是否进 MVP】沿用 `game-concept §9④`**（§2.2/§5.4）
   - 倾向 MVP 不做、架构预留。本 GDD 已预留 `existence_dep.on_false` + N3' 字段。
6. **【悔棋/节点回滚】沿用 `rewrite-causality §9⑤`**（§5.3）
   - 倾向不开放。

---

## 10. 已知风险与取舍

1. **`node_vanished` 归属张力**（§2.3）：S1 文档内部不一致，本 GDD 已按 issue 澄清并标注，但**须在跨 GDD 一致性评审中修正 S1 §2.3 措辞**，否则实现期可能产生信号归属歧义。**本 GDD 不改 S1（红线），仅在 issue comment 回问主理人**。
2. **任务管理 UI 过薄的风险**（§1.3）：刻意薄的 UI 可能让目标导向型玩家觉得"任务信息不足"——靠 §2.4 三层信息分级 + 因果链自然语言预览缓解，须 P4-1 UX + Playtest 校准。
3. **CP 加成参数未平衡**（§4.1）：`quest_reward_mult`/`quest_cp_flat_bonus` 为首版倾向值（1.0~2.0 / 默认 0），须 P2-4（S3 经济曲线）+ P5/P6 Playtest 定，本 GDD 不给"已平衡"承诺。
4. **跨系统存档一致性**（§5.5）：S2 账本与 S1 `resolved_nodes` 的原子写入对工程有要求，须程基岩 P3 存档设计对齐（与 `rewrite-causality §10` 同源风险）。
5. **消失节点的叙事承接**（§5.2）：N3 消失若 X1 旁白承接不好，玩家会困惑（认知过载）——依赖 X1 表现质量与 `system_vanish_voice` 文案，须与文策渊 Phase 4/6 叙事打磨联合。
6. **因果链范围硬约束**（§2.2/§2.3）：3 节点最小链 + 存在性最多一层是范围红线（对齐 `rewrite-causality §5.2`）；若主创要在目标态扩展复杂因果网，须回头评估级联防线。

---

## 11. 下一步建议（给主理人 · 游承峰）

1. **本 issue（P2-3）完成后**，请主创优先审批 **§9 第 1、2 项**（`node_vanished` 归属 / `node_committed` 触发源）——它们是 S1↔S2 信号契约的歧义点，影响 P3 架构的事件路由设计。
2. **P2-4（S3 面板/成长）可与本 GDD 并行**（`systems-index §7`）：本 GDD 已锁 **任务目标显示契约（§6.2）+ CP 加成接口（§4.1）+ 章节进度（§4.3）**，S3 据此设计面板/经济曲线即可。**重点联合确认 §9 第 3 项（加成应用方）**。
3. **给程基岩（P3-1 架构）**：§3 数据契约 + §6 信号契约 + §7 DAG 可直接作为系统边界与数据归属输入；§3.3 `save_state` + §5.5 跨系统账本一致性是存档需求清单（与 `rewrite-causality §3.6/§10` 合并设计）。建议 P3-1 与本文 + S1 交叉引用，在 ADR 中确认 `quests/*.tres` 资源类设计与事件路由（尤其 `node_vanished`/`node_committed` 归属）。
4. **跨 GDD 一致性待办**：§9 第 1 项的 `rewrite-causality §2.3` 措辞修正——建议作为独立一致性 issue 由主理人派单（本 GDD 不越权改 S1）。
5. **给严守真（QA）**：§5（尤其 §5.5 账本一致性）+ §8 验收项是 QA 清单雏形，建议 P5/P6 转为可执行校验（如"读档后 S2 已确认集合 == S1 resolved_nodes"自动断言）。

---

*—— 文策渊（design-strategist）· Phase 2 系统设计（P2-3 · S2 主线任务系统）· 待主创评审*
