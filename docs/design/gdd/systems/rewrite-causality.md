# 改写/因果引擎 GDD · 《赤壁·改写者》

> 阶段：Phase 2 · 系统设计（P2-2，S1）　|　执行角色：文策渊（design-strategist）
> 文档版本：v0.1（首版，待主创评审）　|　状态：可评审
> 基线锚点：`AGENTS.md`「设计基线」表、`docs/project-charter.md`「核心循环 Loop A」、`docs/roadmap.md` P2-2。
> 设计依赖（**显式引用**，本 GDD 与之保持一致，不另立术语）：
> - `docs/design/gdd/game-concept.md`（P1-1）——**术语词汇表 §1、设计支柱 §2、核心循环 §5、三节点最小可工作样例 §6、范围分层 §7、待审批项 §9**。本文凡引用写作 `game-concept §x`。
> - `docs/design/gdd/systems-index.md`（P2-1）——**系统清单 §1、职责边界 §2（S1 行）、依赖 DAG §3、横切实体归属 §6、撰写顺序 §7**。本文凡引用写作 `systems-index §x`。
> - `docs/design/art/art-bible.md`（P1-2）——**双轨反差 §0、Δ 视觉编码 §2.5、系统材质 §6、命名空间 §9**。本文凡引用写作 `art-bible §x`。
> 本系统边界以 `systems-index §2`（S1 行）为准；术语以 `game-concept §1` 为准。本文件是改写/因果引擎的**完整八节 GDD**，是整个游戏的"心脏"（`AGENTS.md` 基线），下游 S2~S5 全部读其契约。

---

## 0. 公式符号与单位约定（全篇统一）

> 为杜绝跨文档/跨公式符号漂移，本节定义全篇公式用的符号、单位与取值域。**第 4 节所有公式均回引本表符号**，不另造。

| 符号 | 含义 | 单位 | 取值域 / 类型 |
|---|---|---|---|
| `Δ` | 历史偏差（单个改写单元产出） | 分 | [0, 100] 浮点 |
| `Δ_node` | 节点累计偏差（本节点全部已确认改写之和） | 分 | [0, 100] |
| `Δ_critical` | 重大偏差阈值（节点级，超则世界线震荡） | 分 | 节点数据字段，全局默认 80 |
| `d_i` | 关键变量 `v_i` 的偏离度 | 无量纲 | [0, 1] |
| `w_i` | 关键变量 `v_i` 在 Δ 计算中的权重 | 无量纲 | [0, 1]，节点内 `Σw_i = 1.0` |
| `M` | 意图匹配度（改写结果对声明蓝图的吻合度） | 无量纲 | [0, 1] |
| `w'_i` | 蓝图内变量权重（算 M 用，可与 `w_i` 不同） | 无量纲 | [0, 1]，蓝图内 `Σw'_i = 1.0` |
| `CP` | 因果点（成长货币） | 点 | ≥ 0 整数 |
| `CP_node` | 节点因果点上限（数据字段） | 点 | 节点数据字段，整数 |
| `k` | Δ 加成系数（防"盲改最大"） | 无量纲 | 全局默认 0.5，[0, 1] |
| `Δ_cap` | Δ 加成饱和上限 | 分 | 全局默认 100（即不额外封顶时取 Δ_node 上限） |
| `RE` | 改写能量（执行改写动词的再生资源） | 点 | [0, `RE_max`]，`RE_max` 数据字段 |
| `cost_RE` | 单次改写动词消耗的 RE | 点 | ≥ 0 |
| `diff` | 节点难度系数（可被情报下调） | 无量纲 | [0.5, 2.0]，节点 `diff_base` 数据字段 |
| `intel_cov` | 情报覆盖率（探索产出，降改写难度/解锁蓝图） | 无量纲 | [0, 1] |
| `disc` | 改写能力折扣（来自 S3 成长） | 无量纲 | [0, 0.5]，封顶 0.5 |
| `I` | 反馈强度档位（驱动演出量级） | 枚举 | {`minor`, `notable`, `critical`} |

**命名 / 数据约定**：所有落到 `game/data/*.tres|*.json` 的字段、ID 一律 `snake_case`；朝代命名空间固定 `dyn_threekingdoms_chibi`（与 `art-bible §9.1` 一致），多朝代扩展换命名空间即可（见 §3.7 热切换口）。**存疑的引擎精确实现一律标 `[待程基岩确认]`，本文不臆造 Godot API**。

---

## 1. 概述

### 1.1 系统定位

改写/因果引擎是本项目（`AGENTS.md` 基线）的**系统心脏**：它把玩家在赤壁世界的"改写动词"（杀/救/策反/截断/伪造/误导/说服，见 `game-concept §3.1`）翻译成**可丈量的「历史偏差 Δ」**，并据此产出**因果点 CP**，再经因果链把本节点结果传递到下一节点——从而驱动核心循环 Loop A（`charter` 核心循环、`game-concept §5`）。

- **它是根**（`systems-index §3.1`）：Δ/CP 产出/v_i/节点模型/因果链的**唯一所有者**；任何系统不得反向写入其内部计算状态，只能通过定义好的事件/信号读取契约。
- **它不做什么**（边界以 `systems-index §2` S1 行为准）：不管节点何时被派发/主线顺序（→ S2）、不管 Δ/CP 怎么显示与花掉（→ S3）、不管改写的物理执行移动/战斗/潜行（→ S4/S5）、不管世界长什么样/情报从哪来（→ S5）。

### 1.2 玩家动词（本系统承接的输入）

本系统**消费**玩家动词，把它映射为对关键变量 `v_i` 的改变。动词清单沿用 `game-concept §3.1`，按"对 v_i 的作用方式"归类（便于数据建模）：

| 动词类别 | 具体动词 | 对 v_i 的作用 | 主要承接系统（物理执行） |
|---|---|---|---|
| 直接改值 | 杀 / 救 / 截杀 | 离散改写人物存活类 `v_x ∈ {生,死}` | S4 战斗 / S5 对象交互 |
| 状态改写 | 策反 / 说服 / 误导 | 改写阵营/立场/路径类 `v_x` | S5 对话 / X2 关系（目标态） |
| 伪造 | 伪造（献伪计/假情报） | 改写"程度/真伪"类 `v_x`，常带破绽 | S5 交互 |
| 物理破坏 | 截断 / 潜行破坏 | 改写物件/设施类 `v_x`（如 `v_boat` 连舟程度、`v_altar` 坛状态） | S4 潜行 / S5 |
| 系统侧介入 | 玩家自借（穿越者用系统术法代行） | 直接改写环境类 `v_x`（如 `v_wind`），并触发系统特殊旁白 | S3 术法 → S4 执行 |

> ⚠️ 本系统只负责"动词→v_i 改变→Δ/CP"这条数值链；动词的**物理执行**（走位/战斗/潜行命中）归 S4/S5，执行成功后通过**事件**通知本系统（见 §6 接口）。这正是维持 DAG 无环的硬契约（`systems-index §3.1/§3.3`）。

### 1.3 与核心循环 Loop A 的接口

本系统承担 Loop A 的**「改写」**环，并向**「反馈」**环（S3）输出、向**「任务」**环（S2）回灌因果链（`systems-index §4` 映射表）：

```
… ──②探索(S5)产出情报/世界状态──▶ 【S1 改写/因果引擎】 ──③Δ+CP+分叉演出信号──▶ ③反馈(S3)…
                                        │
                                        └──④因果链 v_i 传递──▶ ①下一节点派发(S2)
```

- **入**：来自 S5 的情报（`intel_cov`）/世界状态（当前 `v_i` 值）/来自 S4 的"动词执行结果"事件。
- **出**：`Δ`（→ S3 显示、S5 高 Δ 视觉化、S2 节点依赖判断）、`CP`（→ S3 账户/兑换，**产出归 S1、账户归 S3 的两段式**，`systems-index §6`）、`分叉演出信号`（→ S3 演出 + X1 旁白）、`因果链解析值`（→ S2 节点存在性/难度）。

---

## 2. 机制

### 2.1 改写如何触发（输入 / 条件 / 流程）

**触发前置条件（全部为"与"，缺一不可）：**

1. **节点已激活**：当前改写节点由 S2 派发并置为 `可改写` 态（节点状态机见 §2.3）。本系统不主动派发节点。
2. **玩家在改写场所 / 接近关键对象**：如 N2 的七星坛、N1 的连舟战船。由 S5 在 L5 系统叠层给出冷光环提示（`art-bible §3.3`）。
3. **前置解锁满足**：部分蓝图/动词需 `intel_cov` 达标或持有特定情报条目（来自 S5 探索）。**这把"探索"变成对"改写"的策略投资**（`game-concept §3.2` 情报→改写收益回路）。
4. **资源充足**：当前 `RE ≥ cost_RE`（改写能量，见 §4.3）。

**触发流程（一次改写单元的生命周期）：**

```
① 接近改写场所(S5提示) 
  → ② 打开改写面板(S3 UI)：系统列出"可用蓝图"(按 intel_cov 过滤)
  → ③ 玩家【选择蓝图】= 声明意图（意图匹配度的来源，见 §2.4 / §4.2）
  → ④ 玩家【选择改写动词】并确认
  → ⑤ 物理执行(S4 战斗/潜行 或 S5 交互)：成功则发"动词执行成功"事件给 S1
       （失败/被发现 → Loop B 微观风险，可重试或转其它动词，不改 v_i）
  → ⑥ S1 据"动词→v_i 映射表"改变 v_i（可能多次，直到玩家【确认改写】锁定节点）
  → ⑦ S1 重算 Δ_node、M、CP_earned → 触发反馈信号组（§6）→ 因果链解析（§2.5）
  → ⑧ 节点锁定 → 因果链把解析值传给下游节点（经 S2 派发判断）
```

> 📌 **"改写单元"与"节点"是两个粒度**：一个节点容纳**多次改写单元**直到玩家"确认锁定"或耗尽 `max_attempts`；锁定后才结算最终 Δ_node/CP 并传递因果链。这给玩家"先试后定"的掌控感（支柱②），同时封顶尝试次数防无限试错（防认知过载/防刷分，见 §5.2）。

### 2.2 "片段 / 节点"模型（数据形态）

> 术语沿用 `game-concept §1`：**改写节点（Rewrite Node）**= 主线上可介入的关键历史时刻；**关键变量 v_i**= 决定节点走向的离散/数值状态量；**因果链**= 节点间 v_i 的传递关系。

**节点（Rewrite Node）的组成（数据形态，字段细节见 §3）：**

- `node_id`、`title`、`dynasty`（命名空间）、`position`（世界坐标，S5 用）。
- `vars[]`：本节点的关键变量集合（每个 `v_i` 有 `baseline` 基准值 + 偏离度表 `deviation_table`）。
- `blueprints[]`：可选改写蓝图（**意图声明的可选项**，见 §2.4），每条声明一组 `target_vars` 目标值。
- `verbs[]`：本节点可用的改写动词（含 `cost_base`、`→ v_i 改变映射`）。
- `causal_out[]`：本节点对下游的因果链出口（见 §2.5）。
- `existence_dep`：本节点**存在性依赖**（特殊因果链，见 §2.5 / §2.6）。
- `Δ_critical`、`CP_node`、`diff_base`、`max_attempts`：平衡参数（§4）。

**改写单元（Rewrite Unit，一次执行）= (所选蓝图, 所选动词序列, 目标 v_i 改变, 执行结果)**。改写单元是瞬态的，不持久化；锁定时只持久化"节点最终 v_i 取值 + Δ_node + CP_earned + 选中蓝图"。

### 2.3 节点状态机（与 S2 协作）

> 本系统定义节点的**内部数值态**；节点的**生命周期态机（未激活/进行/已完成/已消失）**所有权在 S2（`systems-index §2` S2 行）。两者通过事件协同：

| S2 生命周期态 | S1 内部数值态 | 说明 |
|---|---|---|
| `未激活` | — | 未被派发，S1 不持有数据。 |
| `可改写`（S2 激活） | `v_i = baseline`（首次）或上次未锁定值 | S1 接受改写单元输入。 |
| `执行中`（玩家改写进行） | `v_i` 随改写单元变化（未锁定） | 玩家可多次试改；Δ_node 实时预览（§2.7）。 |
| `已确认`（玩家确认锁定 / 耗尽 max_attempts） | `v_i` 锁定 → 结算 Δ_node / CP / 因果链 | S1 发 `node_resolved`；S2 据因果链决定下游节点存在性。 |
| `已消失`（存在性依赖不满足） | 丢弃未结算态 | S2 发 `node_vanished`；S1 据存在性规则可能派发**替代节点**（`game-concept §6.3`，目标态）。 |

### 2.4 意图匹配度 M——【提议方案，待主创审批】

> ⚠️ 这是 `game-concept §9③` 的悬而未决项（"意图匹配度如何被系统判定"），**直接决定主导策略**（§5.1），是本系统设计的核心待决策点。本文给出一套**具体可审批的方案**，不擅自定稿。

**提议：改写蓝图（Rewrite Blueprint）= 显式意图声明机制。**

- **机制**：玩家进入改写面板后，系统（轨道 B 冷光，`art-bible §6`）列出本节点**可用蓝图**；每条蓝图 = 一组 `target_vars`（玩家"打算让 v_i 变成什么"）+ 一句系统风格的意图标签（如「让火攻哑火」「让曹操败走华容」）。**玩家选蓝图 = 显式声明意图**。
- **蓝图可见性受 `intel_cov` 门控**：探索越充分，可见/可选的蓝图越精确（高 `intel_cov` 解锁"精确蓝图"，低 `intel_cov` 只能给"模糊蓝图"，M 上限相应更低）。**这把探索→改写→反馈串成可读闭环**（`game-concept §3.2`）。
- **M 计算**：改写锁定后，比对"实际 v_i 取值"与"所选蓝图 target_vars"，按蓝图内权重 `w'_i` 加权吻合度（公式见 §4.2）。
- **设计意图（为何选显式而非隐式）**：① 让"意图"对玩家**可读、可掌控**（支柱②胜任）；② 给 CP 公式一个干净可测的信号（`game-concept §9③` 待定的正是这个信号）；③ 与情报系统天然耦合，强化探索收益。代价是认知成本略增——由蓝图数量上限 + 信息分级缓解（§5.3）。

> **待主创审批**：(a) 是否采用"蓝图=显式意图"方案；(b) 蓝图可见性门控的强度（强门控=更重度策略，弱门控=更轻度）。本文后续公式以"采用本方案"为前提给出，若主创改方向需同步调整 §4.2 与 §5.1。

### 2.5 因果链（跨节点 v_i 传递）

> 落地 `game-concept §3.1` 因果链机制与 `game-concept §6` 三节点联动。规则只在 S1 定义（`systems-index §6` 因果链所有权）。

**因果链类型（数据形态，细节见 §3.4）：**

| 类型 | 含义 | 赤壁示例 |
|---|---|---|
| **值传递（value）** | 上游节点的某 `v_i` 解析值，作为下游节点的**输入/前置约束**。 | N1 的 `v_boat` 传入 N2 的火攻威力计算（`game-concept §6.2`）。 |
| **存在性（existence）** | 上游结果决定下游节点**是否存在**（最重的因果联动）。 | N3 华容道仅在 N2 火攻成功、曹操大败时存在（`game-concept §6.3`）。 |
| **难度调制（difficulty）** | 上游结果改变下游节点 `diff_base` 或蓝图可见性。 | N1 连舟"半连有破绽"→ N2 火攻 `diff` 下降（破绽可利用）。 |

**关键约束（防因果网爆炸，守 `game-concept §7.4` 范围）**：本垂直切片因果链**限定在 3 节点最小链**（N1→N2→N3），不做复杂因果网；存在性依赖**最多一层**（N3 依赖 N2，不递归）。超出范围列为愿景。

**解析时机**：节点 `已确认` 时，S1 沿因果链解析下游输入值，发 `causal_link_propagated` 事件；**S2 据此决定下游节点派发/消失**（存在性依赖的"派发决策"所有权在 S2，规则数据在 S1，见 §7 边界交叉确认）。

### 2.6 历史偏差如何度量（Δ 的产出链）

落地 `game-concept §3.1` 示意公式 `Δ = Σ_i ( w_i · d(v_i) )`，**定稿**为可落数据的形式（公式见 §4.1）：

1. 每个 `v_i` 有一张**偏离度表 `deviation_table`**：把 `v_i` 的每个取值映射为 `d_i ∈ [0,1]`（`baseline` 取值恒为 `d=0`）。**离散枚举型用查表，有序/数值型用 `d = |actual-baseline| / range`**（§4.1）。
2. 节点内 `Σ w_i = 1.0` 归一化，使 `Δ_node ∈ [0,100] 分`，跨节点、跨朝代可比。
3. `Δ_node` 是**双效数值**（`game-concept §5.2`）：既是 CP 成长来源（§4.2），又经因果链影响下游存在性/难度（§2.5）。

### 2.7 历史偏差如何呈现（预览 + 反馈）

- **实时预览（执行中态）**：玩家改写 v_i 时，S3 面板**实时预览** Δ_node 变化（冷光数值跳动，`art-bible §6.1`），让玩家"看得见天平"（支柱②）。此预览**不发 CP、不锁因果链**，仅 UI 反馈。
- **结算反馈（锁定后）**：节点确认后，S1 发最终 Δ_node → S3 触发**历史线分叉演出**（`game-concept §5.2` 情感峰值，演出资产归 S3+X1，本系统只发触发信号）。
- **Δ 视觉编码三档**（落地 `art-bible §2.5`）：`minor`（Δ≈0~低，色温稳）/ `notable`（中 Δ，冷光描边+浮标）/ `critical`（≥ Δ_critical，世界线震荡 glitch）。档位映射见 §4.4。

### 2.8 反馈回成长面板的钩子

锁定后 S1 向 S3 发**一组结算信号**（§6 契约）：`deviation_recomputed(node, Δ_node)` + `cp_awarded(amount, reason)` + `intent_match_computed(node, M)` + `feedback_tier(I)` + 可选 `critical_deviation_triggered`。**S3 据此更新 CP 账户、播演出、刷新技能树可用性**——CP 账户/兑换的所有权在 S3（两段式，`systems-index §6`），本系统只负责"算出 CP_earned 并发出"，**不持有 CP 余额**。

---

## 3. 数据（为落 `game/data/*.tres|*.json` 铺路）

> 遵循 `AGENTS.md` 数据驱动约定 + `art-bible §9` 命名规范（`snake_case` + 朝代命名空间）。下列为**设计侧字段契约**，是给程基岩 P3 架构的输入；**`.tres` 资源类名、Godot 类型映射标 `[待程基岩确认]`**，本文只定"要存什么、叫什么"。

### 3.1 关键变量 `v_i` —— `game/data/variables/<var_id>.tres`

```yaml
# 示例：v_boat（连环计连舟程度）
var_id: v_boat
display_name: "连舟程度"
dynasty: dyn_threekingdoms_chibi        # 朝代命名空间（多朝代换此字段）
type: enum                               # enum | ordered | numeric
values:                                  # 枚举取值（ordered/numeric 用 min/max/step）
  - { key: unchained,  display: "未连" }
  - { key: half_chain, display: "半连" }
  - { key: full_chain, display: "全连" }
baseline: full_chain                     # 史实基准取值（d 恒为 0）
deviation_table:                         # d_i ∈ [0,1]，每取值的偏离度（数据驱动，可手调）
  unchained:  1.0
  half_chain: 0.5
  full_chain: 0.0                        # = baseline
world_visual:                            # S5 视觉映射契约（art-bible §9.5）
  unchained:  prop_dyn_threekingdoms_chibi_ship_tower_chain_off
  half_chain: prop_dyn_threekingdoms_chibi_ship_tower_chain_partial
  full_chain: prop_dyn_threekingdoms_chibi_ship_tower_chain_on
```

> **设计意图**：`deviation_table` 让"偏离度"可逐值手调（而非死板的距离公式），便于叙事定权——例如"半连有破绽"可与"半连无破绽"给不同 d 值。`world_visual` 是给 S5 的只读契约（视觉化所有权在 S5，`systems-index §6`）。

### 3.2 改写节点 —— `game/data/nodes/<node_id>.tres`

```yaml
node_id: n2_east_wind                    # N2 借东风
display_title: "借东风"
dynasty: dyn_threekingdoms_chibi
position: { x: 1280, y: 960 }            # S5 世界坐标（占位，待 S5/P3 定坐标系）
vars:                                    # 本节点 v_i（引用 variables/*.tres）+ Δ 权重 w_i
  - { var_id: v_wind,  w: 0.6 }
  - { var_id: v_altar, w: 0.2 }
  - { var_id: v_kong,  w: 0.2 }
blueprints:                              # 改写蓝图（意图声明可选项）— 见 §3.3
  - bp_fire_fail
  - bp_player_self_wind
  - bp_baseline_keep
verbs:                                   # 本节点可用改写动词
  - verb_smash_altar
  - verb_block_kongming
  - verb_self_borrow_wind
causal_out:                              # 对下游因果链出口 — 见 §3.4
  - link_fire_power_to_n3_existence
  - link_wind_to_n3
existence_dep:                           # 本节点自身是否存在（特殊因果链入口）
  type: none                             # N2 是链首，无存在性依赖；N3 此处填 existence 型 link
delta_critical: 80                       # 重大偏差阈值（分）— 全局默认见 §0
cp_node: 120                             # 节点因果点上限（点）
diff_base: 1.2                           # 节点难度系数 [0.5,2.0]
max_attempts: 3                          # 改写单元上限（防刷分，见 §5.2）
system_intro: "已锁定目标：借东风。当前节点偏差归零。记录员就位。"  # 系统派单语气（X1，game-concept §9① 待审批）
```

### 3.3 改写蓝图（意图声明）—— 嵌于节点 `blueprints[]` 或独立 `game/data/blueprints/*.tres`

```yaml
blueprint_id: bp_player_self_wind        # N2 分支 C：玩家自借东风
intent_label: "由你之手，借这阵东风"     # 系统风格意图标签（冷光旁白用）
target_vars:                             # 目标 v_i 取值（M 比对的基准）
  v_wind:  southeast
  v_altar: intact                        # 可只声明部分变量（未声明的 M 不计）
m_weights:                               # 蓝图内权重 w'_i（算 M，Σ=1.0）
  v_wind: 1.0
unlock_intel_cov: 0.6                    # 需 intel_cov≥0.6 才可见（探索门控，§2.4）
special_flags:                           # 满足时触发的系统特殊旁白/演出
  triggers_system_voice: self_replacement  # game-concept §6.2 分支C「功劳归于玩家」
```

> **`baseline` 蓝图**：每节点隐含一条"维持原线"蓝图（`target_vars` = 全 baseline）；选它且执行成功 → M 高、Δ≈0、CP 最低（防"躺平最优"，§5.1）。

### 3.4 因果链 —— `game/data/causal_links.tres`（聚合表）

```yaml
links:
  - link_id: link_wind_to_n3
    type: value                          # value | existence | difficulty
    source: { node: n2_east_wind, var: v_wind }
    target: { node: n3_huarong, input: fire_power }   # 作为下游"输入变量"
    transform:                           # 上游值→下游输入的映射（数据驱动）
      southeast: high
      none:      none
      northwest: reverse

  - link_id: link_fire_power_to_n3_existence
    type: existence                      # 存在性依赖（最重）
    source: { node: n2_east_wind, input: fire_power }  # 注意：可依赖"输入变量"而非原始 v_i
    target_node: n3_huarong
    condition: "fire_power == high"      # N3 仅当火攻大胜才存在（game-concept §6.3）
    on_false: spawn_alternative          # 不满足则由 S2 派替代节点（目标态）

  - link_id: link_boat_to_n2_difficulty
    type: difficulty
    source: { node: n1_chain_scheme, var: v_boat }
    target: { node: n2_east_wind, field: diff_base }
    transform:                           # N1 连舟"半连有破绽"→ N2 火攻难度↓
      half_chain: 0.8
      unchained:  1.0
      full_chain: 1.0
```

> ⚠️ **存在性依赖的所有权切分**（交叉确认 `systems-index §2`）：**规则与数据归 S1**（本表 `type: existence`），**派发/消失的决策归 S2**（S1 发 `causal_link_propagated`，S2 读 condition 决定是否激活/派替代节点）。两段式，无重复。

### 3.5 改写动词 —— `game/data/verbs/<verb_id>.tres`

```yaml
verb_id: verb_self_borrow_wind           # 玩家自借东风（系统侧介入）
cost_base: 40                            # 基础 RE 消耗（点）
effect:                                  # → v_i 改变映射
  set: { v_wind: southeast }
  flags: [system_side, triggers_self_replacement_voice]   # 触发系统特殊旁白
requires:                                # 物理执行前置（由 S4/S5 校验）
  ability: ability_system_magic_wind     # 需 S3 已解锁该系统术法
  scene: scene_altar                     # 需在七星坛场所
```

### 3.6 运行时状态（**非持久数据，仅设计侧"需存什么"清单**——X4 存档消费）

> 存档所有权在工程（X4，`systems-index §1.2`）。本系统声明**需被持久化的状态**（设计侧契约，给程基岩）：

```yaml
save_state_rewrite_engine:
  active_dynasty: dyn_threekingdoms_chibi
  resolved_nodes:                        # 已确认节点：最终 v_i + Δ + CP + 选中蓝图
    - { node_id: n1_chain_scheme, final_vars: {...}, delta_node: 40, cp_earned: 90, blueprint: bp_reveal }
  unresolved_node_snapshot:              # 当前"执行中"节点的未锁定 v_i（支持 §5.4 回溯）
    node_id: n2_east_wind
    working_vars: { v_wind: none, v_altar: intact }
    attempts_used: 1
  causal_resolved_inputs:                # 因果链已解析的下游输入值（存在性判断依据）
    n3_huarong:
      fire_power: high                   # → N3 存在
  critical_flags:                        # 世界线震荡标记（影响后续节点难度/演出）
    worldline_shaken: false
  re: 60                                 # 当前改写能量
```

### 3.7 朝代热切换口（多朝代扩展铺路，**本切片不实现**）

> 落地 `AGENTS.md` Godot 约定「朝代 = TileSet + 遭遇表 + BGM 组合热切换」+ `art-bible §5.1` 视觉 token + `game-concept §7.3` 愿景。

**本系统的热切换契约**：
- 上述所有数据（`variables/`、`nodes/`、`blueprints/`、`causal_links`、`verbs`）均带 `dynasty` 命名空间字段；引擎按 `active_dynasty` 加载对应数据包。
- **Δ / M / CP 公式（§4）朝代无关**（纯数值，不含朝代硬编码）——换朝代只换数据，不换公式。
- **跨朝代偏差累积**（一个穿越者的"偏差总账"）列为愿景（`game-concept §7.3`），本切片**不做**，但 `save_state_rewrite_engine` 的 `resolved_nodes` 结构已为"按朝代分组累积"留口（未来加 `dynasty` 维度即可）。

> ✅ **预留验收**：本切片结构满足"换数据包即可换朝代"，不挡多朝代扩展的路。

---

## 4. 公式（统一格式 · 标变量与单位）

> 本节是本系统心脏的数值定稿。所有符号见 §0。每条公式给出：**公式式 → 变量说明 → 设计意图/防红线注释**。

### 4.1 历史偏差 Δ（节点锁定时结算）

```
Δ_node = Σ_i ( w_i · d_i ) · 100            [分]，结果 ∈ [0, 100]
```

| 变量 | 含义 | 单位 | 来源 |
|---|---|---|---|
| `w_i` | 变量 `v_i` 的 Δ 权重，节点内 `Σw_i = 1.0` | 无量纲 | 节点数据 `vars[].w` |
| `d_i` | 变量 `v_i` 当前取值的偏离度 ∈ [0,1] | 无量纲 | 变量数据 `deviation_table` |

- **离散枚举型**：`d_i = deviation_table[ v_i.current ]`（查表）。
- **有序/数值型**：`d_i = clamp( |actual − baseline| / range, 0, 1 )`，`range = max − min`。
- **设计意图**：归一化到 [0,100] 使 Δ **跨节点、跨朝代可比**（朝代热切换前提）。`game-concept §6` 示意值（+15~+90）与此量纲一致。
- **防红线**：`d_i` 由数据表手调，**可对"看似大改实则历史无关"的取值压低 d**，避免玩家刷无意义偏差（经济失衡防线之一）。

### 4.2 意图匹配度 M 与因果点 CP 产出

**意图匹配度**（前提：采用 §2.4 蓝图方案）：

```
M = Σ_i ( w'_i · match_i )                  [无量纲]，结果 ∈ [0, 1]
match_i =
  离散型:  1.0 if v_i.actual == v_i.target else 0.0
  有序/数值: clamp( 1 − |actual − target| / range, 0, 1 )
```

| 变量 | 含义 | 单位 | 来源 |
|---|---|---|---|
| `w'_i` | 蓝图内变量权重，蓝图内 `Σw'_i = 1.0` | 无量纲 | 蓝图数据 `m_weights` |
| `match_i` | 单变量吻合度 | 无量纲 [0,1] | 上式 |
| `target` | 所选蓝图声明的目标值 | 同 `v_i` 类型 | 蓝图 `target_vars` |

**因果点产出**：

```
CP_earned = round( CP_node · M · ( 1 + k · min(Δ_node, Δ_cap) / Δ_cap ) )     [点]，整数 ≥ 0
```

| 变量 | 含义 | 单位 | 默认 |
|---|---|---|---|
| `CP_node` | 节点因果点上限 | 点 | 节点数据 |
| `M` | 意图匹配度 | 无量纲 [0,1] | §4.2 |
| `k` | Δ 加成系数（**防"盲改最大"的关键旋钮**） | 无量纲 | 全局 0.5 |
| `Δ_cap` | Δ 加成饱和上限 | 分 | 全局 100 |

**防主导策略解读（守 `game-concept §5.4`）**：
- **"躺平贴合最优"被否决**：选 baseline 蓝图 → M 高但 `Δ_node≈0` → `CP = CP_node·M·1`；选并执行好一个偏离蓝图 → M 高 + `Δ>0` 加成 → CP 更高。**贴合史实永远是较低收益**，倒逼主动改写。
- **"全力改写最优"被否决**：盲改大 Δ 而不匹配蓝图 → `M≈0` → `CP ≈ 0`；只有"声明意图并精确达成"才拿满。`Δ_cap` + `k<1` 进一步压住 Δ 加成上限。
- **双保险**：即便 M 高 + 大 Δ，超出 `Δ_critical` 仍触发**世界线震荡惩罚**（§4.5），第二道防线。

> ⚠️ **CP 仅"产出"于此公式；CP 余额/兑换规则归 S3**（两段式所有，`systems-index §6`）。本系统发 `cp_awarded(CP_earned)` 后即放手。

### 4.3 改写消耗（改写能量 RE）

```
cost_RE(verb, node) = cost_base(verb) · diff(node) · ( 1 − disc )            [点]
diff(node)         = diff_base(node) · ( 1 − intel_cov )                     [无量纲]
RE(t)              = clamp( RE(t−1) − cost_RE + regen, 0, RE_max )           [点]
```

| 变量 | 含义 | 单位 | 默认/来源 |
|---|---|---|---|
| `cost_base(verb)` | 动词基础消耗 | 点 | 动词数据（截杀高/说服低） |
| `diff(node)` | 节点有效难度系数 ∈ [0.5, 2.0] | 无量纲 | 上式 |
| `diff_base` | 节点基础难度 | 无量纲 | 节点数据 |
| `intel_cov` | 情报覆盖率 ∈ [0,1]（探索产出，S5 提供） | 无量纲 | S5 只读契约 |
| `disc` | 改写能力折扣 ∈ [0, 0.5]，封顶 0.5 | 无量纲 | S3 成长只读契约 |
| `regen` | RE 再生速率 | 点/秒 或 点/事件 | **[待审批]**（见下） |
| `RE_max` | RE 上限 | 点 | 数据字段 |

**设计意图**：① `intel_cov` 直接下调 `diff` → **探索显式降低改写成本**（`game-concept §3.2` 情报→改写收益回路数值化）；② `disc` 来自 S3 成长 → **成长反哺改写能力**（Loop A 闭环），且封顶 0.5 防后期无消耗（经济失衡防线）。
**[待审批] RE 再生曲线**：倾向"按节点重置 + 营寨休整/探索事件补充"，**不做**纯时间挂机再生（防 AFK 刷分）。精确值待 P2-4 面板经济曲线对齐后定。

### 4.4 反馈强度档位 I（驱动演出，落地 `art-bible §2.5`）

```
I =
  minor    if Δ_node <  Δ_minor_threshold        （默认 20 分）
  notable  if Δ_minor_threshold ≤ Δ_node < Δ_critical
  critical if Δ_node ≥ Δ_critical                （默认 80 分）
```

| 变量 | 含义 | 单位 | 默认 |
|---|---|---|---|
| `Δ_minor_threshold` | "轻微偏差"上限 | 分 | 20 |
| `Δ_critical` | 重大偏差阈值 | 分 | 80（节点可覆盖） |

- `I` 映射到 **Δ 视觉三档**（`art-bible §2.5`：minor 色温稳 / notable 冷光描边+浮标 / critical glitch 震荡）与**演出量级**（minor 仅数值跳动 / notable 短分叉演出 / critical 长演出+世界线震荡）。
- **演出资产/脚本归 S3+X1**（`systems-index §6` 历史线两段式）；本系统只发 `feedback_tier(I)` 信号。

### 4.5 重大偏差 / 世界线震荡（第二道防主导策略防线）

> 落地 `game-concept §6.3` 重大偏差机制。**触发条件**：`Δ_node ≥ Δ_critical` 且 `I = critical`。

```
on_critical:
  CP_earned        不变（仍按 §4.2 发放，不双倍）   # 防止"震荡=高收益"反激励
  worldline_shaken = true                            # 存档标记，影响下游
  downstream_effects:                                # 由 S2/S5 消费（存在性/难度/演出）
    - 后续节点 diff_base 上浮（建议 +0.2，[待审批]）
    - 触发世界线震荡演出（X1 旁白 + art-bible §2.5 glitch）
    - 可能改变下游节点存在性（经 existence 型因果链）
```

**设计意图**：震荡**不直接扣 CP**（避免"惩罚=少发钱"的负面反馈），而是**把风险转嫁到未来**（下游更难/世界线更乱）——这制造"短爽长险"的张力，呼应 `game-concept §6.3`「世界线剧烈震荡」的叙事卖点，同时抑制无脑制造最大偏差。

> ⚠️ **[待审批] 震荡下游影响的精确强度**（diff 上浮幅度、是否影响存在性）须与 S2（P2-3）联合定，本文给倾向值。

### 4.6 公式总览（一眼速查）

| 量 | 公式 | 单位 |
|---|---|---|
| 节点偏差 | `Δ_node = Σ(w_i·d_i)·100` | 分 [0,100] |
| 意图匹配 | `M = Σ(w'_i·match_i)` | 无量纲 [0,1] |
| 因果点产出 | `CP_earned = round(CP_node·M·(1+k·min(Δ,Δ_cap)/Δ_cap))` | 点 |
| 改写消耗 | `cost_RE = cost_base·diff_base·(1−intel_cov)·(1−disc)` | 点 |
| 反馈档位 | `I = tier(Δ_node vs Δ_minor/Δ_critical)` | 枚举 |

---

## 5. 边缘情况（≥3 类，逐类给判定与处理）

### 5.1 连续改写同一节点（"刷分 / 反复试"）—— 经济失衡 + 主导策略红线

- **现象**：玩家在一个节点反复改写以累积 CP，或不断试错找最优蓝图。
- **判定/处理**：
  1. `max_attempts`（节点数据，默认 3）封顶**改写单元次数**；耗尽则强制 `已确认` 结算（§2.3）。
  2. **CP 只在锁定时结算一次**（不是每次改写都发），彻底杜绝"按次刷分"。
  3. 蓝图选定后**本节点不可更换**（防"试遍所有蓝图取最优 M"）——一旦声明意图即锁定意图，强化"选择有分量"（支柱①）。
- **红线标注**：此条是**经济失衡/主导策略**的直接防线；若移除 `max_attempts` 或改为按次发 CP，支柱①②崩塌。**严禁弱化**。

### 5.2 偏差溢出 / 世界线震荡级联（认知过载 + 支柱漂移风险）

- **现象**：玩家连续多个节点触发 `critical`，世界线震荡标记累积，下游节点大面积消失/难度暴增，玩家看不懂"为什么世界变成这样"。
- **判定/处理**：
  1. `worldline_shaken` 标记**不无限累积**下游惩罚（建议封顶 2~3 次震荡后封顶 diff 上浮，**[待审批]**）。
  2. 存在性依赖**最多一层**（§2.5），不允许"震荡→节点消失→下游又消失"的级联（守 `game-concept §7.4` 3 节点最小链范围）。
  3. 系统在连续 critical 时发**降维旁白**（X1，轨道 B 冷光简报）向玩家解释"当前世界线状态"，防认知过载（呼应 `art-bible §6` 系统材质可读性）。
- **红线标注**：此条守**认知过载 + 支柱③（可丈量沙盘可读性）**；级联一旦失控，玩家失去对因果的可读掌控，支柱③崩塌。

### 5.3 改写与主线冲突（因果链 / 存在性边界）—— 系统一致性红线

- **现象**：玩家改写使下游节点应"消失"（如 N2 风借失败 → N3 华容道不该存在），但 S2 仍派发了 N3；或 S4 战斗已"杀了曹操"但 v_cao 未更新。
- **判定/处理**：
  1. **存在性优先**：S1 发 `causal_link_propagated(type=existence)` 后，S2 **必须**据此决定 N3 派发/消失（契约硬约束，`systems-index §3.1` DAG）。本系统在 N3 数据 `existence_dep` 标 `type: existence`。若 S2 仍派发，属 S2 bug，非本系统责任——**本系统只保证规则数据正确发出**。
  2. **S4 战斗结果必经事件**：S4"杀曹操"成功 → 发 `verb_executed(verb_kill_cao, success)` → S1 据 `verbs[].effect.set` 改 `v_cao=死` → 再算 Δ。**S4 绝不直接写 v_i/Δ**（DAG 硬契约，`systems-index §3.1/§3.3`）。若 S4 跳过事件直写，属越权，本系统拒绝承认。
  3. 边界交叉确认已写入 §7（与 S2/S4 双向）。
- **红线标注**：此条守**系统一致性 / DAG 无环**；任一系统越权直写共享数值，整个心脏的可测试性崩塌。

### 5.4 存档回溯与未锁定改写（数据一致性）—— X4 协作

- **现象**：玩家在节点"执行中"（未锁定、`working_vars` 已改）时存档/读档/退出。
- **判定/处理**：
  1. **未锁定改写可回滚**：存档保留 `unresolved_node_snapshot.working_vars` 与 `attempts_used`（§3.6）；读档恢复到"执行中"态，**不结算 Δ/CP**（因未锁定）。
  2. **已锁定节点不可回滚**：`resolved_nodes` 一经写入即历史事实（呼应"历史已改写"的叙事）；若主创要求"悔棋"，须作为独立功能设计（**[待审批]，本切片不做**）。
  3. **CP 已发即不撤**：即便读档到锁定前，已结算的 CP_earned 视为"已入账"（账户在 S3）；回溯不撤 CP，避免刷分（与 §5.1 一致）。
- **红线标注**：此条守**经济一致 + 叙事一致**；"悔棋"若开放将直接破坏 §5.1 防刷分。

### 5.5 蓝图与实际不可达（设计/数据配置错误兜底）—— 数据健壮性

- **现象**：数据配置错误，某蓝图 `target_vars` 给了当前动词集合**无法达成**的取值（玩家永远 M=0）。
- **判定/处理**：
  1. **设计侧验收**：§8 验收要求每条蓝图至少存在一组动词可达（数据 QA，归严守真 P5/P6）。
  2. **运行兜底**：若锁定时 M=0，仍按公式发 `CP_earned≈0`（不崩），并触发系统"旁白：意图落空"（X1）作为叙事兜底——**不抛错、不卡流程**。
  3. 标 `[待程基岩确认]`：是否在数据加载时静态校验"蓝图可达性"（建议做，归工程）。

---

## 6. UI 接口（信号 / 事件契约，衔接 P4-1 UX 规格）

> 本系统**只发信号、不实现 UI**（UI 归 S3，`systems-index §2`）。下列是**设计侧的事件/信号契约**，落地用 Godot 信号（`AGENTS.md`「信号优先于全局单例滥用」）。**Godot 信号精确签名（参数类型、Signal 名规约）标 `[待程基岩确认]`**，本文定义"信号名 + 载荷语义 + 消费方"。

### 6.1 本系统对外发出的信号（S1 → 消费方）

| 信号名（建议） | 载荷 | 触发时机 | 主消费方 |
|---|---|---|---|
| `blueprint_declared(node_id, blueprint_id)` | 节点、所选蓝图 | 玩家选蓝图（§2.1③） | S3（面板意图高亮）、X1（旁白） |
| `variable_changed(var_id, old_value, new_value, is_preview)` | 变量、旧/新值、是否预览 | 改写单元改 v_i（§2.1⑥） | S3（Δ 实时预览）、S5（视觉切换 `world_visual`） |
| `deviation_recomputed(node_id, delta_node, is_preview)` | 节点、Δ、是否预览 | v_i 变后重算（§2.6/§2.7） | S3（Δ 条/数值）、S5（Δ 视觉三档） |
| `intent_match_computed(node_id, m)` | 节点、M | 锁定时算 M（§4.2） | S3（结算面板） |
| `cp_awarded(amount, node_id, reason)` | CP 量、节点、原因 | 锁定结算（§4.2） | **S3（CP 账户入账，两段式）** |
| `feedback_tier(node_id, tier)` | 节点、档位 I | 锁定结算（§4.4） | S3（演出量级）、X1（旁白长度） |
| `critical_deviation_triggered(node_id, delta_node)` | 节点、Δ | Δ≥Δ_critical（§4.5） | S3（世界线震荡演出）、S2（下游难度/存在性预警） |
| `causal_link_propagated(link_id, source_node, resolved_value, target)` | 链、源、解析值、目标 | 节点锁定后（§2.5） | **S2（下游节点派发/消失决策）**、S5（世界状态更新） |
| `node_resolved(node_id, final_vars, delta_node, cp_earned)` | 节点、最终 v_i、Δ、CP | 锁定（§2.3） | S3（结算屏）、X4 存档（持久化触发） |
| `node_vanished(node_id)` | 节点 | 存在性依赖不满足（经 S2 判定后回告） | S3（UI 标记）、S5（场所移除） |

### 6.2 本系统接收的信号（消费方 → S1）

| 信号名（建议） | 载荷 | 来源 | 本系统响应 |
|---|---|---|---|
| `node_activated(node_id)` | 节点 | S2 | 初始化节点 v_i=baseline，进入 `可改写` 态 |
| `verb_executed(verb_id, target, success)` | 动词、目标、成败 | **S4（战斗/潜行）/ S5（交互）** | 成功则按 `verbs[].effect` 改 v_i（**S4/S5 不直写 v_i**，§5.3） |
| `intel_updated(intel_cov, new_intels[])` | 覆盖率、新情报 | S5 | 更新 `intel_cov`（降 `diff`、解锁蓝图可见性） |
| `ability_changed(ability_id, disc_delta)` | 能力、折扣增量 | S3（成长） | 更新 `disc`（封顶 0.5） |
| `node_committed(node_id)` | 节点 | S3（玩家点"确认改写"）/ S2（耗尽 attempts） | 进入锁定结算流程（§2.1⑦⑧） |

### 6.3 与 P4-1 UX 规格的衔接点（给文策渊 Phase 4 自己）

> 本节是给未来 P4-1（关键屏幕 UX 规格）的**输入清单**，定义"改写面板"须呈现的信息：

- **改写面板（轨道 B 系统材质，`art-bible §6`）需显示**：①当前节点 + 系统派单语气开场；②可用蓝图列表（按 `intel_cov` 过滤，冷光卡片）；③选中蓝图的 `target_vars` 与意图标签；④可用动词 + `cost_RE` 预览；⑤实时 Δ 预览条（`deviation_recomputed(is_preview=true)`）；⑥M 预估（若可算）；⑦"确认改写"按钮（触发 `node_committed`）。
- **结算屏需显示**：`Δ_node`、`M`、`CP_earned`、`feedback_tier`、（若 critical）世界线震荡警告。
- **HUD 常驻**：当前节点名 + Δ 指示条（`art-bible §6.2` HUD 极简）、RE 条。
- ⚠️ **信息密度分级**（守 `systems-index §8` 认知过载红线）：核心（Δ/CP/RE）常驻；进阶（M/蓝图对比）按需展开；隐藏（d_i/w_i 权重）默认折叠，供硬核玩家查。

---

## 7. 依赖（与 S2/S3/S4/S5 的边界与数据流）

> 边界以 `systems-index §2` 为准；本节做**心脏视角的交叉确认**，尤其落实 `systems-index §3.3` 提醒的"唯一需警惕的反向耦合：成长→改写更强"。

### 7.1 与 S2 主线任务系统（P2-3）

- **S2 → S1**：`node_activated`（派发节点）、`node_committed`（耗尽 attempts 强制锁定）。
- **S1 → S2**：`causal_link_propagated`（含 existence 型，**S2 据此决定下游节点派发/消失**）、`node_resolved`、`node_vanished` 回告。
- **边界**：**存在性依赖的规则数据归 S1（§3.4 `type: existence`），派发决策归 S2**（两段式，`systems-index §2/§6`）。节点状态机的"生命周期态"归 S2，"内部数值态"归 S1（§2.3）。
- **引用**：`game-concept §6.3`（N3 存在性依赖）、`systems-index §2` S2 行、§3.1 DAG。

### 7.2 与 S3 面板/成长系统（P2-4）

- **S1 → S3**：`deviation_recomputed`、`cp_awarded`、`intent_match_computed`、`feedback_tier`、`critical_deviation_triggered`、`blueprint_declared`（S1 不持有 CP 余额）。
- **S3 → S1**：`ability_changed`（更新 `disc`）、`node_committed`（玩家确认）。
- **边界（CP 两段式，`systems-index §6`）**：**产出归 S1（§4.2 公式），账户/兑换归 S3**。S3 不得反向改 `CP_earned`；S1 不持有余额。
- **⚠️ 反向耦合确认（`systems-index §3.3` 提醒点）**：成长使 `disc↑` → 改写消耗↓ → 玩家更强。已通过"`disc` 作为 S3 暴露的**只读契约**、S1 读取（非控制反转）"解耦，**仍是 DAG 边 S1←S3 的数据契约，无环**。`disc` 封顶 0.5（§4.3）防后期无消耗（经济防线）。**本确认即为 systems-index §3.3 要求的交叉确认，✅ 已落实。**

### 7.3 与 S4 实时战斗系统（P2-5）

- **S4 → S1**：`verb_executed(verb_id, target, success)`（战斗/潜行/截杀结果）。
- **S1 → S4**：（无直接；S4 从 S3 读玩家能力/HP 契约，`systems-index §3.1`）。
- **边界（DAG 硬契约）**：**S4 绝不直接写 v_i/Δ**（§5.3）；战斗"杀了曹操"只是发事件，由 S1 判定 `v_cao=死` 并算 Δ。战斗**不直接产出 Δ**（`game-concept §5.3`），只通过事件间接。
- **引用**：`systems-index §3.1/§3.3`（S4 只发事件、不写 Δ）。

### 7.4 与 S5 开放世界/朝代地图（P2-6）

- **S5 → S1**：`intel_updated(intel_cov, new_intels)`（探索产出情报，降 `diff`/解锁蓝图）。
- **S1 → S5**：`variable_changed`（S5 据此切换 `world_visual`，如连舟铁索 `_on/_off`，`art-bible §9.5`）、`deviation_recomputed`（高 Δ 视觉三档，`art-bible §2.5`）。
- **边界**：v_i 的**枚举/取值/基准只在 S1 定义**（§3.1）；S5 只做 `world_visual` 视觉映射（只读契约，`systems-index §6`）。情报"从哪来"归 S5，"怎么用（降 diff/解锁蓝图）"归 S1。

### 7.5 引用的前置文档（一致性锚）

- `game-concept.md`：§1 术语、§2 支柱、§3.1 动词/示意公式、§5 核心循环、§6 三节点 MWP（本文数据结构直接据此）、§7 范围、§9 待审批（③ 意图匹配即本文 §2.4）。
- `systems-index.md`：§2 S1 边界、§3 依赖 DAG、§6 横切实体归属（Δ/v_i/节点/因果链/CP 两段式）、§7 撰写顺序（S1 最先）、§3.3 反向耦合提醒（本文 §7.2 已确认）。
- `art-bible.md`：§0 双轨（系统冷光仅 L5）、§2.5 Δ 视觉三档、§6 系统材质（改写面板）、§9 命名空间（`dyn_threekingdoms_chibi`，本文数据沿用）。
- `project-charter.md`：核心循环 Loop A 措辞、范围（垂直切片严守）。

---

## 8. 验收标准（可逐条勾选）

> 对照 issue 验收要点 + `team/design-strategist.md` 输出规范（八节齐全 / 公式标变量单位 / ≥3 类边缘情况）。

- [ ] **八节齐全**：概述(§1) / 机制(§2) / 数据(§3) / 公式(§4) / 边缘情况(§5) / UI 接口(§6) / 依赖(§7) / 验收标准(§8)，缺一不可。✅
- [ ] **公式统一格式、标变量与单位**：§0 符号表 + §4 六条公式均给式/变量/单位/域，§4.6 速查表。✅
- [ ] **≥3 类边缘情况**：§5 给 5 类（连续改写/偏差溢出级联/改写与主线冲突/存档回溯/蓝图不可达兜底）。✅
- [ ] **与 game-concept / systems-index 一致且显式引用**：§0/§1/§7 多处显式引用，术语逐字沿用（Δ/CP/v_i/改写节点/因果链/系统），支柱名可追溯。✅
- [ ] **不与已有支柱/数值矛盾**：Δ∈[0,100] 与 game-concept §6 示意（+15~+90）量纲一致；CP=CP_node·M·(1+k·...) 落地 game-concept §3.1 示意 `CP=f(Δ,意图匹配度)`；Δ_critical 默认 80 对齐 game-concept §6.3 示意。✅
- [ ] **不脱离引擎能力**：数据驱动落 `game/data/*.tres|*.json`（§3），引擎精确 API/资源类名一律标 `[待程基岩确认]`，未臆造。✅
- [ ] **设计理论红线已标注**：主导策略（§4.2/§5.1）、经济失衡（§4.3 disc 封顶/§5.1 max_attempts）、认知过载（§5.2/§6.3 信息分级）、支柱漂移（§5.2 支柱③）逐项标注并给缓解。✅
- [ ] **朝代热切换留口**：§3.7 数据均带 `dynasty` 命名空间，公式朝代无关，跨朝代累积留口（愿景，本切片不做）。✅
- [ ] **CP 两段式所有已落实**：产出(S1 §4.2)/账户(S3)分离，§7.2 明确接口。✅
- [ ] **DAG 无环硬契约已落实**：S4/S5 不直写 v_i/Δ，必经事件（§5.3/§7.3）。✅
- [ ] **待审批项显式标注**：§2.4（蓝图=意图方案）、§4.3（RE 再生曲线）、§4.5（震荡下游强度）、§5.4（悔棋）、§5.5（蓝图可达性静态校验）均标 `[待审批]`/`[待程基岩确认]`，不擅自定稿。✅
- [ ] **守范围**：因果链限 3 节点最小链（§2.5），存在性依赖最多一层（§5.2），多朝代/跨朝代累积列为愿景（§3.7），未越垂直切片。✅

---

## 9. 待主创审批项（发现设计张力，不擅自定稿）

> 沿用并细化 `game-concept §9` / `systems-index §10` 中影响**本系统数值结构**的待定项。

1. **【意图匹配度判定】采用"改写蓝图=显式意图声明"方案？（§2.4 / §4.2）**
   - 来源：`game-concept §9③`。这是**主导策略的总开关**，直接决定 CP 公式形态。本文以"采用"为前提给全公式；若主创倾向隐式判定（如据探索路径推断），§4.2/§5.1/§6.1 需同步改。
   - 倾向：显式蓝图（可读、可测、与情报耦合）。
2. **【蓝图可见性门控强度】强门控（重度策略）vs 弱门控（轻度）？（§2.4）**
   - 影响"探索→改写"耦合松紧与认知负荷。倾向中度（`intel_cov` 阈值解锁精确蓝图）。
3. **【RE 再生曲线】按节点重置 + 营寨/探索补充 vs 时间再生？（§4.3）**
   - 防 AFK 刷分 vs 休闲友好。倾向前者；精确值待 P2-4 经济曲线对齐。
4. **【世界线震荡下游强度】diff 上浮幅度 + 是否影响存在性？（§4.5 / §5.2）**
   - 须与 S2（P2-3）联合定。本文给倾向值（diff +0.2、震荡封顶 2~3 次）。
5. **【悔棋/读档回滚已锁定节点】是否开放？（§5.4）**
   - 倾向**不开放**（保叙事一致 + 防刷分）；若主创要求须作独立功能设计。

---

## 10. 已知风险与取舍

1. **意图判定复杂度**（§2.4）：蓝图方案增加改写面板步骤，有认知过载风险——靠蓝图数量上限 + 信息分级（§6.3）+ MVP 收窄到单节点（`game-concept §7.1`）缓解，须 P4-1 + Playtest 校准。
2. **公式参数未平衡**（§4 全部默认值）：`k=0.5`/`Δ_critical=80`/`disc 封顶 0.5` 等为首版倾向值，须 P5/P6 数值平衡（严守真）+ Playtest 迭代，本文不给"已平衡"承诺。
3. **双轨张力的数值侧**：高 Δ 的冷光震荡演出（`art-bible §2.5`）若过频会抢正剧沉浸（`systems-index §10` 跨系统张力）——靠 §5.2 震荡封顶 + §4.4 档位节制缓解。
4. **存档一致性**（§5.4）：未锁定回滚 + 已锁定不撤 CP 的设计对工程实现有要求，须程基岩 P3 存档设计对齐。
5. **因果链范围硬约束**（§2.5/§5.2）：3 节点最小链是范围红线，超出的"消失节点级联"逻辑列为愿景——若主创要在目标态扩展，须回头评估 §5.2 级联防线。

---

## 11. 下一步建议（给主理人 · 游承峰）

1. **本 issue（P2-2）完成后**，请主创优先审批 **§9 第 1 项（意图判定方案）**——它是 P2-3~P2-5 全部下游 GDD 的前置（S2 任务文案、S3 面板布局、S4 动词执行都依赖它）。
2. **立即可派 P2-3（主线任务系统 GDD）**：本系统已锁死**节点模型 + 因果链 + 存在性依赖规则数据**（§3.2/§3.4），S2 据此定义节点生命周期态机与派发顺序即可（`systems-index §7` 顺序）。
3. **P2-3/P2-4 可并行**：S3 依赖本系统 Δ/CP 契约（已锁，§4.2/§6.1），可与 S2 并行撰写（`systems-index §7`）。
4. **给程基岩（P3-1 架构）**：§3 数据契约 + §6 信号契约 + §7 DAG 可直接作为系统边界与数据归属输入；§3.6 `save_state` 是存档需求清单。建议 P3-1 与本文交叉引用，并在 ADR 中确认 `.tres` 资源类设计。
5. **给严守真（QA）**：§5.5 蓝图可达性 + §8 验收项是数据 QA 清单的雏形，建议 P5/P6 转为可执行校验。

---

*—— 文策渊（design-strategist）· Phase 2 系统设计（P2-2 · S1 改写/因果引擎）· 待主创评审*
