# 主架构文档 · 《赤壁·改写者》垂直切片

> 阶段：Phase 3 · 技术搭建（P3-1）　|　执行角色：程基岩（engineering-lead）
> 文档版本：v0.1（首版，待主创评审）　|　状态：可评审
> 基线锚点：`AGENTS.md`「设计基线 / Godot 4.7 约定 / 红线」、`docs/project-charter.md`、`docs/roadmap.md` P3-1。
> 设计输入（**显式引用，需求可追溯**，已全部读完）：
> - `docs/design/gdd/game-concept.md`（P1-1）——支柱 / 核心循环 Loop A / 三节点 MWP / 范围分层。
> - `docs/design/gdd/systems-index.md`（P2-1）——系统清单 S1~S5、职责边界 §2、依赖 DAG §3、Loop A 映射 §4、横切实体归属 §6。
> - `docs/design/gdd/systems/rewrite-causality.md`（P2-2 · S1）——数据契约 §3、公式 §4、信号 §6、依赖 §7、存档 §3.6。
> - `docs/design/gdd/systems/mainline-quest.md`（P2-3 · S2）——节点生命周期、派发 §2、数据 §3、信号 §6。
> - `docs/design/gdd/systems/panel-progression.md`（P2-4 · S3）——CP 账户、技能树 §3、公式 §4、信号 §6。
> - `docs/design/gdd/systems/combat.md`（P2-5 · S4）——伤害/资源/感知、数据 §3、信号 §6。
> - `docs/design/gdd/systems/open-world.md`（P2-6 · S5）——TileMapLayer/情报/遭遇、数据 §3、信号 §6、朝代热切换 §3.7。
> - `docs/design/art/art-bible.md`（P1-2）——双轨反差、渲染叠层 §3.2、性能上限 §8.4、命名 §9。
> 配套文档：`adr-001~005-*.md`（基础层决策）、`control-manifest.md`（一页控制清单）、`review-report.md`（架构评审报告）。
> 本文件是**垂直切片的技术地基**：把 GDD 的设计需求翻译成**分层架构 + 数据归属 + 信号契约 + 场景树组织**，供 P3-2 工程骨架与 P5 制作据此编码。**不写代码实现**（红线）。

---

## 0. 阅读指南与文档边界

- **作用**：垂直切片的**技术总图**——分层（基础/核心/玩法）、每层模块的职责/归属/依赖方向、数据归属与持久化、信号总线、场景树组织、核心循环走查、性能预算、可访问性、需求可追溯。
- **不是**：不给具体代码/脚本实现（P5 Story 职责）；不臆造 Godot 4.7 API（不确定处标 `[待 P3-2 确认]`，见 §13）；不做多朝代/多人/网络的过度设计（守 `project-charter` 范围，垂直切片=1 朝代 + Loop A）。
- **配套 ADR 覆盖**：渲染与拉伸（adr-001）、数据驱动（adr-002）、输入系统（adr-003）、节点/信号架构（adr-004）、朝代热切换（adr-005）——5 条，满足 issue「≥3 条基础层 ADR」。
- **术语**：沿用 `game-concept §1` 词汇表与 `systems-index §1` 系统编号（S1~S5 / X1~X6），本文不另造。

---

## 1. 架构目标与设计原则

> 把 GDD 的设计约束翻译成**可执行的工程纪律**。每条原则给「GDD 来源 → 架构落地」。

| # | 原则 | GDD 来源 | 架构落地 |
|---|---|---|---|
| A1 | **DAG 无环**（共享数值唯一所有者） | `systems-index §3.1/§3.3`、`rewrite-causality §5.3/§7.2-7.4` | S1 是根；跨系统**只经信号通信**，消费方只读契约、绝不反向写生产方内部态（§4）。 |
| A2 | **信号优先于全局单例滥用** | `AGENTS.md` Godot 约定 | 跨系统通信走**事件总线**（§7）；状态型系统用最小 Autoload 集（§8）；场景内系统用**节点分组**定位（`combat §6.4` 场景子系统）。见 adr-004。 |
| A3 | **数据驱动**（不硬编码） | `AGENTS.md`、`systems-index §6`、各 GDD §3 | GDD 数值落 `game/data/*.tres`（自定义 Resource）/ `*.json`（如对话/本地化），代码只读取（§6）。见 adr-002。 |
| A4 | **分层依赖单向**（基础←核心←玩法） | 工程惯例 + DAG | 玩法层调核心层契约、核心层用基础层服务；核心层系统间按 DAG（§4）。 |
| A5 | **知识诚实，不臆造 API** | `team/engineering-lead.md` 注意事项 | Godot 4.7 API 不确定处一律标 `[待 P3-2 确认]`（§13），P3-2 工程骨架逐一核对。 |
| A6 | **守垂直切片范围，不过度设计** | `project-charter`、`game-concept §7.4` | 架构支撑「1 朝代 + Loop A 闭环」；多朝代热切换/跨朝代累积/NPC 关系深度/阵营逻辑**只留数据接口，不实现**（adr-005、§6.4）。 |
| A7 | **可测试性**（心脏可独立验证） | `rewrite-causality §3.3`、`team/engineering-lead.md` | S1 计算封闭（只读自有数据 + 注入 v_i），可脱离 UI/世界单测（§10）。 |
| A8 | **垂直切片可演进**（架构不挡路） | `AGENTS.md` Godot 约定「朝代热切换铺路」 | 朝代包为换数据即可换朝代的单位（adr-005）；公式朝代无关；跨朝代累积留数据维度口。 |

---

## 2. 技术栈与工程基线

> 严格对齐 `AGENTS.md`「设计基线」与 Godot 4.7 约定。**所有带 ⚠️ 项须 P3-2 工程骨架在 `game/project.godot` 实际落地时复核**。

### 2.1 引擎与语言

- **引擎**：Godot 4.7.1 stable（`AGENTS.md` 锁定）。
- **语言**：GDScript（单一语言，不混 C#；守基线）。
- **渲染**：2D 优先（无 3D 场景）。⚠️ `AGENTS.md` 写「渲染 `2d`」——Godot 4 无字面 "renderer=2d" 开关（2D 由场景类型决定）；`rendering/renderer/rendering_method` 倾向 `gl_compatibility`（2D 友好、PC 兼容、为移动端愿景铺路）。**精确字段以 P3-2 `project.godot` 为准**，见 adr-001。
- **拉伸**：`window/stretch/mode = "canvas_items"`、`window/stretch/aspect = "expand"`（支持宽屏，`art-bible §3.1` 设计分辨率 1920×1080）。见 adr-001。

### 2.2 目录结构（工程根 `game/`，P3-2 创建）

> 落地 `AGENTS.md`「工程根在 `game/`」+ 数据驱动约定。**目录为 P3-2 创建蓝图，本文定义命名规约**（`snake_case`，对齐 `art-bible §9`）。

```
game/
├── project.godot                  # P3-2 生成；渲染/拉伸/autoload/InputMap 在此
├── scenes/
│   ├── boot.tscn                  # 启动场景（F6）
│   ├── world/world.tscn           # 开放世界主场景（S5/S4 系统节点 + TileMapLayer）
│   ├── ui/                        # 系统 UI 场景（panel/hud/timeline_*，轨道 B）
│   └── panel/                     # 改写面板/演出子场景（panel-progression §3.5）
├── scripts/
│   ├── foundation/                # 基础层（F1~F7，零游戏知识）
│   ├── core/                      # 核心层（C1~C5 = S1~S5 逻辑所有者）
│   ├── gameplay/                  # 玩法层（actors/triggers/ui surfaces）
│   └── autoload/                  # Autoload 脚本（EventBus/SaveManager 等）
├── data/                          # 数据驱动（GDD 数值落地，§6）
│   ├── variables/ nodes/ blueprints/ verbs/ causal_links/   # S1
│   ├── quests/chapters/ quests/nodes/                        # S2
│   ├── panel/ progression/skills/                            # S3
│   ├── combat/ skills/ enemies/                              # S4
│   ├── world/ intel/ encounters/ npcs/                       # S5
│   ├── dynasties/                                            # 朝代包（adr-005）
│   └── globals/                                              # 全局参数（detection_globals / env / ui_strings）
├── assets/                        # 美术/音频资产（林绘澄/阮和鸣管；本架构只定引用路径）
└── tests/                         # 单测/集成测（程基岩 P4 脚手架 + P5 实现）
```

> ⚠️ `data/` 子目录命名**与各 GDD §3 建议落点逐一对齐**（见 §6.2 表）。`.tres` 资源类名规约见 adr-002。

### 2.3 项目配置要点（给 P3-2）

| 配置 | 值 | 来源 |
|---|---|---|
| `application/run/main_scene` | `res://scenes/boot.tscn` | §8 启动序列 |
| `rendering/renderer/rendering_method` | ⚠️ `gl_compatibility`（待 P3-2 复核） | adr-001 |
| `display/window/size/viewport_width/height` | `1920 × 1080` | `art-bible §3.1` |
| `display/window/stretch/mode` | `canvas_items` | `AGENTS.md` 锁定 |
| `display/window/stretch/aspect` | `expand`（倾向） | adr-001 |
| Autoload | EventBus / DynastyLoader / SaveManager /（S1/S2/S3 见 §8） | adr-004 |
| InputMap actions | `move_up/down/left/right`、`interact`、`sprint`、`crouch`、`basic_attack`、`skill_1`、`ui_*` 等 | adr-003 |
| 验证命令 | `$GODOT_BIN --headless --import --quit`（在 `game/` 下） | `AGENTS.md` |

---

## 3. 系统分层（基础 / 核心 / 玩法）

> 落地 `team/engineering-lead.md`「分层（基础/核心/玩法）→ 每层定模块」。依赖方向：**玩法 → 核心 → 基础**（单向，§4）。

### 3.0 分层总览

```
┌─────────────────────────────────────────────────────────────┐
│ 玩法层 Gameplay（场景 actors + UI 表面；消费核心契约）        │
│  G1 玩家控制器 G2 敌人 G3 NPC/对话 G4 情报点 G5 遭遇生成       │
│  G6 改写场所触发器 G7 系统面板UI G8 历史线演出 G9 系统旁白(X1) │
└───────────────▲─────────────────────────────────────────────┘
                │ 调用核心契约 / 向核心发事件
┌───────────────┴─────────────────────────────────────────────┐
│ 核心层 Core（S1~S5 权威逻辑与共享态所有者；DAG）             │
│  C1 改写/因果引擎(S1·根) C2 主线任务(S2) C3 面板/成长(S3)      │
│  C4 战斗系统(S4) C5 开放世界系统(S5)                          │
└───────────────▲─────────────────────────────────────────────┘
                │ 使用引擎服务
┌───────────────┴─────────────────────────────────────────────┐
│ 基础层 Foundation（引擎服务；零游戏知识；可独立测试）        │
│  F1 渲染/场景组织 F2 输入 F3 数据驱动资源 F4 存档(X4)         │
│  F5 事件总线/信号路由 F6 启动/场景管理 F7 音频总线(占位)      │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 基础层（Foundation · 引擎服务，零游戏知识）

> 特征：不含任何 S1~S5 业务语义；可被任意核心/玩法模块复用；可独立单测。

| 模块 | 职责 | 关键依赖（Godot 4.7） | 范围 | ADR |
|---|---|---|---|---|
| **F1 渲染与场景组织** | 叠层组织（L0~L5，`art-bible §3.2`）、Camera2D 跟随、YSort、前景半透 | `TileMapLayer`/`Camera2D`/`CanvasLayer`/`YSort` ⚠️待核 | 垂直切片 | adr-001 |
| **F2 输入系统** | InputMap 动作抽象、键鼠+手柄双绑定、重映射、死区/抖动 | `InputMap`/`Input`/`InputEvent` | 垂直切片 | adr-003 |
| **F3 数据驱动资源** | 自定义 Resource(.tres) 类族、资源加载/缓存、数据校验、本地化(.json) | `Resource`/`ResourceLoader`/`ResourceSaver` | 垂直切片 | adr-002 |
| **F4 存档/读档（X4）** | 跨系统原子写、Loop A 持久化、读档重同步、存档槽 | `ConfigFile`/`FileAccess` ⚠️待核 | 垂直切片 | （本文 §9） |
| **F5 事件总线/信号路由** | 跨系统信号中枢（typed signals）、生产/消费解耦、调试钩子 | Godot 信号系统 | 垂直切片 | adr-004 |
| **F6 启动与场景管理** | boot 序列、Autoload 注册、世界场景生命周期、暂停 | `SceneTree`/`change_scene` | 垂直切片 | （本文 §8） |
| **F7 音频总线（占位）** | BGM/SFX 总线路由、朝代 BGM 包 hook | `AudioStreamPlayer`/`AudioServer` | 占位（音频归阮和鸣） | （本文 §6.4） |

### 3.2 核心层（Core · S1~S5 权威逻辑所有者）

> 特征：拥有共享数值的**唯一真值**；跨场景持久（Loop A 态）；只读他人契约，绝不反向写。**与 `systems-index §1` 系统编号一一对应**。

| 模块 | GDD 系统 | 职责（管什么） | 所有/读写实体（`systems-index §6`） | 持久化 | 部署形态 |
|---|---|---|---|---|---|
| **C1 改写/因果引擎** | S1（根） | Δ/CP 产出、v_i 真值、节点模型、因果链解析、存在性规则 | Δ / CP(产出) / v_i / 节点模型 / 因果链 / 历史线判定 | Loop A：`resolved_nodes` 等 | **Autoload** |
| **C2 主线任务编排器** | S2 | 节点生命周期态机、派发、存在性派发决策、章节推进 | 节点生命周期 / 派发 / 任务文案 / CP 加成参数 | Loop A：`node_lifecycle_ledger` | **Autoload** |
| **C3 面板/成长** | S3 | CP 账户/兑换、技能树、`effective_*` 只读契约聚合、演出资产 | CP 账户 / 兑换 / 技能解锁 / 历史线演出资产 | Loop A：`cp_balance`/`unlocked_skills` | **Autoload** |
| **C4 战斗系统** | S4 | 伤害/资源(HP·BF)/感知警戒/敌人 FSM/改写动词物理执行派发 | 玩家战斗状态(HP·BF·alert) / 敌人行为 | **不持久化**（Loop B 瞬态，`combat §3.5`） | **场景内**（world 场景） |
| **C5 开放世界系统** | S5 | TileMap 世界、v_i 视觉映射、情报聚合(intel_cov)、遭遇布置、场所检测 | 情报(采集) / 遭遇布置 / v_i 视觉映射 / 世界探索态 | Loop A：`collected_intel_pois`/`cleared_encounters`/checkpoint | **场景内**（world 场景） |

> **部署形态决策**（adr-004 详）：C1/C2/C3 持有跨场景 Loop A 态 → **Autoload**（合理单例，非滥用）；C4/C5 与世界场景同生命周期 → **world 场景内节点**，经节点分组被定位。**战斗态(HP·BF·alert)与敌人实例不持久化**（读档满血 + 清警戒 + S5 重建遭遇，`combat §3.5`）。

### 3.3 玩法层（Gameplay · 场景 actors + UI 表面）

> 特征：无共享数值所有权；消费核心契约、向核心发事件；是玩家/世界的可见化身。

| 模块 | 职责 | 消费/对接的核心 | GDD 来源 |
|---|---|---|---|
| **G1 玩家控制器** | 移动/stance（sprint/walk/crouch）、战斗输入转发 | C5(stance/场所)→C4(战斗) | `open-world §2.7`、`combat §2.7` |
| **G2 敌人角色** | FSM 巡逻/追击/攻击、感知锥、沿 S5 路线移动 | C4(AI) + C5(遭遇布置/巡逻路线) | `combat §2.8/§3.3` |
| **G3 NPC + 对话** | 基础对话触发、情报给予、改写目标标记、冷光描边 | C5(NPC 布置) + C1(verb target) | `open-world §2.5` |
| **G4 情报采集点** | 交互范围检测、采集触发 | C5(intel 聚合) | `open-world §2.2` |
| **G5 遭遇生成器** | 读遭遇表、实例化敌人、互斥/排队 | C5(遭遇表) + G2(敌人) | `open-world §2.6` |
| **G6 改写场所触发器** | 冷光环提示（L5）、打开改写面板 | C2(target_scene)→C3(改写面板) | `mainline §6.2`、`art-bible §3.3` |
| **G7 系统面板 UI** | 偏差/技能树/兑换/情报/任务 Tab、改写面板、HUD | C3(显示)+读 C1/C2 数据 | `panel §6.5`、`art-bible §6` |
| **G8 历史线分叉演出** | minor/notable/critical 演出回放 | C3(资产) + C1(Δ 触发) | `panel §2.5`、`art-bible §6.2` |
| **G9 系统旁白（X1）** | 配音/字幕/动效回放（冷峻记录员） | 消费 C1/C2/C5 触发 | `systems-index §1.2 X1`、各 GDD §6.x |

> **X1 归属**（`systems-index §6` 待定项）：架构上 X1 表现为**纯消费型播放器节点**（接收 S1/S2/S5 的 `*_voiced` 信号回放旁白），自身无游戏状态；人格基调待主创审批（`game-concept §9①`），架构只暴露文案 id 接口（adr-004）。

---

## 4. 依赖方向与 DAG（无环论证）

> 落地 `systems-index §3.1/§3.3`。**核心层系统间依赖 = 静态数据契约 DAG，无环**；玩法层只单向调核心。

### 4.1 分层依赖规则

1. **玩法 → 核心**：玩法 actor 调核心契约方法、向核心发事件；**核心不反向调用玩法**（核心只发信号，玩法自愿订阅）。
2. **核心 → 基础**：核心用基础层引擎服务；**基础层零核心知识**（基础层是工具库）。
3. **核心内部 = DAG**（下节）。
4. **横切（X1/X4/X5）**：X1（旁白播放器）只消费；X4（存档）只读写持久态；X5（可访问性）只调基础层 F2。**无业务所有权**。

### 4.2 核心层 DAG（静态数据契约，无环）

> 箭头 =「依赖方 → 被依赖方」（A 读 B 的契约）。**S1 是根**。完全对齐 `systems-index §3.1`。

```
                         C1 改写/因果引擎 (S1 · 根)
                        ▲          ▲          ▲
       读节点模型/因果链 │          │ Δ/CP 契约 │ v_i 可视化契约
                        │          │          │
              C2 主线任务         C3 面板/成长   C5 开放世界
                                                   ▲
                                                   │ 玩家能力/HP 契约
                                                 C4 战斗 ──(verb_executed 事件，不写 Δ)──┐
                                                                                             │
                                                              （回流 S1，由 S1 自算 Δ）◀─────┘
```

- **无环证明**：C1 无任何反向依赖；C4→C1 是**事件**（`verb_executed`），C1 自算 Δ（C4 不写 Δ，`combat §5.3`）；C3→C1 是 `disc` 只读契约（C1 读，非控制反转，`rewrite-causality §7.2`）。**唯一反向边 C3→C1 经「只读契约 + 封顶 0.5」解耦，仍是 DAG 边**。
- **DAG 硬契约**（守 `systems-index §3.1`）：任何系统**不得反向写**生产方内部态。违规示例（须在 P5 代码评审拦截）：C4 直接改 `v_i`、C5 直接算 `Δ`、C3 直接改 `CP_earned`、S2 重定义存在性 `condition`。→ 信号契约是唯一合法跨系统通信（§7）。

### 4.3 动态环 = Loop A（有意闭环，时序解耦）

> 落地 `systems-index §3.2/§3.3`。Loop A 的环是设计目标，非坏味道。解耦三手段（架构支撑）：
> 1. **时序单向**：单次循环节点级粒度流动（派发→探索→改写→反馈→下一派发），非可重入。
> 2. **接口契约**：跨系统只经定义好的信号（§7 总表），不共享可变全局态。
> 3. **C1 计算封闭**：Δ 计算只读 C1 自有数据 + 注入的当前 v_i，不依赖 UI/世界内部态 → 心脏可独立单测（§10）。

---

## 5. 数据归属与持久化策略（横切实体映射）

> 落地 `systems-index §6` 横切实体归属表 → 架构模块 + 持久化策略。**每个共享实体唯一所有者**。

| 共享实体 | 唯一所有者（模块） | 持久化？ | 持久化字段（GDD 来源） |
|---|---|---|---|
| 历史偏差 Δ | C1 (S1) | 是（节点级，结算后） | `resolved_nodes[].delta_node`（`rewrite-causality §3.6`） |
| 因果点 CP（产出） | C1 (S1) | 产出瞬时，不入 C1 账户 | — |
| 因果点 CP（账户/兑换） | **C3 (S3)**（两段式） | 是 | `cp_balance`/`cp_spent_total`/`unlocked_skills`（`panel §3.3`） |
| 关键变量 v_i | C1 (S1) | 是 | `resolved_nodes[].final_vars` + `unresolved_node_snapshot.working_vars` |
| 改写节点（数值模型） | C1 (S1) | 是（确认后） | `rewrite-causality §3.6` |
| 改写节点（生命周期） | C2 (S2) | 是 | `node_lifecycle_ledger`（`mainline §3.3`） |
| 因果链（规则） | C1 (S1) | 静态数据（`causal_links.tres`） | — |
| 存在性依赖（规则） | C1 (S1) | 静态数据 | — |
| 存在性依赖（派发决策） | C2 (S2) | 是（消失/替代 ledger） | `vanished_nodes`（`mainline §3.3`） |
| 历史线判定 / 演出资产 | 判定 C1 / 资产 **C3** | 演出场景引用静态 | — |
| 情报（采集/intel_cov） | C5 (S5) | 是 | `collected_intel_pois`/`player_intel_entries`/`active_dynasty_intel_cov`（`open-world §3.6`） |
| 玩家能力（解锁） | C3 (S3) | 是 | `unlocked_skills`（`panel §3.3`） |
| 玩家能力（执行数值） | C4 (S4) | 静态数据（`skills/*.tres`） | — |
| 玩家战斗状态（HP/BF/alert） | C4 (S4) | **否**（Loop B 瞬态） | 读档满血+清警戒（`combat §3.5`） |
| 遭遇布置 | C5 (S5) | 是（cleared ledger） | `cleared_encounters`（`open-world §3.6`） |
| checkpoint | C5 (S5) | 是 | `last_checkpoint` |
| NPC 关系（X2） | — | **MVP 不实现**（字段预留） | `relation_seed`（`open-world §3.4`） |
| 阵营关系（X3） | — | **愿景外**（仅视觉） | — |
| 「系统」人格文案 | C2/C1/C5（触发）+ X1（表现） | 静态文案数据 | `system_*_voice` |

> **两段式所有权**（CP / 节点 / 存在性 / 玩家能力）：均按 GDD 既定接口 join（CP: 产出 S1↔账户 S3；节点: 数值 S1↔生命周期 S2 按 `node_id`；存在性: 规则 S1↔决策 S2 按 `link_id`；能力: 解锁 S3↔执行 S4 按 `ability_id`）。**架构禁止任一侧越权写另一侧**（§4.2 DAG 硬契约）。

---

## 6. 数据驱动资源设计

> 落地 `AGENTS.md` 数据驱动 + `art-bible §9` 命名 + 各 GDD §3。决策详 adr-002。

### 6.1 资源类型策略

| 数据类别 | 格式 | 理由 |
|---|---|---|
| **静态游戏数据**（节点/变量/技能/敌人/遭遇/情报/朝代包） | `.tres`（自定义 Resource） | 编辑器可视化、强类型、引用安全、`ResourceLoader` 缓存、Godot 原生版本控制友好 |
| **本地化/对话长文本/事件脚本** | `.json` | 翻译协作友好、外部工具可编辑、热加载便利 |
| **全局参数**（detection_globals/env/ui_strings） | `.tres` | 强类型 + 编辑器手调 |
| **存档**（运行时态） | `ConfigFile`（`.cfg`）/ 序列化 dict ⚠️待核 | §9；原子写、多槽位 |

> ⚠️ `.tres` 资源**类名规约**（adr-002）：`class_name` 用 `PascalCase`（如 `RewriteNodeData`），文件 id/字段用 `snake_case`（如 `node_id: n2_east_wind`）。资源类放 `scripts/foundation/data_resources/`（基础层，被核心/玩法读）。

### 6.2 数据落点映射（GDD §3 建议落点 → 本架构确认）

> 逐条对齐各 GDD §3。**路径为本架构确认的最终落点**（GDD 标「以 P3 ADR 为准」者，本表拍板）。

| 数据族 | 路径 | 所有者 | GDD 来源 |
|---|---|---|---|
| 关键变量 | `data/variables/<var_id>.tres` | S1 | `rewrite-causality §3.1` |
| 改写节点（数值模型） | `data/nodes/<node_id>.tres` | S1 | `rewrite-causality §3.2` |
| 改写蓝图 | `data/blueprints/<bp_id>.tres`（或嵌节点） | S1 | `rewrite-causality §3.3` |
| 改写动词 | `data/verbs/<verb_id>.tres` | S1 | `rewrite-causality §3.5` |
| 因果链（聚合） | `data/causal_links.tres` | S1 | `rewrite-causality §3.4` |
| 章节表 | `data/quests/chapters/<chapter_id>.tres` | S2 | `mainline §3.1` |
| 节点派发表（生命周期） | `data/quests/nodes/<node_id>.tres` | S2 | `mainline §3.2` |
| 技能节点（解锁） | `data/progression/skills/<skill_id>.tres` | S3 | `panel §3.1` |
| 技能树（聚合） | `data/progression/skill_tree.tres` | S3 | `panel §3.2` |
| 兑换项 | `data/panel/exchange_items.tres` | S3 | `panel §3.4` |
| 玩家战斗配置 | `data/combat/player_combat.tres` | S4 | `combat §3.1` |
| 能力执行数据 | `data/skills/<ability_id>.tres` | S4 | `combat §3.2` |
| 敌人定义 | `data/enemies/<enemy_id>.tres` | S4 | `combat §3.3` |
| 感知/噪声全局 | `data/globals/detection_globals.tres` | S4 | `combat §3.4` |
| 朝代包 | `data/dynasties/<dynasty_id>.tres` | S5（顶层组织） | `open-world §3.1` |
| 情报采集点 | `data/intel/<poi_id>.tres` | S5 | `open-world §3.2` |
| 遭遇表 | `data/encounters/<encounter_id>.tres` | S5 | `open-world §3.3` |
| NPC 布置 | `data/npcs/<npc_id>.tres` | S5 | `open-world §3.4` |
| 场所/环境 | `data/world/scenes/*.tres`、`data/world/environment/*.tres` | S5 | `open-world §3.5` |
| UI 文案/演出引用 | `data/panel/ui_strings.tres` | S3 | `panel §3.5` |

> **`skills/*.tres` 所有权澄清**（回应 `combat §7.7②` / `open-world §7.6④` 跨 GDD 待统一项）：**`data/skills/<ability_id>.tres` = C4 执行数据**；**`data/progression/skills/<skill_id>.tres` = C3 解锁数据**；按 `ability_id` join（两段式，无重复所有者）。与 GDD 口径一致，本架构拍板。

### 6.3 资源加载机制（adr-002 详）

- **启动加载**：朝代包（`dynasties/<active>.tres`）及其引用的 TileSet/遭遇/BGM 在 boot/进 world 场景时一次性加载（`ResourceLoader.load`，⚠️ `load_threaded_*` 用于大资源待 P3-2 核对）。
- **按需加载**：节点/蓝图/动词在 C1 初始化节点时加载；敌人在遭遇触发时实例化。
- **缓存**：静态数据 Resource 单例缓存（Godot `ResourceLoader` 默认缓存同一路径）；运行时态**不**写回 .tres（只入存档）。
- **数据校验**：F3 提供 `validate_data()`（boot 时跑）：蓝图可达性（`rewrite-causality §5.5`）、`Σw_i=1.0` 归一化、`causal_links` 引用完整性、`existence_dep` 的 `condition` 可解析。**失败即拒绝启动并报错**（不静默降级）。

### 6.4 朝代包与多朝代扩展（铺路，本切片不实现）

> 落地 adr-005。**朝代 = TileSet + 遭遇表 + BGM 组合**（`AGENTS.md` / `art-bible §5.1`）。

- **朝代包**（`data/dynasties/dyn_threekingdoms_chibi.tres`）聚合：TileSet 引用（ground/props/collision）+ 遭遇表包 + BGM 包 + 据点/场所集 + MVP 子集开关。
- **命名空间**：所有数据带 `dynasty` 字段（`dyn_threekingdoms_chibi`）；换朝代换包（换命名空间）即可。
- **公式朝代无关**：C1 的 Δ/CP 公式、C4 的伤害公式均不含朝代硬编码。
- **本切片**：仅 1 朝代；**跨朝代热切换 / 跨朝代偏差累积明确愿景外**（`game-concept §7.3`、`systems-index §1.2 X6`），架构只留 `dynasty` 数据维度口，不实现切换逻辑。**不做**联网/多人（`project-charter` 范围）。

---

## 7. 信号/事件总线架构（信号契约总表）

> 落地 `AGENTS.md`「信号优先」+ 各 GDD §6 信号清单。决策详 adr-004。

### 7.1 路由方式

- **跨系统信号**（核心层系统间、核心→玩法消费方）走 **EventBus Autoload**（typed signals 中枢）：生产方 `EventBus.xxx.emit(...)`，消费方 `EventBus.xxx.connect(callable)`。解耦生产/消费，无直接引用（守 A2）。
- **场景内信号**（world 场景内 C4↔C5↔actors）用**节点直接信号**或**节点分组** `call_group`（如 S5 环境遮挡广播给 S4 感知节点）。
- **信号载荷**：一律 GDD 既定命名（§7.2 总表），**零新增冲突信号**（与 GDD §6.x 逐条对齐）。Godot typed signal 精确签名（参数类型）标 `[待 P3-2 确认]`（A5）。

### 7.2 信号契约总表（跨系统，汇总 5 GDD）

> 生产方 → 消费方。**此表是编码的契约源**。GDD 信号名为「建议」，本架构采纳，P3-2 工程骨架据此定义 EventBus signals。

#### C1 (S1) 发出 → 消费方
| 信号 | 载荷 | 主消费方 | 来源 |
|---|---|---|---|
| `blueprint_declared(node_id, blueprint_id)` | 节点/蓝图 | C3, X1 | `rewrite-causality §6.1` |
| `variable_changed(var_id, old_value, new_value, is_preview)` | 变量/旧新值/预览 | C3, C5 | `rewrite-causality §6.1` |
| `deviation_recomputed(node_id, delta_node, is_preview)` | 节点/Δ/预览 | C3, C5 | `rewrite-causality §6.1` |
| `intent_match_computed(node_id, m)` | 节点/M | C3 | `rewrite-causality §6.1` |
| `cp_awarded(amount, node_id, reason)` | CP/节点/原因 | **C3（账户入账）** | `rewrite-causality §6.1` |
| `feedback_tier(node_id, tier)` | 节点/档位 | C3, X1 | `rewrite-causality §6.1` |
| `critical_deviation_triggered(node_id, delta_node)` | 节点/Δ | C3, C2 | `rewrite-causality §6.1` |
| `causal_link_propagated(link_id, source_node, resolved_value, target)` | 链/源/值/目标 | **C2（派发决策）**, C5 | `rewrite-causality §6.1` |
| `node_resolved(node_id, final_vars, delta_node, cp_earned)` | 节点/最终v/Δ/CP | C3, C2, **X4（持久化触发）** | `rewrite-causality §6.1` |
| `node_vanished(node_id)` | 节点 | C2 | `rewrite-causality §6.1` |

#### C1 接收 ← 来源
| 信号 | 载荷 | 来源 | 来源 |
|---|---|---|---|
| `node_activated(node_id)` | 节点 | C2 | `rewrite-causality §6.2` |
| `verb_executed(verb_id, target, success)` | 动词/目标/成败 | **C4（战斗/潜行）**, C5（交互） | `rewrite-causality §6.2` |
| `intel_updated(intel_cov, new_intels[])` | 覆盖率/新情报 | C5 | `rewrite-causality §6.2` |
| `ability_changed(ability_id, contract_key, value_delta)` | 能力/键/增量 | C3 | `rewrite-causality §6.2` |
| `node_committed(node_id)` | 节点 | **C3（玩家确认）**/ C2（任务级强制） | `rewrite-causality §6.2` |

#### C2 (S2) 发出 → 消费方
| 信号 | 载荷 | 主消费方 | 来源 |
|---|---|---|---|
| `quest_objective_updated(node_id, objective_short, objective_long)` | 节点/目标文案 | C3 | `mainline §6.2` |
| `quest_dispatch_voiced(node_id, system_dispatch_voice)` | 节点/派单文案 | X1 | `mainline §6.2` |
| `quest_target_scene_set(node_id, target_scene)` | 节点/场所 | **C5（场所布置/冷光环）** | `mainline §6.2` |
| `quest_progress_updated(chapter_id, p_ch)` | 章节/进度 | C3 | `mainline §6.2` |
| `quest_node_vanished_voiced(node_id, system_vanish_voice)` | 节点/消失文案 | X1, C3, **C5（场所移除）** | `mainline §6.2` |
| `quest_reward_declared(node_id, quest_reward_mult, quest_cp_flat_bonus)` | 节点/加成参数 | C3（可改查表，`mainline §6.2` 注） | `mainline §6.2` |

> （C2→C1 的 `node_activated`/`node_committed` 见 C1 接收表。）

#### C3 (S3) 发出 → 消费方
| 信号 | 载荷 | 主消费方 | 来源 |
|---|---|---|---|
| `ability_changed(ability_id, contract_key, value_delta)` | 能力/键/增量 | C1（disc/insight）, C5（intel_gain_mult） | `panel §6.3` |
| `ability_unlocked(ability_id)` | 能力 | C4, C1（`requires.ability` 校验） | `panel §6.3` |
| `node_committed(node_id)` | 节点 | C1（玩家确认锁定的发出方） | `panel §6.3` |
| `timeline_branch_play(tier, node_id, scene_ref)` | 档位/节点/场景 | X1 | `panel §6.4` |
| `cp_balance_changed(new_balance, delta)` | 余额/增量 | HUD | `panel §6.4` |
| `skill_unlocked_toast(skill_id, display_name)` | 技能/名 | HUD, X1 | `panel §6.4` |

#### C4 (S4) 发出 → 消费方
| 信号 | 载荷 | 主消费方 | 来源 |
|---|---|---|---|
| `verb_executed(verb_id, target, success)` | 动词/目标/成败 | C1 | `combat §6.1` |
| `alert_state_changed(node_id, alert_level, alert_mult)` | 节点/警戒/乘子 | C1（待联合确认应用，`combat §7.1`） | `combat §6.1` |
| `hp_changed(new_hp, max_hp)` / `bf_changed(...)` | HP/BF | C3（HUD 显示，只读） | `combat §6.2` |
| `combat_alert_changed(alert_level, alert_mult)` | 警戒/乘子 | C3（HUD） | `combat §6.2` |
| `encounter_cleared(encounter_id)` | 遭遇 | **C5（由 S4 判定全灭/脱战）** | `combat §6.4` / `open-world §6.5` |

#### C5 (S5) 发出 → 消费方
| 信号 | 载荷 | 主消费方 | 来源 |
|---|---|---|---|
| `intel_updated(intel_cov, new_intels[])` | 覆盖率/情报 | C1 | `open-world §6.1` |
| `encounter_spawned(encounter_id, enemies[])` | 遭遇/敌人集 | **C4（接管行为）** | `open-world §6.5` |
| 环境遮挡只读（芦苇/烟雾/湿地修正） | 遮挡参数 | C4（感知修正） | `open-world §6.5` |
| 玩家 stance（sprint/walk/crouch） | stance | C4（噪声/感知） | `open-world §6.5` |
| `player_at_scene(scene_id)` | 场所 | C4, C1（`requires.scene` 校验） | `open-world §6.5` |
| `intel_collected_voiced(intel_entry, lore_text)` | 情报/文本 | X1, C3 | `open-world §6.6` |
| `poi_interact_prompt(poi_id, prompt_text)` / `dialogue_started(...)` / `stronghold_discovered(...)` / `minimap_updated(...)` / `env_voice_triggered(...)` | 见 GDD | C3/X1 | `open-world §6.6` |

> **跨 GDD 待联合确认项**（架构记录，不擅自定）：
> - `alert_mult` 应用方（`combat §7.7①`）：C1 的 `diff` 公式无 alert 项；待 C1/C4 联合确认是否在 C1 消费侧增补。
> - `intel_cov` 上限（`open-world §7.6②`）：`=1` 可能使 `cost_RE≈0`；待 C1/C5 联合确认封顶 <1 或 C1 加 `cost_RE` 保底。
> - `node_committed` 触发源（`mainline §9②`）：本架构采纳 GDD 共识——**玩家确认由 C3 发出**；C2 仅任务级强制；耗尽 `max_attempts` 由 C1 内部触发。

---

## 8. 场景树与节点组织

> 决策详 adr-004。**Autoload 最小化 + 场景内节点分组**。

### 8.1 Autoload 注册表（状态型持久系统）

| Autoload | 层 | 职责 | 状态 |
|---|---|---|---|
| `EventBus` | 基础(F5) | 跨系统信号中枢（§7） | 无游戏态（纯路由） |
| `DynastyLoader` | 基础(F3/F6) | 加载朝代包、缓存静态数据、跑数据校验 | 当前 `active_dynasty` |
| `SaveManager` | 基础(F4) | 存档/读档/槽位/原子写（§9） | 无业务态（只读写） |
| `RewriteCausalityEngine` (C1) | 核心 | S1 心脏 | Loop A 改写态 |
| `MainlineQuestDirector` (C2) | 核心 | S2 编排 | Loop A 任务态 |
| `PanelProgression` (C3) | 核心 | S3 账户/成长 | Loop A 账户态 |

> **为何 C4/C5 不 Autoload**：C4（战斗）/C5（世界）与世界场景同生命周期，且战斗态不持久化（§5）；它们作为 world 场景子节点存在，被 C1/C2/C3 经**节点分组**（`add_to_group("combat_system")` / `"open_world_system")`）或 EventBus 间接寻址。这避免「单例持有场景态」的反模式。

### 8.2 world 场景树（开放世界主场景，P3-2 搭建）

> 落地 `art-bible §3.2` 渲染叠层 + `open-world §2.1` 叠层组织。⚠️ 节点名/层位为建议，待 P3-2 核对 Godot 4.7 `TileMapLayer`/`YSort` 实际行为（A5）。

```
world.tscn (Node2D)
├── L0_Parallax       (ParallaxBackground/ Sprite)   远景/天光/雾
├── L1_Ground         (TileMapLayer)                 地形/水面/路面
├── L2_Props          (TileMapLayer)                 建筑/营寨/植被/连舟（world_visual 变体）
├── L2b_Collision     (TileMapLayer / 静态碰撞) ⚠️    碰撞/寻路 NavigationRegion2D
├── L3_Characters     (YSort)
│   ├── Player        (G1 玩家控制器)
│   ├── Enemies/      (G2 敌人角色，运行时实例化)
│   └── NPCs/         (G3 NPC)
├── L4_Foreground     (Sprite/YSort)                 树冠/屋檐/烟雾（玩家近时半透）
├── Systems           (Node)                         —— 场景内系统节点 ——
│   ├── OpenWorldSystem   (C5，group:"open_world_system")
│   ├── CombatSystem      (C4，group:"combat_system")
│   ├── EncounterSpawner  (G5)
│   └── IntelPOIManager   (G4 容器)
├── L5_SystemCanvas   (CanvasLayer)                  —— 轨道 B 冷光唯一入口 ——
│   ├── HUD           (Control)
│   ├── RewritePrompt (改写场所冷光环/浮标)
│   └── TimelineStage (G8 历史线演出)
├── RewritePanel      (CanvasLayer)                  改写面板/系统面板（G7）
├── X1_Narrator       (Node)                         G9 系统旁白播放器（纯消费）
├── Camera2D          (Camera2D)                     跟随玩家，缓动，zoom
└── WindDirector      (Node)                         v_wind→wind_visual_dir 全场景驱动
```

> **叠层纪律**（守 `art-bible §0/§3.2`）：轨道 B 冷光**只允许出现在 `L5_SystemCanvas`**（含少量穿透术法 VFX）；`L1~L4` 保持轨道 A 暖色，**冷光不污染世界**。`WindDirector` 监听 C1 `variable_changed(v_wind)` 广播 `wind_visual_dir` 给旗帜/芦苇/浪/烟（`open-world §2.4/§4.4`）。

### 8.3 UI 场景（轨道 B，CanvasLayer 内）

- `HUD`（`L5_SystemCanvas` 子）：HP/BF（C4 数据）+ CP 余额（C3）+ 当前节点名（C2）+ Δ 指示条 + RE 条（C1）+ 警戒指示（C4）。极简贴边（`art-bible §6.2`）。
- `RewritePanel`：改写面板（蓝图/动词/Δ 预览/确认）+ 系统 Tab（偏差/技能树/兑换/情报/任务）。冷光材质（`art-bible §6.1`）。
- `TimelineStage`：历史线分叉演出（minor/notable/critical 三档场景，`panel §3.5`）。

### 8.4 启动序列（boot.tscn → world）

> F6 启动管理。顺序：
> 1. Autoload 初始化（EventBus/DynastyLoader/SaveManager/C1/C2/C3 就绪）。
> 2. `DynastyLoader` 加载 `active_dynasty`（默认 `dyn_threekingdoms_chibi`）+ 跑数据校验（§6.3）。
> 3. `SaveManager` 读最近存档（若有）→ 注入 C1/C2/C3 的 Loop A 态；无则初始化 baseline。
> 4. `change_scene_to(world.tscn)`；world 的 `_ready` 中 C5/C4 据朝代包 + 存档重建世界（TileMap、NPC、遭遇 spawn_state、v_i 视觉重同步，§9.2）。
> 5. C2 据章节进度派发当前节点（`node_activated`）→ Loop A 起步。

---

## 9. 存档/读档（X4）

> 落地 `systems-index §1.2 X4` + 各 GDD §3.x 存档清单。**工程所有权**。

### 9.1 持久化范围

- **持久化（Loop A）**：C1 改写态（`rewrite-causality §3.6`）、C2 任务账本（`mainline §3.3`）、C3 账户（`panel §3.3`）、C5 世界探索态（`open-world §3.6`）。
- **不持久化（Loop B 瞬态）**：C4 战斗态（HP/BF/alert/敌人实例，`combat §3.5`）；读档满血 + 清警戒 + C5 重建遭遇。

### 9.2 原子写与读档重同步

- **跨系统原子写**（`open-world §3.6`/`panel §3.3`/`mainline §3.3`）：C1/C2/C3/C5 的持久态须**单次事务写入**同一存档文件，避免撕裂。`SaveManager` 收集四者快照 → 序列化 → 原子落盘（写临时文件 + rename ⚠️待核 Godot 4.7 文件 API）。
- **一致性校验（读档）**：
  - C2 `已确认` 节点集 == C1 `resolved_nodes`（`mainline §3.3` 硬约束）。
  - C3 `cp_credited_total` == Σ(C1 `cp_awarded` × C2 加成)（`panel §3.3`）。
  - C5 `player_intel_entries` ↔ C1 `intel_cov` 来源对应（`open-world §3.6`）。
  - **不一致即拒绝读档并报错**（不静默修复）。
- **读档世界重同步**（`open-world §5.5`）：C5 据 C1 `resolved_nodes.final_vars` + `unresolved_node_snapshot.working_vars` **重建全部 world_visual**；C5 据 `cleared_encounters` 重建遭遇 `spawn_state`；C5 置玩家于 `last_checkpoint`。
- **存档触发**：监听 C1 `node_resolved`（节点确认后存档）+ 手动存档入口（暂停菜单）。⚠️ 未锁定改写可回滚（C1 保留 `unresolved_node_snapshot`），已锁定节点不可悔棋（`rewrite-causality §5.4`，待审批）。

### 9.3 多槽位与版本

- 多槽位（≥3）；存档头含 `schema_version`，读档迁移（`SaveManager`）。⚠️ 精确迁移策略待 P4/P5。

---

## 10. 核心循环 Loop A 数据流走查（N2 借东风一次改写，端到端）

> 用架构节点 trace 一次完整 Loop A，验证架构闭合。节点 = N2 借东风，玩家选「自借东风」分支 C。

```
① 任务（C2→C5→X1）
  C2 派发 N2：EventBus.node_activated.emit(n2_east_wind) → C1 置 v_i=baseline
  C2 EventBus.quest_target_scene_set.emit(n2, scene_altar) → C5 在七星坛生成冷光环(G6)
  C2 EventBus.quest_dispatch_voiced.emit(n2, "已锁定目标：借东风…") → X1(G9) 播派单旁白

② 探索（G1→C5→C1；可选 C4 Loop B）
  G1 玩家移动到江岸情报点(G4) → C5 累计 intel_cov → EventBus.intel_updated.emit(...) → C1 降 diff
  G1 切蹲行(stance) → C5 广播 stance → C4（若遇遭遇 G5→C4 Loop B）
  G1 移动至七星坛 → C5 EventBus.player_at_scene.emit(scene_altar) → C1/C4 记录 requires.scene 满足

③ 改写（G7 改写面板→C3→C1→C4→C1）
  G6 触发 → 打开 G7 改写面板 → 玩家选蓝图 bp_player_self_wind → C1 EventBus.blueprint_declared.emit(...)
  玩家选动词 verb_self_borrow_wind → 玩家释放 ability_system_magic_wind
    G1 转发战斗输入 → C4 执行术法（ability 解锁校验读 C3）→ C4 EventBus.verb_executed.emit(verb_self_borrow_wind, target, success) → C1
  C1 据 verbs[].effect 改 v_wind=southeast → EventBus.variable_changed.emit(v_wind,...) →
       C5 切 world_visual（WindDirector 驱动全场景风向）+ C3 实时预览 Δ
  玩家点"确认改写"(G7) → C3 EventBus.node_committed.emit(n2) → C1 进入锁定结算

④ 反馈（C1→C3→G8/X1；C1→C2 因果链）
  C1 算 Δ_node、M、CP_earned（§4 公式）→
       EventBus.deviation_recomputed/cp_awarded/intent_match_computed/feedback_tier.emit(...)
  C3 入账 CP（查 C2 加成 quest_reward_mult → CP_credited）→ G7 HUD/结算屏显示
  C3 EventBus.timeline_branch_play.emit(tier,...) → G8 播历史线演出 + X1 旁白
  C1 EventBus.node_resolved.emit(n2, final_vars,...) → C2 推进章节 + X4 触发存档
  C1 EventBus.causal_link_propagated.emit(link_fire_power_to_n3_existence,...) →
       C2 判定 N3 存在性 → 派发 N3 或派替代节点 → 回到 ①（下一轮 Loop A）
```

> ✅ **闭合验证**：四环（任务→探索→改写→反馈）均有架构节点主责；因果链 N2→N3 存在性经 C1→C2 跨系统信号落地；冷光仅在 L5（C5 视觉映射不污染世界）。**架构支撑垂直切片 Loop A 闭环**。

---

## 11. 性能与预算

> 落地 `art-bible §8.4`（美术倾向）+ `combat §5.5`/`open-world §5.3`（同屏预算）。**精确阈值待 P3-2 + P6 剖析冻结**（A5）。

| 维度 | 倾向预算（art-bible §8.4） | 架构落地 |
|---|---|---|
| 设计分辨率 | 1920×1080（4K 经 canvas_items 缩放） | adr-001 |
| Tile | 64×64px（`art-bible §8.1`） | TileSet 规约 |
| 同屏高精敌人精灵 | ≤30–50 | C5 遭遇互斥/排队（`open-world §5.3` `max_concurrent_encounters`，待审批） |
| 同屏粒子 | ≤200–400 | C4 VFX 池化（待 P3-2） |
| 战场色块（士卒） | 压缩表达（`art-bible §3.3`） | G2 精灵规格分级 |
| 叠层 | L0 视差 + L5 系统 CanvasLayer 计预算 | F1 禁四层全动态过绘 |
| 同屏并发遭遇 | 1~2（待审批） | C5 互斥队列 |

> **性能纪律**：图集合批（同精灵入同图集，`art-bible §8.4`）；冷光粒子用轻量 Sprite + 加法混合；`variable_changed`→`world_visual` 切换在 N 帧内完成（`open-world §5.5`，F1 加断言）。**预算超限时 C5/C4 应降级而非崩帧**（目标态 LOD，本切片可不实现）。

---

## 12. 可访问性（X5）与输入

> 落地 `systems-index §1.2 X5` + `art-bible §6.3` + `combat §6.6`。输入详 adr-003。

- **输入双绑定**（基线 PC 键鼠+手柄）：所有玩法动词在 InputMap 双绑定；UI 双套提示图标（`combat §6.6`）。
- **多通道辨识**：阵营辨识（色相+旗号+形制）、Δ 视觉（冷光环+浮标文字+glitch）、战斗受击（红光+震屏+音效）——禁仅色相（`art-bible §2.3`）。
- **字幕/缩放**：系统文字支持 ≥150% 缩放 + WCAG AA 对比度（`art-bible §6.3`）；旁白配字幕。
- **减少动效选项**：减少震屏/glitch（目标态）。⚠️ 可访问性矩阵待 P4-1/P3 联合（`combat §6.6`）。

---

## 13. 知识诚实 / Godot 4.7 API 缺口标记

> 守 A5。下列项**不确定 Godot 4.7 精确 API/字段**，标 `[待 P3-2 确认]`，**P3-2 工程骨架逐一核对并补 `docs/engine-reference/godot/4.7.md`**（当前不存在，建议主理人派补）。

| # | 不确定项 | 架构处理 | 验证方式 |
|---|---|---|---|
| K1 | `rendering/renderer/rendering_method` 是否 = `gl_compatibility` 最优 | adr-001 倾向 gl_compatibility，待 P3-2 复核 | P3-2 project.godot 实测 |
| K2 | `TileMapLayer` 多层组织（ground/props/collision 分层 + 静态碰撞）精确节点用法 | §8.2 给结构，层名待核 | P3-2 测试图 |
| K3 | `YSort` 节点 vs `Node2D.y_sort_enabled` 哪个用于 L3 | §8.2 用 YSort 节点倾向 | P3-2 实测 |
| K4 | `NavigationRegion2D` 寻路烘焙流程 | §8.2 占位 | P3-2 |
| K5 | typed signal（Godot 4 带参数类型）精确语法 | §7 信号名/载荷定，类型待核 | P3-2 |
| K6 | 存档原子写（临时文件 + rename）/ `ConfigFile` 序列化 dict | §9 给策略 | P3-2/P4 |
| K7 | `ResourceLoader.load_threaded_*` 是否需用于大 TileSet | §6.3 默认 `load` | P3-2/P6 |
| K8 | InputMap 手柄死区/抖动 API（`InputEventJoypadMotion`） | adr-003 给抽象 | P3-2 |
| K9 | `Camera2D` zoom/缓动/拖拽边距精确属性 | §8.2 占位 | P3-2 |

> **红线**：在 P3-2 核对前，**不得**在 P5 Story 实现中臆造上述 API；遇缺口回问主理人或标 `# TODO(p3-2-verify): <缺口>`。

---

## 14. 需求可追溯矩阵（GDD 需求 → 架构模块）

> 守 `team/engineering-lead.md`「需求可追溯」。抽样关键需求；完整映射见各 GDD §3/§6 与本文 §5/§7。

| GDD 需求（来源） | 架构模块 | 落地节 |
|---|---|---|
| Δ 计算 `Δ=Σ(w_i·d_i)·100`（`rewrite §4.1`） | C1 | §3.2/§5 |
| CP 产出（`rewrite §4.2`）/ 账户（`panel §4.1`） | C1 / C3 | §5（两段式） |
| 因果链存在性派发（`rewrite §3.4` + `mainline §2.3`） | C1（规则）→C2（决策） | §4.2/§7 |
| v_i 视觉映射只读（`open-world §2.3`） | C1（真值）→C5（视觉）+G1/G2/G3 | §5/§7/§10 |
| intel_cov 降 diff（`open-world §4.1`→`rewrite §4.3`） | C5（产）→C1（消费） | §7 |
| 遭遇布置 vs 战斗执行（`combat §2.1` + `open-world §2.6`） | C5（布）→C4（执行）+G5/G2 | §3.3/§7 |
| 能力解锁 vs 执行（`panel §3.1` + `combat §3.2`） | C3（解锁）→C4（执行）按 ability_id | §6.2 |
| 玩家 stance→感知（`combat §2.7` + `open-world §2.7`） | G1→C5→C4 | §7/§8.2 |
| 朝代热切换铺路（`open-world §3.7`） | F3 DynastyLoader + 朝代包 | adr-005/§6.4 |
| 存档原子写（各 GDD §3.x） | F4 SaveManager | §9 |
| 冷光仅 L5（`art-bible §0/§3.2`） | F1 叠层 + L5_SystemCanvas | §8.2 |
| 输入双绑定（基线） | F2 InputMap | adr-003 |
| 渲染 2d + canvas_items（`AGENTS.md`） | F1 project.godot | adr-001 |

---

## 15. 待主创审批项（与 GDD 待审批对齐）

> 本架构**不擅自定稿**，沿用 GDD 待审批；仅列**影响架构结构**者。

1. **【alert_mult 应用方】**（`combat §7.7①`）：C1 `diff` 是否增 alert 项？影响 C1 公式模块。待 C1/C4 联合确认。
2. **【intel_cov 上限】**（`open-world §7.6②`）：=1 可能 `cost_RE≈0`（经济失衡）。待 C1/C5 联合确认封顶 <1 或 C1 加保底。
3. **【意图判定方案】**（`rewrite §9①`）：蓝图=显式意图方案是否采纳？影响 C1/C3/G7 改写面板数据结构。架构以「采纳」为前提设计，可平滑切换。
4. **【X1 系统人格归属】**（`systems-index §6` 待定）：X1 表现为纯消费播放器（架构已支持），归属细节待主创。
5. **【悔棋/读档回滚】**（`rewrite §9⑤`）：倾向不开放；若开放需改 §9 存档策略（独立功能）。
6. **【渲染字段 gl_compatibility】**（K1）：倾向 gl_compatibility，待 P3-2 复核。

---

## 16. 下一步建议（给主理人 · 游承峰）

1. **本 issue（P3-1）完成后，立即可派 P3-2（Godot 4.7 工程骨架）**：本架构 §2 目录结构 / §8 场景树 / §7 EventBus signals / §2.3 project.godot 配置是 P3-2 的直接输入。P3-2 须**逐一核对 §13 API 缺口表**并补 `docs/engine-reference/godot/4.7.md`。
2. **请主创优先审批 §15 第 1/2 项**（alert_mult / intel_cov 上限）——它们影响 C1 公式与经济防线，越早定越省 P5 返工。
3. **给严守真（QA）**：§9.2 一致性校验 + §6.3 数据校验 + §10 Loop A 走查是集成测试清单雏形；§13 API 缺口表是 P3-2 验收项。P4 起转可执行断言。
4. **建议补 `docs/engine-reference/godot/4.7.md`**（当前缺失）：把 §13 API 缺口一次性核对成「Godot 4.7 确切用法手册」，避免每个 P5 Story 重复踩 API 雷区。可作独立 issue。

---

*—— 程基岩（engineering-lead）· Phase 3 技术搭建（P3-1 主架构）· 待主创评审*
