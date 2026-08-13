# 开放世界/朝代地图系统 GDD · 《赤壁·改写者》

> 阶段：Phase 2 · 系统设计（P2-6，S5）　|　执行角色：文策渊（design-strategist）
> 文档版本：v0.1（首版，待主创评审）　|　状态：可评审
> 基线锚点：`AGENTS.md`「设计基线」表（**2D 俯视角开放世界 · Godot 4.7 `TileMapLayer`**；**朝代 = TileSet + 遭遇表 + BGM 组合热切换**，X6 跨朝代热切换明确愿景外）、`docs/project-charter.md`「核心循环 Loop A · 探索环」、`docs/roadmap.md` P2-6。
> 设计依赖（**显式引用**，本 GDD 与之保持一致，不另立术语/信号/产出源）：
> - `docs/design/gdd/game-concept.md`（P1-1，✅）——**术语 §1、设计支柱 §2（**S5 主支撑支柱③「赤壁是可丈量的沙盘」、次支撑支柱①**）、核心循环 §5（S5=探索环主责）、三节点 MWP §6（场所/据点落点）、范围分层 §7（MVP 收窄）、待审批 §9（①人格 / ②奇幻来源上限）**。本文凡引用写作 `game-concept §x`。
> - `docs/design/art/art-bible.md`（P1-2，✅）——**§0 双轨反差、§1.3 3/4 俯视角、§2.5 Δ 视觉三档、§3.2 渲染叠层（L1-L2 地形/实体、L5 系统叠层）、§3.3 信息焦点（冷光环）、§4.4 精灵尺寸、§5.1 朝代舞台视觉 token（TileSet+遭遇表+BGM）、§5.2 滩涂湿地可读性、§5.3 植被芦苇遮挡、§5.4 关键建筑（楼船/连舟/营寨/七星坛/华容道）、§5.5 风向/芦苇/烟雾视觉化（v_wind 表达）、§8.1 Tile=64px、§8.4 性能上限、§9 命名空间（`dyn_threekingdoms_chibi`、snake_case）**。本文凡引用写作 `art-bible §x`。
> - `docs/design/gdd/systems-index.md`（P2-1，✅）——**S5 行 §2（边界）、依赖 DAG §3（S5 只读 S1 的 v_i 可视化契约）、Loop A 映射 §4（S5=探索环主责，S4 战斗为其动作层）、支柱对齐 §5（S5 漂移红线=据点间无因果联动、退化为清单 → 支柱③崩塌）、横切实体归属 §6（情报行：采集归 S5 消费归 S1/S2；v_i 行：S1 所有 S5 视觉映射；阵营关系行：S5 NPC 层·目标态）、撰写顺序 §7**。本文凡引用写作 `systems-index §x`。
> - `docs/design/gdd/systems/rewrite-causality.md`（P2-2，✅）——**§0 符号（`v_i`/`intel_cov`/`Δ_node`）、§3.1 关键变量 `world_visual` 视觉映射契约、§3.5 改写动词 `requires.scene`、§6.1 S1→S5 信号（`variable_changed`/`deviation_recomputed`）、§6.2 S5→S1 信号（`intel_updated`）、§7.4 与 S5 的边界（情报采集归 S5 / 降 diff 解锁蓝图归 S1；v_i 只读视觉映射）**。本文凡引用写作 `rewrite-causality §x`。
> - `docs/design/gdd/systems/mainline-quest.md`（P2-3，✅）——**§3.2 节点 `target_scene` 字段、§6.2 S2→S5 信号（`quest_target_scene_set` 场所布置 / `quest_node_vanished_voiced` 场所移除）、§2.4 改写节点如何嵌入地理场所、§2.1 玩家绕序/未激活节点的软引导**。本文凡引用写作 `mainline-quest §x`。
> - `docs/design/gdd/systems/panel-progression.md`（P2-4，✅）——**§0 符号（`intel_gain_mult`）、§4.5 情报强化（`intel_gain_mult` S3→S5 只读契约，"S5 把采集到的原始情报量 ×此乘子得 intel_cov"）、§6.3 `ability_changed` S3→S5 下发**。本文凡引用写作 `panel-progression §x`。
> - `docs/design/gdd/systems/combat.md`（P2-5，✅）——**§2.1 遭遇触发流程（遭遇布置归 S5 / 战斗执行归 S4）、§6.4 S5↔S4 信号契约建议（`encounter_spawned`/`encounter_cleared`/环境遮挡只读/玩家 stance/`player_at_scene`，标「待 S5 GDD 联合确认」）、§7.4 与 S5 边界（遭遇布置 vs 战斗执行两段式；环境遮挡归 S5，S4 只读修正感知；潜行 stance 归 S5 玩家控制器）**。本文凡引用写作 `combat §x`。
> 本系统边界以 `systems-index §2`（S5 行）为准；术语以 `game-concept §1` 为准；与 S1/S2/S3/S4 的信号契约**严格对齐前置 GDD 既定信号，零新增冲突信号**（S4 §6.4 提出的 S5↔S4 通道信号由本 GDD 正式确认，属本系统职责，不与 S1↔S2/S3 契约冲突）。本文件是开放世界/朝代地图系统的**完整八节 GDD**，是核心循环 Loop A「任务→**探索**→改写→反馈」的**探索环主责**（`systems-index §4` 探索行；`charter` 核心循环第 2 环；S4 战斗嵌入其内作动作层）。

---

## 0. 公式符号与单位约定（全篇统一）

> 为杜绝跨文档/跨公式符号漂移，本节定义本 GDD 用的符号、单位与取值域。**第 4 节所有公式均回引本表符号**，不另造。**与 S1/S3/S4 共享的符号（`v_i`/`intel_cov`/`intel_gain_mult`/`alert_level`/`encounter_id` 等）沿用 `rewrite-causality §0` / `panel-progression §0` / `combat §0` 定义，本表不重定义**，只列本系统**新增**符号并显式标注来源；共享符号列后注明归属，避免「生产方/消费方」混淆。

| 符号 | 含义 | 单位 | 取值域 / 类型 | 来源 |
|---|---|---|---|---|
| `v_i` | 关键变量（如 `v_wind`/`v_boat`/`v_altar`） | 枚举/数值 | 见各变量定义 | **S1 拥有**（`rewrite-causality §3.1`），**S5 只读视觉映射**（`systems-index §6` v_i 行） |
| `intel_cov` | 节点情报覆盖率 | 无量纲 | [0, 1] | **S5 生产**（§4.1 公式）、**S1 只读消费**（`rewrite-causality §4.3` diff 公式）；与 `rewrite-causality §0`「探索产出」标注一致 |
| `intel_gain_mult` | 情报采集乘子（S3 成长元升级） | 无量纲 | [1.0, 2.0] | **S3 拥有**（`panel-progression §4.5`）、**S5 只读应用** |
| `intel_raw` | 单个情报采集点的基础情报产出量 | 无量纲 | [0, 1]（数据字段） | **本系统新增（S5 拥有）** |
| `intel_cap` | 节点情报覆盖率饱和上限（分母，使覆盖率可比） | 无量纲 | 数据字段，默认 1.0 | **本系统新增（S5 拥有）** |
| `intel_entry` | 离散情报条目（解锁蓝图/S2 解锁条件用） | 结构体 | `{entry_id, relates_to_node, unlocks[], lore_text}` | **本系统新增（S5 生产）**；消费方 S1/S2 只读 |
| `poi_id` / `scene_id` / `stronghold_id` / `npc_id` / `encounter_id` / `dynasty` | 标识符 | 字符串 | `snake_case`，朝代命名空间 `dyn_threekingdoms_chibi` | `art-bible §9`；**本系统新增 POI/场所/据点枚举口径** |
| `v_wind` | 风向关键变量（N2 核心，art-bible §5.5） | 枚举 | {`southeast`, `none`, `northwest`}（`rewrite-causality §3.1` 口径） | **S1 拥有**，**S5 视觉映射**（旗帜/芦苇/江浪/烟雾方向，§2.4/§2.3） |
| `weather_state` | 天气状态 | 枚举 | {`clear`, `overcast`, `rain`, `fog`, `storm`} | **本系统新增（S5 拥有环境表达）** |
| `time_of_day` | 时辰 | 枚举 | {`dawn`, `day`, `dusk`, `night`}（四分时，目标态可细分） | **本系统新增（S5 拥有环境表达）** |
| `wind_visual_dir` | 视觉风向（旗帜/芦苇/浪/烟的渲染朝向） | 枚举 | {`se`, `none`, `nw`} | **本系统新增（S5 拥有，由 `v_wind` 映射）** |
| `spawn_state` | 遭遇刷新状态 | 枚举 | {`dormant`, `active`, `cleared`, `cooldown`} | **本系统新增（S5 拥有遭遇布置生命周期）** |
| `encounter_trigger` | 遭遇触发条件类型 | 枚举 | {`on_player_enter`, `on_node_active`, `on_scene_enter`, `manual`} | **本系统新增（S5 拥有）** |
| `cooldown_enc` | 遭遇刷新冷却时长 | 秒 | 数据字段，默认 0（MVP 多数不刷新） | **本系统新增（S5 拥有）** |
| `intel_cooldown` | 情报采集点刷新冷却时长 | 秒 | 数据字段，默认 0（一次性）/ 目标态可循环 | **本系统新增（S5 拥有）** |
| `stance` | 玩家移动姿态（探索层） | 枚举 | {`sprint`, `walk`, `crouch`} | **本系统新增（S5 玩家控制器持有）**；S4 只读消费作感知参数（`combat §6.4`） |
| `alert_level` | 战斗警戒档位 | 枚举 {0,1,2,3} | — | **S4 拥有**（`combat §0`），**S5 不持有**（仅经 S4 信号被动获知，不改写） |
| `Δ_node` / `I` | 历史偏差 / 反馈档位 | 分 / 枚举 | [0,100] / {`minor`,`notable`,`critical`} | **S1 拥有**（`rewrite-causality §0/§4.4`），**S5 只读做世界高 Δ 视觉三档**（`art-bible §2.5`） |

**命名 / 数据约定**：所有落到 `game/data/world/*.tres|*.json`、`game/data/intel/*.tres`、`game/data/encounters/*.tres`、`game/data/npcs/*.tres` 的字段、ID 一律 `snake_case`；朝代命名空间固定 `dyn_threekingdoms_chibi`（与 `art-bible §9.1` 一致），多朝代扩展换命名空间即可（见 §3.7 热切换口）。**存疑的引擎精确实现一律标 `[待程基岩确认]`，本文不臆造 Godot API**（如 `TileMapLayer` 多层组织、`Camera2D` 跟随、`NavigationRegion2D` 寻路、`Area2D` 触发区、`YSort`/CanvasLayer 的精确节点名均待 P3 架构核对）。

> ⚠️ **本系统绝不写 `v_i`/绝不产 `Δ`/绝不持 CP**（守 `systems-index §3.1` DAG 无环 + `game-concept §5.3` + `rewrite-causality §5.3/§7.4`）。S5 对 v_i 只做**只读视觉映射**（读 `variable_changed` → 切换 `world_visual` 资产，`rewrite-causality §3.1/§7.4`）；对情报只**生产并发出** `intel_cov`/`intel_entry`，由 S1/S2 **只读消费**（`systems-index §6` 情报行）。**S5 是「探索环的内容生产者 + v_i 的视觉映射者」，不是心脏数值的写者。**

---

## 1. 概述

### 1.1 系统定位

开放世界/朝代地图系统是核心循环 Loop A 的**「探索」环主责**（`systems-index §4` 探索行；`charter` 核心循环第 2 环：「玩家在赤壁开放世界探索 / 战斗 / 结盟 / 收集」）。它用 Godot 4.7 `TileMapLayer` 拼出一盘**可读、可丈量、可因果联动的赤壁沙盘**（`game-concept §2` 支柱③），让玩家的「移动 / 对话 / 潜行 / 采集 / 战斗」变成对历史棋局的**策略投资**——探索产出的**情报**经 S1 降改写难度、经 S2 解锁节点条件；探索看见的**关键变量视觉化**（风向、连舟铁索、七星坛状态）让玩家「读懂这盘棋」（`game-concept §3.2` 情报→改写收益回路、`art-bible §5.5` v_wind 视觉化）。

- **它管什么**（边界以 `systems-index §2` S5 行为准）：`TileMapLayer` 赤壁地图拼贴与**据点**（夏口 / 乌林 / 赤壁 / 华容道）；**可交互对象与情报采集点**；**NPC 布置与基础对话**；**天气 / 时辰 / 风向（`v_wind`）的环境表达**；**关键变量 `v_i` 的世界视觉化**（连舟铁索、芦苇风向等，呼应 `art-bible §5.5`）；**遭遇触发与刷新**。
- **它不管什么**（关键契约，**别越界**）：
  - **`v_i` 改变后 Δ 怎么算**（→ S1，`rewrite-causality §4`）——S5 只**读** v_i 做视觉映射，**绝不反向写 v_i/Δ**（`systems-index §3.1` DAG 硬契约）。
  - **据点是否成为当前任务目标**（→ S2 派发，`mainline-quest §2.4`）——S5 只**布置场所触发器**，不决定「现在该去哪」。
  - **NPC 关系深度逻辑**（→ X2，目标态预留，`systems-index §1.2` X2 行）——S5 只做**基础对话触发与布置**。
  - **地图美术资产制作**（→ 林绘澄，遵循 `art-bible`）——S5 只**消费资产引用**，不产美术。
  - **战斗执行**（敌人怎么动/怎么打）（→ S4，`combat §2.1`）——S5 只**布置遭遇**（敌人「在哪/有多少/巡逻路线」），敌人被放下后的行为归 S4。
- **它不是**：不是问号收集清单（守 `game-concept §2` 支柱③反例「据点之间无因果联动、退化为清单」）；不是独立的世界模拟器（世界状态由 S1 的 v_i 驱动，S5 是其视觉化身）。

### 1.2 玩家动词（本系统承接的探索动词）

本系统承接 `game-concept §3.1`「探索动词」集合（Loop A · 探索环），**与 S1 改写动词、S3 系统动词、S4 战斗动词分层**：

| 动词 | 作用 | 触发 | 归属 | MVP？ |
|---|---|---|---|---|
| **移动**（行走/奔跑/蹲行潜行） | 在沙盘走位；`stance` 切换影响 S4 感知（`combat §2.7`） | 键鼠 WASD / 手柄左摇杆；蹲行键切换 | S5 玩家控制器（`stance` 归 S5，`combat §6.4`） | ✅ |
| **采集情报** | 在情报采集点收集 `intel_raw` + `intel_entry` | 互动键（E / 手柄△） | S5（产出 → S1/S2 只读消费） | ✅ |
| **交互对象** | 触发可交互物件（如连舟铁索查看、坛上法器） | 互动键 | S5（物理场所校验，改写动词执行转 S4/S1） | ✅ |
| **对话** | 与 NPC 触发基础对话（任务线索/世界背景） | 靠近 + 对话键 | S5（基础对话归 S5；深度关系归 X2 目标态） | ✅（MVP 仅基础对话） |
| **潜行** | 蹲行降低被感知（`combat §2.7` `alert` 档位） | 蹲行 stance | S5 玩家控制器（stance 归 S5，感知判定归 S4） | ✅ |
| **（嵌入）战斗** | 探索中遭遇敌人 → Loop B | 进入遭遇触发区 | **S5 布置 → S4 执行**（`combat §2.1`） | ✅（MVP 普攻+1 术法） |

> 📌 **设计意图**：S5 对玩家的"动词面"是**探索的四件套**（移动/采集/交互/对话），刻意把"战斗"作为探索的**嵌入式动作层**（经遭遇触发进入 Loop B，`game-concept §5.3`）。这把"探索"从"跑图"升级为"读懂棋盘 + 策略投资"——采集情报降改写难度（`intel_cov`→S1）、对话/潜行改变被发现风险（`stance`→S4→`alert`→S1）、看风向/连舟读因果（`v_i` 视觉化）——这正是支柱③「可丈量的沙盘」的动词落地。

### 1.3 与核心循环 Loop A / Loop B 的接口

本系统承担 Loop A 的**「探索」**环（`systems-index §4`），是循环的**信息与风险中转站**：上游接 S2 派发的节点目标场所（布置触发器），下游产出情报给 S1（降改写难度/解锁蓝图）与 S2（解锁节点条件），同时把 v_i 的世界状态**视觉化**让玩家"看得见天平"，并把 Loop B 战斗作为嵌入动作层：

```
①任务(S2): quest_target_scene_set(node_id, target_scene) ──▶ 【S5 开放世界】
                                                                        │
   ┌────────────────────────────────────────────────────────────────────┤
   │  ②探索产出：                                                        │
   │    a. 情报采集 → intel_updated(intel_cov, new_intels[]) [S5→S1]      │ 降 diff / 解锁蓝图
   │    b. v_i 世界视觉化（读 S1 variable_changed → 切 world_visual）      │ 玩家读棋盘
   │    c. 天气/时辰/风向环境表达（v_wind → 旗帜/芦苇/浪/烟）              │ art-bible §5.5
   │    d. 遭遇触发 → encounter_spawned(...) [S5→S4] → 进入 Loop B         │ S4 战斗执行
   │    e. 玩家 stance → S4 感知参数（潜行降被发现风险）                    │ combat §2.7
   │    f. 高 Δ 世界视觉三档（读 S1 deviation_recomputed → world_visual）   │ art-bible §2.5
   ▼                                                                     │
③改写(S1) ◀──────────────── 情报/世界状态供给 ──────────────────────────────┘
```

- **入（← 任务/成长）**：S2 `quest_target_scene_set`（布置目标场所冷光环/触发器，`mainline-quest §6.2`）、S2 `quest_node_vanished_voiced`（移除消失节点的场所，`mainline-quest §6.2`）；S3 `ability_changed(intel_gain_mult_delta)`（情报采集乘子只读契约，`panel-progression §6.3`）；S1 `variable_changed`（v_i 改变 → 切 world_visual，`rewrite-causality §6.1`）、S1 `deviation_recomputed`（高 Δ 视觉三档，`rewrite-causality §6.1`）；玩家移动/交互/采集输入。
- **出（→ 改写/战斗）**：S5→S1 `intel_updated(intel_cov, new_intels[])`（情报产出，`rewrite-causality §6.2`）；S5→S4 `encounter_spawned`（遭遇布置，`combat §6.4`）、环境遮挡只读、玩家 stance、`player_at_scene`（场所检测，供 `requires.scene` 校验，`rewrite-causality §3.5`）。
- **闭环关键**：S5 **不直接产 Δ**，但产出**情报**与**世界状态可见性**——情报经 S1 降 diff（`intel_cov`）/经 S2 解锁条件（`intel_entry`），把"探索"变成对"改写"的策略投资（`game-concept §3.2`）。Loop B 战斗嵌入探索（遭遇触发），其"被发现风险"（S4 alert）经 S1 反馈到改写难度（`combat §4.5`），形成「探索→战斗→改写」的风险收益链。

### 1.4 支柱对齐（逐字引用 `game-concept §2`，标 S5 主/次支柱 + 漂移红线）

> 支柱名**逐字取自 `game-concept.md §2`**，保证跨文档一致。漂移红线沿用 `systems-index §5` S5 行。

| 支柱（逐字） | S5 角色 | 本 GDD 落地 |
|---|---|---|
| **③ 赤壁是可丈量的沙盘——"开放世界即历史棋局"**（`game-concept §2`） | **主要支撑** | §2.3 v_i 世界视觉化（风向/连舟/坛状态一眼可读）、§2.4 环境变量表达（v_wind 驱动旗/芦苇/浪/烟）、§2.2 情报采集点（探索=读棋盘的投资）、§2.1 据点按历史场所布局（夏口/乌林/赤壁/华容道）；据点与场所间通过 S1 v_i 因果链联动（**不是孤立清单**，§1.5） |
| **① 改写即玩法——"历史是你的可玩材料"**（`game-concept §2`） | 次要支撑 | §2.2 情报→改写（`intel_cov` 降 diff、`intel_entry` 解锁蓝图/节点条件）、§2.7 玩家移动/潜行→被发现风险→改写难度（经 S4 alert） |
| ② 系统流的掌控感 × 正剧底色 | （不强支撑，但须守反例） | §2.5 NPC/对话守正剧底色（系统旁白归 X1，不渗入 NPC）；§5.4 v_i 视觉化保持世界暖色主导、冷光仅 L5（`art-bible §0/§3.2`），防"冷光污染世界"破坏沉浸 |

**漂移红线（沿用 `systems-index §5` S5 行）**：**据点间无因果联动、退化为清单 → 支柱③崩塌**。本 GDD 的对应防线：
- **红线 1（据点清单化）**：据点/场所**不是**独立问号收集点，而是**经 S1 v_i 因果链联动**的棋盘节点（如 N1 连舟→N2 火攻威力→N3 存在性，`rewrite-causality §3.4`）。S5 的场所布置**必须随 S1 `variable_changed` 联动改变世界状态**（连舟铁索视觉、火攻威力预兆等），让据点"互相咬合"（§2.3/§5.5）。**若据点彼此孤立、世界不随 v_i 变化，支柱③崩塌**。
- **红线 2（探索退化为跑图）**：探索**必须**产出对改写/战斗有意义的情报与世界可见性（`intel_cov`/`intel_entry`/`v_i` 视觉化），而非纯位移。**若情报无用、v_i 不可读，探索退化为跑图，支柱③崩塌**（§2.2/§2.3）。
- **红线 3（冷光污染世界）**：v_i 视觉化的冷光标记（冷光环/数据浮标/glitch）**只允许出现在 L5 系统叠层**（`art-bible §3.2/§0`），**绝不污染**地形/建筑/NPC 本色。**若冷光铺满世界（赛博三国），支柱②正剧底色 + 双轨反差崩塌**（§2.3/§5.4）。

> ✅ **支柱可追溯**：③ → Mechanics 探索动词 + v_i 视觉化（§2.3/§2.4）→ Aesthetics Discovery（`game-concept §3.3`）→ Loop 探索环（`game-concept §5`）。① → 情报→改写桥（§2.2）→ Loop 探索→改写（`game-concept §3.2`）。

### 1.5 「系统」人格触点（与 X1 叙事层分工 · 两段式）

「系统」（`game-concept §1`）在 S5 的角色是**环境旁白触发源**（如玩家首次进入关键场所、采集情报、看见 v_i 视觉变化时的冷光简报）。与横切叙事层 X1 分工，**严格守住「触发/数据归属」与「旁白表现归属」两段式**（与 `mainline-quest §1.2` / `panel-progression §1.4` 同口径）：

| 归属方 | 职责 | 落点 |
|---|---|---|
| **S5（触发/数据归属）** | 持有环境触发的**条件与时机**（如"玩家首次进入七星坛"、"采集到关键情报 `intel_entry`"），向 X1 发**触发信号 + 文案 id**；持有环境物件的冷光标记数据（`art-bible §3.3` 信息焦点）。**不产旁白语音/演出表现。** | `game/data/world/*.tres`（触发条件）+ 触发信号（§6） |
| **X1（表现归属）** | 把 S5 的触发**以「冷峻记录员」旁白演出**：配音/字幕样式/出场动效/节奏；承接 S1 Δ 反馈、S2 派单/完成/消失旁白（`mainline-quest §6.3`）。 | X1 运行时（`systems-index §6`「系统人格」行） |

> ⚠️ **边界红线**：S5 **只产触发条件与时机**，不做旁白**语音/字幕演出**（那是 X1）；X1 **不擅自改写 S5 的世界状态语义**。系统人格**基调本身待主创审批**（`game-concept §9①`），本系统按"冷峻第三方观测者/记录员"倾向撰写环境触发文案（如「记录：玩家已抵达关键场所」「情报已收录」），**留接口**待定稿——若主创改语气，只改文案数据（§3.5），不改 S5 逻辑（与 `mainline-quest §6.3` / `panel-progression §1.4` 同口径）。

---

## 2. 机制

### 2.1 世界构成：`TileMapLayer` 多层 + 据点 + 关键场所（朝代包）

> 落地 `AGENTS.md`「2D 俯视角开放世界 · Godot 4.7 `TileMapLayer`」+ `art-bible §3.2` 渲染叠层 + `art-bible §5.1` 朝代舞台视觉 token + `art-bible §5.4` 关键建筑。**Godot 精确节点组织（多层 TileMapLayer 的层名/碰撞层位）标 `[待程基岩确认]`**。

**世界叠层（沿用 `art-bible §3.2`，落地 S5 侧组织）**：

| Godot 层（建议） | `art-bible §3.2` 对应 | 内容（S5 负责） | 朝代热切换契约 |
|---|---|---|---|
| `TileMapLayer · ground` | L1 可玩层 | 地形、水面、路面（焦墨/宣纸/赭石/墨青基底） | 换朝代换 TileSet |
| `TileMapLayer · props` | L2 实体层 | 建筑、营寨、战船、植被、芦苇、连舟铁索（含 `world_visual` 变体，§2.3） | 换朝代换 props 集 |
| `TileMapLayer · collision` | （工程侧） | 寻路/碰撞体（ `[待程基岩确认]` 用 Godot 碰撞层/`NavigationRegion2D`） | 换朝代换碰撞图 |
| `YSort · characters` | L3 角色层 | 玩家、NPC、士卒（Y 轴排序，`[待程基岩确认]`） | — |
| `Sprite · foreground` | L4 前景遮挡 | 树冠、屋檐、烟雾（玩家经过半透，`art-bible §3.2`） | — |
| `CanvasLayer · L5_system` | L5 系统叠层 | 冷光环（活跃节点场所）、v_i 数据浮标、Δ 视觉三档、术法叠层（**轨道 B 冷光唯一入口**，`art-bible §3.2/§0`） | — |

**据点（Stronghold）= 区域级 POI**，赤壁垂直切片含 4 个（`game-concept §7.2` / `art-bible §5.4`）：

| `stronghold_id` | 名称 | 定位（历史 + 游戏性） | 关联场所/节点 |
|---|---|---|---|
| `sh_xiakou` | 夏口 | 联军（孙刘）后方营寨；玩家初始/休整据点 | 营寨休整 checkpoint（§2.8） |
| `sh_wulin` | 乌林 | 曹军北岸大营；N1 连环计舞台；火攻对象 | 连舟战船（N1 改写场所） |
| `sh_chibi` | 赤壁（主战场/江面） | 江面决战区；N2 借东风核心 | 七星坛 `scene_altar`（N2 改写场所） |
| `sh_huarong` | 华容道 | 曹操败走险道；N3 华容道舞台 | 华容道险路（N3 改写场所，**存在性依赖 N2**，`rewrite-causality §3.4`） |

**场所（Scene）= 改写节点的目标地点**（`mainline-quest §3.2` `target_scene` 字段），由 S2 声明、S5 布置触发器：
- 场所是**比据点更细的粒度**：一个据点内可有多个场所（如 `sh_chibi` 内有 `scene_altar` 七星坛）。
- S5 据 S2 `quest_target_scene_set(node_id, target_scene)` 在场所生成**冷光环提示**（`art-bible §3.3`），玩家靠近触发改写面板入口（经 S3）。
- **场所与据点不是"任务清单"**：它们经 S1 v_i 因果链联动（如 `sh_wulin` 的连舟铁索视觉随 `v_boat` 变化、`sh_huarong` 的存在性随 N2 火攻结果变化），是"棋盘节点"而非"问号收集"（守支柱③，§1.4 红线 1）。

> 📌 **朝代 = TileSet + 遭遇表 + BGM 组合**（`AGENTS.md` / `art-bible §5.1`）：上述 `ground`/`props`/`collision` + 遭遇表（§2.6）+ BGM（音频归阮和鸣）打包为一个**朝代包**，命名空间 `dyn_threekingdoms_chibi`。**MVP 只此一朝代**；多朝代扩展换包即可（§3.7 热切换口，X6 跨朝代热切换明确愿景外，`systems-index §1.2` X6 行）。

### 2.2 情报采集点（探索=读棋盘的投资 · 核心跨系统机制）

> 这是 `systems-index §6` 情报行「**采集归 S5 / 消费归 S1（降改写难度）/ S2（解锁条件）**」的落地，也是 `game-concept §3.2`「情报→改写收益回路」的世界侧源头。**严格守两段式**：S5 生产情报（采集点 + `intel_cov` 聚合），S1/S2 只读消费。

**情报采集点的组成（数据形态，细节见 §3.2）**：
- `poi_id`、`dynasty`、`position`（世界坐标）、`intel_kind`（情报类型）。
- `intel_raw`：该点的基础产出量（[0,1]，数据字段）。
- `relates_to_node`：关联的改写节点（情报服务于哪个节点的 `intel_cov`/蓝图解锁）。
- `intel_entries[]`：采集时产出的**离散情报条目**（`intel_entry`，可解锁 S1 蓝图 `unlock_intel_cov` / S2 节点解锁条件）。
- `intel_cooldown`：刷新冷却（MVP 多为一次性 `0`/`∞`；目标态可循环）。
- `requires`：采集前置（如"需在场所内"/"需特定 `v_i` 状态"，呼应 `art-bible §5.5` 风向情报需 v_wind 可见）。

**采集流程（一次采集的生命周期）**：

```
① 玩家进入情报采集点交互范围（S5 检测）
  → ② 玩家按互动键（S5 触发）
  → ③ S5 校验 requires（场所/v_i 前置）
  → ④ S5 产出：intel_raw 累计入 intel_cov(node)（§4.1 聚合）；intel_entries[] 入玩家情报集
  → ⑤ S5 发 intel_updated(intel_cov, new_intels[]) [S5→S1]（rewrite-causality §6.2）
       └─ S1 据 intel_cov 降 diff（rewrite-causality §4.3）/ 据新 intel_entries 解锁蓝图可见性（unlock_intel_cov）
       └─ S2（按需）读 intel_entries 判定节点解锁条件（mainline-quest §3.2 prerequisites 可引用情报）
  → ⑥ S5 置采集点为已采集态（spawn_state→exhausted 或进 intel_cooldown）
  → ⑦ （可选）S5 发 intel_collected_voiced(intel_entry, lore_text) 给 X1（冷光简报旁白，§6.6）
```

**情报类型 `intel_kind`**（数据字段，决定情报的语义用途）：
| `intel_kind` | 语义 | 典型赤壁示例 | 消费方 |
|---|---|---|---|
| `wind_intel` | 风向情报（降 N2 改写难度 / 解锁借风蓝图） | 江岸渔夫谈近日风向、芦苇倾角观察点 | S1（intel_cov）/ S1（蓝图 unlock） |
| `chain_intel` | 连舟情报（降 N1 改写难度 / 解锁破连舟蓝图） | 曹营斥候绘的连舟图、铁索材质弱点 | S1 |
| `character_intel` | 人物情报（解锁 S2 节点条件 / 目标态 X2 关系前置） | 关羽重义传闻（解锁 N3 策反关羽条件）、曹操多疑性格 | **S2（解锁条件）** / X2 目标态 |
| `lore_intel` | 世界背景/志怪（纯叙事 Discovery，不直接影响数值） | 民间志怪奇遇、历史细节 | X1（旁白）/ 玩家（无系统消费） |

> 📌 **情报"从哪来 / 怎么用"的接口边界（issue 验收要点 4，`systems-index §6` 情报行）**：
> - **从哪来（S5 生产）**：情报采集点归 S5（位置/产出/刷新，§3.2）；S5 算 `intel_cov` 聚合值（§4.1）、产出 `intel_entry`。
> - **怎么用（S1/S2 只读消费）**：S1 读 `intel_cov` 降 `diff`（`rewrite-causality §4.3`）、读 `intel_entry` 解锁蓝图可见性（`rewrite-causality §3.3` `unlock_intel_cov`）；S2 读 `intel_entry` 判定节点解锁条件（`mainline-quest` prerequisites 可引用情报条目 id）。
> - **两段式红线**：**S5 绝不在产出侧"直接降 diff / 直接解锁蓝图"**（那是 S1 权责）；**S1/S2 绝不反向创建情报或改 `intel_cov` 公式**（那是 S5 权责）。S5 只发 `intel_updated`（事实），消费方自行决定如何应用。**守 `systems-index §3.1` DAG 无环。**

### 2.3 关键变量 `v_i` 的世界视觉化（**只读映射** S1 的 v_i · 核心跨系统契约）

> 落地 `systems-index §6` v_i 行「**S1 所有 / S5 视觉映射**」+ `rewrite-causality §3.1` `world_visual` 契约 + `art-bible §5.4/§5.5/§9.5`。**S5 只读 `variable_changed`（S1→S5，`rewrite-causality §6.1`）→ 切换 `world_visual` 资产，绝不反向写 v_i。** 这是支柱③「可丈量沙盘」的视觉化身。

**v_i → world_visual 映射表（沿用 `rewrite-causality §3.1` 数据契约，S5 侧落地为资产引用）**：

| v_i（S1 拥有） | 取值 → world_visual 资产（S5 映射，`art-bible §9.5`） | 视觉效果（`art-bible §5.4/§5.5`） | 切换时机 |
|---|---|---|---|
| `v_boat`（连舟程度） | `unchained`→`prop_..._ship_tower_chain_off` / `half_chain`→`..._chain_partial` / `full_chain`→`..._chain_on` | 冷灰铁索连线/断裂/无索；连舟 vs 单舟形制 | 玩家改写 N1（经 S4/S1）→ S1 发 `variable_changed` → S5 切资产 |
| `v_wind`（风向） | `southeast`→`wind_se` / `none`→`wind_none` / `northwest`→`wind_nw` | **旗帜飘向 + 芦苇倾角 + 江浪走向 + 烟雾飘散**统一切换（`art-bible §5.5`） | 玩家改写 N2 → S1 发 `variable_changed` → S5 切**全场景**风向渲染 |
| `v_altar`（坛状态） | `intact`→`prop_altar_intact` / `destroyed`→`prop_altar_destroyed` | 七星坛完好 vs 碎裂（朱黄墨晕消散，`art-bible §5.4`） | 玩家改写 N2 → S1 发 `variable_changed` → S5 切坛资产 |
| `v_cao`（曹操结局，N3） | `alive`→（无显式标记）/ `dead`→（叙事演出，归 S3+X1） | 曹操在场 vs 缺席（场景 NPC 存在性，§2.5） | 玩家改写 N3 → S1 发 `variable_changed` → S5 移除/保留曹操 NPC 实例 |
| `v_guan`（关羽埋伏，N3） | `arrived`/`not_arrived`/`turned`→关羽 NPC 布置变体 | 关羽伏兵在场/缺席/反水（阵营色 + 位置） | 同上 |

**`v_wind` 的特殊地位（环境核心变量）**：`v_wind` 不仅映射自身资产，还**驱动全场景环境渲染**（`art-bible §5.5`）——风向变东南时，全场景旗帜、芦苇、江浪、烟雾**统一切换朝向**。这是"可丈量沙盘"的环境信息源（`game-concept §2` 支柱③）。S5 把 `v_wind` 映射为 `wind_visual_dir`（§4.4），驱动环境渲染器（`[待程基岩确认]` 用 Godot 材质参数/AnimationPlayer/全局风场）。

> ⚠️ **只读映射红线（守 DAG）**：S5 **绝不**因玩家"看了芦苇方向"而改 `v_wind`（那是 S1 权责，经改写动词）；S5 **绝不**因世界渲染而回写 v_i。**信息流单向：S1 v_i（真值）→ S5 world_visual（视觉）**。若实现期 S5 被写成"直接改 v_wind"，违反 DAG 硬契约（`systems-index §3.1`），本设计拒绝承认（与 `rewrite-causality §5.3/§7.4` 同口径，§5.5 边缘情况）。

### 2.4 天气 / 时辰 / 风向的环境表达（环境层 · S5 拥有）

> 落地 `art-bible §5.5` 天气与时辰 + `systems-index §2` S5 行「天气/时辰/风向（`v_wind`）的环境表达」。S5 拥有**环境渲染参数**（`weather_state`/`time_of_day`），但 `v_wind`（风向真值）**归 S1**——S5 只把 S1 的 `v_wind` 映射为视觉风向 `wind_visual_dir`（§2.3/§4.4）。

**环境表达三要素**：

| 要素 | S5 拥有部分 | 真值归属 | 视觉效果（`art-bible`） |
|---|---|---|---|
| **风向** | `wind_visual_dir`（渲染朝向） + 全场景植被/旗/浪/烟统一切换 | **`v_wind` 归 S1**（`rewrite-causality §3.1`），S5 只读映射 | §5.5：旗帜飘向、芦苇倾角、江浪走向、烟雾飘散 |
| **时辰** `time_of_day` | `dawn/day/dusk/night`（S5 拥有，按章节脚本/现实时间推进） | S5（环境氛围，非因果变量） | §5.5：昼=宣纸黄+朱赤战火；夜=墨青+冷金营火；影响潜行可读性 |
| **天气** `weather_state` | `clear/overcast/rain/fog/storm`（S5 拥有，按节点脚本触发） | S5（环境氛围 + 战术影响） | §5.5：雾/雨影响视野（S4 感知遮挡只读契约，`combat §6.4`） |

**天气/时辰与战斗/潜行的耦合（S5→S4 只读契约，呼应 `combat §6.4`）**：
- **雾 `fog` / 雨 `rain` / 烟雾**：作为 S4 的**视野遮挡只读输入**（`combat §6.4` 环境遮挡只读）——S4 读 S5 的雾区/雨区/烟雾体修正敌人视野锥感知（`combat §3.4` `smoke_block_sight` 等）。**S5 拥有"雾在哪/多浓"，S4 拥有"感知怎么算"**（两段式，`combat §7.4`）。
- **烟雾受风向联动**（`art-bible §5.5`）：火攻烟雾的飘散方向 = `wind_visual_dir`（由 `v_wind` 驱动，§2.3）。这是 v_i 环境表达与天气的**交叉点**——风向改西北，烟雾反向飘，可能遮挡/暴露不同区域（战术深度，目标态）。
- **时辰影响潜行可读性**（`art-bible §5.5`）：夜间玩家更难被发现（S4 感知修正，`combat §6.4` 玩家 stance 之外的时段修正），是 S5→S4 只读契约。

> 📌 **环境与 v_i 的关系**：天气/时辰是 **S5 自有氛围变量**（非因果变量，不影响 Δ）；`v_wind` 是 **S1 因果变量**（影响 Δ，`rewrite-causality §3.1`），S5 把它**视觉化**。**不要混淆**："天气晴/阴"是 S5 氛围；"东南风/西北风"是 S1 v_wind 的视觉映射。MVP 天气/时辰可极简（固定 `day`/`clear`），目标态才做动态切换（§9 待审批）。

### 2.5 NPC 布置与基础对话（X2 关系=目标态预留 · X3 阵营=愿景外仅视觉）

> 落地 `systems-index §2` S5 行「NPC 布置与基础对话」+ `systems-index §1.2` X2/X3 范围。**S5 只做基础对话与布置；深度关系逻辑归 X2（目标态预留）；阵营关系逻辑归 X3（愿景外，仅视觉区分）。**

**NPC 布置（数据形态，§3.4）**：
- `npc_id`、`dynasty`、`faction`（`wei/shu/wu/player/folk`，仅视觉旗号/配色，`art-bible §2.3/§9.3`）、`position`、`sprite_ref`/`anim_ref`（资产引用，归林绘澄）。
- `dialogues[]`：基础对话集（触发条件 + 文本 id + 选项最小集）。
- `is_rewrite_target`：是否是改写动词的目标 NPC（如曹操/庞统，映射 `rewrite-causality` verbs 的 target，§2.6）。

**基础对话（S5 拥有，深度关系归 X2 目标态）**：
- **MVP 范围**：基础对话 = **触发 + 线性文本 + 任务线索/世界背景**，**不做**好感度/分支/关系深度（那是 X2，`game-concept §7.1` MVP 收窄）。
- **对话内容类型**：①任务线索（如"听说曹营连舟了"——提供 `intel_entry` 的线索来源）；②世界背景（Discovery，`game-concept §3.3`）；③志怪奇遇引子（民间志怪，基线）。
- **核心名角的冷光描边**（`art-bible §3.3`）：诸葛亮/曹操/周瑜/关羽等参与 v_i 的核心 NPC 在**节点激活时**获得冷光描边（普通 NPC 无）——这是"历史棋局可读"的视觉抓手（§6 经 S2 `quest_target_scene_set` 联动）。

**X2 NPC 关系（目标态预留）**：
- MVP **不做**师徒/敌友/策反关系深度（`game-concept §7.1/§9`、`systems-index §1.2` X2 行）。
- **架构预留**：NPC 数据带 `relation_seed`/`faction_relation_ref` 字段（目标态 X2 消费，本切片不实现，§3.4）。
- **与 S1/S2 的预留接口**：改写动词中"策反/说服"类（`rewrite-causality §1.2`）在 MVP 经"基础对话 + 改写面板"简化执行；目标态引入 X2 后，对话选项/关系值才真正影响改写条件。**本 GDD 不实现 X2 逻辑，只预留字段**（守范围，`systems-index §8`）。

**X3 阵营（愿景外，仅视觉区分）**：
- MVP/目标态**不做**阵营关系逻辑（`systems-index §1.2` X3 行「愿景外」）。
- **仅视觉区分**：阵营色（魏黑/蜀红/吴青，`art-bible §2.3`）+ 旗号 + 盔甲形制（`art-bible §4.3`）用于辨识，**不影响**遭遇/改写政治后果（那是 X3/X2 愿景）。
- ⚠️ **可访问性红线**（`art-bible §2.3`）：阵营辨识**多通道**（色相 + 旗号 + 形制），禁仅色相区分（红绿色盲不友好）。

### 2.6 遭遇触发与刷新（遭遇布置归 S5 / 战斗执行归 S4 · 两段式）

> 落地 `combat §2.1` 遭遇触发流程 + `combat §6.4` S5↔S4 信号契约（本 GDD 正式确认）+ `systems-index §2` S4/S5 行。**严格两段式**：**遭遇布置归 S5**（敌人 `enemy_id`/数量/巡逻路线/触发条件/刷新规则），**战斗执行归 S4**（敌人被放下后怎么动/怎么打，`combat §2.8`）。

**遭遇表（Encounter Table，数据形态，§3.3）**：
- `encounter_id`、`dynasty`、`stronghold_id`/`scene_id`（遭遇所属场所）。
- `enemies[]`：敌人集合（`enemy_id` 引用 `combat §3.3` 敌人定义 + 初始位置 + 巡逻路线）。
- `encounter_trigger`：触发条件（`on_player_enter` 区域触发 / `on_node_active` 节点激活 / `on_scene_enter` 进场所 / `manual` 任务派发）。
- `spawn_state`：刷新状态机（`dormant`/`active`/`cleared`/`cooldown`）。
- `cooldown_enc`：刷新冷却（MVP 多数 `0`=不刷新；目标态可循环刷新）。

**遭遇生命周期（一次 Loop B 遭遇的世界侧流程，与 `combat §2.1` 对齐）**：

```
① S5 遭遇表在 encounter_trigger 满足时（玩家进触发区 / 节点激活 / 任务派发）布置敌人
     → ② S5 发 encounter_spawned(encounter_id, enemies[]) [S5→S4]（combat §6.4，本 GDD 确认）
          └─ S4 为每个敌人实例化战斗状态机（combat §2.1②），初始态=巡逻
     → ③ S5 置 spawn_state = active
     → ④ Loop B 战斗（S4 执行，combat §2.1③④）
     → ⑤ 终结（combat §2.1⑤）：
          (a) S4 判定敌人全灭 → 发 encounter_cleared(encounter_id) [S4→S5]（本 GDD 确认由 S4 判定，combat §6.4 待确认项）
          (b) 玩家脱战成功（combat §2.7）→ S4 发 encounter_cleared [S4→S5]
          (c) 玩家 HP=0 倒地（combat §5.2）→ S4 失败态 → S5 回 checkpoint（§2.8），遭遇态保持 active（下次重开）
     → ⑥ S5 收 encounter_cleared → 置 spawn_state = cleared 或 cooldown（按 cooldown_enc 决定是否可再触发）
```

**关键约束（两段式 + 性能）**：
- **S5 不生成敌人行为**：S5 只布置敌人**实例**（`enemy_id`/位置/巡逻路线），敌人 FSM/伤害/AI 归 S4（`combat §2.8`）。S5 不持有敌人 HP/ATK（那是 `combat §3.3`）。
- **同屏预算**（`art-bible §8.4`）：S5 遭遇表**负责不超量布置**——同屏高精敌人精灵 ≤30–50（`art-bible §8.4`），士卒用「色块 + 少数精英」压缩（`art-bible §3.3`）。**精确同屏上限待程基岩 P3 核对**（`combat §5.5`）。
- **刷新规则（MVP 多不刷新）**：为防"刷怪刷分"（呼应 `rewrite-causality §5.1` 经济防线），MVP 多数遭遇 `cooldown_enc = 0`（一次性，清了就清了）；目标态个别巡逻遭遇可循环刷新（`cooldown_enc > 0`）。**关键改写目标遭遇永不刷新**（曹操/庞统等，避免重复击杀刷 Δ）。

> ⚠️ **`encounter_cleared` 判定方归属（确认 `combat §6.4` 待确认项）**：本 GDD **确认由 S4 判定**（S4 拥有战斗状态机与敌人 HP，`combat §3.5`），S4 在敌人全灭/玩家脱战时发 `encounter_cleared` 给 S5；S5 据此更新 `spawn_state`。**S5 不判定战斗胜负**（不持有敌人 HP）。✅ 与 `combat §6.4/§7.4` 两段式一致。

### 2.7 玩家移动 / 潜行 stance / 场所检测（玩家控制器归 S5）

> 落地 `combat §6.4` 玩家 stance / `player_at_scene` + `rewrite-causality §3.5` `requires.scene` 校验。**玩家探索层控制器归 S5**（移动/stance/场所检测），**战斗层感知判定归 S4**（`combat §2.7`）。

- **移动 stance**（S5 玩家控制器持有）：`sprint`（奔跑，噪声大）/ `walk`（行走）/ `crouch`（蹲行潜行，噪声≈0）。S5 把 `stance` 作为**只读契约**给 S4（`combat §6.4`），S4 据此算玩家噪声半径（`combat §3.4` `noise_radii_px`：sprint 160 / walk 64 / crouch 0）。**stance 切换是探索动词，归 S5；感知判定归 S4**（两段式，`combat §7.4`）。
- **场所检测 `player_at_scene(scene_id)`**（S5→S4/S1 只读）：S5 检测玩家当前所在场所（`scene_altar` 等），供改写动词 `requires.scene` 校验（`rewrite-causality §3.5`）与 rewrite_proxy 术法 `requires_scene` 校验（`combat §3.2/§5.4`）。**S5 是场所检测的唯一来源**（它拥有世界几何）；S4/S1 只读消费。
- **营寨休整触发**（S5→S4/S1，§2.8）：玩家进入营寨场所触发休整事件。

### 2.8 营寨休整 / checkpoint（S4 失败态回归点 · 探索环的补给节点）

> 落地 `game-concept §7.2` 据点营寨 + `combat §5.2` 失败态 `nearest_camp` respawn + `panel-progression §2.3` RE 再生方案。

- **营寨休整事件**（S5 触发）：玩家进入营寨（如 `sh_xiakou`）触发休整 → 部分回复 HP/BF（经 S4，`combat §3.1` `hp_regen_ooc`）/ RE（经 S1，`panel-progression §2.3` 营寨休整补充【待审批】）。**回复数值的执行归 S4/S1，S5 只产触发时机**（两段式）。
- **checkpoint**（S5 持有）：S5 记录玩家最近营寨场所作为复活点。S4 失败态 `respawn_rule: nearest_camp`（`combat §3.1`）时，S4 读 S5 checkpoint 回归（`combat §5.2`）。**checkpoint 归 S5**（世界几何所有权），**失败判定归 S4**（战斗状态所有权）。

---

## 3. 数据（为落 `game/data/world/*.tres`、`game/data/intel/*.tres`、`game/data/encounters/*.tres`、`game/data/npcs/*.tres` 铺路）

> 遵循 `AGENTS.md` 数据驱动约定 + `art-bible §9` 命名规范（`snake_case` + 朝代命名空间）。下列为**设计侧字段契约**，是给程基岩 P3 架构的输入；**`.tres` 资源类名、Godot 类型映射标 `[待程基岩确认]`，本文只定"要存什么、叫什么"**。**下列路径为建议命名，最终以 P3-1 架构 ADR 为准，本文不臆造引擎 API**（issue 验收要点 5）。

### 3.1 朝代包 —— `game/data/world/dynasties/<dynasty_id>.tres`（S5 拥有顶层组织）

```yaml
dynasty_id: dyn_threekingdoms_chibi          # 朝代命名空间（art-bible §9.1）
display_title: "三国·赤壁之战"
# —— 朝代 = TileSet + 遭遇表 + BGM 组合（AGENTS.md Godot 约定）——
tileset_refs:                                 # 视觉 token（art-bible §5.1）
  ground: tile_dyn_threekingdoms_chibi_ground   # [待程基岩确认] TileSet 资源引用
  props:  tile_dyn_threekingdoms_chibi_props
  collision: tile_dyn_threekingdoms_chibi_collision
encounter_table_pack: enc_dyn_threekingdoms_chibi   # 遭遇表包引用（§3.3）
bgm_pack: bgm_dyn_threekingdoms_chibi           # BGM 包引用（音频归阮和鸣，本字段仅占位）
strongholds: [sh_xiakou, sh_wulin, sh_chibi, sh_huarong]
scenes: [scene_altar, scene_chain_fleet, scene_huarong_pass, ...]   # 关键场所
# —— MVP 范围开关（呼应 mainline-quest §3.1 mvp_subset）——
mvp_stronghold_subset: [sh_chibi]              # MVP 仅赤壁小区域（game-concept §7.1）
mvp_scene_subset: [scene_altar]                # MVP 仅七星坛 1 处改写场所
```

> **设计意图**：朝代包是**多朝代热切换的最小单位**（`AGENTS.md` / `art-bible §5.1`）——换朝代 = 换一个 `dynasty_id` 包（TileSet + 遭遇表 + BGM + 据点/场所集）。**MVP 只此一朝代，X6 跨朝代热切换明确愿景外**（`systems-index §1.2` X6 行；§3.7 热切换口）。

### 3.2 情报采集点 —— `game/data/intel/<poi_id>.tres`（S5 拥有采集）

```yaml
# 示例：N2 借东风的风向情报采集点
poi_id: poi_wind_reed_observatory_01          # 芦苇观察点（看风向）
dynasty: dyn_threekingdoms_chibi
position: { x: 1408, y: 1024 }                # 世界坐标（占位，待 P3 定坐标系）
stronghold_id: sh_chibi
relates_to_node: n2_east_wind                 # 服务于 N2 的 intel_cov（§4.1）
intel_kind: wind_intel                        # wind_intel | chain_intel | character_intel | lore_intel（§2.2）
intel_raw: 0.25                               # 基础产出量 [0,1]（占该节点 intel_cov 的份额）
intel_entries:                                # 采集时产出的离散情报条目（消费方只读）
  - { entry_id: intel_wind_southeast_sign, unlocks_blueprint: bp_player_self_wind, lore_text: "芦苇皆向西北倾——东风未起。", unlock_intel_cov_contribution: 0.0 }
intel_cooldown: 0                             # 刷新冷却（秒；0/∞ = 一次性，MVP 多用）
requires:                                     # 采集前置（S5 校验）
  scene: null                                 # 不限场所（江岸即可）
  v_i_visible: [v_wind]                       # 需该 v_i 已在世界视觉化（呼应 art-bible §5.5）
spawn_state: dormant                          # 运行时态（dormant/exhausted/cooldown）
system_voice_on_collect: "情报已收录·风向数据。"   # 系统简报文案（X1 表现，§1.5）
```

> ⚠️ **`intel_entry.unlocks_blueprint` 是引用 S1 蓝图 id（`rewrite-causality §3.3`），不重定义蓝图**（只读引用）。S5 产出"这条情报能解锁哪个蓝图可见性"的**事实**，S1 据此调蓝图门槛。两段式（`systems-index §6` 情报行）。

### 3.3 遭遇表 —— `game/data/encounters/<encounter_id>.tres`（S5 拥有布置；敌人行为归 S4）

```yaml
# 示例：乌林曹营巡逻遭遇
encounter_id: enc_wulin_patrol_01
dynasty: dyn_threekingdoms_chibi
stronghold_id: sh_wulin
scene_id: null                                # 区域触发，非场所内
encounter_trigger: on_player_enter            # on_player_enter | on_node_active | on_scene_enter | manual
trigger_area: { shape: rect, x: 960, y: 800, w: 320, h: 240 }   # [待程基岩确认] Area2D 触发区
enemies:                                      # 敌人布置（enemy_id 引用 combat §3.3，S5 只布置）
  - { enemy_id: npc_wei_soldier_elite, position: { x: 1000, y: 820 }, patrol_route: [ {x:1000,y:820}, {x:1100,y:900} ] }
  - { enemy_id: npc_wei_soldier_elite, position: { x: 1080, y: 860 }, patrol_route: [ {x:1080,y:860}, {x:1180,y:820} ] }
is_rewrite_target_encounter: false            # 关键改写目标遭遇永不刷新（曹操/庞统等设 true）
spawn_state: dormant                          # dormant | active | cleared | cooldown（§2.6）
cooldown_enc: 0                               # 刷新冷却（秒；0 = 一次性，MVP 默认）
node_lock: null                               # 关联节点（若 encounter_trigger=on_node_active，填 node_id）
```

> ⚠️ **`enemies[].enemy_id` 引用 `combat §3.3` 敌人定义**（HP/ATK/AI 归 S4），S5 不重定义敌人数值——**两段式**（遭遇布置归 S5 / 战斗执行归 S4，`combat §2.1/§7.4`）。`patrol_route` 归 S5（世界几何），敌人沿路线移动的行为归 S4。

### 3.4 NPC 布置 —— `game/data/npcs/<npc_id>.tres`（S5 拥有布置 + 基础对话）

```yaml
# 示例：诸葛亮（N2 改写目标 NPC，本土术士侧）
npc_id: char_zhuge_liang                      # 与 art-bible §9.2 角色命名一致
dynasty: dyn_threekingdoms_chibi
faction: shu                                  # 阵营（仅视觉，art-bible §2.3；X3 关系逻辑愿景外）
stronghold_id: sh_chibi
position: { x: 1280, y: 960 }                 # 世界坐标（与 n2_east_wind 节点 scene_altar 一致）
sprite_ref: char_zhuge_liang                  # 资产引用（归林绘澄）
anim_ref: anim_char_zhuge_liang
is_rewrite_target: true                       # 是改写动词目标（映射 rewrite-causality verbs target）
rewrite_target_verbs: [verb_block_kongming, verb_self_borrow_wind]   # 引用 S1 改写动词
core_character: true                          # 核心名角（节点激活时冷光描边，art-bible §3.3）
# —— 基础对话（S5 拥有，深度关系归 X2 目标态）——
dialogues:
  - { id: dlg_kongming_intro, trigger: on_first_talk, kind: quest_clue, text_id: txt_kongming_intro,
      gives_intel: intel_wind_southeast_sign }   # 对话可产出情报条目（S5 采集的另一种形式）
# —— X2 关系预留（目标态，MVP 不实现，架构预留）——
relation_seed: mentor_kongming                # 目标态 X2 消费（systems-index §1.2 X2 行）
faction_relation_ref: factions_shu            # 目标态 X3 视觉/关系（本切片仅视觉）
```

> 📌 **基础对话 vs X2 深度关系**：MVP 对话是线性文本 + 任务线索（可给情报）；X2 的好感度/分支/师徒线**目标态才做**，本切片**预留字段不实现**（守范围）。对话产出的情报（`gives_intel`）是 §2.2 采集机制的一种形式（NPC 即采集点）。

### 3.5 关键场所 / 环境 —— `game/data/world/scenes/<scene_id>.tres`、`game/data/world/environment/*.tres`

```yaml
# 场所定义
scene_id: scene_altar                         # 七星坛（N2 改写场所）
dynasty: dyn_threekingdoms_chibi
stronghold_id: sh_chibi
position: { x: 1280, y: 960 }
area: { shape: circle, radius_px: 192 }       # 场所范围（供 player_at_scene 检测，§2.7）
is_rewrite_scene: true                        # 是改写场所（激活时冷光环，art-bible §3.3）
linked_node: n2_east_wind                     # 关联改写节点（mainline-quest §3.2 target_scene）
v_i_visual_refs:                              # 场所内 v_i 视觉资产引用（§2.3）
  v_altar: { intact: prop_altar_intact, destroyed: prop_altar_destroyed }
```

```yaml
# 环境配置（S5 拥有氛围 + v_wind 视觉映射）
# game/data/world/environment/env_globals.tres
default_time_of_day: day                      # MVP 固定 day（game-concept §7.1 收窄）
default_weather_state: clear                  # MVP 固定 clear
wind_visual_map:                              # v_wind（S1 真值）→ wind_visual_dir（S5 渲染）映射（§4.4）
  southeast: se
  none: none
  northwest: nw
env_occlusion_for_combat:                     # S5→S4 只读契约（combat §6.4 环境遮挡）
  reed_conceal_sight_mult: 0.3                # 芦苇荡内玩家被看到概率 ×0.3（art-bible §5.3）
  smoke_block_sight: true                     # 烟雾完全遮挡（受 wind_visual_dir 影响）
  wetland_noise_mult: 1.5                     # 湿地噪声 ×1.5（art-bible §5.2，combat §3.4 on_wetland_mult）
```

> ⚠️ **`env_occlusion_for_combat` 是 S5→S4 的只读契约**（`combat §6.4`）：S5 拥有"芦苇/烟雾/湿地在哪"，S4 读修正感知。**S5 不算感知，S4 不创造遮挡体**（两段式，`combat §7.4`）。`reed_conceal_sight_mult`/`wetland_noise_mult` 数值与 `combat §3.4` 一致（本 GDD 引用不重定义）。

### 3.6 运行时状态（**非持久数据**，给 X4 存档的「需存什么」清单）

> 存档所有权在工程（X4，`systems-index §1.2`）。本系统声明**需被持久化的世界探索态**（设计侧契约，给程基岩）。

```yaml
save_state_open_world:
  active_dynasty: dyn_threekingdoms_chibi
  visited_strongholds: [sh_xiakou, sh_chibi]  # 已访问据点（地图揭示）
  collected_intel_pois: [poi_wind_reed_observatory_01]   # 已采集情报点（防重复采集）
  player_intel_entries: [intel_wind_southeast_sign]       # 玩家持有的情报条目（供 S1/S2 查询）
  active_dynasty_intel_cov:                    # 各节点当前 intel_cov（S5 生产，S1 读用）
    n2_east_wind: 0.25
  cleared_encounters: [enc_wulin_patrol_01]    # 已清遭遇（防刷新，cooldown_enc=0 的）
  last_checkpoint: sh_xiakou                   # 最近营寨 checkpoint（§2.8）
```

> ⚠️ **跨系统存档一致性**：S5 的 `player_intel_entries` 必须与 S1 `unresolved_node_snapshot` 中的 `intel_cov` 来源**对应**（情报条目 → intel_cov 聚合，§4.1）——否则出现"采集了情报但 diff 没降"。X4 存档须把 S5 采集账本与 S1/S3 状态**原子写入**。**敌人实例/遭遇 active 态不持久化**（战斗瞬态归 S4，`combat §3.5`；读档由 S5 遭遇表 + spawn_state 重建）。

### 3.7 朝代热切换口（多朝代扩展铺路，**本切片不实现**）

> 落地 `AGENTS.md` Godot 约定「朝代 = TileSet + 遭遇表 + BGM 组合热切换」+ `art-bible §5.1` 视觉 token + `game-concept §7.3` 愿景。

**本系统的热切换契约**：
- 朝代包（§3.1）、情报采集点、遭遇表、NPC 布置、场所/环境配置均带 `dynasty` 命名空间字段；引擎按 `active_dynasty` 加载对应世界数据包。
- **世界逻辑（§2 探索/采集/视觉映射/遭遇布置）朝代无关**（纯流程，不含朝代硬编码）——换朝代只换数据包，不换逻辑。
- **跨朝代世界累积**（如"上一朝代改写的后果带入下一朝代"）列为愿景（`game-concept §7.3`），本切片**不做**；`save_state_open_world` 的 `active_dynasty` 字段已为"多朝代存档分组"留口（未来加 `dynasty_progress` 维度即可）。

> ✅ **预留验收**：本切片结构满足"换世界数据包即可换朝代"，不挡多朝代扩展（与 `rewrite-causality §3.7` / `mainline-quest §3.5` / `panel-progression §3.6` / `combat §3.6` 一致）。**X6 跨朝代热切换明确愿景外**（`systems-index §1.2` X6 行）。

---

## 4. 公式（统一格式 · 标变量与单位）

> 本节是本系统的数值定稿。所有符号见 §0。每条公式给出：**公式式 → 变量说明 → 设计意图/防红线注释**。**本系统的公式刻意"轻"**——S5 是内容生产 + 视觉映射系统，不做重数值计算（心脏在 S1，`rewrite-causality §4`）；本节主要定义**情报聚合**与**视觉映射**两类。

### 4.1 节点情报覆盖率 `intel_cov`（S5 生产 · S1 只读消费）

```
intel_cov(node) = clamp( Σ_{p ∈ collected_pois(node)} ( intel_raw(p) · intel_gain_mult ) / intel_cap(node) , 0, 1 )    [无量纲]
```

| 变量 | 含义 | 单位 | 来源 / 归属 |
|---|---|---|---|
| `collected_pois(node)` | 玩家已采集的、关联本节点的情报采集点集合 | POI 集合 | **S5 持有**（§3.6） |
| `intel_raw(p)` | 采集点 p 的基础产出量 | 无量纲 [0,1] | **S5 数据**（§3.2，S5 拥有） |
| `intel_gain_mult` | 情报采集乘子（S3 成长） | 无量纲 [1.0, 2.0] | **S3 只读契约**（`panel-progression §4.5`，S5 应用） |
| `intel_cap(node)` | 节点情报覆盖率饱和上限（分母） | 无量纲 | **S5 数据**（默认 1.0，可手调使 intel_cov 满覆盖所需采集量可控） |
| `intel_cov(node)` | 节点情报覆盖率 | 无量纲 [0,1] | **S5 生产**（本公式）、**S1 只读消费**（`rewrite-causality §4.3` diff 公式） |

**设计意图**：
- **`intel_gain_mult` 是 S3 成长的放大器**（`panel-progression §4.5`「S5 把采集到的原始情报量 ×此乘子得 intel_cov"）——探索产出随成长递增（成长反哺探索，呼应 `game-concept §5.2`）。**S5 只应用乘子，乘子的所有权/封顶在 S3**（两段式）。
- **归一化到 [0,1]**：`intel_cov` 直接进 S1 的 `diff(node) = diff_base · (1 − intel_cov)`（`rewrite-causality §4.3`），故须是无量纲覆盖率。`intel_cap` 让"满覆盖所需采集量"可手调（如某节点需采集 4 个情报点才满，则各点 `intel_raw` 设 0.25、`intel_cap=1.0`）。
- **离散情报条目 `intel_entry` 不进此公式**：它们是解锁 S1 蓝图/S2 节点条件的离散钥匙（§2.2），与连续的 `intel_cov` 是**两类产出**（一个降 diff，一个解锁）。S5 都生产，但分别发（§6）。

**防红线（防刷情报）**：
- **采集点一次性为主**（`intel_cooldown=0`，MVP）：玩家不能反复采集同一情报点刷 `intel_cov` 满值（与 `rewrite-causality §5.1` 防刷分同源）。
- **`intel_cov` 封顶 1.0**：探索再多情报，`diff` 最多降到 `diff_base·(1−1)=0`？——**不**，S1 的 `diff` 公式有 `intel_cov` 但 `cost_RE` 仍有 `cost_base·diff·(1−disc)`，且 `disc` 封顶 0.5（`rewrite-causality §4.3`），故即便 `intel_cov=1`、`disc=0.5`，`cost_RE = cost_base·0·0.5 = 0`——**需与 S1 联合确认 intel_cov 是否应封顶 < 1**（如 0.8），避免"满情报=免费改写"的经济失衡。**[待与 S1 联合确认] intel_cov 上限**（§7.1 / §9）。

### 4.2 情报采集点刷新冷却

```
on_collect(poi):
    spawn_state(poi) := exhausted
    if intel_cooldown(poi) > 0:
        schedule respawn at t_now + intel_cooldown(poi)  → spawn_state := dormant
    else:
        spawn_state(poi) := exhausted (永久，MVP 默认)
```

**设计意图**：MVP 多数采集点一次性（`intel_cooldown=0`），防刷情报（§4.1 防红线）；目标态个别动态情报点（如"每日风向观察"）可循环（`intel_cooldown>0`）。**关键改写目标情报永不刷新**（避免重复解锁刷蓝图）。

### 4.3 遭遇刷新冷却

```
on_encounter_cleared(encounter_id):   # S4 发（§2.6⑤）
    if is_rewrite_target_encounter(encounter_id):
        spawn_state := cleared (永久，关键目标不刷新)
    elif cooldown_enc(encounter_id) > 0:
        schedule respawn at t_now + cooldown_enc → spawn_state := dormant
    else:
        spawn_state := cleared (一次性，MVP 默认)
```

**设计意图**：MVP 多数遭遇一次性（`cooldown_enc=0`），防"刷怪刷分"（呼应 `rewrite-causality §5.1`）；关键改写目标遭遇（曹操/庞统）**永不刷新**，避免重复击杀刷 Δ（DAG 一致性防线）。目标态巡逻遭遇可循环。

### 4.4 风向 → 视觉方向映射（v_wind → wind_visual_dir）

```
wind_visual_dir = wind_visual_map[ v_wind.current ]     # 查表，枚举映射
# 默认表（art-bible §5.5 / env_globals.tres）：
#   southeast → se   (旗帜/芦苇/浪/烟 朝 SE 飘)
#   none      → none (静止)
#   northwest → nw   (反向飘)
```

| 变量 | 含义 | 单位 | 来源 |
|---|---|---|---|
| `v_wind.current` | 风向关键变量当前值 | 枚举 | **S1 拥有**（`rewrite-causality §3.1`），S5 读 `variable_changed` |
| `wind_visual_map` | 风向→视觉方向映射表 | 字典 | **S5 数据**（§3.5 `env_globals.tres`） |
| `wind_visual_dir` | 视觉风向（驱动全场景渲染） | 枚举 {se, none, nw} | **S5 拥有**（环境渲染参数，§2.4） |

**设计意图**：把 S1 的因果变量 `v_wind` **视觉化**为全场景渲染参数（`art-bible §5.5`）——风向一变，旗帜/芦苇/江浪/烟雾统一切换。**单向**：S1 v_wind（真值）→ S5 wind_visual_dir（视觉），S5 绝不回写 v_wind（§2.3 红线）。

### 4.5 时辰 / 天气 → 环境渲染参数（氛围，S5 自有）

```
# 时辰→色温（art-bible §5.5）
time_tint[time_of_day] = { dawn: warm_pale, day: paper_yellow, dusk: amber, night: ink_cyan_gold_campfire }
# 天气→能见度（S5→S4 只读契约，combat §6.4）
weather_visibility[weather_state] = { clear: 1.0, overcast: 0.9, rain: 0.8, fog: 0.4, storm: 0.3 }
```

**设计意图**：时辰/天气是 **S5 自有氛围变量**（非因果变量，不影响 Δ），驱动色温渲染 + 作为 S4 视野遮挡只读输入（`fog`/`storm` 降低 S4 感知半径，`combat §6.4`）。**MVP 固定 `day`/`clear`**（`game-concept §7.1` 收窄），目标态才动态切换（§9 待审批）。

### 4.6 公式总览（一眼速查）

| 量 | 公式 | 单位 | 归属 |
|---|---|---|---|
| 节点情报覆盖率 | `intel_cov = clamp(Σ(intel_raw·intel_gain_mult)/intel_cap, 0, 1)` | 无量纲 | **S5 生产**（S1 只读消费） |
| 情报点冷却 | `intel_cooldown>0 → respawn; else 永久 exhausted` | 秒 | S5 |
| 遭遇冷却 | `关键目标→永久 cleared; cooldown_enc>0→respawn; else 一次性` | 秒 | S5（清场判定归 S4） |
| 风向视觉映射 | `wind_visual_dir = map[v_wind]` | 枚举 | S5（v_wind 归 S1） |
| 时辰/天气渲染 | `time_tint[time_of_day]`、`weather_visibility[weather_state]` | — | S5（氛围，S4 只读 visibility） |

---

## 5. 边缘情况（≥3 类，逐类给判定与处理 · 含 issue 明列 4 类）

### 5.1 玩家进入未激活据点 / 未激活节点场所（开放世界自由 vs 顺序派发）—— 认知过载 + 支柱③红线

> 对齐 `mainline-quest §5.1`（玩家绕序/跳过节点）。
- **现象**：玩家在 N1/N2 未确认时，凭探索自由走到 N3 华容道区域（`sh_huarong`）；开放世界无空气墙（`game-concept §2` 支柱③）。
- **判定/处理**：
  1. **场所冷光环不亮**：N3 节点未激活（`mainline-quest §2.1` `can_dispatch=false`，S2 未发 `quest_target_scene_set`）→ S5 **不显示**华容道场所的冷光环改写提示（`art-bible §3.3`）。玩家能逛，但找不到"可改写"介入点。
  2. **软引导而非硬阻挡**：S5/X1 发自然语言旁白"此地尚未成为历史的关键时刻"（`mainline-quest §5.1`），引导回主线。**绝不空气墙/强制传送**（守支柱③"开放世界即历史棋局"，不退化线性传送门）。
  3. **情报仍可采集（不影响）**：华容道区域的 `lore_intel` 采集点仍可互动（Discovery），但不影响 N3 存在性（存在性归 S1/S2，§5.2）。
- **红线标注**：若为"防绕序"加空气墙，支柱③崩塌。**用"节点未激活则场所无冷光环 + 软引导"，非硬阻挡**。

### 5.2 情报采集后节点被 S2 移除（`node_vanished`）—— 系统一致性 + 经济红线

> 对齐 `mainline-quest §5.2`（因果链使下游节点消失）+ `rewrite-causality §5.3`。
- **现象**：玩家采集了若干服务 N3 的情报（`intel_cov(n3)`>0、持有关联 `intel_entry`），随后改写 N2 使火攻失败 → S1 发 `node_vanished(n3)`（`rewrite-causality §6.1`）→ S2 置 N3 消失 → N3 不存在了，采集的情报还有用吗？
- **判定/处理**：
  1. **情报不退、不刷分**：已采集的 `intel_raw` 与 `intel_entry` **保留**（玩家探索劳动的记录），但因 N3 消失，其 `intel_cov(n3)` **不再被任何 diff 公式消费**（节点不存在=无 diff）——**不退 CP、不退情报**（与 `rewrite-causality §5.1/§5.4` 防刷分一致）。
  2. **替代节点可复用情报**：若 S2 派替代节点 N3'（目标态，`mainline-quest §2.3/§5.4`），N3' 的 `relates_to_node` 可**部分复用**原 N3 情报（数据字段 `intel_transferable: true` 时），避免玩家"白采"。**MVP 无替代节点**（`game-concept §7.1`），故 N3 消失则相关情报闲置（可作 `lore_intel` 纯叙事保留）。
  3. **UI 标记**：S3 经 `quest_node_vanished_voiced`（`mainline-quest §6.2`）在任务面板标记 N3 消失；S5 移除 N3 场所冷光环（§6）。玩家清楚"这情报暂时用不上了"。
- **红线标注**：此条守**经济一致 + 叙事一致**；若情报随节点消失而退回/重采，会诱发"故意让节点消失刷情报"（与 `rewrite-causality §5.1` 冲突）。

### 5.3 同屏多遭遇刷新竞争（性能 + 难度红线 · 对齐 `art-bible §8.4` / `combat §5.5`）

- **现象**：玩家同时进入多个遭遇触发区（或巡逻遭遇联动），多个 `encounter_spawned` 同时触发，同屏敌人 + VFX 超预算（`art-bible §8.4`）。
- **判定/处理**：
  1. **遭遇互斥/排队**（S5 拥有布置）：S5 对**同一场所/相邻区域**的遭遇做互斥——同屏最多激活 `max_concurrent_encounters`（首版倾向 1~2，`[待审批]`）个遭遇；其余触发区进入"待激活队列"，当前遭遇 `cleared` 后才激活下一个。**这把同屏敌人控制在预算内**（守 `art-bible §8.4` 高精精灵 ≤30–50）。
  2. **遭遇表设计纪律**：相邻遭遇触发区**不重叠**（数据 QA，归严守真 P5/P6）；关键改写目标遭遇**独占场所**（避免普通巡逻混入 boss 战）。
  3. **联动警戒的性能策略**（与 `combat §5.5` 一致）：敌人"喊叫"联动升警戒的范围**由 S4 限制**（近距 2~3 个），S5 不布置会"全图联动"的遭遇组。
- **红线标注**：此条守**性能预算 + 难度曲线**；若 S5 超量布置，战斗时帧率崩 + 难度失控（`combat §5.5`）。**精确 `max_concurrent_encounters` 待程基岩 P3 + Playtest 核对**。

### 5.4 TileSet / 场所切换时机（朝代内场所传送 + X6 跨朝代愿景外）—— 范围红线

> 对齐 `game-concept §7.3` / `systems-index §1.2` X6 行。
- **现象**：玩家从 `sh_chibi`（赤壁）到 `sh_huarong`（华容道）跨越较远距离，是否"传送"？跨朝代（愿景）如何切？
- **判定/处理**：
  1. **朝代内据点间移动**（MVP/目标态）：赤壁垂直切片是**单张连续地图**（4 据点在同一 `TileMapLayer`），玩家**步行/乘船**在据点间移动，**不做加载传送**（守支柱③开放世界连续性）。若距离过远，可设"路径点快速旅行"（目标态，`[待审批]`），但**非跨地图加载**。
  2. **X6 跨朝代热切换明确愿景外**（`systems-index §1.2` X6 行）：本切片**只有 1 朝代**，不存在跨朝代 TileSet 切换。架构上朝代包（§3.1）已为"换包换朝代"铺路，但**切换机制本切片不实现**（`game-concept §7.3`）。
  3. **场所内无加载**：据点内多场所（如 `sh_chibi` 内 `scene_altar`）是**同一 TileMapLayer 的子区域**，无加载屏（冷光环提示场所，§2.1）。
- **红线标注**：此条守**范围 + 支柱③连续性**；若 MVP 做跨朝代/频繁加载传送，破坏开放世界沉浸且越范围。

### 5.5 v_i 视觉化与 S1 数值不同步（`variable_changed` 丢失/乱序）—— DAG + 认知过载红线

- **现象**：玩家改写使 `v_boat` 从 `full_chain` 变 `unchained`，S1 发了 `variable_changed` 但 S5 因事件丢失/乱序未切 `world_visual`（连舟铁索仍显示连线），玩家"看到的世界"与"实际 v_i"不符。
- **判定/处理**：
  1. **v_i 是 S1 单一真值**（`systems-index §6` v_i 行）：`variable_changed` 是 S1→S5 的**只读契约**，S5 必须接收并应用。若 S5 未应用，属 S5 bug——**S1 只保证真值正确发出**。
  2. **视觉化兜底校验 [待程基岩确认]**：建议 P3 在 `variable_changed` 处理链加断言——S5 收到后 `world_visual` 必须在 N 帧内切换；节点 `已确认` 时做一次"v_i 当前值 → world_visual"全量重同步（防累积漂移）。
  3. **读档重同步**：读档后 S5 据 S1 `resolved_nodes` 的 `final_vars`（`rewrite-causality §3.6`）+ 当前 `unresolved_node_snapshot.working_vars` **重建全部 world_visual**（防存档撕裂，§3.6）。
- **红线标注**：此条守**DAG 一致性 + 支柱③可读性**；若世界视觉与 v_i 撕裂，玩家"看不懂棋盘"，支柱③崩塌。

### 5.6 环境遮挡与 S4 感知冲突（芦苇/烟雾/湿地）—— 跨系统一致性

> 对齐 `combat §6.4/§7.4` 环境遮挡只读契约。
- **现象**：玩家蹲在芦苇荡里（`reed_conceal_sight_mult=0.3`），但 S4 仍按无遮挡算视野（"我在芦苇里还被看到了"）；或湿地噪声未 ×1.5（`art-bible §5.2`）。
- **判定/处理**：
  1. **遮挡体归 S5，感知公式归 S4**（两段式，`combat §7.4`）：S5 提供 `env_occlusion_for_combat`（§3.5：芦苇/烟雾/湿地修正），S4 读修正感知。若 S4 未读，属 S4 bug。
  2. **湿地噪声联动**（`art-bible §5.2`）：S5 标记湿地 Tile（地形数据），S4 读 `wetland_noise_mult=1.5` 应用到 `noise_radii_px`（`combat §3.4`）。**S5 不算噪声半径**（那是 S4 权责）。
  3. **烟雾受风向联动**（§2.4）：烟雾体由 S5 生成（火攻/术法），飘散方向 = `wind_visual_dir`（由 `v_wind` 驱动）；S4 读烟雾体作 `smoke_block_sight`（`combat §3.4`）。
- **红线标注**：此条守**跨系统一致性**；遮挡体/感知错位会让潜行"不可读"（认知过载，支柱②③）。

---

## 6. UI 接口（信号 / 事件契约，衔接 P4-1 UX 规格）

> 本系统**对内消费 S1/S2/S3 信号、向 S1/S4 下发情报/遭遇、向 S3/X1/P4-1 衔接**。下列是**设计侧的事件/信号契约**，落地用 Godot 信号（`AGENTS.md`「信号优先于全局单例滥用」）。**与 S1/S2/S3 的信号逐条回引前置 GDD，零新增冲突信号**；S5↔S4 通道信号（`combat §6.4` 提议）由本 GDD 正式确认；S5 自有信号（HUD/大地图/对话）单独列出，明确不与 S1↔S2/S3 契约冲突。**Godot 信号精确签名标 `[待程基岩确认]`**。

### 6.1 S5 → S1（情报产出 · 逐条回引 `rewrite-causality §6.2`，**零新增**）

| 信号（沿用 S1 命名） | 方向 | 载荷 | 触发时机 | S1 响应 | 回引 |
|---|---|---|---|---|---|
| `intel_updated(intel_cov, new_intels[])` | **S5 → S1** | 节点情报覆盖率、新情报条目集 | 玩家采集情报点（§2.2⑤） | 降 `diff`（`rewrite-causality §4.3`）/ 解锁蓝图可见性（`unlock_intel_cov`） | `rewrite-causality §6.2/§7.4` |

> ✅ **验收**：`intel_updated` 与 `rewrite-causality §6.2/§7.4` 完全一致，零改名。S5 不向 S1 发任何其他信号（v_i 视觉化是 S5 读 S1，非 S5 写 S1）。

### 6.2 S1 → S5（v_i 视觉化 · 逐条回引 `rewrite-causality §6.1`，**零新增**）

| 信号（沿用 S1 命名） | 方向 | 载荷 | S5 响应 | 回引 |
|---|---|---|---|---|
| `variable_changed(var_id, old_value, new_value, is_preview)` | **S1 → S5** | 变量、旧/新值、是否预览 | 切换 `world_visual` 资产（连舟铁索/坛/风向等，§2.3）；`v_wind`→`wind_visual_dir` 全场景切换（§2.4） | `rewrite-causality §6.1` |
| `deviation_recomputed(node_id, delta_node, is_preview)` | **S1 → S5** | 节点、Δ、是否预览 | 高 Δ 世界视觉三档（`art-bible §2.5`：minor 色温稳 / notable 冷光描边+浮标 / critical glitch 震荡），L5 系统叠层呈现 | `rewrite-causality §6.1` |

> ✅ **验收**：`variable_changed`/`deviation_recomputed` 与 `rewrite-causality §6.1` 完全一致。S5 只读消费，不改 v_i/Δ。

### 6.3 S2 → S5（目标场所布置/移除 · 逐条回引 `mainline-quest §6.2`，**零新增**）

| 信号（沿用 S2 命名） | 方向 | 载荷 | S5 响应 | 回引 |
|---|---|---|---|---|
| `quest_target_scene_set(node_id, target_scene)` | **S2 → S5** | 节点、目标场所 | 在场所生成冷光环提示（`art-bible §3.3`）；激活场所触发器 | `mainline-quest §6.2` |
| `quest_node_vanished_voiced(node_id, system_vanish_voice)` | **S2 → S5** | 节点、消失文案 | 移除消失节点的场所冷光环/触发器（如 N3 消失则 `sh_huarong` 改写场所撤下，§5.2） | `mainline-quest §6.2` |

> ✅ **验收**：2 条与 `mainline-quest §6.2` 完全一致，零新增。S2 派发/消失 → S5 布置/移除场所，节点语义归 S2，场所几何归 S5。

### 6.4 S3 → S5（情报采集乘子只读契约 · 逐条回引 `panel-progression §6.3`，**零新增**）

| 信号（沿用 S3 命名） | 方向 | 载荷 | S5 响应 | 回引 |
|---|---|---|---|---|
| `ability_changed(ability_id, contract_key, value_delta)` | **S3 → S5** | 能力、契约键（如 `intel_gain_mult_delta`）、增量 | 更新 `effective_intel_gain_mult`（§4.1 intel_cov 聚合用） | `panel-progression §6.3` |

> ✅ **验收**：`ability_changed` 与 `panel-progression §6.3` 完全一致。S5 应用 `intel_gain_mult` 到 intel_cov 聚合（`panel-progression §4.5`「S5 把采集到的原始情报量 ×此乘子得 intel_cov"）。**S5 不创造乘子，只应用**（两段式）。

### 6.5 S5 ↔ S4（遭遇布置 + 环境只读 · **正式确认 `combat §6.4` 提议信号**）

> `combat §6.4` 把 S5↔S4 信号标「待 S5 GDD 联合确认」。本 GDD **正式确认**下列信号清单（属 S5/S4 通道，不与 S1↔S2/S3 契约冲突）。

| 信号/契约（建议） | 方向 | 载荷 | 触发时机 | 回引/确认 |
|---|---|---|---|---|
| `encounter_spawned(encounter_id, enemies[])` | **S5 → S4** | 遭遇 id、敌人实例集（`enemy_id`/位置/巡逻路线） | 遭遇触发条件满足（§2.6①②） | `combat §6.4`（**确认**） |
| `encounter_cleared(encounter_id)` | **S4 → S5** | 遭遇 id | S4 判定敌人全灭/玩家脱战（§2.6⑤，**确认由 S4 判定**） | `combat §6.4`（**确认由 S4 判定**） |
| 环境遮挡只读 | **S5 → S4** | 视线遮挡体/噪声介质（芦苇/烟雾/湿地，§3.5 `env_occlusion_for_combat`） | 玩家移动时 S5 提供当前遮挡 | `combat §6.4/§3.4`（**确认**） |
| 玩家 stance | **S5 → S4** | 玩家移动模式（`sprint/walk/crouch`，§2.7） | 玩家切换 stance | `combat §6.4/§2.7`（**确认**，stance 归 S5） |
| `player_at_scene(scene_id)` | **S5 → S4/S1** | 场所 id（或 null） | 玩家进入/离开场所（§2.7） | `combat §6.4`（**确认**）；供 `requires.scene` 校验（`rewrite-causality §3.5`） |

> ✅ **验收**：上表 5 项正式确认 `combat §6.4` 的 S5↔S4 通道，与 S1↔S2/S3 契约**零冲突**（独立通道）。**两段式**：遭遇布置归 S5 / 战斗执行归 S4；环境遮挡归 S5 / 感知公式归 S4；stance 归 S5 / 感知判定归 S4；场所检测归 S5 / `requires.scene` 校验消费归 S4/S1。

### 6.6 S5 自有的 UI/环境信号（向 S3/X1/HUD，**不与 S1↔S2/S3 冲突**）

> 这些是 S5 在自己权责内（大地图/对话/环境旁白）发出的信号，**不在 S1↔S2/S3 清单内，也不冲突**。

| 信号（建议） | 载荷 | 触发时机 | 主消费方 |
|---|---|---|---|
| `intel_collected_voiced(intel_entry, lore_text)` | 情报条目、背景文本 | 玩家采集情报（§2.2⑦） | **X1**（冷光简报旁白）、S3（HUD 情报计数） |
| `poi_interact_prompt(poi_id, prompt_text)` | 采集点、提示文案 | 玩家进入交互范围 | S3（HUD 互动提示"按 E 采集"） |
| `dialogue_started(npc_id, dialogue_id)` | NPC、对话 id | 玩家触发对话（§2.5） | S3（对话 UI）、X1（旁白） |
| `stronghold_discovered(stronghold_id)` | 据点 id | 玩家首次进入据点 | S3（大地图揭示）、X1（发现旁白） |
| `minimap_updated(strongholds_visible, active_node_scene)` | 据点可见集、当前活跃节点场所 | 据点揭示/节点激活 | S3（大地图/迷你地图） |
| `env_voice_triggered(trigger_id, voice_text)` | 触发 id、文案 | 玩家首次进入关键场所/看见 v_i 视觉变化（§1.5） | **X1**（环境旁白） |

> 📌 **大地图/迷你地图 UI**（P4-1 衔接）：S5 提供据点揭示状态 + 当前活跃节点场所（`minimap_updated`），S3 渲染大地图（`art-bible §6.2`）。**大地图非"问号清单"**——它是 v_i 因果棋盘的可读视图（守支柱③，§1.4 红线 1）。

### 6.7 与 P4-1 UX 规格的衔接点（给文策渊 Phase 4 自己）

> 本节是给未来 P4-1（关键屏幕 UX 规格）的**输入清单**：

- **大地图**（`art-bible §6.2`）：据点（夏口/乌林/赤壁/华容道）+ 当前活跃节点场所冷光环 + v_i 视觉状态摘要（如"连舟：全连""风向：东南"）+ 已揭示/未揭示区域。**信息焦点**（`art-bible §3.3`）：活跃场所冷光高对比，非活跃据点低对比。
- **HUD 互动提示**（贴边，`art-bible §6.2`）：进入情报点/NPC/场所时的"按 E 采集/对话/介入"提示。
- **对话界面**（轨道 A 工笔重彩头像，`art-bible §4.5/§6.4`）：基础对话文本 + 选项最小集；系统旁白（X1）以冷光叠加（不改 NPC 台词语义）。
- **情报计数 HUD**：当前节点 `intel_cov` 进度条（冷光，与 Δ/CP 条并排，呼应 `panel-progression §6.5` 核心 HUD）。
- ⚠️ **信息密度分级**（守 `systems-index §8` 认知过载）：核心（活跃场所指引 + intel_cov 进度）常驻；进阶（大地图全据点 + v_i 摘要）按需；隐藏（完整场所/v_i 数据）折叠。
- ⚠️ **手柄适配**（基线 PC 键鼠+手柄）：移动/采集/对话/大地图 verb 双绑定（`combat §6.6` X5 可访问性）。

---

## 7. 依赖（与 S1/S2/S3/S4/X2/X3/X4/X5 的边界与数据流）

> 边界以 `systems-index §2` 为准；本节做**开放世界视角的交叉确认**。**显式引用**前置文档节号。

### 7.1 与 S1 改写/因果引擎（P2-2 · 已完成 · 核心跨系统契约）

- **S5 → S1**：`intel_updated(intel_cov, new_intels[])`（情报产出，§6.1）。
- **S1 → S5**：`variable_changed`（v_i 改变 → 切 world_visual，§6.2）、`deviation_recomputed`（高 Δ 视觉三档，§6.2）。
- **边界 1（v_i 只读视觉映射，`systems-index §6` v_i 行 + `rewrite-causality §3.1/§7.4`）**：**v_i 枚举/取值/基准只在 S1 定义**；S5 只做 `world_visual` 视觉映射（只读契约）。**S5 绝不反向写 v_i/Δ**（DAG 硬契约，`systems-index §3.1`）。✅ 已在 §2.3/§5.5 落实。
- **边界 2（情报两段式，`systems-index §6` 情报行 + `rewrite-causality §7.4`）**：**情报采集归 S5**（生产 intel_cov/intel_entry），**情报使用归 S1**（降 diff/解锁蓝图）/ S2（解锁条件，§7.2）只读消费。S5 绝不在产出侧直接降 diff（§2.2 接口边界）。✅
- **⚠️ `intel_cov` 上限待联合确认（§4.1 防红线）**：`intel_cov∈[0,1]`，若=1 则 `diff=0` 可能导致"满情报=免费改写"经济失衡。**[待与 S1 联合确认]** 是否封顶 <1（如 0.8）或由 S1 在 `cost_RE` 加保底项。**列入 §9 待审批**。
- **引用**：`game-concept §3.2`（情报→改写收益回路）、`rewrite-causality §3.1`（world_visual 契约）、§4.3（intel_cov 进 diff）、§6.1/§6.2（S1↔S5 信号）、§7.4（与 S5 边界）、`systems-index §3.1`（DAG）、§6（v_i/情报行）。

### 7.2 与 S2 主线任务系统（P2-3 · 已完成）

- **S2 → S5**：`quest_target_scene_set`（布置目标场所冷光环/触发器，§6.3）、`quest_node_vanished_voiced`（移除消失节点场所，§6.3）。
- **S5 → S2**：（无直接信号；S5 产情报 → S2 读 `intel_entry` 判定节点解锁条件，经数据查询非信号，§2.2）。
- **边界（场所布置 vs 节点派发，`mainline-quest §2.4/§3.2/§6.2`）**：**节点何时派发/消失归 S2**（生命周期），**场所几何/触发器归 S5**（世界）。S5 据 S2 `target_scene` 布置，节点语义归 S2。玩家绕序未激活场所 → S5 不亮冷光环（§5.1，软引导）。
- **边界（情报解锁 S2 节点条件）**：S5 的 `character_intel`/`intel_entry` 可作 S2 节点 `prereq` 的解锁条件（如"需收集关羽重义传闻才解锁 N3 策反条件"）。**S2 读 S5 情报只读**，S5 不判定节点解锁（§2.2）。
- **引用**：`mainline-quest §2.1`（玩家绕序软引导）、§2.4（节点嵌入场所）、§3.2（`target_scene`）、§5.1（未激活场所）、§5.2（节点消失场所移除）、§6.2（S2→S5 信号）。

### 7.3 与 S3 面板/成长系统（P2-4 · 已完成）

- **S3 → S5**：`ability_changed(intel_gain_mult_delta)`（情报采集乘子只读契约，§6.4）。
- **S5 → S3**：（无直接；S5 产情报 → S1 降 diff，不经 S3；HP/资源状态归 S4，S3 只读显示。S5 的据点揭示/活跃场所/情报计数经 §6.6 信号给 S3 HUD）。
- **边界（情报采集 vs 情报强化，`panel-progression §7.3`）**：**情报采集归 S5**（情报点/产出/intel_cov 聚合），**情报强化归 S3**（采集乘子元升级）。S5 应用 `effective_intel_gain_mult` 到 intel_cov（§4.1），**S5 仍决定"情报从哪来"**（`systems-index §6` 情报行）。**S3 不创造情报，只放大采集**。
- **引用**：`panel-progression §4.5`（intel_gain_mult → S5）、§6.3（ability_changed S3→S5）、§7.3（与 S5 边界）。

### 7.4 与 S4 实时战斗系统（P2-5 · 已完成 · 核心跨系统契约）

- **S5 → S4**：`encounter_spawned`（遭遇布置，§6.5）、环境遮挡只读（芦苇/烟雾/湿地，§6.5）、玩家 stance（§6.5）、`player_at_scene`（场所检测，§6.5）。
- **S4 → S5**：`encounter_cleared`（敌人全灭/脱战判定，§6.5，**确认由 S4 判定**）。
- **边界 1（遭遇布置 vs 战斗执行，`combat §2.1/§7.4`）**：**敌人"在哪/有多少/巡逻路线"归 S5 遭遇表**，**敌人"怎么动/怎么打"归 S4**。S5 不生成敌人行为，S4 不创造敌人实例。✅
- **边界 2（环境遮挡，`combat §6.4/§7.4` + `art-bible §5.2/§5.3/§5.5`）**：**视线遮挡体/噪声介质归 S5**（世界长什么样），**S4 只读修正感知**（`combat §3.4`）。`art-bible §5.2` 显式「滩涂湿地影响潜行/战斗可读性」——**本 GDD 落地**：湿地噪声 ×1.5（§3.5 `wetland_noise_mult`），芦苇荡视野 ×0.3（`reed_conceal_sight_mult`），烟雾完全遮挡（受 `wind_visual_dir` 影响，§2.4）。✅
- **边界 3（潜行 stance，`combat §7.4`）**：**玩家蹲行移动归 S5 玩家控制器**（探索层），**感知判定归 S4**（战斗层）。两段式。✅
- **边界 4（checkpoint，§2.8）**：**checkpoint 归 S5**（世界几何），**失败判定归 S4**（战斗状态）。S4 失败态 `nearest_camp` 读 S5 checkpoint。
- **引用**：`combat §2.1`（遭遇流程）、§2.7（感知/stance）、§3.4（环境遮挡修正）、§5.2（失败态 checkpoint）、§5.5（同屏性能）、§6.4（S5↔S4 信号——本 GDD 已确认）、§7.4（与 S5 边界）、`art-bible §5.2/§5.3/§5.5`。

### 7.5 与 X2 NPC 关系 / X3 阵营 / X4 存档 / X5 可访问性（横切）

- **X2（NPC 关系，目标态预留）**：S5 NPC 数据带 `relation_seed`/`faction_relation_ref` 字段（§3.4）预留，**MVP 不实现**关系深度逻辑（`systems-index §1.2` X2 行）。目标态引入 X2 后，对话/关系值才影响改写条件。**本 GDD 只预留字段**。
- **X3（阵营，愿景外仅视觉）**：阵营色/旗号/形制仅视觉辨识（`art-bible §2.3/§4.3`），**不影响**遭遇/改写政治后果（`systems-index §1.2` X3 行「愿景外」）。⚠️ 多通道辨识（色相+旗号+形制）守可访问性。
- **X4（存档）**：S5 声明持久态 `save_state_open_world`（§3.6）——已采集情报点/玩家情报条目/intel_cov/已清遭遇/checkpoint。**敌人实例/遭遇 active 态不持久化**（战斗瞬态归 S4，`combat §3.5`；读档由 S5 遭遇表 + spawn_state 重建）。**跨系统一致性**：`player_intel_entries` ↔ S1 `intel_cov` 来源对应（§3.6/§5.5），X4 原子写入。
- **X5（可访问性）**：①阵营辨识多通道（§7.5 X3）；②v_i 视觉化不只靠颜色（冷光环 + 浮标文字 + glitch 多通道，`art-bible §2.5`）；③键鼠+手柄双绑定（基线）；④大地图/对话可访问性（缩放/字幕，`art-bible §6.3`）。[待 P4-1/P3 可访问性矩阵]。

### 7.6 跨 GDD 评审注释（issue 验收要点 · 跨 GDD 一致性）

> 撰写中发现与前置 GDD 的**张力 / 待统一项**，逐条列具体位置与修复建议。**本 GDD 不越权改前置 GDD**（红线），仅标注，建议主理人派独立一致性 issue 或在评审中统一。

1. **【`intel_cov` 生产/消费归属】`rewrite-causality §0` 列 intel_cov 为 S1 符号 vs 实际 S5 生产（§4.1 / §7.1）**（无硬冲突，仅澄清）。
   - 澄清：`rewrite-causality §0` 把 `intel_cov` 列在 S1 符号表（标"探索产出"），但 `panel-progression §4.5` 明确"S5 把采集到的原始情报量 ×此乘子得 intel_cov"——即 **intel_cov 由 S5 生产、S1 只读消费**。本 GDD §0/§4.1 据此定稿：intel_cov 生产归 S5（§4.1 公式）、消费归 S1（`rewrite-causality §4.3` diff）。与 `rewrite-causality §0`「探索产出」标注一致，**无冲突**，仅澄清生产方。
   - 建议：回写 `rewrite-causality §0` 在 intel_cov 行注明「**生产：S5（§4.1） / 消费：S1 只读**」更精确，避免读者误以为 S1 生产。
2. **【`intel_cov` 上限 1.0 的经济失衡风险】§4.1 / §7.1**（新增张力，待联合确认）。
   - 张力：`intel_cov∈[0,1]`，若=1 则 S1 `diff = diff_base·(1−1) = 0`，叠加 `disc` 封顶 0.5 可能使 `cost_RE≈0`（满情报+满成长=免费改写），与 `rewrite-causality §5.1` 防刷分冲突。
   - 本 GDD 立场：**[待与 S1 联合确认]** intel_cov 是否封顶 <1（如 0.8）或 S1 在 `cost_RE` 加保底项（如 `cost_RE ≥ cost_base·0.2`）。在确认前，本 GDD 公式照写（封顶 1.0），S1 可在消费侧加保底。
   - 建议：主创审批后，回写 `rewrite-causality §4.3` 加 intel_cov 上限或 cost_RE 保底项。
3. **【S5↔S4 信号清单确认】`combat §6.4` 标「待 S5 联合确认」→ 本 GDD §6.5 已确认**（正面回应，无冲突）。
   - 本 GDD §6.5 正式确认 `encounter_spawned`/`encounter_cleared`（**由 S4 判定**）/环境遮挡只读/玩家 stance/`player_at_scene` 五项，回应 `combat §6.4/§11③` 的"待 S5 GDD 联合确认"。✅ 与 `combat` 两段式一致，零新增冲突信号（独立 S5↔S4 通道）。
4. **【`game/data/intel/*.tres` 落点】systems-index §6 情报行落点 vs 本 GDD §3.2**（细化，无冲突）。
   - systems-index §6 情报行列落点 `game/data/intel/*.tres`（建议）。本 GDD §3.2 细化：情报采集点 `game/data/intel/<poi_id>.tres` + 离散情报条目嵌于采集点 `intel_entries[]`（或独立 `game/data/intel/entries/*.tres`，`[待程基岩确认]`）。与 systems-index 一致。
5. **【MVP 据点范围】`game-concept §7.1` MVP 世界最小集（1 张赤壁小区域 TileMap + ≤5 NPC + 1 处改写场所）vs §3.1 mvp_subset**（对齐，无冲突）。
   - 本 GDD §3.1 `mvp_stronghold_subset: [sh_chibi]` + `mvp_scene_subset: [scene_altar]` 精确落地 `game-concept §7.1` MVP 世界最小集。目标态才扩展到 4 据点全集。✅

> ✅ **跨 GDD 一致性总检**：与 S1（`intel_updated`/`variable_changed`/`deviation_recomputed` 零改名；intel_cov 生产/消费澄清；intel_cov 上限待联合确认）、S2（`quest_target_scene_set`/`quest_node_vanished_voiced` 零改名）、S3（`ability_changed` 零改名）、S4（S5↔S4 五项信号正式确认，两段式一致）**无硬矛盾**；发现的张力（intel_cov 上限）已在 §7.6②标注 + §9 待审批。支柱红线（§1.4 据点不清单化/探索不跑图/冷光不污染）已逐机制标注。

### 7.7 引用的前置文档（一致性锚）

- `game-concept.md`：§1 术语（系统/v_i/情报/改写节点/因果链）、§2 支柱（③主/①次）、§3.1 探索动词、§3.2 情报→改写收益回路、§3.3 美学（Discovery）、§5 核心循环 Loop A（探索环）、§5.3 Loop B（战斗嵌入）、§6 三节点 MWP（场所/据点）、§7 范围（MVP 收窄）、§9 待审批（①人格/②奇幻上限）。
- `systems-index.md`：§2 S5 边界、§3 依赖 DAG（S5 只读 S1 v_i）、§4 Loop A 映射（S5=探索环主责）、§5 支柱对齐（S5 漂移红线=据点清单化）、§6 横切实体归属（情报行/v_i 行/阵营关系行）、§1.2 X2/X3/X6 范围、§8 认知过载红线。
- `rewrite-causality.md`：§0 符号（v_i/intel_cov）、§3.1 world_visual 契约、§3.3 蓝图 unlock_intel_cov、§3.5 verb requires.scene、§4.3 diff/intel_cov、§6.1/§6.2 S1↔S5 信号、§7.4 与 S5 边界。
- `mainline-quest.md`：§2.1 玩家绕序软引导、§2.4 节点嵌入场所、§3.2 target_scene、§5.1 未激活场所、§5.2 节点消失场所移除、§6.2 S2→S5 信号。
- `panel-progression.md`：§4.5 intel_gain_mult → S5、§6.3 ability_changed S3→S5、§7.3 与 S5 边界。
- `combat.md`：§2.1 遭遇流程、§2.7 感知/stance、§3.4 环境遮挡修正、§5.2 失败态 checkpoint、§5.5 同屏性能、§6.4 S5↔S4 信号（本 GDD 已确认）、§7.4 与 S5 边界。
- `art-bible.md`：§0 双轨、§1.3 3/4 俯视、§2.5 Δ 视觉三档、§3.2 渲染叠层（L1-L5）、§3.3 信息焦点（冷光环）、§4.3/§4.4 角色/阵营视觉、§5.1 朝代视觉 token、§5.2 湿地、§5.3 芦苇遮挡、§5.4 关键建筑、§5.5 风向/时辰/天气、§8.1 Tile=64px、§8.4 性能上限、§9 命名空间。
- `project-charter.md`：核心循环 Loop A 措辞（探索环）、范围（垂直切片严守）、平台（PC 键鼠+手柄）。

---

## 8. 验收标准（可逐条勾选）

> 对照 issue 9 个验收要点 + `team/design-strategist.md` 输出规范（八节齐全 / 公式标变量单位 / ≥3 类边缘情况 / 跨 GDD 一致性 / 支柱红线 / 数据驱动）。

- [ ] **八节齐全 + §0 符号表**：概述(§1) / 机制(§2) / 数据(§3) / 公式(§4) / 边缘情况(§5) / UI 接口(§6) / 依赖(§7) / 验收标准(§8) + §0 符号表（含 S1/S3/S4 沿用符号 + S5 新增符号分列），缺一不可。✅
- [ ] **公式统一格式、标变量与单位**：§0 符号表 + §4 六类公式（intel_cov 聚合/情报冷却/遭遇冷却/风向映射/时辰天气渲染/总览）均给式/变量/单位/域/归属，§4.6 速查表。✅
- [ ] **≥3 类边缘情况（含 issue 明列 4 项）**：§5 给 6 类——§5.1 玩家进入未激活据点（issue 明列）/ §5.2 情报采集后节点被 S2 移除（issue 明列）/ §5.3 同屏多遭遇刷新竞争（issue 明列）/ §5.4 TileSet/场所切换时机（issue 明列）/ §5.5 v_i 视觉化与 S1 不同步 / §5.6 环境遮挡与 S4 感知冲突。✅
- [ ] **支柱对齐小节**：§1.4 逐字引用 `game-concept §2` 三条支柱全称，标 S5 主（③）/ 次（①）支柱 + 3 条漂移红线（沿用 `systems-index §5` S5 行），支柱名可追溯。✅
- [ ] **依赖节静态无环**：§7.1 S5 只**只读** S1 的 v_i 契约做视觉映射（`variable_changed` 消费），**绝不反向写 v_i/Δ**（§2.3/§5.5 红线）；与 S2/S3/S4 信号契约**逐条对齐前置 GDD 既定信号，零新增冲突信号**（§6.1~§6.4 回引 S1/S2/S3；§6.5 确认 `combat §6.4` 提议的 S5↔S4 通道，独立不冲突）。✅
- [ ] **情报机制接口边界**：§2.2 + §4.1 明确「情报从哪来（S5 采集点生产 intel_cov/intel_entry）」与「情报怎么用（S1 降 diff / S2 解锁条件，**消费方只读**）」的两段式接口边界（`systems-index §6` 情报行）；§7.1 交叉确认。✅
- [ ] **数据驱动落点建议**：§3 给出 `game/data/world/*.tres`、`game/data/intel/*.tres`、`game/data/encounters/*.tres`、`game/data/npcs/*.tres` 等建议命名（`snake_case` + `dyn_threekingdoms_chibi`），**全程标注「以 P3-1 ADR 为准，不臆造引擎 API」**（§3 引言 + 各字段 `[待程基岩确认]`）。✅
- [ ] **朝代热切换铺路**：§2.1/§3.1/§3.7 说明 S5 以「TileSet + 遭遇表 + BGM 组合」（朝代包 `dynasties/*.tres`）组织，使多朝代扩展不挡路（换包换朝代）；**明确 MVP=赤壁单一朝代**（§3.1 mvp_subset），X6 跨朝代热切换属愿景外（§3.7/§7.5）。✅
- [ ] **范围标注 MVP/目标态/愿景分级**：§2.5（X2 NPC 关系=目标态预留字段不实现；X3 阵营=愿景外仅视觉）、§2.4/§4.5（天气/时辰 MVP 固定，目标态动态）、§2.6/§4.3（遭遇刷新 MVP 多一次性）、§3.1（mvp_subset）逐处标注。✅
- [ ] **不臆造引擎 API**：§3 全程标 `[待程基岩确认]`（`TileMapLayer` 多层/`NavigationRegion2D`/`Area2D`/`YSort`/`CanvasLayer` 等）；不确定处标 `[待审批]`/`[待与 S1/S4 联合确认]`。✅
- [ ] **与 game-concept / systems-index / 前置 GDD 一致且显式引用**：§0/§1/§7 多处显式引用节号，术语逐字沿用（Δ/CP/v_i/改写节点/因果链/系统/Loop A/Loop B/情报），支柱名可追溯（③主/①次）。✅
- [ ] **设计理论红线已标注**：支柱漂移（§1.4 三红线：据点清单化/探索跑图/冷光污染）、认知过载（§6.7 信息密度分级）、经济防线（§4.1 intel_cov 防刷/§5.2 情报不退）逐项标注并给缓解。✅
- [ ] **DAG 无环硬契约已落实**：§2.3/§5.5（S5 不写 v_i/Δ）、§2.2/§7.1（S5 不直接降 diff）明确 S5 只读视觉映射 + 只产情报，消费方自决。✅
- [ ] **待审批项显式标注**：§4.1（intel_cov 上限）、§2.4/§4.5（天气/时辰动态切换）、§5.3（max_concurrent_encounters）、§7.6（intel_cov 生产/消费澄清回写、上限）均标 `[待审批]`/`[待与 S1/S4 联合确认]`/`[待程基岩确认]`，不擅自定稿。✅
- [ ] **状态标记**：文档头 v0.1（首版，待主创评审）/ 状态：可评审。✅

---

## 9. 待主创审批项（发现设计张力，不擅自定稿）

> 沿用并细化 `game-concept §9` / `systems-index §10` / 前置 GDD 中影响**本系统数值结构**的待定项。

1. **【`intel_cov` 上限与经济平衡】封顶 1.0 vs <1（如 0.8）？S1 是否加 cost_RE 保底项？（§4.1 / §7.1 / §7.6②）**
   - 来源：本 GDD 撰写中发现。`intel_cov=1` 可能使 S1 `diff=0` → `cost_RE≈0`（满情报+满成长=免费改写），与 `rewrite-causality §5.1` 防刷分冲突。
   - **须 S1/S5 联合确认**：封顶 <1（在 S5 生产侧）或 S1 加 `cost_RE ≥ cost_base·0.2` 保底项（在 S1 消费侧）。倾向后者（保底项更稳，不改 intel_cov 表达力）。
2. **【天气/时辰动态切换】MVP 固定 `day/clear` vs 轻度动态？（§2.4 / §4.5）**
   - 来源：`game-concept §7.1` MVP 收窄。倾向 MVP 固定（`day/clear`），目标态做章节脚本驱动的时辰/天气切换（如 N2 夜间借风）。奇幻上限待 `game-concept §9②`。
3. **【同屏并发遭遇数 `max_concurrent_encounters`】1~2 是否拍板？（§5.3）**
   - 守 `art-bible §8.4` 性能预算。倾向 1~2，精确值待程基岩 P3 + Playtest。
4. **【据点间快速旅行】目标态是否做路径点快速旅行？（§5.4）**
   - 来源：4 据点单图步行可能耗时。倾向 MVP 步行/乘船（连续世界），目标态加"已揭示据点间快速旅行"（非加载传送）。守支柱③开放连续性。
5. **【系统人格基调】沿用 `game-concept §9①`（环境旁白/情报简报语气）（§1.5 / §3.2）**
   - S5 环境触发文案按"冷峻记录员"倾向撰写（如「情报已收录」「记录：玩家已抵达关键场所」），留接口待定稿。与 S2/S3/S4 文案同口径。
6. **【X2 NPC 关系字段预留是否够用】（§3.4 / §7.5）**
   - 本切片只预留 `relation_seed`/`faction_relation_ref` 字段不实现。若 X2 目标态设计需要更多字段（如好感度数值/关系事件），须回头评估 S5 NPC 数据结构。倾向当前预留足够。

---

## 10. 已知风险与取舍

1. **情报经济未平衡**（§4 全部默认值）：`intel_raw`/`intel_cap`/`intel_gain_mult`/`intel_cov` 上限为首版倾向值，须 P5/P6 Playtest（严守真）迭代。`intel_cov` 上限（§9 第 1 项）是核心经济风险。
2. **据点清单化的支柱风险**（§1.4 红线 1）：若 S5 据点/场所彼此孤立、世界不随 v_i 联动变化，支柱③崩塌。**防线**：§2.3 v_i 视觉化强制随 S1 `variable_changed` 联动；据点经 v_i 因果链互相咬合（连舟→火攻→华容道）。须 P4-2 资产 + Playtest 验证"据点联动可读"。
3. **跨系统只读契约同步依赖消费方**（§5.5/§5.6）：S5 发 `intel_updated` 后 S1/S2 必须接收应用；S5 切 `world_visual` 依赖 S1 `variable_changed` 到达；S5 提供遮挡体 S4 必须读。若 P3 事件路由有遗漏，功能"看似生效实则没用"。建议 P3 加断言。
4. **开放世界性能预算未冻结**（§5.3/`art-bible §8.4`）：同屏敌人/据点 LOD/VFX 上限是美术倾向，精确阈值待程基岩 P3。S5 遭遇表须共同守预算（`combat §5.5`）。
5. **v_i 视觉化的资产量**（§2.3/`art-bible §5.4/§5.5`）：每个 v_i 取值需一套 world_visual 变体（连舟 3 态、坛 2 态、风向 3 态×全场景植被/旗/浪/烟）——资产制作量大，依赖林绘澄 P4-2。MVP 收窄（单节点 N2 → 主要做 `v_wind`/`v_altar` 视觉化）。
6. **跨系统存档一致性**（§3.6）：`player_intel_entries` ↔ S1 `intel_cov` 来源、`spawn_state` ↔ S4 战斗态、checkpoint ↔ S4 失败回归——多处跨系统，须 X4 原子写入 + 读档重同步（§5.5）。
7. **双轨张力的世界侧**（§1.4 红线 3）：v_i 视觉化的冷光（冷光环/浮标/glitch）过强会抢赤壁正剧沉浸（`systems-index §5` 跨系统张力）——靠 `art-bible §3.2` 冷光仅 L5 + `art-bible §2.5` 三档节制缓解，须 P4-1 UX + Playtest 校准。

---

## 11. 下一步建议（给主理人 · 游承峰）

1. **本 issue（P2-6）完成后**，请主创优先审批 **§9 第 1 项（`intel_cov` 上限与经济平衡）**——它是探索→改写收益回路（`game-concept §3.2`）的数值开关，须 S1/S5 联合确认后可能回写 `rewrite-causality §4.3`。**这是与 S1 的唯一跨系统数值依赖**。
2. **请主创次优先审批 §9 第 2、3 项**（天气/时辰动态切换 / 同屏并发遭遇数）——它们决定 MVP 开放世界的氛围厚度与性能预算，影响 P4-2 资产清单（环境资产量）。
3. **P2 全部 5 系统 GDD 至此完成（S1~S5）**：建议主理人派**跨 GDD 一致性评审**（design-strategist 自检 / 或独立 issue），统一处理各 GDD §7.x/§9 中累积的"待联合确认/回写"项（如 `alert_mult` 应用方 `combat §7.7①`、`intel_cov` 上限本 GDD §7.6②、`skills` 落点两段式 `combat §7.7②`、CP 加成应用方 `panel-progression §9①`）。**这些是 P3 架构的前置**，越早统一越省返工。
4. **给程基岩（P3-1 架构）**：§3 数据契约（`world/*`/`intel/*`/`encounters/*`/`npcs/*`）+ §6 信号契约（含 §6.5 正式确认的 S5↔S4 通道）+ §7 DAG 可直接作为系统边界与数据归属输入。重点：①`TileMapLayer` 多层组织与碰撞层；②S5↔S4 遭遇/环境/stance/场所信号路由；③`variable_changed`→world_visual 重同步断言（§5.5）；④X4 存档跨系统原子写入（§3.6）。建议 P3-1 与本文 + S1/S4 交叉引用，在 ADR 中确认 `.tres` 资源类设计 + 朝代包加载机制。
5. **给林绘澄（P4-2 资产清单）**：§2.1 据点/场所布局 + §2.3 v_i 视觉化变体清单（连舟/坛/风向）+ §3.5 环境配置 + `art-bible §5` 环境视觉，是开放世界资产的直接需求清单。重点：v_wind 全场景统一切换的植被/旗/浪/烟资产（`art-bible §5.5`）；4 据点建筑（夏口/乌林/赤壁/华容道，`art-bible §5.4`）。
6. **给严守真（QA）**：§5（尤其 §5.2 情报与节点消失、§5.5 v_i 视觉化同步、§5.6 环境遮挡）+ §8 验收项是 QA 清单雏形，建议 P5/P6 转为可执行断言（如"采集情报后 intel_updated 必发且 intel_cov 单调非降"、"v_i 改变后 world_visual 在 N 帧内切换"、"同屏激活遭遇 ≤ max_concurrent_encounters"）。

---

*—— 文策渊（design-strategist）· Phase 2 系统设计（P2-6 · S5 开放世界/朝代地图系统）· 待主创评审*
