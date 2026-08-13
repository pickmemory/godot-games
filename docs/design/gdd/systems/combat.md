# 实时战斗系统 GDD · 《赤壁·改写者》

> 阶段：Phase 2 · 系统设计（P2-5，S4）　|　执行角色：文策渊（design-strategist）
> 文档版本：v0.1（首版，待主创评审）　|　状态：可评审
> 基线锚点：`AGENTS.md`「设计基线」表（战斗=俯视角实时轻动作 ARPG；PC 优先键鼠+手柄）、`docs/project-charter.md`「核心循环 Loop A」、`docs/roadmap.md` P2-5。
> 设计依赖（**显式引用**，本 GDD 与之保持一致，不另立术语/信号/产出源）：
> - `docs/design/gdd/game-concept.md`（P1-1）——**术语 §1、设计支柱 §2（支柱①主/②次）、战斗动词 §3.1、核心循环 §5.3 Loop B（秒级次循环·不直接产 Δ）、范围分层 §7（MVP=普攻+1 系统术法；完整集=多术法+闪避/硬直）、待审批 §9（①人格 / ②奇幻来源上限）**。本文凡引用写作 `game-concept §x`。
> - `docs/design/gdd/systems-index.md`（P2-1）——**S4 行 §2（边界）、依赖 DAG §3、Loop A 映射 §4（S4 嵌入探索环）、支柱对齐 §5（S4 漂移红线=战斗喧宾夺主）、横切实体归属 §6（玩家能力/技能行：解锁归 S3 执行归 S4；玩家战斗状态 HP/资源 行：状态机归 S4 只读显示归 S3）**。本文凡引用写作 `systems-index §x`。
> - `docs/design/gdd/systems/rewrite-causality.md`（P2-2，✅已完成）——**§0 符号（RE/disc）、§3.5 改写动词数据契约（`requires.ability` / `requires.scene` / `effect` / `cost_base`）、§5.3 战斗结果必经事件、§6.2 S1 接收信号（`verb_executed`）、§7.3 与 S4 的边界（S4 不直写 v_i/Δ）**。本文凡引用写作 `rewrite-causality §x`。
> - `docs/design/gdd/systems/mainline-quest.md`（P2-3，✅已完成）——**§3.2 节点 `target_scene`、§6.2 S2→S3/S5 信号（目标场所布置归 S5）、§2.4 改写节点如何嵌入战斗场所**。本文凡引用写作 `mainline-quest §x`。
> - `docs/design/gdd/systems/panel-progression.md`（P2-4，✅已完成）——**§3.1 技能节点 `grants: { target: s4_combat, key: ability_unlocked, value: <ability_id> }`（S3 解锁→S4 执行的 join 键）、§6.3 `ability_unlocked(ability_id)` 信号（S3→S4）、§6.3 玩家战斗状态 HP/资源只读显示归 S3**。本文凡引用写作 `panel-progression §x`。
> - `docs/design/art/art-bible.md`（P1-2）——**§1.3 3/4 俯视角（60°–65°）、§2.4 玩家系统术法=青蓝几何 / 本土志怪=朱黄墨晕（绝不混用）、§3.3 信息焦点与战场色块压缩、§4.4 玩家精灵 64×96 px / 碰撞 ~24×40、§5.2 滩涂湿地影响潜行/战斗可读性（显式「待 P2-5 战斗 GDD」）、§5.5 风向/芦苇/烟雾视觉化、§6.2 HUD 极简、§7.1 4 向方向集 + 核心动作集（待机/行走/奔跑/普攻含连段/闪避/施法/对话/受击/倒地）、§7.2 VFX 来源区分、§8.4 同屏高精 ≤30–50 / VFX ≤200–400**。本文凡引用写作 `art-bible §x`。
> 本系统边界以 `systems-index §2`（S4 行）为准；术语以 `game-concept §1` 为准；与 S1 的信号契约**严格对齐 `rewrite-causality §6.2/§7.3`（`verb_executed`），零新增冲突信号**；与 S3 的能力契约**严格对齐 `panel-progression §6.3`（`ability_unlocked`）与 §3.1 的 `ability_id` join 键**。本文件是实时战斗系统的**完整八节 GDD**，是核心循环 Loop A「探索」环内嵌的**秒级次循环 Loop B**（`game-concept §5.3`）。

---

## 0. 公式符号与单位约定（全篇统一）

> 为杜绝跨文档/跨公式符号漂移，本节定义本 GDD 用的符号、单位与取值域。**第 4 节所有公式均回引本表符号**，不另造。**与 S1/S3 共享的符号（`RE`/`disc`/`Δ`/`v_i` 等）沿用 `rewrite-causality §0` / `panel-progression §0` 定义，本表不重定义**，只列本系统**新增**符号并显式标注来源。

| 符号 | 含义 | 单位 | 取值域 / 类型 | 来源 |
|---|---|---|---|---|
| `HP` | 玩家生命值（**S4 唯一持有运行时态**） | 点 | [0, `HP_max`] | §3.1（**本系统新增**） |
| `HP_max` | 玩家生命上限 | 点 | 数据字段，首版倾向 100 | §3.1（**本系统新增**） |
| `BF` | 战意（Battle Focus，闪避/系统术法的**唯一战斗资源**，区别于 S1 的 `RE` 改写能量） | 点 | [0, `BF_max`] | §3.1（**本系统新增**） |
| `BF_max` | 战意上限 | 点 | 数据字段，首版倾向 100 | §3.1（**本系统新增**） |
| `bf_cost` | 单次闪避/术法消耗的战意 | 点 | ≥ 0 | §3.2/§4.2（**本系统新增**） |
| `regen_BF_passive` | 战意被动再生速率 | 点/秒 | 数据字段，首版 6 | §4.2（**本系统新增**） |
| `regen_BF_on_hit` | 命中敌人回战意 | 点/次 | 数据字段，首版 3 | §4.2（**本系统新增**） |
| `ATK_base` | 基础攻击力（玩家/敌人） | 点 | 数据字段 | §3.1/§3.3（**本系统新增**） |
| `mult_skill` | 动作/术法伤害倍率 | 无量纲 | ≥ 0（普攻≈1.0，术法 1.5–3.0） | §3.2（**本系统新增**） |
| `crit_chance` | 暴击概率 | 无量纲 | [0, 1]，首版 0 | §3.1/§4.1（**本系统新增**） |
| `crit_mult` | 暴击伤害倍率 | 无量纲 | 首版 1.5 | §4.1（**本系统新增**） |
| `resist` | 目标对某伤害类型的抗性 | 无量纲 | [0, 0.8] | §3.3（**本系统新增**） |
| `DEF` | 目标防御（固定减伤） | 点 | ≥ 0 | §3.1/§3.3（**本系统新增**） |
| `stagger_value` | 单次命中的硬直积累值 | 无量纲 | ≥ 0 | §3.2/§3.3（**本系统新增**） |
| `stagger_meter` | 目标当前硬直槽 | 无量纲 | [0, `stagger_threshold`] | §4.3（**本系统新增**） |
| `stagger_threshold` | 触发硬直态的阈值 | 无量纲 | 数据字段，玩家 30 / 敌人按类型 | §3.1/§3.3（**本系统新增**） |
| `stagger_dur` | 硬直失控时长 | 秒 | 数据字段，首版玩家 0.5 / 敌人 0.6 | §4.3（**本系统新增**） |
| `i_frames` | 闪避无敌帧时长 | 秒 | 数据字段，首版 0.35 | §3.1/§4.4（**本系统新增**） |
| `dodge_dist` | 闪避位移距离 | px | 数据字段，首版 96（≈1.5 Tile，`art-bible §8.1`） | §3.1（**本系统新增**） |
| `cooldown` | 术法/技能冷却 | 秒 | ≥ 0 | §3.2（**本系统新增**） |
| `cast_time` | 术法施法前摇 | 秒 | ≥ 0 | §3.2（**本系统新增**） |
| `alert_level` | 被发现/警戒档位（**S4 拥有**，影响改写难度） | 枚举 | {`未察觉`,`警戒`,`发现`,`交战`} → {0,1,2,3} | §2.7（**本系统新增**） |
| `alert_mult` | 警戒档位对改写难度的乘子（**S1 应用**，§4.5 / §7.1） | 无量纲 | {1.0, 1.0, 1.2, 1.5}，[待审批] | §4.5（**本系统新增**） |
| `enemy_id` / `ability_id` / `dynasty` | 标识符 | 字符串 | `snake_case`，朝代命名空间 `dyn_threekingdoms_chibi` | `art-bible §9.1` |
| `RE` / `disc` / `intel_cov` / `Δ` / `v_i` | （**只读引用，不重定义**） | 见原表 | 见原表 | `rewrite-causality §0` |

**命名 / 数据约定**：所有落到 `game/data/combat/*.tres`、`game/data/skills/*.tres`（**S4 战斗执行数据**，见 §3.2 与 systems-index §6 落点）、`game/data/enemies/*.tres` 的字段、ID 一律 `snake_case`；朝代命名空间固定 `dyn_threekingdoms_chibi`（与 `art-bible §9.1` 一致），多朝代扩展换命名空间即可（见 §3.6 热切换口）。**存疑的引擎精确实现一律标 `[待程基岩确认]`，本文不臆造 Godot API**（如 `Area2D` 判定盒、`CharacterBody2D` 移动、`AnimationPlayer` 帧、`TileMapLayer` 碰撞层的精确节点/信号名均待 P3 核对）。

> ⚠️ **本系统绝不产出 `Δ` / 绝不直写 `v_i`**（守 `game-concept §5.3` + `rewrite-causality §5.3/§7.3` + `systems-index §3.1` DAG 无环硬契约）。战斗结果（击杀/破坏）只通过发 `verb_executed(verb_id, target, success)` 事件通知 S1，由 S1 自行判定 `v_i` 改变与 Δ（§2.9 / §6.1 / §7.1）。**战斗是 Loop A「探索/改写」的动作层与微观风险源，不是心脏。**

> ⚠️ **资源命名防混淆（重要）**：本系统的 `BF`（战意）≠ S1 的 `RE`（改写能量）。二者分属不同循环、不同所有者：`RE` 服务 Loop A 改写动词（`rewrite-causality §4.3`，S1 持有数值态、S3 提供补充出口）；`BF` 服务 Loop B 战斗（闪避/系统术法，§4.2，S4 唯一持有）。**S4 不读写 `RE`，S1 不读写 `BF`**。命名上刻意分轨：RE=「改写能量」（系统冷光侧），BF=「战意」（穿越者武人侧），避免玩家把二者当成同一槽位。见 §5.2 边缘情况。

---

## 1. 概述

### 1.1 系统定位

实时战斗系统是核心循环 Loop A「探索」环内嵌的**秒级次循环 Loop B**（`game-concept §5.3`：`遭遇 → 战斗/潜行/对话 → 即时反馈（伤害/资源/关系变化）→ 继续探索`）。它为探索/改写提供**动作乐趣**与**微观风险**——而「微观风险」的核心是**被发现/警戒状态会抬高改写难度**（`game-concept §5.3`「被发现则改写难度上升」），从而把战斗/潜行的结果**间接**传导到 Loop A 的「改写」环。

- **它管什么**（边界以 `systems-index §2` S4 行为准）：普攻/闪避/硬直/资源（HP/BF）消耗的**基础战斗规则**；系统术法/技能的**释放与命中**（解锁/数值归 S3，**执行**归 S4，`systems-index §6` 玩家能力技能行）；**伤害公式**；敌人 **AI 基础行为**（行为逻辑归 S4，遭遇布置归 S5）；战斗内的**「被发现/警戒」状态**（影响改写难度，§2.7）。
- **它不管什么**（关键契约，**别越界**）：
  - **战斗不直接产出 Δ**（`game-concept §5.3` 已明确）——S4 通过运行时事件把「战斗结果」通知 S1（`verb_executed`），由 S1 判定 Δ；**S4 不自算 Δ、不写 `v_i`**（`systems-index §3.1` DAG 硬契约）。
  - 术法/技能的**解锁与数值归 S3**（`panel-progression §2.2 magic` 分支），S4 只负责**执行**。
  - 战场**地理与遭遇布置归 S5**（`systems-index §2` S5 行）——S4 不决定敌人「在哪、有多少」，只决定「敌人被放下后怎么动、怎么打」。
- **它不是**：不是游戏的主导玩法（守 `systems-index §5` S4 漂移红线：**战斗喧宾夺主、掩盖改写成为主导玩法 → 心脏偏移，支柱①漂移**，见 §1.4 战斗「轻」纪律）；不是独立的心脏数值系统（心脏是 S1）。

### 1.2 玩家动词（本系统承接的战斗动词）

本系统承接 `game-concept §3.1`「战斗动词」集合（Loop B 即时），**与 S1 的改写动词、S3 的系统动词分层**：

| 动词 | 作用 | 触发 | 资源消耗 | 归属 |
|---|---|---|---|---|
| **移动**（行走/奔跑） | 俯视战场走位 | 键鼠 WASD / 手柄左摇杆 | 无 | S4 基础（范围：MVP 含） |
| **普攻**（含连段） | 近战基础输出，3 段连段 | 鼠标左键 / 手柄□ | 无（`BF_cost=0`） | S4 基础（MVP 含） |
| **闪避** | 翻滚位移 + 无敌帧（`i_frames`）规避伤害 | 空格 / 手柄○ | `bf_cost_dodge`（首版 18） | S4 基础（**完整集含**，`game-concept §7.2`） |
| **系统术法/技能释放** | 释放已解锁的青蓝系统术法（攻击/buff/utility/改写代理） | 数字键 / 手柄△ | `bf_cost`（按能力）+ `cooldown` | **S3 解锁（数值）→ S4 执行**（`panel-progression §6.3`） |
| **锁定/切换目标** | 俯视下聚焦当前威胁 | 鼠标右键 / 手柄 R（[待审批] 是否进 MVP） | 无 | S4 辅助 |
| **（受控态）受击/硬直** | 被命中积累硬直槽至失控 | 被动 | — | S4 基础（完整集含） |

> 📌 **MVP 范围对齐 `game-concept §7.1`**：玩家能力最小集 = 可移动 + 战斗（普攻 + **1 个系统术法**）+ 潜行/对话最小集。故 MVP **不含闪避/硬直**（`game-concept §7.2` 完整集才含）；本 GDD 仍**完整设计**闪避/硬直以锚定目标态，但用「`game-concept §7.x`」标尺在每个机制处注明 MVP 是否启用，避免范围蔓延（守 `systems-index §8` 范围红线）。**MVP 不含闪避意味着「1 个系统术法」必须能独立支撑基础战斗闭环**（§2.6 / §5.2）。

### 1.3 与核心循环 Loop A / Loop B 的接口

本系统承担 Loop B（秒级），嵌入 Loop A「探索」环内部（`systems-index §4`），并通过**三条事件通道**与 Loop A 各环耦合（全部单向、DAG 无环）：

```
Loop A「探索」环(S5)
   │  ①遭遇触发(S5布置敌人) → 进入 Loop B
   ▼
【S4 实时战斗系统 · Loop B（秒级）】 遭遇→战斗/潜行→即时反馈(伤害/BF/HP/关系)→继续探索
   │
   ├──②战斗结果事件 S4→S1：verb_executed(verb_id, target, success)   [击杀/破坏=改写动词的物理执行结果]
   │        └─ S1 据 verbs[].effect 改 v_i → 自算 Δ（S4 不写 v_i/Δ，rewrite-causality §5.3/§7.3）
   │
   ├──③警戒状态事件 S4→S1：alert_state_changed(node_id, alert_level)  [被发现→改写难度↑]
   │        └─ S1 读 alert_level → 应用 alert_mult 到有效 diff（§4.5，[待与 S1 联合确认]）
   │
   └──④战斗状态只读 S4→S3：hp_changed / bf_changed                    [HUD 显示，panel-progression §6.3]
            └─ S3 HUD 显示 HP/BF；S3 不改战斗状态（systems-index §6 玩家战斗状态行）

成长反哺（S3→S4，跨 Loop）：⑤ability_unlocked(ability_id)   [S3 解锁→S4 放行 requires.ability]
```

- **入（← 探索/成长）**：①遭遇触发（S5 布置敌人，`systems-index §2` S5 行）；⑤能力解锁（S3 `ability_unlocked`，`panel-progression §6.3`）；玩家移动/潜行输入（玩家控制器，潜行 stance 经 S5/S4 感知消费，§2.7）。
- **出（→ 改写/反馈）**：②`verb_executed`（→ S1，战斗击杀=改写动词执行）；③`alert_state_changed`（→ S1，改写难度调制）；④HP/BF 只读（→ S3 HUD）。
- **闭环关键**：Loop B **不直接产出 Δ**，但②③两条事件把「战斗的物理结果」与「被发现的风险」**间接**灌进 Loop A 的「改写」环——这就是 `game-concept §5.3`「不直接产出 Δ，但影响改写前的状态」的落地。

### 1.4 战斗「轻」纪律（支柱红线 · 对齐 `systems-index §5` S4 漂移红线）

> 战斗是本作的**次玩法**（Loop B），心脏是改写/因果（Loop A）。战斗的深度、时长、占比必须**严格受控**，否则触发支柱①漂移（`systems-index §5`：「战斗喧宾夺主、掩盖改写成为主导玩法」）。本节是本系统全部机制的**约束总纲**，每个机制节都回引本节。

| 纪律 | 量化锚点（首版倾向，[待审批]） | 设计理由 |
|---|---|---|
| **资源单一** | 战斗只用**一个**资源 `BF`（战意）；HP 仅作生存阈值 | 多资源（体力+法力+怒气…）会逼玩家"读战斗系统"，抢改写的认知带宽（`systems-index §8` 认知过载红线） |
| **动作集精简** | 普攻(连段) + 闪避 + 系统术法；**不设**格挡/弹反/派生取消/装备切换 | 轻动作 ARPG（基线）；每多一个动作动词都在抢改写动词的"动词清晰度"（支柱①） |
| **数值平坦** | 玩家 ATK 不随章节大幅膨胀（成长主要是 S3 能力**种类**，非 ATK 数值）；敌人 HP/ATK 在窄区间 | 防止"练级碾压"使战斗成为通关主路径（经济失衡 + 支柱①漂移） |
| **时长占比小** | 单次遭遇目标 **8–20 秒**（非 boss）；非必要战斗可潜行绕过（§2.7 脱战） | 战斗是"探索的摩擦"，不是"探索的目的"；玩家应能用潜行/对话减少战斗（`game-concept §3.1` 探索动词含潜行/结盟） |
| **失败成本低** | HP=0 倒地 → 重开当前遭遇/回最近营寨（S5 checkpoint），**不扣 CP、不删改写进度** | 战斗失败不应惩罚 Loop A 成果（守 `rewrite-causality §5.1/§5.4` 经济一致）；否则玩家逃避战斗→潜行主导→又一种漂移 |
| **术法节制** | 同屏系统术法 VFX 冷光**不铺满**（`art-bible §7.2`：玩家术法快/脆/低饱和/硬边） | 冷光是轨道 B，过载会抢正剧底色（支柱②反例，`systems-index §5` 跨系统张力） |

> ✅ **支柱对齐（回引 `systems-index §5` S4 行）**：主要支撑支柱①「改写即玩法」（截杀/策反等战斗**即**改写动词的物理执行，§2.9）；次要支撑支柱②「系统流掌控感 × 正剧底色」（动作精通 + `art-bible §3.3` Sensation 即时爽感）。漂移红线：**任一纪律被破坏 → 战斗占比膨胀 → 玩家"为了打而打"而非"为了改写而打" → 心脏偏移，支柱①漂移**。每个机制节（§2.3~§2.8）末尾均回引本节确认未越界。

---

## 2. 机制

### 2.1 战斗如何触发（遭遇归 S5，战斗态归 S4）

**两段式所有权**（守 `systems-index §2/§6`）：**遭遇布置归 S5**（敌人 `enemy_id`/数量/巡逻路线/感知参数由 S5 遭遇表决定，落 `game/data/...`，最终路径待 S5 GDD），**战斗状态机归 S4**（敌人被放下后怎么动/怎么打）。

**触发流程（一次 Loop B 遭遇的生命周期）**：

```
① S5 遭遇表在玩家进入触发区/任务激活时布置敌人（enemy_id 集合 + 初始位置/巡逻路线）
  → ② S4 为每个敌人实例化战斗状态机（敌人 FSM §2.8），初始态=巡逻
  → ③ 玩家移动/潜行/攻击进入敌人感知范围（§2.7）→ 敌人 FSM 转 警戒/发现/交战
  → ④ Loop B 战斗循环：玩家普攻/闪避/术法 ↔ 敌人攻击；伤害/BF/HP 即时结算（§4）
  → ⑤ 终结条件之一：
       (a) 战斗击杀改写目标（如曹操/庞统）→ 发 verb_executed(verb_kill_xxx, target, success) [S4→S1]
       (b) 敌人全灭/逃跑脱战 → 敌人 FSM 归位 → alert 衰减（§2.7）
       (c) 玩家 HP=0 倒地 → 失败态（§5.2）→ 回 S5 checkpoint 重开
       (d) 玩家脱离敌人感知（潜行/拉开距离）→ 敌人 FSM 转 警戒→归位（§2.7 脱战）
```

> 📌 **S4 不"生成"敌人**：敌人的存在性、数量、位置全由 S5 遭遇表决定。S4 只在敌人被 S5 实例化后接管其**行为 FSM 与伤害结算**。若 S5 未布置敌人，S4 无战斗（纯探索）。这把"战斗何时发生"归 S5、"战斗怎么打"归 S4，边界清晰（§7.4 交叉确认）。

### 2.2 玩家战斗状态机（核心动作集对齐 `art-bible §7.1`）

> 状态集取自 `art-bible §7.1`「核心动作集」：待机 / 行走 / 奔跑 / 普攻（含连段）/ 闪避 / 施法（系统术法）/ 对话 / 受击 / 倒地。本系统定义其**数值态机**与转移规则。**Godot 精确节点（如 `AnimationNode`/`StateMachine`）实现标 `[待程基岩确认]`**。

| 态 | 含义 | 进入条件 | 可被打断？ | MVP 启用？ |
|---|---|---|---|---|
| `idle` 待机 | 无输入静止 | 默认/动作后回归 | 是（任何输入） | ✅ |
| `move` 行走/奔跑 | 移动输入 | 方向输入 | 是 | ✅ |
| `attack_n` 普攻第 n 段（n=1,2,3） | 普攻连段，每段有 `mult_skill`（首版 1.0/1.0/1.4）与后摇 | 攻击键，前一段命中/后摇窗口内可派生下一段 | 受击/闪避可打断；下一段在 cancel 窗口（首版后 60% 帧）内可派生 | ✅ |
| `dodge` 闪避 | 翻滚位移 `dodge_dist` + `i_frames` 无敌 | 闪避键 + `BF ≥ bf_cost_dodge` | 仅受击前 `i_frames` 内不可打断 | ❌（完整集，`game-concept §7.2`） |
| `cast` 施法（系统术法） | `cast_time` 前摇 → 释放 → 后摇；消耗 `bf_cost`，进 `cooldown` | 术法键 + `ability_unlocked` + `BF≥bf_cost` + 未在 cd | 前摇可被受击打断（受硬直）；释放瞬间不可打断 | ✅（MVP 至少 1 个） |
| `hit_stagger` 受击硬直 | 硬直槽满 → 失控 `stagger_dur` | `stagger_meter ≥ stagger_threshold` | 否（失控态） | ❌（完整集） |
| `downed` 倒地 | HP≤0 | HP 归零 | 否 → 触发失败态 | ✅（失败态必须有） |
| `dialogue` 对话 | 非战斗态（探索/改写），列出以求完备 | 探索层触发 | — | 归 S5（非本系统战斗态） |

**转移规则要点**：
- **`i_frames` 优先**：闪避态的 `i_frames` 窗口内，受击判定被忽略（§4.4）。这是俯视轻动作 ARPG 的核心生存机制（完整集）。
- **硬直槽满即失控**：`hit_stagger` 期间玩家无法输入，是"被连续命中"的惩罚（完整集）。**MVP 无硬直**意味着玩家受击只是扣 HP 不失控——降低新手门槛，契合"轻"。
- **施法前摇可被受击打断**：`cast` 前 `cast_time` 内被命中 → 中断施法，**不消耗 `bf_cost`**（防"前摇被打还扣资源"的双重惩罚，守 §1.4 失败成本低）；释放瞬间后不可打断。

### 2.3 普攻与连段（基础输出）

- **3 段连段**（`art-bible §7.1`「普攻含连段」）：第 1/2/3 段 `mult_skill` = 1.0 / 1.0 / 1.4（首版，`game-concept` 范围内轻数值）；第 3 段有轻微击退（`stagger_value` 略高）。
- **派生窗口（cancel window）**：每段后约 60% 帧起可派生下一段（`[待程基岩确认]` 精确帧数）；窗口外按攻击键重置回第 1 段。这让连段有"节奏感"但不强制精确（轻动作）。
- **命中盒（hitbox）**：普攻在玩家朝向前方生成短时判定盒（`[待程基岩确认]` 用 `Area2D` 或自定义形状）；朝向取自移动/锁定方向，4 向基础（`art-bible §7.1`）。
- **`bf_cost=0`**：普攻不耗战意（§1.4 资源单一纪律——普攻是默认输出，不应被资源卡死）。命中**回**少量 BF（`regen_BF_on_hit` 首版 3），奖励"敢上去平 A"的主动战斗节奏。
- **MVP**：✅ 启用（普攻是 MVP 唯一的基础输出）。

### 2.4 闪避与无敌帧（完整集）

> ⚠️ **MVP 不含闪避**（`game-concept §7.1`：MVP 玩家能力最小集 = 普攻 + 1 系统术法；`game-concept §7.2`：完整集才含闪避/硬直）。本节完整设计以锚定目标态。

- **机制**：按闪避键（`BF ≥ bf_cost_dodge` 首版 18）→ 玩家朝当前方向翻滚 `dodge_dist`（首版 96px ≈ 1.5 Tile，`art-bible §8.1` Tile=64px），期间前 `i_frames`（首版 0.35s）无视受击判定。
- **设计意图**：俯视轻动作 ARPG 的**核心生存动词**——用走位+无敌帧规避伤害，而非靠数值硬扛。这是 `game-concept §3.3` Challenge「动作技巧」层的主要载体。
- **限制（防滥用）**：`bf_cost_dodge` 限频（首版 18，`BF_max=100` → 连续约 5 次即空）；闪避有后摇（首版 0.15s 不可取消），防"无限翻滚逃课"。
- **MVP**：❌ 不启用。MVP 生存靠"系统术法清场 + 走位拉开"，不强求精确闪避。**若 Playtest 显示 MVP 无闪避太难，应在 S3 解锁更易用的术法，而非提前把闪避塞进 MVP**（守范围红线）。

### 2.5 硬直 / 受击系统（完整集）

> ⚠️ **MVP 不含硬直**（`game-concept §7.2` 完整集）。同 §2.4，本节完整设计锚定目标态。

- **硬直槽（stagger meter）**：每个可受击单位（玩家+敌人）有 `stagger_meter ∈ [0, stagger_threshold]`。每次被命中 `stagger_meter += stagger_value`（来源命中盒，§4.3）；未被命中时 `stagger_meter` 以 `regen_stagger`（首版 10/秒）衰减。
- **触发失控**：`stagger_meter ≥ stagger_threshold`（玩家首版 30，敌人按类型）→ 进入 `hit_stagger` 态，失控 `stagger_dur`（玩家 0.5s / 敌人 0.6s），失控期间 `stagger_meter` 清零。
- **设计意图**：硬直是"被连续命中"的惩罚，逼玩家（与敌人）**不能无脑站桩**——它让"走位/闪避"有价值（即便 MVP 无闪避，硬直也是目标态闪避存在的理由）。敌人硬直给玩家"打出破绽再输出"的节奏感。
- **MVP**：❌ 不启用。MVP 受击只扣 HP，不积累硬直——降低门槛。但敌人**可以被"打断"**（施法/蓄力敌人被命中中断施法，§2.8），保留最小战术深度。

### 2.6 系统术法/技能的释放与命中（S3 解锁 → S4 执行 · 核心跨系统契约）

> 这是 S3↔S4 的**核心接口**，落地 `systems-index §6` 玩家能力技能行「**解锁/数值归 S3，执行归 S4**」。**伤害/资源/硬直公式落 `game/data/skills/*.tres` 数据契约**（issue 验收要点 2）。

**两段式数据所有权（关键，回应 systems-index §6 落点细化）**：
- **S3 拥有「解锁/成长」数据**：技能节点的 CP 造价、分支、tier、`grants`（解锁哪个 `ability_id`）——落 `game/data/progression/skills/<skill_id>.tres`（`panel-progression §3.1` 已实现）。例：`skill_magic_wind_borrow.tres` → `grants: { target: s4_combat, key: ability_unlocked, value: ability_system_magic_wind }`。
- **S4 拥有「战斗执行」数据**：该 `ability_id` 的伤害倍率/`bf_cost`/`cooldown`/`cast_time`/`hitstun_dealt`/VFX/SFX/`rewrite_proxy_verb`——落 `game/data/skills/<ability_id>.tres`（§3.2，本系统新增）。
- **join 键 = `ability_id`**：S3 的 `grants.value`（`ability_system_magic_wind`）引用 S4 的 `game/data/skills/ability_system_magic_wind.tres`。两文件按 `ability_id` 关联，各管各的——**镜像 S1/S2 的 node_id 两段式**（`rewrite-causality §3.2` ↔ `mainline-quest §3.2`）。
- ⚠️ **systems-index §6 落点 `game/data/skills/*.tres` 的细化**：systems-index 把该路径列为「建议，以 P3 ADR 为准」。本 GDD 细化：`game/data/skills/*.tres` 特指 **S4 战斗执行数据**（按 `ability_id`）；S3 解锁数据在 `game/data/progression/skills/`（`panel-progression §3.1` 已实现）。两段式，无重复所有者。**列入 §7.7 跨 GDD 评审注释**。

**释放流程**：

```
① 玩家按术法键（绑定某 ability_id）
  → ② S4 校验：ability_id ∈ S3 已解锁集？(读 S3 的 ability_unlocked 历史，panel-progression §6.3)
                  ∧ BF ≥ bf_cost(ability) ∧ 不在 cooldown ∧ 当前态可施法(非 downed/stagger)
  → ③ 进入 cast 态：cast_time 前摇（可被受击打断，打断不耗 BF，§2.2）
  → ④ 释放：BF −= bf_cost；进 cooldown；播放 VFX/SFX（art-bible §7.2，玩家术法=青蓝几何/快/脆/硬边）
  → ⑤ 命中结算：生成术法命中盒 → 按 §4.1 算伤害 / §4.3 算硬直 → 对敌人应用
  → ⑥【若该 ability 是 rewrite_proxy 类】释放即触发改写动词：
        发 verb_executed(rewrite_proxy_verb, target, success) [S4→S1]，由 S1 改 v_i（§2.9）
```

**术法 `kind` 分类**（`game/data/skills/*.tres` 字段，§3.2）：
- `attack`：纯战斗术法（如 `ability_system_combat_burst` 青蓝爆发 AoE），只造伤害/硬直。
- `buff`：自身强化（如短暂提速/减耗），目标=玩家。
- `utility`：非伤害功能（如短暂显形/位移）。
- `rewrite_proxy`：**兼作改写动词的物理执行**（如 `ability_system_magic_wind` 玩家自借东风）。其「执行」不是造伤害，而是发 `verb_executed(verb_self_borrow_wind, ...)` 给 S1——S4 把它当「一次特殊施法」，释放后由 S1 决定 v_i/Δ。**这是战斗系统与改写引擎的语义缝合点**：战斗动作=改写动词的物理层。

> 📌 **`requires.ability` 校验归属**（回引 `rewrite-causality §3.5`）：改写动词 `verb_self_borrow_wind` 的 `requires.ability: ability_system_magic_wind` 由 **S4/S1 校验**（`rewrite-causality §3.5` + `panel-progression §6.3` 注）。本 GDD **确认由 S4 校验**：玩家在改写场所（`requires.scene`，S5 校验）尝试释放 `ability_system_magic_wind` 时，S4 查 S3 解锁集——未解锁则施法失败（不发 `verb_executed`）。S1 不重复校验（S1 只收事件）。✅ 与 `rewrite-causality §7.3`「S1→S4 无直接；S4 从 S3 读玩家能力契约」一致。

### 2.7 「被发现 / 警戒」状态机（S4 拥有 · 影响改写难度 · 核心跨系统机制）

> 这是 `systems-index §2` S4 行明列的职责「战斗内的『被发现/警戒』状态（影响改写难度）」，也是 `game-concept §5.3`「被发现则改写难度上升」的**唯一落地机制**。**S4 拥有警戒态机与感知判定，S1 拥有改写难度公式与如何应用警戒**（DAG 无环：S4 只发事件，S1 自决）。

**警戒档位 `alert_level`（4 档）**：

| `alert_level` | 名称 | 触发 | 敌人行为 | `alert_mult`（→ S1 改写难度，§4.5） |
|---|---|---|---|---|
| 0 `未察觉` | 巡逻默认 | 初始 / 脱战衰减后 | 按巡逻路线移动 | 1.0（基线） |
| 1 `警戒` | 听到声响/看到残影/玩家踩湿地响动（`art-bible §5.2`） | 转向声源、走去最近可疑点调查 | 1.0（仅观察，不改写难度） |
| 2 `发现` | 视野锥内确认看到玩家 / 玩家正面近距 | 喊叫（触发周围敌人警戒提升）、转入追击 | **1.2** [待审批] |
| 3 `交战` | 进入攻击范围开打 | 攻击玩家（§2.8） | **1.5** [待审批] |

**感知判定（S4 拥有逻辑，S5 提供环境只读契约）**：
- **视野锥**：每个敌人有朝向锥（首版半角 35°、半径 288px ≈ 4.5 Tile，`[待审批]`）；玩家在锥内且**无遮挡**（S5 地形/建筑/芦苇/烟雾可遮挡，`art-bible §5.3/§5.5`）→ 累计感知值；达阈值升档。
- **听觉半径**：全向（首版半径 160px ≈ 2.5 Tile）；玩家**奔跑/普攻/术法/踩湿地**（`art-bible §5.2` 滩涂湿地）产生噪声半径不同（首版奔跑 160 / 行走 64 / 潜行 0）；达半径内敌人升到 `警戒`。
- **潜行 stance**：玩家蹲行（探索层输入，S5 玩家控制器持有 stance；S4 只读消费）→ 视野锥感知值累积速率 ×0.3、听觉噪声=0。**潜行 stance 的所有权在 S5（玩家移动/探索），感知判定所有权在 S4**——两段式，§7.4 交叉确认。
- **环境遮挡只读**：S4 读 S5 的「视线遮挡体」「噪声传导介质（湿地放大/芦苇衰减）」作为感知参数修正，**S5 仍决定环境长什么样**（`systems-index §2` S5 行）。

**脱战与衰减**：
- 玩家脱离所有敌人感知半径 + 视线 **持续 `lose_target_time`（首版 6s）** → 敌人 FSM 归位、`alert_level` 从 `交战` 逐档衰减回 `未察觉`（每档 `alert_decay` 首版 3s）。
- **警戒记忆（目标态）**：脱战后敌方「阵营警戒基线」可能永久抬高一档（X3 阵营系统，`systems-index §1.2` 愿景外）——**MVP 不做**，脱战即清零。

**`alert_state_changed` 事件（S4 → S1，§6.1）**：每次 `alert_level` 跨档（尤其进入 `发现`/`交战`）→ S4 发 `alert_state_changed(node_id, alert_level, alert_mult)`。**S1 读后应用 `alert_mult` 到当前改写节点的有效 `diff`（§4.5）**。这是战斗→改写的**风险传导链**：被发现 → 改写更难 → 倒逼玩家潜行/速战速决。

> ⚠️ **`alert_mult` 应用方归属（关键跨系统契约，[待与 S1 联合确认]）**：`game-concept §5.3` 与 `systems-index §2` 都说「被发现影响改写难度」，但 `rewrite-causality §4.3` 已锁的 `diff(node) = diff_base · (1 − intel_cov)` **没有 alert 项**。本 GDD **不擅自改 S1 公式**（红线），只：(a) 拥有 `alert_level`/`alert_mult` 并发事件；(b) **提议** S1 的有效 `diff` 增补 `alert_mult` 项（§4.5 给提议式）。最终 S1 是否采纳、以何形式（乘 `diff_base` 还是乘整个 `diff`）**须 S1/S4 联合确认**。**列入 §7.7 跨 GDD 评审注释**。在 S1 确认前，本系统事件照发，S1 可暂不应用（功能降级但不崩）。

### 2.8 敌人 AI 基础行为 FSM（行为归 S4，布置归 S5）

> `systems-index §2` S4 行「敌人 AI 基础行为」归 S4。**敌人"在哪、有多少"归 S5**（§2.1）。本节定义敌人被放下后的**行为状态机**。

**敌人基础 FSM（5 态，目标态；MVP 敌人可简化为 巡逻→追击→攻击 三态）**：

| 态 | 含义 | 转移条件 |
|---|---|---|
| `patrol` 巡逻 | 沿 S5 给定的巡逻路线移动（或定点待机） | 感知触发 → `suspicious`/`chase` |
| `suspicious` 警戒（=玩家侧 `alert_level=1` 的敌人侧映射） | 走向最近可疑点调查 | 确认目标 → `chase`；调查无果 → `patrol` |
| `chase` 追击 | 朝玩家移动，可绕简单障碍 | 进入攻击范围 → `attack`；脱离 → `return` |
| `attack` 攻击（=玩家侧 `alert_level=3`） | 在攻击范围释放攻击动作（有前摇，可被打断） | 玩家脱离范围 → `chase`；玩家倒地 → `patrol` |
| `return` 归位 | 失去目标，回巡逻起点，`alert` 衰减 | 到起点 → `patrol` |

**敌人攻击设计纪律（守 §1.4 战斗「轻」）**：
- **攻击有清晰前摇**（首版 0.3–0.6s，带 `art-bible §7.1` 预备帧），让玩家可走位/闪避（完整集）/打断（MVP 可打断施法型敌人）。
- **敌人不"秒发"**：所有伤害性攻击必有可读预备动作（俯视下用挥砍弧线/蓄力光），这是俯视轻动作 ARPG 的可读性底线（`art-bible §3.3` 信息焦点）。
- **敌人类型首版（MVP）极简**：①普通士卒（低 HP/低 ATK/巡逻近战）；②精英/将官（较高 HP/有 1 个特殊攻击）；③施法/远程型（可被打断）。**MVP 不做 boss 级 AI**（boss 战会膨胀战斗占比，违反 §1.4）。

**MVP 简化**：敌人 FSM 可省略 `suspicious`/`return`，退化为 `patrol ⇄ chase ⇄ attack`（感知直接 `patrol→chase`），降低实现成本（守 `game-concept §7.1` MVP 收窄）。

### 2.9 战斗不产 Δ 的硬契约（verb_executed 时序）

> 这是维持 `systems-index §3.1` DAG 无环的**硬契约**，逐字落地 `rewrite-causality §5.3/§7.3`。本节定义战斗击杀改写目标时的**事件时序**（issue 验收要点 3 要求的边缘情况之一，详见 §5.3）。

**击杀改写目标（如曹操/庞统）的时序（单向，S4 绝不直写 v_i/Δ）**：

```
① 战斗中敌人(改写目标) HP ≤ 0
  → ② S4 判定该敌人是否是某改写动词的"物理执行目标"
        （敌人 enemy_id 映射到 verbs[].requires / target；如 enemy_cao_cao ↔ verb_kill_cao）
  → ③ 若是：S4 发 verb_executed(verb_id=verb_kill_cao, target=enemy_cao_cao, success=true) [S4→S1]
        S4 自身只做"敌人倒地动画 + 移除战斗实体"，不改任何 v_i
  → ④ S1 收 verb_executed → 按 verbs[].effect.set 改 v_cao=死（rewrite-causality §3.5/§6.2）
  → ⑤ S1 重算 Δ_node / M / CP（rewrite-causality §4.1/§4.2）→ 发反馈信号组给 S3
  → ⑥ 因果链解析（rewrite-causality §2.5）→ S2 据此决定下游节点存在性
```

**关键约束**：
- **S4 不知道 Δ 为何物**：S4 只发"我打死了谁"，不计算也不关心 Δ。Δ 是 S1 的私有计算（`rewrite-causality §7.3`「S1 计算封闭」）。
- **非改写目标的敌人击杀不发轻量事件**：普通士卒被杀**不发 `verb_executed`**（它不映射任何改写动词），只触发敌人倒地 + 可能的 `alert` 提升（被发现尸体→警戒，目标态）。**MVP**：杀普通兵无任何 S1 通知——确认战斗的"摩擦"部分与改写完全解耦。
- **越权拒绝**：若实现期 S4 被写成"直接 `v_cao=死`"，属违反 DAG 硬契约，本设计拒绝承认（与 `rewrite-causality §5.3` 同口径）。

> ✅ **本节即 issue 验收要点 3 的「目标死亡触发 v_i 事件通知 S1 的时序」**：时序单向、S4 不写 v_i、由 S1 自算 Δ，已在 §5.3 作为边缘情况详述。

---

## 3. 数据（为落 `game/data/combat/*.tres`、`game/data/skills/*.tres`、`game/data/enemies/*.tres` 铺路）

> 遵循 `AGENTS.md` 数据驱动约定 + `art-bible §9` 命名规范（`snake_case` + 朝代命名空间）。下列为**设计侧字段契约**，是给程基岩 P3 架构的输入；**`.tres` 资源类名、Godot 类型映射标 `[待程基岩确认]`**，本文只定"要存什么、叫什么"。**伤害/资源/硬直公式数值落 `game/data/skills/*.tres`（§3.2）与 `game/data/combat/*.tres`（§3.1），与 S3 玩家能力数据契约（`panel-progression §3.1`）按 `ability_id` join，对齐 issue 验收要点 2。**

### 3.1 玩家战斗配置 —— `game/data/combat/player_combat.tres`（S4 拥有）

```yaml
# 玩家基础战斗数值（普攻/闪避/资源池；系统术法执行数据见 §3.2 按能力）
entity_id: char_player_traveler             # 与 art-bible §9.2 角色命名一致
dynasty: dyn_threekingdoms_chibi            # 朝代命名空间（art-bible §9.1，多朝代换此字段）
# —— 资源池 ——
hp_max: 100                                 # HP 上限（点）
hp_regen_ooc: 4                             # 脱战 HP 再生（点/秒，仅 alert_level≤1 时）
bf_max: 100                                 # 战意上限（点）
regen_bf_passive: 6                         # 战意被动再生（点/秒）
regen_bf_on_hit: 3                          # 命中回战意（点/次）
# —— 基础属性 ——
atk_base: 18                                # 基础攻击力（点，平坦不随章节膨胀，§1.4）
def_base: 5                                 # 基础防御（点）
crit_chance: 0.0                            # 暴击率（首版 0；成长由 S3 能力/装备目标态提供）
crit_mult: 1.5                              # 暴击倍率
# —— 普攻连段（art-bible §7.1 含连段）——
basic_attack:
  stages:                                   # 3 段连段
    - { mult: 1.0, stagger_value: 6,  windup: 0.08,  active: 0.10, recover: 0.12, cancel_from: 0.60 }
    - { mult: 1.0, stagger_value: 6,  windup: 0.08,  active: 0.10, recover: 0.12, cancel_from: 0.60 }
    - { mult: 1.4, stagger_value: 12, windup: 0.12,  active: 0.14, recover: 0.20, knockback: 24 }
  hitbox_shape: arc_front                   # [待程基岩确认] 前方扇形判定盒
  hitbox_range_px: 56                       # ≈ 0.9 Tile（art-bible §8.1）
# —— 闪避（完整集，game-concept §7.2）——
dodge:
  bf_cost: 18
  i_frames: 0.35                            # 无敌帧（秒）
  dodge_dist_px: 96                         # ≈ 1.5 Tile
  recover: 0.15                             # 后摇（不可取消，防滥用）
  mvp_enabled: false                        # MVP 不启用（game-concept §7.1）
# —— 硬直（完整集）——
stagger:
  stagger_threshold: 30                     # 玩家硬直槽阈值
  stagger_dur: 0.5                          # 失控时长（秒）
  regen_stagger: 10                         # 硬直槽衰减（/秒）
  mvp_enabled: false                        # MVP 不启用
# —— 失败态 ——
on_downed:
  respawn_rule: reload_encounter            # 重开当前遭遇（reload_encounter | nearest_camp）
  cp_penalty: 0                             # 不扣 CP（守 rewrite-causality §5.1 经济一致）
  node_progress_loss: false                 # 不删改写进度（§1.4 失败成本低）
```

> **设计意图**：玩家基础数值**平坦**（`atk_base=18` 不随章节涨，§1.4 战斗「轻」）——成长的爽感来自 S3 解锁的**能力种类**（新术法/新手段），而非 ATK 数值膨胀。这与 `panel-progression §2.2` 三分支（能力解锁）正交：S3 给"新招"，S4 给"招的执行数值"。

### 3.2 能力执行数据 —— `game/data/skills/<ability_id>.tres`（S4 拥有战斗执行数值）

> **join 键 = `ability_id`**：S3 的 `game/data/progression/skills/<skill_id>.tres` 的 `grants.value`（如 `ability_system_magic_wind`）引用本文件。S4 据本文件执行术法的伤害/命中/消耗。**两段式（解锁归 S3 / 执行归 S4），无重复所有者**（§2.6 / §7.3 / §7.7）。

```yaml
# 示例一：纯战斗术法（attack 类）
ability_id: ability_system_combat_burst      # 青蓝爆发（AoE，art-bible §2.4 玩家系统术法=青蓝几何）
display_name: "系统·青蓝爆发"
dynasty: dyn_threekingdoms_chibi
kind: attack                                 # attack | buff | utility | rewrite_proxy
# —— 执行数值（S4 拥有）——
bf_cost: 25
cooldown: 4.0                                # 冷却（秒）
cast_time: 0.4                               # 前摇（秒，可被受击打断，打断不耗 BF，§2.6）
# —— 伤害参数（attack 类才有）——
damage:
  mult_skill: 2.0                            # 伤害倍率（§4.1）
  damage_type: system_arcane                 # 伤害类型（决定敌人 resist）
  stagger_value: 20                          # 命中硬直积累（§4.3）
  aoe_radius_px: 96                          # AoE 半径（≈1.5 Tile）
# —— 表现（资产引用，art-bible §7.2 / §9.2）——
vfx_ref: vfx_system_magic_burst              # 青蓝几何粒子（快/脆/低饱和/硬边）
sfx_ref: sfx_system_magic_burst              # [音频归阮和鸣，本字段仅占位引用]
anim_ref: anim_player_cast_burst             # 施法姿态（art-bible §7.1）
# —— MVP 可见性 ——
mvp_available: false                         # MVP 仅 1 个系统术法（game-concept §7.1），此为完整集
```

```yaml
# 示例二：改写代理术法（rewrite_proxy 类，缝合战斗与改写）
ability_id: ability_system_magic_wind        # 玩家自借东风（rewrite-causality §3.5 verb_self_borrow_wind 的 requires.ability）
display_name: "系统·借风术"
dynasty: dyn_threekingdoms_chibi
kind: rewrite_proxy                          # 兼作改写动词的物理执行（§2.6）
bf_cost: 30
cooldown: 8.0
cast_time: 0.6                               # 较长前摇（仪式感）
damage: null                                 # 不造伤害（它是改写动词，不是攻击）
rewrite_proxy_verb: verb_self_borrow_wind    # 释放即触发此改写动词（rewrite-causality §3.5）
requires_scene: scene_altar                  # 需在七星坛场所（S5 校验 requires.scene）
vfx_ref: vfx_system_magic_wind_burst         # 青蓝几何风（区别于诸葛亮的朱黄墨晕，art-bible §2.4）
sfx_ref: sfx_system_magic_wind
anim_ref: anim_player_cast_wind
special_flags: [triggers_system_voice]       # 触发系统特殊旁白（game-concept §6.2 分支C「功劳归于玩家」）
mvp_available: true                          # MVP 唯一系统术法（game-concept §7.1 玩家能力最小集）
```

> ⚠️ **`ability_system_magic_wind` 是 MVP 唯一系统术法**（`game-concept §7.1`）。它既是**战斗可施放的术法**（S4 执行），又是**改写动词 `verb_self_borrow_wind` 的物理层**（发 `verb_executed` 给 S1）。这精准落地了基线「普攻 + 1 个系统术法」——这 1 个术法必须能**同时**支撑基础战斗（清小怪？否，它不造伤害）与改写（自借东风）。

> ⚠️ **MVP 战斗闭环的张力**：`ability_system_magic_wind` 是 `rewrite_proxy` 类**不造伤害**，那 MVP 玩家靠什么打小怪？答：**靠普攻连段**（§2.3，MVP 启用）。MVP 战斗 = 普攻清杂兵 + 借风术做改写。这意味着 **MVP 的"1 个系统术法"实际是改写工具而非战斗技能**——若 Playtest 觉得 MVP 战斗太单调，倾向在 S3 解锁一个 `attack` 类术法进 MVP，而非把闪避塞进 MVP（守 `game-concept §7.1` 范围）。**列入 §9 待审批。**

### 3.3 敌人定义 —— `game/data/enemies/<enemy_id>.tres`（S4 拥有行为/数值；遭遇布置归 S5）

> 敌人的**数值与行为参数归 S4**；敌人的**出现位置/数量/巡逻路线归 S5 遭遇表**（§2.1）。两段式。

```yaml
enemy_id: npc_wei_soldier_elite              # 与 art-bible §9.2 NPC 命名一致
display_name: "魏·精锐士卒"
dynasty: dyn_threekingdoms_chibi
faction: wei                                 # 阵营（art-bible §2.3，仅视觉/关系，X3 目标态）
# —— 数值（S4 拥有）——
hp_max: 45
atk_base: 8
def_base: 2
resist: { system_arcane: 0.0, physical: 0.0, fire: 0.2 }   # 抗性表（§4.1）
stagger_threshold: 18                        # 较低，易被打出硬直（完整集）
stagger_dur: 0.6
move_speed_px: 90                            # ≈ 1.4 Tile/s
# —— 感知参数（S4 拥有判定逻辑，§2.7）——
detection:
  view_cone_half_deg: 35
  view_radius_px: 288                        # ≈ 4.5 Tile
  hearing_radius_px: 160                     # ≈ 2.5 Tile
  sight_gain_rate: 1.5                       # 视野内感知累积（/秒）
  hear_gain_rate: 3.0                        # 听觉瞬时（听到即升警戒）
  lose_target_time: 6.0                      # 脱战判定（秒）
  alert_decay: 3.0                           # 档位衰减（秒/档）
# —— 行为 FSM（S4 拥有，§2.8）——
ai:
  fsm_preset: patrol_chase_attack            # MVP 简化三态（patrol|suspicious|chase|attack|return）
  attacks:
    - { id: atk_melee_slash, windup: 0.35, active: 0.12, recover: 0.30, mult: 1.0, range_px: 48, interruptible: true }
  patrol_route_ref: null                     # 巡逻路线由 S5 遭遇表注入（S4 不定义路线）
# —— 表现（资产引用，art-bible §4.3 阵营模板 + §9.2）——
sprite_ref: npc_wei_soldier_elite            # 玄甲 + 方正旗号（art-bible §4.3）
anim_ref: anim_npc_wei_soldier_elite
```

> **设计意图**：`detection` 与 `ai` 字段把敌人行为**完全数据驱动**——加新敌人 = 加一个 `.tres`，不改代码（守 `AGENTS.md` 数据驱动）。`patrol_route_ref` 留空由 S5 注入，体现「行为归 S4 / 布置归 S5」两段式。

### 3.4 被发现/警戒配置 —— `game/data/combat/detection_globals.tres`（S4 拥有全局感知规则）

```yaml
# 警戒档位 → 改写难度乘子（alert_mult，发给 S1 应用，§4.5）
alert_levels:
  - { level: 0, name: unaware,   alert_mult: 1.0 }
  - { level: 1, name: suspicious, alert_mult: 1.0 }   # 仅观察，不改写难度
  - { level: 2, name: detected,  alert_mult: 1.2 }    # [待审批]，待与 S1 联合确认
  - { level: 3, name: engaged,   alert_mult: 1.5 }    # [待审批]，待与 S1 联合确认
# 玩家行为噪声半径（art-bible §5.2 湿地放大，§2.7）
noise_radii_px:
  sprint: 160
  walk:   64
  crouch: 0                    # 潜行无噪声
  basic_attack: 96
  system_magic: 128
  on_wetland_mult: 1.5         # 湿地噪声 ×1.5（art-bible §5.2 滩涂湿地）
# 环境遮挡只读修正（S5 提供环境，S4 读修正）
env_modifiers:                 # 实际值由 S5 注入或读 TileMap 碰撞层
  reed_conceal_sight_mult: 0.3   # 芦苇荡内玩家被看到概率 ×0.3（art-bible §5.3）
  smoke_block_sight: true        # 烟雾完全遮挡视野（受风向影响，art-bible §5.5）
```

> ⚠️ **环境遮挡是 S5→S4 只读契约**：芦苇/烟雾/地形遮挡**归 S5**（世界长什么样），S4 只**读**这些遮挡体修正自己的感知判定。S4 不创建/修改遮挡体（守 `systems-index §2` S5 行）。

### 3.5 运行时状态（**非持久数据**，给 X4 存档的「需存什么」清单）

> 存档所有权在工程（X4，`systems-index §1.2`）。`systems-index §6` 明列「玩家战斗状态（HP/资源）= 运行时节点状态，**非持久数据**」。本系统声明：**战斗 HP/BF/alert 不持久化**——读档后按规则重置。

```yaml
# S4 运行时态（不落盘；存档时按规则归零/重置）
combat_runtime_state:
  current_hp: <derived on load>       # 读档后 = hp_max（满血重置）
  current_bf: <derived on load>       # 读档后 = bf_max
  active_alert_level: 0               # 读档后 = 未察觉（清零警戒）
  enemy_instances: []                 # 读档后由 S5 遭遇表重建（S4 不持久化敌人）
```

> **为何不持久化战斗态**：① 战斗是 Loop B 秒级瞬态，存"打到一半的 HP"无意义且易与 S5 遭遇状态撕裂；② 改写节点进度（Loop A）才是要存的核心（S1/S2 持久态）；③ 读档满血+清警戒 = 给玩家"重整旗鼓"的体验，契合 §1.4 失败成本低。**X4 存档只存 Loop A 态（S1 resolved_nodes / S2 ledger / S3 账户），不存 Loop B 战斗态。** 与 `rewrite-causality §3.6` / `mainline-quest §3.3` / `panel-progression §3.3` 一致。

### 3.6 朝代热切换口（多朝代扩展铺路，**本切片不实现**）

> 落地 `AGENTS.md` Godot 约定「朝代 = TileSet + 遭遇表 + BGM 组合热切换」+ `game-concept §7.3` 愿景。

**本系统的热切换契约**：
- 玩家战斗配置、敌人定义、能力执行数据均带 `dynasty` 命名空间字段；引擎按 `active_dynasty` 加载对应战斗数据包（`game/data/combat/`、`game/data/enemies/`、`game/data/skills/`）。
- **战斗公式（§4）朝代无关**（纯数值，不含朝代硬编码）——换朝代只换敌人/术法数据，不换公式。
- **遭遇表归 S5**（敌人"在哪/有多少"），S4 只换"敌人长什么样/怎么打"的数据包。跨朝代**遭遇布置**累积列为愿景（`game-concept §7.3`）。

> ✅ **预留验收**：本切片结构满足"换战斗数据包即可换朝代"，不挡多朝代扩展（与 `rewrite-causality §3.7` / `mainline-quest §3.5` / `panel-progression §3.6` 一致）。

---

## 4. 公式（统一格式 · 标变量与单位）

> 本节是本系统的数值定稿。所有符号见 §0。每条公式给出：**公式式 → 变量说明 → 设计意图/防红线注释**。**所有数值为首版倾向值，标 [待审批] / [待 P5/P6 Playtest]**，本 GDD 不给"已平衡"承诺。

### 4.1 伤害公式

```
crit_mult = 1.5 if rand() < crit_chance else 1.0                           [无量纲]
dmg = max( 1, round( ATK_base · mult_skill · crit_mult · (1 − resist) − DEF ) )    [点]，整数 ≥ 1
```

| 变量 | 含义 | 单位 | 来源 |
|---|---|---|---|
| `ATK_base` | 攻方基础攻击力 | 点 | 玩家 `player_combat.tres` / 敌人 `enemies/*.tres` |
| `mult_skill` | 动作/术法伤害倍率 | 无量纲 | 普攻连段段值 / `skills/*.tres` `damage.mult_skill` |
| `crit_chance` | 暴击率 | 无量纲 [0,1] | 攻方数据（玩家首版 0） |
| `crit_mult` | 暴击倍率 | 无量纲 | 全局 1.5（首版） |
| `resist` | 守方对该 `damage_type` 的抗性 | 无量纲 [0,0.8] | 守方 `resist[damage_type]` |
| `DEF` | 守方防御（固定减伤） | 点 | 守方 `def_base` |

**设计意图（守 §1.4 战斗「轻」）**：
- **`max(1, …)` 保底 1 点伤害**：任何命中至少造 1 伤，防"打不动"僵局（玩家不会卡在"砍不死也死不了"）。
- **`resist ∈ [0,0.8]` 封顶 0.8**：无完全免疫（≥0.8 即 80% 减伤已很高），防"某敌人对玩家主力术法免疫"逼玩家换招的硬门槛——守战斗"轻"（不强制配装）。
- **`ATK_base` 平坦**（玩家 18）：伤害成长主要靠 `mult_skill`（解锁更强术法）与 `crit_chance`（目标态），而非 ATK 膨胀——避免"练级碾压"（§1.4 支柱①漂移防线）。
- **普攻 `mult_skill≈1.0`、术法 `mult_skill≈2.0`**：术法约 2 倍普攻秒伤，但受 `bf_cost`/`cooldown` 限频——普攻是"续航"，术法是"爆发"，二者节奏互补，无主导（守 `game-concept §5.4` 防主导策略）。

### 4.2 战意（BF）消耗与再生

```
BF(t) = clamp( BF(t−1) − bf_cost(action) + regen_BF_passive·dt + regen_BF_on_hit·N_hits , 0, BF_max )    [点]
```

| 变量 | 含义 | 单位 | 默认 |
|---|---|---|---|
| `bf_cost(action)` | 闪避(18)/术法(按 ability)的消耗 | 点 | `player_combat.tres` / `skills/*.tres` |
| `regen_BF_passive` | 被动再生 | 点/秒 | 6 |
| `regen_BF_on_hit` | 命中回战意 | 点/次 | 3 |
| `N_hits` | `dt` 内命中次数 | 次 | 运行时 |
| `BF_max` | 上限 | 点 | 100 |

**设计意图**：
- **被动再生（6/s）** + **命中回（3/次）**：奖励"主动平 A"的战斗节奏（命中越多 BF 越足→越能放术法），契合俯视轻动作 ARPG 的"进攻即防御"哲学。
- **闪避(18) + 术法(25–30) 的 `bf_cost`**：`BF_max=100` → 约 5 次闪避或 3–4 次术法即空，**限频但不苛刻**（被动 6/s 约 17s 回满）。防"无限翻滚/无限术法"逃课（§1.4）。
- **`BF` 与 `RE`（改写能量）完全独立**（§0 防混淆）：BF 服务战斗，RE 服务改写，互不读写。

### 4.3 硬直 / 受击（完整集）

```
stagger_meter(t) = clamp( stagger_meter(t−1) + Σ stagger_value(命中) − regen_stagger·dt , 0, stagger_threshold )
on stagger_meter ≥ stagger_threshold:
    state → hit_stagger ; 持续 stagger_dur ; stagger_meter := 0
```

| 变量 | 含义 | 单位 | 默认 |
|---|---|---|---|
| `stagger_value(命中)` | 单次命中的硬直积累 | 无量纲 | 攻方动作数据（普攻 6–12 / 术法 20） |
| `regen_stagger` | 硬直槽衰减 | /秒 | 10 |
| `stagger_threshold` | 失控阈值 | 无量纲 | 玩家 30 / 敌人按类型（精锐 18） |
| `stagger_dur` | 失控时长 | 秒 | 玩家 0.5 / 敌人 0.6 |

**设计意图**：
- **硬直槽累积制**（而非单次受击即硬直）：让"被连击"才有惩罚，单次擦伤不失控——降低随机性，保留走位容错。
- **敌人阈值低（18）**：敌人易被打出硬直，给玩家"打出破绽→接术法爆发"的战术节奏（`game-concept §3.3` Challenge 动作技巧层）。
- **MVP 关闭**：`mvp_enabled=false`，受击只扣 HP。保留敌人施法/蓄力**可被打断**（`interruptible:true`，§2.8）作为最小战术深度。

### 4.4 闪避与无敌帧（完整集）

```
dodge 状态期间 t ∈ [0, i_frames): 受击判定被忽略（damage := 0, stagger_value := 0）
dodge 状态期间 t ∈ [i_frames, i_frames+recover): 可受击（后摇，不可主动取消）
```

**设计意图**：`i_frames=0.35s` 是俯视轻动作 ARPG 的**核心生存窗口**——玩家用它规避敌人攻击（尤其 boss/精英的重击）。`recover=0.15s` 后摇防"连续翻滚逃课"。**MVP 关闭**（§2.4）。

### 4.5 被发现 → 改写难度（alert_mult → S1 应用 · 关键跨系统契约）

> 落地 `game-concept §5.3`「被发现则改写难度上升」+ `systems-index §2` S4「警戒状态影响改写难度」。**S4 拥有 alert，S1 拥有 diff 公式**。

**S4 侧（本系统拥有）**：每次 `alert_level` 跨档 → 发 `alert_state_changed(node_id, alert_level, alert_mult)`（§6.1）。`alert_mult` 查表（§3.4）：未察觉/警戒=1.0，发现=1.2，交战=1.5。

**S1 侧（提议式，[待与 S1 联合确认]，本 GDD 不改 S1）**：建议 S1 的有效难度增补 `alert_mult` 项：

```
# 提议（待 rewrite-causality §4.3 联合确认，非本系统擅自定）：
diff_eff(node) = diff_base(node) · (1 − intel_cov) · alert_mult           [无量纲]
cost_RE(verb, node) = cost_base(verb) · diff_eff(node) · (1 − disc)       [点]
```

| 变量 | 含义 | 单位 | 来源 |
|---|---|---|---|
| `alert_mult` | 警戒乘子 | 无量纲 | **本系统发事件**，S1 应用 |
| `diff_base`/`intel_cov`/`disc` | （S1 已锁，不改） | 见 `rewrite-causality §4.3` | S1 |

**设计意图（风险传导链）**：
- **被发现 → 改写更贵（最多 1.5×）**：玩家在交战态尝试改写，RE 消耗最多多 50%——倒逼"潜行/速战速决后再改写"，呼应 `game-concept §5.3` 的策略张力。
- **警戒（alert=1）不改难度**：仅"怀疑"不惩罚玩家，给潜行容错（听到声响但没确认 = 还有机会）。
- **脱战即恢复**：alert 衰减回 0 → `alert_mult=1.0` → 改写难度回基线。**不永久惩罚**（MVP 无警戒记忆，§2.7）。

> ⚠️ **`alert_mult` 数值（1.2/1.5）为首版倾向 [待审批]**；`alert_mult` 是否应进入 `diff_eff`（乘 `diff_base`）还是仅乘最终 `cost_RE`，**待 S1/S4 联合确认**（§7.1 / §7.7）。在 S1 确认前，本系统事件照发，S1 可暂不应用——功能降级（被发现不改写难度）但不崩。

### 4.6 公式总览（一眼速查）

| 量 | 公式 | 单位 | 归属 |
|---|---|---|---|
| 伤害 | `dmg = max(1, round(ATK_base·mult_skill·crit_mult·(1−resist) − DEF))` | 点 | S4 |
| 战意 | `BF = clamp(BF − bf_cost + regen_passive·dt + on_hit·N, 0, BF_max)` | 点 | S4 |
| 硬直槽 | `stagger_meter = clamp(Σ stagger_value − regen·dt, 0, threshold)` | 无量纲 | S4 |
| 闪避无敌 | `t∈[0,i_frames): dmg=0, stagger=0` | — | S4（完整集） |
| 警戒→难度 | `diff_eff = diff_base·(1−intel_cov)·alert_mult`（**提议，待 S1 确认**） | 无量纲 | alert_mult 归 S4 发；应用归 S1 |

---

## 5. 边缘情况（≥3 类，逐类给判定与处理）

> 含 issue 验收要点 3 明列的：被发现状态中途 / 资源耗尽 / 目标死亡触发 v_i 事件通知 S1 的时序。

### 5.1 被发现状态中途 / 警戒档位翻转（系统一致性 + 认知过载红线）

- **现象**：玩家在改写场所（如七星坛）开始改写（Loop A `执行中`，S1 持有 `working_vars`），途中被巡逻敌人升到 `发现`（alert=2）/`交战`（alert=3），`alert_mult` 跳变；或反之玩家脱战、alert 衰减回 `未察觉`。
- **判定/处理**：
  1. **alert 跨档即发事件**（§6.1）：S4 在 `alert_level` 每次跨档（含下降）发 `alert_state_changed`；S1 据最新 `alert_mult` 重算**当前 `执行中` 节点的有效 diff**（§4.5 提议式）。**Δ 实时预览随之更新**（S3 改写面板 `deviation_recomputed(is_preview=true)` 不变，但 `cost_RE` 预览变）——让玩家"看见风险"，守支柱②。
  2. **改写不被强中断**：警戒提升**不阻止**玩家继续改写（不强制退出改写面板），只让改写**更贵**（最多 1.5×）。玩家可选择"硬着头皮改（贵）"或"先脱战再改（省）"——这是策略张力，非 bug。
  3. **alert 下降的处理**：脱战衰减回 `未察觉` → `alert_mult=1.0` → 改写难度回基线。**不追溯**已消耗的 RE（已花的 RE 不退，防刷分，对齐 `rewrite-causality §5.1`）。
- **红线标注**：此条守**认知过载 + 策略可读性**；若 alert 跳变导致改写面板数值"乱跳看不懂"，玩家失去掌控感（支柱②崩塌）。靠 `art-bible §6.1` 冷光面板**实时显示当前 alert_mult**（如"警戒中·改写消耗 ×1.5"）翻译风险。

### 5.2 资源耗尽（BF=0 / HP=0）（经济 + 失败态红线）

- **现象（BF=0）**：玩家战意耗尽，无法闪避（`BF < bf_cost_dodge`）/施法（`BF < bf_cost`）。
- **判定/处理**：
  1. **BF=0 不致死**：BF 耗尽只意味着"只能普攻+走位"，HP 不受直接影响。被动再生（6/s）保证约 3s 后可再闪避/施法——**战斗不会因 BF 卡死**，守 §1.4 失败成本低。
  2. **UI 明示**：HUD BF 条空时闪烁警示（`art-bible §6.2`），玩家知"现在只能平 A"。
- **现象（HP=0）**：玩家生命归零 → `downed` 态 → 失败态。
- **判定/处理**：
  1. **`on_downed.respawn_rule`**（§3.1）：默认 `reload_encounter`（重开当前遭遇，敌人/玩家满血重置）或 `nearest_camp`（回最近营寨，S5 checkpoint）。**不扣 CP、不删改写进度**（§1.4 失败成本低）。
  2. **改写节点不回滚**：失败只重开战斗遭遇，**S1 的 `working_vars`（未锁定改写）保留**（玩家可继续之前的改写尝试）；已锁定节点更不受影响（与 `rewrite-causality §5.4` 一致）。
  3. **alert 重置**：失败重开后 `alert_level=0`（清零警戒），给玩家"重整旗鼓"机会（§3.5）。
- **红线标注**：此条守**失败成本低 + 经济一致**；若战斗失败扣 CP/删进度，玩家会逃避战斗→潜行主导→又一种支柱漂移（§1.4）。

### 5.3 目标死亡触发 v_i 事件通知 S1 的时序（DAG 硬契约红线 · issue 验收要点 3）

- **现象**：玩家在战斗中击杀某改写目标（如曹操/庞统），该击杀应导致 `v_cao=死`/`v_pang=死` 并重算 Δ——但若时序错乱（S4 直写 v_i、或事件丢失、或 S1 还没算 Δ 玩家就触发下游）会导致因果链撕裂。
- **判定/处理**（时序单向，§2.9）：
  1. **S4 只发事件，不改 v_i**：敌人 HP≤0 → S4 查"该敌人是否映射某改写动词的 target"（`enemy_id ↔ verb_id` 映射表，§3.3）→ 若是，发 `verb_executed(verb_id, target, success=true)`（S4→S1）；S4 自身只播倒地动画+移除战斗实体。
  2. **S1 收事件后封闭计算**（`rewrite-causality §7.3`「S1 计算封闭」）：S1 据 `verbs[].effect.set` 改 `v_cao=死` → 重算 `Δ_node`/`M`/`CP_earned` → 发反馈信号组给 S3 → 因果链解析给 S2。
  3. **下游节点存在性依赖 S1 解析完成**：N3 华容道的存在性取决于 N2 火攻结果（`rewrite-causality §3.4`），与"曹操是否被截杀"（N3 内的 v_cao）是**不同节点**的不同变量。**S4 击杀曹操（N3 内）只影响 N3 的 v_cao，不回溯影响 N2/N3 存在性**——因果链单向，不逆流。
  4. **越权拒绝**：若实现期 S4 被写成"直接 `v_cao=死`"或"直接算 Δ"，违反 DAG 硬契约（`systems-index §3.1`），本设计拒绝承认（与 `rewrite-causality §5.3` 同口径）。
- **红线标注**：此条守**DAG 无环 + 因果链一致性**；任一环越权直写共享数值，整个心脏的可测试性崩塌。

### 5.4 战斗中切换到改写 / 改写动词的物理执行校验（Loop B 嵌入 Loop A）

- **现象**：玩家在战斗中（alert=3 交战）尝试释放 `ability_system_magic_wind`（rewrite_proxy 类，§2.6）以执行改写动词 `verb_self_borrow_wind`；或在非改写场所误按。
- **判定/处理**：
  1. **`requires.scene` 校验归 S5**（`rewrite-causality §3.5`）：玩家须在七星坛场所（`scene_altar`）才能释放；不在则 S5/S4 校验失败，施法不触发（不发 `verb_executed`）。**战斗中若不在场所，术法键无响应**（或改为释放失败提示）。
  2. **`requires.ability` 校验归 S4**（§2.6）：S4 查 S3 解锁集——未解锁 `ability_system_magic_wind` 则施法失败。
  3. **战斗态不阻塞改写代理施法**：玩家可在 `交战` 态释放 rewrite_proxy 术法（它不造伤害，是改写动作），但 `cast_time` 前摇**可被受击打断**（§2.2）——意味着"在被围攻时强行改写"风险高（前摇被打断=改写失败）。这制造"先清场/拉脱战再改写"的策略（呼应 §4.5 alert→难度）。
- **红线标注**：此条守**跨系统校验归属清晰**（scene 归 S5 / ability 归 S4 / v_i 归 S1）；校验链任一环错位会导致"不该改写时改写了"或"该改写时改不了"。

### 5.5 多敌人围攻 / 同屏性能（性能红线 · 对齐 `art-bible §8.4`）

- **现象**：玩家同时引到大量敌人（如巡逻队联动），同屏高精敌人精灵 + VFX 超预算。
- **判定/处理**：
  1. **同屏上限**（`art-bible §8.4`）：高精角色精灵 ≤30–50；士卒色块单位可更多但用「色块+少数精英」压缩（`art-bible §3.3`）。**S5 遭遇表负责不超量布置**（§2.1）；S4 假设同屏敌人在预算内。
  2. **VFX 节制**（`art-bible §7.2/§8.4`）：同屏活跃粒子 ≤200–400；玩家术法 VFX「快/脆/低饱和/硬边」即用即散，不堆叠。
  3. **alert 联动的性能策略**：敌人「喊叫」联动周围敌人升警戒（§2.7 `发现` 态），可触发连锁围攻——**MVP 限制联动范围**（仅近距 2–3 个敌人联动），防"全图敌人涌来"的性能与难度崩盘。
- **红线标注**：此条守**性能预算 + 难度曲线**；遭遇布置（S5）与战斗表现（S4）须共同守 `art-bible §8.4`，精确阈值待程基岩 P3 核对。

### 5.6 被发现后脱战 / 警戒记忆（叙事一致性 · 目标态）

- **现象**：玩家被发现（alert=2/3）后成功潜行脱战，敌人是否"记住"玩家？
- **判定/处理**：
  1. **MVP：脱战即清零**（§2.7）：脱离感知 + `lose_target_time`（6s）→ 敌人归位 → `alert` 逐档衰减回 `未察觉`。**不记忆**——玩家可"打一下就跑、回来再打"。
  2. **目标态：阵营警戒记忆**（X3 阵营系统，`systems-index §1.2` 愿景外）：脱战后该阵营警戒基线永久 +1 档，使后续遭遇更易被发现。**MVP 不做**，架构预留（敌人/阵营数据带 `faction` 字段，§3.3）。
  3. **尸体/痕迹**（目标态）：被击杀的敌人尸体若被其他敌人发现 → 触发警戒提升。**MVP 不做**（杀普通兵无任何 S1 通知，§2.9）。
- **红线标注**：此条守**叙事一致性 + 范围红线**；警戒记忆若做不好会让玩家觉得"敌人失忆"出戏，但 MVP 收窄不做（`game-concept §7.1`）。

---

## 6. UI 接口（信号 / 事件契约，衔接 P4-1 UX 规格）

> 本系统**对内发 `verb_executed`/`alert_state_changed`/HP·BF 只读给 S1/S3，向 S3 读能力解锁，向 S5 读遭遇/环境**。下列是**设计侧的事件/信号契约**，落地用 Godot 信号（`AGENTS.md`「信号优先于全局单例滥用」）。**与 S1 的信号逐条回引 `rewrite-causality §6.2/§7.3`，与 S3 的信号逐条回引 `panel-progression §6.3`，零新增冲突信号**；S4 自有信号（`alert_state_changed`/HP·BF 只读）单独列出，明确不与 S1↔S3 契约冲突。**Godot 信号精确签名标 `[待程基岩确认]`**。

### 6.1 S4 → S1（战斗结果 + 警戒状态 · 逐条回引 + 新增 1 条不冲突）

| 信号（建议） | 方向 | 载荷 | 触发时机 | S1 响应 | 回引 |
|---|---|---|---|---|---|
| `verb_executed(verb_id, target, success)` | **S4 → S1** | 改写动词、目标、成败 | 击杀/破坏改写目标（§2.9） | 按 `verbs[].effect` 改 v_i → 算 Δ（**S4 不写 v_i**） | `rewrite-causality §6.2/§7.3`（**零新增**） |
| `alert_state_changed(node_id, alert_level, alert_mult)` | **S4 → S1** | 当前节点、警戒档位、乘子 | `alert_level` 跨档（§2.7/§4.5） | **提议**：应用 `alert_mult` 到有效 `diff`（§4.5，[待联合确认]） | **S4 新增**（不在 S1↔S2 清单，不冲突；S1 据需消费） |

> ✅ **验收**：`verb_executed` 与 `rewrite-causality §6.2/§7.3` 完全一致，零改名。`alert_state_changed` 是 S4 在自己权责内（警戒态机）发出的信号，**不在 S1↔S2/S3 清单内，也不与之冲突**；它落实 `game-concept §5.3`/`systems-index §2` 的「警戒→改写难度」契约（S1 是否消费、如何消费待 §7.1 联合确认，事件本身照发）。

### 6.2 S4 → S3（HP/BF/警戒只读 · HUD 显示，回引 `panel-progression §6.3`）

| 信号（建议） | 方向 | 载荷 | 触发时机 | S3 响应 | 回引 |
|---|---|---|---|---|---|
| `hp_changed(new_hp, max_hp)` | **S4 → S3** | 当前/最大 HP | HP 变化（受击/再生） | HUD HP 条显示 | `panel-progression §6.5`（核心 HUD 含 HP） |
| `bf_changed(new_bf, max_bf)` | **S4 → S3** | 当前/最大 BF | BF 变化（消耗/再生） | HUD BF 条显示 | `panel-progression §6.5`（核心 HUD） |
| `combat_alert_changed(alert_level, alert_mult)` | **S4 → S3** | 警戒档位、乘子 | `alert_level` 跨档（同 §6.1 但面向 HUD） | HUD 警戒指示（"警戒中·改写消耗 ×1.5"，§5.1） | `systems-index §6` 玩家战斗状态行（只读显示归 S3） |

> ✅ **边界**（`systems-index §6` 玩家战斗状态行）：**状态机归 S4，只读显示归 S3**。S3 只读 HP/BF/alert 显示，**绝不反向改战斗状态**（S3 不发"扣 HP"/"回 BF"信号——那是 S4 权责）。HP/BF 不持久化（§3.5），故这些信号只在运行时，不进存档。

### 6.3 S3 → S4（能力解锁 · 回引 `panel-progression §6.3`，零新增）

| 信号（沿用 S3 命名） | 方向 | 载荷 | S4 响应 | 回引 |
|---|---|---|---|---|
| `ability_unlocked(ability_id)` | **S3 → S4** | 能力 id（如 `ability_system_magic_wind`） | 加入 S4 已解锁集；玩家释放该术法时 `requires.ability` 校验放行（§2.6） | `panel-progression §6.3`（**零新增**） |

> ✅ **验收**：S4 **不向 S3 发任何信号**（S3 只读 S4 的 HP/BF，§6.2）；S4 只**接收** S3 的 `ability_unlocked`。能力解锁归 S3（数值），执行归 S4（`systems-index §6` 玩家能力技能行）。

### 6.4 S5 → S4 / S4 → S5（遭遇布置 + 环境只读 · 待 S5 GDD 联合确认）

> S5（P2-6）尚未撰写，本节给**设计侧契约建议**，最终以 S5 GDD + P3 ADR 为准（标 `[待与 S5 联合确认]`）。

| 信号/契约（建议） | 方向 | 载荷 | 说明 |
|---|---|---|---|
| `encounter_spawned(encounter_id, enemies[])` | **S5 → S4** | 遭遇 id、敌人实例集（含 `enemy_id`/位置/巡逻路线） | S5 布置遭遇（§2.1），S4 接管敌人行为 FSM |
| `encounter_cleared(encounter_id)` | **S5 → S4** | 遭遇 id | S5 判定遭遇结束（或 S4 通知 S5 敌人全灭），S4 清理战斗态 |
| 环境遮挡只读 | **S5 → S4** | 视线遮挡体/噪声介质（芦苇/烟雾/湿地） | S4 读修正感知（§3.4），S5 拥有环境（`systems-index §2` S5 行） |
| 玩家 stance（潜行） | **S5 → S4** | 玩家移动模式（sprint/walk/crouch） | S4 读作噪声/感知参数（§2.7），stance 归 S5 玩家控制器 |
| `player_at_scene(scene_id)` | **S5 → S4** | 场所 id | `requires.scene` 校验（rewrite-causality §3.5）；S5 检测玩家场所，S4/S1 读用 |

> ⚠️ **遭遇布置 vs 战斗执行的两段式**（`systems-index §2/§6`）：**遭遇归 S5**（敌人"在哪/有多少/巡逻路线"），**战斗执行归 S4**（敌人"怎么动/怎么打"）。S4 不生成/删除敌人（只接收 `encounter_spawned` 接管行为），S5 不定义敌人行为参数（只布置）。**待 S5 GDD 联合确认信号清单**（§7.4）。

### 6.5 战斗 HUD 表现（衔接 `art-bible §6.2` + P4-1 UX）

> 战斗 HUD 是**轨道 B 冷光**（`art-bible §6.2` HUD 行：极简贴边，不挡世界）。本系统声明战斗 HUD 需呈现：

- **核心 HUD 常驻**（对齐 `panel-progression §2.1` 核心层）：HP 条 + BF 条 + 当前节点名 + Δ 指示条（S1）+ RE 条（S1）。**HP/BF 是 S4 数据（§6.2），Δ/RE 是 S1 数据**——S3 HUD 统一显示，但数据源不同（S4 发 HP/BF，S1 发 Δ/RE）。
- **警戒指示**（§5.1）：alert≥2 时 HUD 显"警戒中·改写消耗 ×{alert_mult}"冷光提示（仅战斗/警戒态显示，未察觉不显示，守 `art-bible §6.2` 极简）。
- **受击/硬直反馈**（`art-bible §7.1` 受击动画）：玩家受击有屏幕边缘红光（朱赤，`art-bible §2.1`）+ 受击动画；硬直满失控时画面轻微抖动（节制，`art-bible §3.1`「避免战斗时剧烈抖动」）。
- **敌人血条**：仅精英/将官/改写目标显血条（普通士卒不显，`art-bible §3.3` 战场色块压缩）。
- ⚠️ **战斗 HUD 信息密度纪律**（守 §1.4 + `systems-index §8`）：核心 HUD 恒定 ≤5 单元（HP/BF/节点名/Δ/RE），警戒提示按需。**严禁**把敌人 ATK/DEF/抗性等内部数值塞进战斗 HUD（那是硬核折叠层，P4-1 按需）。

### 6.6 与 P4-1 UX 规格的衔接点（给文策渊 Phase 4 自己）

> 本节是给未来 P4-1（关键屏幕 UX 规格）的**输入清单**：

- **战斗 HUD**（`art-bible §6.2`）：HP/BF 条样式（冷光贴边）+ 警戒指示 + 受击反馈。
- **术法快捷栏**（MVP 1 格 / 完整集多格）：显示已解锁 `ability_id` + `bf_cost` + cooldown 蒙层。
- **锁定指示**（[待审批] 是否进 MVP）：俯视下被锁定敌人的冷光描边。
- **失败屏**（§5.2）：HP=0 → 简洁"倒地"提示 + 重开/回营选项（不渲染沉重惩罚感，守 §1.4 失败成本低）。
- ⚠️ **手柄适配**（基线 PC 键鼠+手柄）：所有战斗动词须双绑定（键鼠 + 手柄），UI 须两套提示图标。对齐 `X5` 可访问性（`systems-index §1.2`）。

---

## 7. 依赖（与 S1/S2/S3/S5/X1/X4/X5 的边界与数据流）

> 边界以 `systems-index §2` 为准；本节做**战斗系统视角的交叉确认**。**显式引用**前置文档节号。

### 7.1 与 S1 改写/因果引擎（P2-2 · 已完成 · 核心跨系统契约）

- **S4 → S1**：`verb_executed(verb_id, target, success)`（战斗击杀/破坏改写目标，§2.9）、`alert_state_changed(node_id, alert_level, alert_mult)`（警戒→改写难度，§2.7/§4.5）。
- **S1 → S4**：（无直接；S4 从 S3 读玩家能力契约，`systems-index §3.1`；S1 不向 S4 发信号）。
- **边界 1（DAG 硬契约，`systems-index §3.1/§3.3` + `rewrite-causality §5.3/§7.3`）**：**S4 绝不直写 `v_i`/`Δ`**；战斗击杀只发 `verb_executed`，由 S1 判定 v_i 与 Δ。战斗**不直接产出 Δ**（`game-concept §5.3`）。✅ 已在 §2.9 / §5.3 落实。
- **边界 2（警戒→改写难度，`game-concept §5.3` + `systems-index §2` S4 行）**：**alert 态机与 `alert_mult` 归 S4 发，diff 公式与如何应用归 S1**。⚠️ **`rewrite-causality §4.3` 已锁的 `diff` 公式无 alert 项**——本 GDD **提议** S1 增补 `alert_mult`（§4.5），**不擅自改 S1**。**[待与 S1 联合确认]** 应用形式（乘 `diff_base` 还是乘最终 `cost_RE`）与数值（1.2/1.5）。在 S1 确认前，S4 事件照发，S1 可暂不应用（功能降级不崩）。
- **引用**：`game-concept §5.3`（Loop B 不产 Δ、被发现→改写难度↑）、`rewrite-causality §3.5`（verb requires.ability/scene）、§4.3（diff 公式，待增 alert 项）、§5.3（战斗结果必经事件）、§6.2（S1 接收 verb_executed）、§7.3（与 S4 边界）。

### 7.2 与 S2 主线任务系统（P2-3 · 已完成）

- **S2 → S4**：（无直接信号；S2 经 S5 布置节点目标场所 `target_scene`，`mainline-quest §3.2/§6.2` `quest_target_scene_set` → S5；玩家是否在场所由 S5 检测 → S4/S1 读 `requires.scene`）。
- **S4 → S2**：（无直接；战斗结果经 S1 的 `verb_executed`→`node_resolved`/`causal_link_propagated` 传导到 S2，S4 不直连 S2）。
- **边界（改写节点嵌入战斗场所，issue 任务来源）**：改写节点（如 N2 七星坛）的目标场所 `target_scene` 归 S2 声明（`mainline-quest §3.2`）、S5 布置（`mainline-quest §6.2`）；玩家在该场所的**战斗/潜行**归 S4；改写动词的 `requires.scene` 校验由 S5（场所检测）+ S4（ability 校验）+ S1（收事件）分层完成（§5.4）。**S4 不知道"这是 N2 节点"**，只知道"玩家在七星坛释放了借风术"——节点语义归 S1/S2。
- **引用**：`mainline-quest §2.4`（节点嵌入战斗场所）、§3.2（`target_scene`）、§6.2（S2→S5 场所布置）。

### 7.3 与 S3 面板/成长系统（P2-4 · 已完成 · 核心跨系统契约）

- **S3 → S4**：`ability_unlocked(ability_id)`（magic 分支解锁战斗/改写术法，§6.3）。
- **S4 → S3**：`hp_changed`/`bf_changed`/`combat_alert_changed`（HP/BF/警戒只读显示，§6.2）。
- **边界 1（能力解锁 vs 战斗执行，`systems-index §6` 玩家能力技能行 + `panel-progression §7.4`）**：**解锁/成长数值归 S3（`game/data/progression/skills/`），战斗执行数值归 S4（`game/data/skills/`）**，按 `ability_id` join（§2.6/§3.2）。✅ 与 `panel-progression §6.3/§7.4` 已确认的口径一致。
- **边界 2（玩家战斗状态，`systems-index §6` 玩家战斗状态行）**：**HP/BF 状态机归 S4，只读显示归 S3**（§6.2）。HP/BF 非持久数据（§3.5），不进存档。
- **引用**：`panel-progression §3.1`（skill `grants` 引用 `ability_id`）、§6.3（`ability_unlocked` S3→S4）、§6.5（核心 HUD 含 HP）、§7.4（与 S4 边界）。

### 7.4 与 S5 开放世界/朝代地图（P2-6 · 未开始 · 待联合确认）

- **S5 → S4**：`encounter_spawned`（敌人布置）、环境遮挡只读（芦苇/烟雾/湿地）、玩家 stance（潜行）、`player_at_scene`（场所检测，供 `requires.scene` 校验）（§6.4，[待 S5 GDD 联合确认]）。
- **S4 → S5**：`encounter_cleared`（敌人全灭通知，[待确认]由 S4 还是 S5 判定）。
- **边界 1（遭遇布置 vs 战斗执行，`systems-index §2` S4/S5 行）**：**敌人"在哪/有多少/巡逻路线"归 S5 遭遇表**，**敌人"怎么动/怎么打"归 S4**（§2.1）。S4 不生成/删除敌人。
- **边界 2（环境遮挡，`art-bible §5.2/§5.3/§5.5`）**：**视线遮挡体/噪声介质归 S5**（世界长什么样），**S4 只读修正感知**（§3.4）。`art-bible §5.2` 显式「滩涂湿地影响潜行/战斗可读性，待 P2-5 战斗 GDD」——**本 GDD 落地**：湿地噪声半径 ×1.5（§3.4 `on_wetland_mult`），芦苇荡视野感知 ×0.3，烟雾完全遮挡（§2.7/§3.4）。
- **边界 3（潜行 stance）**：**玩家蹲行移动归 S5 玩家控制器**（探索层），**感知判定归 S4**（战斗层）。两段式，§2.7。
- **引用**：`systems-index §2` S5 行、`art-bible §5.2/§5.3/§5.5`（环境与潜行）、`mainline-quest §6.2`（S2→S5 场所布置）。

### 7.5 与 X1 系统叙事层（横切）

- **S4 → X1**：（无直接信号；战斗表现音效/VFX 由 S4 资产直接播放，旁白归 S3/S1 触发）。
- **X1 → S4**：（无）。
- **边界**：战斗的**音效/VFX 资产归 S4 执行播放**（如剑击声/术法爆裂），**系统旁白**（如"目标已消除"）由 S1/S3 触发 X1（非战斗触发）。S4 不产旁白文案。战斗表现资产命名遵循 `art-bible §9`（`vfx_system_*`/`sfx_*`，音频归阮和鸣）。

### 7.6 与 X4 存档 / X5 可访问性（横切）

- **X4（存档）**：S4 战斗态（HP/BF/alert/敌人实例）**不持久化**（§3.5）。读档满血 + 清警戒 + S5 重建遭遇。X4 只存 Loop A 态（S1/S2/S3），不存 Loop B 战斗态。
- **X5（可访问性）**：①战斗受击反馈须**多通道**（红光 + 屏幕震 + 音效），不只靠颜色（`art-bible §2.3` 可访问性红线）；②键鼠+手柄双绑定（基线）；③战斗节奏可访问性选项（如"减少屏幕震"），[待 P4-1/P3 可访问性矩阵]。

### 7.7 跨 GDD 评审注释（issue 验收要点 4 · 跨 GDD 一致性）

> 撰写中发现与前置 GDD 的**张力 / 待统一项**，逐条列具体位置与修复建议。**本 GDD 不越权改前置 GDD**（红线），仅标注，建议主理人派独立一致性 issue 或在评审中统一。

1. **【`alert_mult` 应用方与 S1 公式】`rewrite-causality §4.3` 的 `diff` 公式无 alert 项**（§4.5 / §7.1）。
   - 张力：`game-concept §5.3` + `systems-index §2` S4 行都要求「被发现→改写难度↑」，但 S1 已锁的 `diff(node)=diff_base·(1−intel_cov)` 无 alert 项。
   - 本 GDD 立场：S4 拥有 alert 态机 + 发 `alert_state_changed`；提议 S1 增补 `alert_mult`（§4.5 提议式），**待 S1/S4 联合确认**应用形式与数值（1.2/1.5）。在 S1 确认前，S4 事件照发，S1 可暂不应用（降级不崩）。
   - 建议：主创审批后，回写 `rewrite-causality §4.3` 增补 alert 项（或确认"alert 不进 diff，仅作 UI 提示"的替代方案）。
2. **【`game/data/skills/*.tres` 所有权细化】systems-index §6 落点 vs panel-progression §3.1 路径**（§2.6 / §3.2）。
   - 张力：systems-index §6 把 `game/data/skills/*.tres` 列为「玩家能力/技能（owner S3）」的建议落点；但 panel-progression §3.1 实际把 S3 解锁数据放在 `game/data/progression/skills/<skill_id>.tres`。
   - 本 GDD 细化：`game/data/skills/<ability_id>.tres` = **S4 战斗执行数据**（伤害/bf_cost/cooldown/hitstun/VFX）；`game/data/progression/skills/<skill_id>.tres` = **S3 解锁数据**（CP 造价/branch/grants）。两文件按 `ability_id` join，各管各的——镜像 S1/S2 的 node_id 两段式（`rewrite-causality §3.2` ↔ `mainline-quest §3.2`）。无重复所有者。
   - 建议：回写 systems-index §6 落点列为「`game/data/skills/*.tres`（S4 执行）/ `game/data/progression/skills/*.tres`（S3 解锁）」两段式，与 panel-progression 一致。
3. **【MVP「1 个系统术法」= 改写代理而非战斗技能的张力】game-concept §7.1**（§3.2 / §9）。
   - 张力：MVP「普攻 + 1 个系统术法」中，这 1 个术法（`ability_system_magic_wind`）是 `rewrite_proxy` 类（自借东风），**不造伤害**——意味着 MVP 玩家打小怪只能靠普攻。
   - 本 GDD 立场：MVP 战斗 = 普攻清杂兵 + 借风术做改写。若 Playtest 觉得太单调，倾向在 S3 解锁 1 个 `attack` 类术法进 MVP，**而非把闪避塞进 MVP**（守 `game-concept §7.1` 范围）。**[待主创审批]** MVP 是否含 1 个 attack 类术法。
4. **【`requires.scene` 校验方】rewrite-causality §3.5 vs 本 GDD §2.6/§5.4**（无冲突，仅澄清）。
   - 澄清：`verb.requires.scene`（玩家须在场所）校验由 **S5 检测玩家场所 + S4/S1 读取**（本 GDD §5.4）；`verb.requires.ability` 由 **S4 查 S3 解锁集**（本 GDD §2.6）。与 `rewrite-causality §3.5`「requires 由 S4/S5 校验」一致，零冲突，仅具体化归属。

> ✅ **跨 GDD 一致性总检**：与 S1（`verb_executed` 零改名；`alert_mult` 待联合确认）、S2（`target_scene` 经 S5 布置，S4 不直连 S2）、S3（`ability_unlocked` 零改名；`ability_id` join；HP/BF 只读）**无硬矛盾**；与 S5（遭遇/环境）待 S5 GDD 联合确认信号清单。支柱红线（§1.4 战斗不喧宾夺主）已逐机制标注。

### 7.8 引用的前置文档（一致性锚）

- `game-concept.md`：§1 术语、§2 支柱（①主/②次）、§3.1 战斗动词、§3.3 美学（Challenge 动作技巧 / Sensation）、§4.2 Bartle（Killer 次）、§5.3 Loop B（秒级·不产 Δ·被发现→改写难度↑）、§7.1 MVP（普攻+1 术法）、§7.2 完整集（多术法+闪避/硬直）、§9 待审批（①人格 / ②奇幻上限）。
- `systems-index.md`：§2 S4 边界、§3 依赖 DAG（S4 发事件不写 Δ）、§4 Loop A 映射（S4 嵌入探索环）、§5 支柱对齐（S4 漂移红线=喧宾夺主）、§6 横切实体归属（玩家能力技能/玩家战斗状态）、§8 认知过载/支柱漂移红线。
- `rewrite-causality.md`：§3.5 verb 数据契约（requires.ability/scene/effect）、§4.3 diff 公式（待增 alert）、§5.3 战斗结果必经事件、§6.2 verb_executed、§7.3 与 S4 边界。
- `mainline-quest.md`：§2.4 节点嵌入战斗场所、§3.2 target_scene、§6.2 S2→S5 场所布置。
- `panel-progression.md`：§3.1 skill grants（ability_id）、§6.3 ability_unlocked（S3→S4）、§6.5 核心 HUD 含 HP、§7.4 与 S4 边界。
- `art-bible.md`：§1.3 3/4 俯视角、§2.4 玩家术法青蓝/本土朱黄、§3.3 战场色块压缩、§4.4 精灵尺寸、§5.2 湿地潜行（显式待 P2-5）、§5.5 风向视觉化、§6.2 HUD 极简、§7.1 方向集+动作集、§7.2 VFX 来源、§8.4 性能上限、§9 命名空间。
- `project-charter.md`：核心循环 Loop A 措辞、范围（垂直切片严守）、平台（PC 键鼠+手柄）。

---

## 8. 验收标准（可逐条勾选）

> 对照 issue 验收要点 + `team/design-strategist.md` 输出规范（八节齐全 / 公式标变量单位 / ≥3 类边缘情况 / 跨 GDD 一致性 / 支柱红线 / 数据驱动）。

- [ ] **八节齐全**：概述(§1) / 机制(§2) / 数据(§3) / 公式(§4) / 边缘情况(§5) / UI 接口(§6) / 依赖(§7) / 验收标准(§8)，缺一不可。✅
- [ ] **公式统一格式、标变量与单位**：§0 符号表（含 S1/S3 沿用符号 + S4 新增符号分列）+ §4 六类公式（伤害/BF/硬直/闪避/警戒→难度/总览）均给式/变量/单位/域/归属，§4.6 速查表。✅
- [ ] **伤害/资源/硬直公式落 `game/data/skills/*.tres` 数据契约**：§3.2（S4 执行数据）+ §3.1（玩家配置）+ 与 S3 玩家能力契约（`panel-progression §3.1`）按 `ability_id` join（§2.6），对齐 systems-index §6 玩家能力技能行。✅
- [ ] **≥3 类边缘情况（含 issue 明列 3 项）**：§5 给 6 类——§5.1 被发现状态中途 / §5.2 资源耗尽 / **§5.3 目标死亡触发 v_i 事件通知 S1 的时序**（issue 明列）/ §5.4 战斗中改写校验 / §5.5 多敌人性能 / §5.6 警戒记忆。✅
- [ ] **跨 GDD 一致性（issue 验收要点 4）**：§7.7 列 4 条评审注释（alert_mult 应用方 / skills 落点细化 / MVP 术法定位 / requires.scene 校验方）；与 S1/S2/S3/S5 **无硬矛盾**，发现冲突已在 §7.7 标注 + §9 待审批。✅
- [ ] **支柱红线（issue 验收要点 5）**：§1.4「战斗『轻』纪律」给 6 条量化锚点（资源单一/动作精简/数值平坦/时长占比小/失败成本低/术法节制），逐机制节回引；§7.7 总检确认未使支柱①漂移；战斗**不直接产 Δ**（§2.9/§5.3 落实 DAG 硬契约）。✅
- [ ] **数据驱动（issue 验收要点 6）**：数值落 `game/data/combat/*.tres`、`game/data/skills/*.tres`、`game/data/enemies/*.tres`（§3），代码读取避免硬编码；引擎精确 API/资源类名一律标 `[待程基岩确认]`。✅
- [ ] **与 S1/S3 信号契约逐条对齐、零新增冲突**：§6.1（`verb_executed` 回引 `rewrite-causality §6.2/§7.3` 零改名；`alert_state_changed` 明确不在 S1↔S2/S3 清单、不冲突）、§6.3（`ability_unlocked` 回引 `panel-progression §6.3` 零新增）。✅
- [ ] **不产 Δ / 不写 v_i 的 DAG 硬契约已落实**：§2.9 / §5.3 / §7.1 明确 S4 只发 `verb_executed`，S1 自算 Δ。✅
- [ ] **与 game-concept / systems-index / 前置 GDD 一致且显式引用**：§0/§1/§7 多处显式引用节号，术语逐字沿用（Δ/CP/v_i/改写节点/Loop A/Loop B），支柱名可追溯（①主/②次）。✅
- [ ] **不脱离引擎能力**：数据驱动落 `game/data/*`（§3），引擎精确 API（`Area2D`/`CharacterBody2D`/`AnimationPlayer`/`TileMapLayer` 碰撞层）一律标 `[待程基岩确认]`，未臆造。✅
- [ ] **守范围**：MVP = 普攻 + 1 系统术法（`game-concept §7.1`），闪避/硬直标完整集（`game-concept §7.2`）；每个机制标 MVP 启用与否（§2.2~§2.8）；多朝代/跨朝代累积列为愿景（§3.6）；未越垂直切片。✅
- [ ] **待审批项显式标注**：§1.4（战斗「轻」数值锚点）、§2.4/§2.5（闪避/硬直 MVP 范围）、§2.7（alert_mult 数值/警戒记忆）、§3.2（MVP 术法定位）、§4.5（alert_mult 应用方）、§4 全部默认值、§6.4（S5 信号清单待联合确认）均标 `[待审批]`/`[提议方案]`/`[待程基岩确认]`/`[待与 S1/S5 联合确认]`，不擅自定稿。✅
- [ ] **状态标记**：文档头 v0.1（首版，待主创评审）/ 状态：可评审。✅

---

## 9. 待主创审批项（发现设计张力，不擅自定稿）

> 沿用并细化 `game-concept §9` / `systems-index §10` 中影响**本系统数值结构**的待定项。

1. **【战斗「轻」的量化锚点是否拍板】（§1.4）**：单资源 BF、动作集精简、ATK 平坦、单遭遇 8–20s、失败不扣 CP——这些是「战斗不喧宾夺主」的支柱①防线。若主创希望战斗更重（如允许格挡/装备/练级），须重评支柱对齐。倾向：严守「轻」。
2. **【`alert_mult` 应用方与数值】S1 增补 alert 项？（§4.5 / §7.1 / §7.7①）**：提议 `diff_eff = diff_base·(1−intel_cov)·alert_mult`，数值 1.2/1.5。**须 S1/S4 联合确认**应用形式（乘 diff_base 还是乘 cost_RE）与数值。这是 `game-concept §5.3`「被发现→改写难度」的落地开关。
3. **【MVP「1 个系统术法」是否含 attack 类】（§3.2 / §7.7③）**：MVP 的 `ability_system_magic_wind` 是 rewrite_proxy（不造伤害）。若 Playtest/主创要求 MVP 战斗更有术法爽感，倾向在 S3 解锁 1 个 attack 类术法进 MVP，**而非把闪避塞进 MVP**。
4. **【闪避/硬直的 MVP 范围】沿用 `game-concept §7.1/§7.2`（§2.4/§2.5）**：MVP 不含闪避/硬直（完整集才含）。倾向严守范围；若主创要求 MVP 含闪避，须回头评估 `game-concept §7.1` 范围。
5. **【系统人格基调】沿用 `game-concept §9①`（战斗旁白/术法提示语气）**：战斗的术法提示/失败提示按"冷峻记录员"倾向（如「目标已消除」「能量不足」），留接口待定稿。与 S2/S3 文案同口径。
6. **【奇幻来源上限·战斗侧】沿用 `game-concept §9②` / `art-bible §11②`（§2.6 VFX）**：玩家系统术法严守青蓝几何/快/脆/低饱和（`art-bible §2.4/§7.2`）；本土敌人术士（如有）用朱黄墨晕。两套不混用。MVP 敌人无施法型（§2.8），故战斗侧奇幻上限主要约束玩家术法 VFX。

---

## 10. 已知风险与取舍

1. **战斗数值未平衡**（§4 全部默认值）：HP/BF/ATK/`mult_skill`/`alert_mult` 等为首版倾向值，须 P5/P6 Playtest（严守真）迭代，本 GDD 不给"已平衡"承诺。战斗"轻"的锚点（§1.4）是约束框架，非冻结数值。
2. **MVP 战斗深度的张力**（§3.2 / §7.7③）：MVP 仅普攻 + 1 个不造伤害的改写术法，战斗可能"太薄"——靠普攻连段节奏 + 敌人可打断维持最小乐趣。若 Playtest 证明太单调，须 §9 第 3 项决策（加 attack 类术法进 MVP）。
3. **`alert_mult` 跨系统耦合的实现依赖**（§4.5 / §7.1）：本系统正确发事件，但**功能（被发现→改写难）依赖 S1 采纳 `alert_mult`**。若 S1 不采纳，"被发现"只剩 UI 提示（无实际改写惩罚）——可能削弱潜行动机（支柱③探索策略）。须 §9 第 2 项尽快联合确认。
4. **俯视战斗的可读性**（`art-bible §3.3/§4.2`）：俯视下敌人攻击预备/命中盒须极清晰可读，否则玩家"莫名其妙掉血"（认知过载）。依赖 `art-bible §7.1` 预备帧 + 攻击弧线 VFX，须 P4-2 资产规格验证。
5. **性能预算未冻结**（§5.5 / `art-bible §8.4`）：同屏敌人/VFX 上限是美术侧倾向，精确阈值待程基岩 P3。S5 遭遇表须共同守预算（§7.4），否则战斗时帧率崩。
6. **手柄适配与可访问性**（§6.6 / X5）：战斗动词双绑定 + 受击多通道反馈须 P4-1/P3 可访问性矩阵落地，本 GDD 只声明需求。
7. **存档不持久化战斗态的取舍**（§3.5）：读档满血+清警戒给"重整旗鼓"体验，但可能被玩家利用"打不过就读档回满血"——靠 `max_attempts`（S1）+ 节点 diff 平衡缓解，不靠扣 HP 惩罚（守 §1.4 失败成本低）。

---

## 11. 下一步建议（给主理人 · 游承峰）

1. **本 issue（P2-5）完成后**，请主创优先审批 **§9 第 2 项（`alert_mult` 应用方与数值）**——它是 `game-concept §5.3`「被发现→改写难度」的落地开关，须 S1/S4 联合确认后回写 `rewrite-causality §4.3`。**这是唯一的跨系统数值依赖**，越早定越省 P3 架构返工。
2. **请主创次优先审批 §9 第 1、3 项**（战斗「轻」锚点 / MVP 术法定位）——它们决定 MVP 战斗的"厚度"与范围，影响 P4-2 资产清单（多少敌人/术法 VFX）。
3. **立即可派 P2-6（S5 开放世界 GDD）**：本 GDD §6.4 已给出 S5↔S4 信号/契约建议清单（遭遇布置/环境遮挡/潜行 stance/场所检测），S5 据此 + `art-bible §5` 环境定义遭遇表与环境即可（`systems-index §7` S5 在 S4 后）。
4. **给程基岩（P3-1 架构）**：§3 数据契约（`combat/*`/`skills/*`/`enemies/*`）+ §6 信号契约 + §7 DAG 可直接作为系统边界与数据归属输入。重点：①`ability_id` join（S3↔S4 两段式）；②`verb_executed`/`alert_state_changed` 事件路由；③HP/BF 非持久态；④敌人 FSM 数据驱动。建议 P3-1 与本文 + S1/S3 交叉引用，在 ADR 中确认 `.tres` 资源类设计 + 事件路由。
5. **跨 GDD 一致性待办**（§7.7）：①回写 `rewrite-causality §4.3` 增补 alert 项（待主创审批后）；②回写 `systems-index §6` skills 落点为两段式——建议作为独立一致性 issue 由主理人派单（本 GDD 不越权改前置 GDD）。
6. **给严守真（QA）**：§5（尤其 §5.3 击杀时序、§5.1 警戒翻转）+ §8 验收项是 QA 清单雏形，建议 P5/P6 转为可执行断言（如"击杀改写目标后 v_i 未由 S4 直写"、"alert 跨档必发 alert_state_changed"）。

---

*—— 文策渊（design-strategist）· Phase 2 系统设计（P2-5 · S4 实时战斗系统）· 待主创评审*
