# 关键屏幕 UX 规格 · 《赤壁·改写者》

> 阶段：Phase 4 · 预制作（P4-1）　|　执行角色：文策渊（design-strategist）
> 文档版本：v0.1（首版，待主创评审）　|　状态：可评审
> 基线锚点：`AGENTS.md`「设计基线」表（2D 俯视开放世界 ARPG / 改写·因果心脏 / 三国·赤壁 / PC 键鼠+手柄 / Godot 4.7 / Loop A）。
> 设计依赖（已交付，逐字沿用术语 / 数值 / 信号名）：
> - 概念与支柱：`docs/design/gdd/game-concept.md`（§1 术语、§2 三支柱、§5 Loop A、§9 待审批）。
> - 系统索引与五系统 GDD（**HUD 接口字段与变量名全部取自这里，零臆造**）：
>   `systems-index.md`；`systems/rewrite-causality.md`（§3.6 运行态 / §4 公式 / §6 信号 / §6.3 改写面板输入清单）；
>   `systems/mainline-quest.md`（§2.4 任务三层呈现 / §3.2 派发字段 / §6.2 任务信号）；
>   `systems/panel-progression.md`（§2.1 面板三层信息密度 / §2.2 技能树三分支 / §2.5 反馈钩子 / §2.6 改写面板 / §6 信号 / §6.5 系统 Tab 清单）；
>   `systems/combat.md`（§2.7 警戒四档 / §3.1 HP/BF 资源池 / §6.2 HP/BF/警戒只读 / §6.5 战斗 HUD / §6.6 衔接）；
>   `systems/open-world.md`（§6.6 大地图/对话/情报 / §6.7 P4-1 衔接 / §2.3 v_i 视觉化）。
> - 美术圣经（视觉锚点 / 配色 / 字体 / 分区 / 系统材质 / Δ 三档）：`docs/design/art/art-bible.md`（§0 双轨、§2 配色、§3 构图、§6 UI、§7 动效、§8 预算）。
> - 架构与输入：`docs/architecture/architecture.md`（§8 场景树、§9 存档）、`docs/architecture/adr-003-input-system.md`、`docs/architecture/control-manifest.md`（输入硬规则）、`docs/architecture/adr-004-node-and-signal-architecture.md`（EventBus/信号优先）。
> - 工程骨架现状：`game/project.godot`（InputMap 实际动作集）、`game/scenes/`（`boot.tscn`→`world.tscn`，`L5_SystemCanvas`→`HUD`/`RewritePrompt`/`TimelineStage`，`RewritePanel` CanvasLayer）。
> 本文件是 P5 制作 UI 的**唯一 UX 蓝图**：四关键屏幕（主菜单 / 核心 HUD / 系统面板 / 暂停）的流程图、线框、双套输入、数据接口、可访问性、认知负载、验收清单。所有控件名/字段名/信号名可追溯到上述文档，存疑处一律标 `[待审批]` / `[待程基岩确认]`。

---

## 0. 文档边界与使用方式

- **是**：四关键屏幕的 UX 规格（流程图 + 文字线框 + 双套输入映射 + 数据/状态接口约定 + 可访问性 + 认知负载 + 验收清单）。
- **不是**：不定义任何系统的机制/公式/数值（那归各系统 GDD 八节）；不产美术资产（归林绘澄）；不实现代码（归程基岩 P5）。
- **范围**：覆盖**垂直切片**（三国·赤壁单朝代 / Loop A 闭环）所需的四块关键屏幕。朝代热切换、多朝代存档迁移、商城/在线服务**明确不做**（`game-concept §7.3/§7.4`、`systems-index §1.2 X6`）——主菜单中的「朝代切换」仅作**禁用预留入口**（§5.4 待审批）。
- **设计分辨率**：1920×1080 基准绘制，`canvas_items` 拉伸 + `aspect=expand` 适配 4K/超宽（`control-manifest` 渲染节）。所有线框按 **16:9 安全区**标注，边距见 §3.4。

---

## 1. 设计基线与术语沿用（一致性锚）

### 1.1 术语（逐字沿用 `game-concept §1` + 五 GDD）

| 术语 | 含义 | UX 出现处 |
|---|---|---|
| 历史偏差 Δ / `delta_node` | 节点偏差分 ∈ [0,100] | HUD Δ 指示条、改写面板预览、结算屏 |
| 因果点 CP / `cp_balance` | 成长货币（点） | HUD CP 余额、系统面板兑换/技能树 |
| 改写能量 RE / `re` | 执行改写动词的再生资源 ∈ [0,`RE_max`] | HUD RE 条、改写面板动词消耗预览 |
| 战意 BF / `bf` | 战斗资源（点）∈ [0,`bf_max=100`] | HUD BF 条、术法快捷栏 `bf_cost` |
| 警戒档位 `alert_level` | {0未察觉,1警戒,2发现,3交战} → `alert_mult`{1.0,1.0,1.2,1.5}（[待审批]，`combat §2.7/§0`） | HUD 警戒指示 |
| 情报覆盖率 `intel_cov` | 节点情报 ∈ [0,1] | HUD intel 进度（按需）、情报 Tab |
| 改写节点 / `node_id` / `objective_short` | 主线派发的关键历史时刻 | HUD 节点名、任务 Tab、改写面板 |
| 改写蓝图 / `blueprint_id` | 玩家的意图声明 | 改写面板蓝图卡 |
| 反馈档位 I / `feedback_tier` | {minor,notable,critical} | 历史线演出弹层量级 |
| 系统（The System） | 穿越者携带的改写/因果系统 | 主菜单、旁白横幅、面板语气 |

### 1.2 支柱落地（逐字引用 `game-concept §2`，每屏标注）

| 支柱 | 一句话 | UX 落地（本规格负责） |
|---|---|---|
| ① **改写即玩法——"历史是你的可玩材料"** | 改写是玩家亲手操作的核心动词，系统让你改并告诉你改了多少。 | 改写面板（蓝图/动词/Δ 实时预览/确认）、结算屏、历史线演出。 |
| ② **系统流的掌控感 × 正剧底色——"穿越者孤独，但你看得见天平"** | 系统把赤壁翻译成可读变量；世界是正剧的。 | HUD 极简可读、系统材质冷光、记录员语气旁白；认知负载红线（§11）。 |
| ③ **赤壁是可丈量的沙盘——"开放世界即历史棋局"** | 开放世界是可读、可联动的因果棋盘，非问号清单。 | 方位/小地图（v_i 摘要）、任务因果链预览、情报采集提示。 |

> **基调红线**（`game-concept §9①` 待审批）：系统以「**冷峻第三方观测者/记录员**」人格出现，元幽默**仅限系统注释/UI 弹窗**，绝不渗入 NPC 台词与世界叙事。本规格所有系统文案（旁白/按钮/提示）按此倾向撰写，留接口供主创切换「带点毒舌」语气。

---

## 2. 全局 UX 原则（贯穿四屏）

> 四屏共享的设计纪律，避免每屏重复声明。

1. **双轨反差即 UI 语言**（`art-bible §0/§6`）：世界侧（轨道 A 暖色水墨）与系统侧（轨道 B 冷光）严格分层。**所有 UI/面板/HUD/演出 = 轨道 B 系统材质**，只允许在 `L5_SystemCanvas` 呈现（`control-manifest` 渲染节）；**唯一例外是主菜单/过场的开场卷轴**（轨道 A 开篇 + 冷光标题叠加并存，非混用）。
2. **系统材质规范**（`art-bible §6.1`）：面板底=半透明网格墨蓝（10–20% 不透明）；边框=系统青蓝硬边 + 数据投影失真边缘；文字=数据白等宽字（数值/变量）+ 冷光青字（标签）；装饰=扫描线/坐标网格/十字准星/偶发冷光粒子；开合=「冷光扫描展开」200–350ms；数值跳动=打字机/滚动即时。
3. **信息密度分级**（`panel-progression §2.1`，认知过载红线）：核心（常驻）/ 进阶（按需展开）/ 隐藏（默认折叠）三层。**严禁**把内部数值（`d_i`/`w_i` 权重、`condition` 表达式、敌人 ATK/DEF）塞进核心/进阶层。
4. **信号驱动，禁轮询**（`control-manifest` 信号节、`adr-004`）：HUD/面板订阅 EventBus 信号刷新，**不每帧读生产方属性**。详见 §10 数据接口。
5. **双设备零分支**（`adr-003` 决定1）：代码只查 InputMap 动作名，不碰原始键码；UI 提示图标据「最后输入设备」动态切键鼠/手柄两套（`adr-003` 决定4）。
6. **焦点链完整**（`control-manifest` 输入节）：改写面板/系统面板/暂停菜单须方向键焦点导航（手柄无鼠标）；`ui_focus_next`/`ui_focus_previous` 链完整，**焦点框可见**（冷光描边）。
7. **可暂停性**（`adr-003` 决定5）：`ui_pause` 触发 `SceneTree.paused` + 暂停菜单（CanvasLayer，`process_mode = PROCESS_MODE_WHEN_PAUSED` ⚠️待核精确枚举名，`adr-003` 缺口）。

---

## 3. 屏间跳转矩阵（Screen Map）

### 3.1 屏幕清单与归属场景节点（对齐 `architecture §8`）

| 屏 ID | 屏 | 场景节点（建议，对齐 `architecture §8.2/§8.3`） | CanvasLayer | 范围 |
|---|---|---|---|---|
| **MM** | 主菜单 | `MainMenu`（**新增**，当前工程仅 `boot.tscn`；建议 P4/P5 落 `scenes/ui/main_menu.tscn`） | 独立全屏 | 垂直切片 |
| **HUD** | 核心 HUD（战斗态常驻） | `world.tscn` → `L5_SystemCanvas/HUD`（Control，`architecture §8.2`） | `L5_SystemCanvas` | 垂直切片 |
| **SP** | 系统面板（5 Tab + 改写面板） | `world.tscn` → `RewritePanel`（CanvasLayer，`architecture §8.3`） | `RewritePanel`（覆于 `L5` 之上） | 垂直切片 |
| **PS** | 暂停菜单 | `PauseMenu`（建议落 `scenes/ui/pause_menu.tscn`，运行时实例化入 `L5_SystemCanvas` 子层） | 独立（`PROCESS_MODE_WHEN_PAUSED`） | 垂直切片 |
| **DLG** | 对话界面（横切，非四关键屏） | `RewritePanel` 同层叠层 | 同 SP | 垂直切片（本规格仅作接口约定，线框从简） |
| **STG** | 历史线分叉演出（模态） | `L5_SystemCanvas/TimelineStage`（`architecture §8.3`） | `L5_SystemCanvas` | 垂直切片 |

> ⚠️ **`MainMenu` / `PauseMenu` 场景当前不存在**（`game/scenes/` 只有 `boot.tscn`、`world.tscn`）。本规格定义其 UX，落地场景由 P5 按本规格创建（`scenes/ui/main_menu.tscn` / `pause_menu.tscn`），程基岩确认节点命名后实现。

### 3.2 屏间跳转矩阵（入口 → 流转 → 退出）

> 矩阵读法：行=当前屏，列=目标屏，格内=触发动作（输入动作 / 系统信号）。`—`=不可直达；`×`=自身。

| 从＼到 | MM | HUD | SP(改写面板) | SP(系统 Tab) | PS | STG | DLG |
|---|---|---|---|---|---|---|---|
| **MM** | × | 开始新存档 / 继续→`change_scene_to(world)` `architecture §8.4` | — | — | 设置（MM 内嵌或→PS）| — | — |
| **HUD** | 返回主菜单（经 PS） | × | 进入改写场所触发冷光环→自动呼出改写面板 `combat §6.6`/`open-world §6.7` | `ui_menu`（Tab/Select）打开系统面板默认 Tab | `ui_pause`（P/Start） | 被动（`feedback_tier` notable/critical）| `dialogue_started`（S5→S3） |
| **SP(改写)** | 返回主菜单（经 PS） | `ui_cancel`（Esc/B）回 HUD；改写场所离开则自动收 | × | `panel_tab_next`（Q/LB）切 Tab；`ui_menu` 切系统 Tab | `ui_pause` | `node_committed`→结算→`timeline_branch_play` | — |
| **SP(系统)** | 返回主菜单（经 PS） | `ui_cancel` / `ui_menu` 回 HUD | 进入场所或 `panel_tab_next` 回改写 Tab | ×（Tab 间切换） | `ui_pause` | — | — |
| **PS** | 返回主菜单（确认弹窗） | 继续游戏→`unpause` | ×（暂停时 SP 关闭）| ×（暂停时 SP 关闭）| × | — | — |
| **STG** | —（模态，禁止跳转） | 演出结束→自动回 HUD | — | — | 演出中禁暂停（或 `ui_cancel` 跳过，见 §8.4）| × | — |
| **DLG** | — | `ui_cancel` 结束对话→回 HUD | — | — | `ui_pause`（对话可暂停）| — | × |

**全局退出约定**：
- **任何战斗态屏（HUD/SP改写）→ 暂停**：恒经 `ui_pause`（P/Start），不设其他入口（防误触）。
- **暂停 → 主菜单**：必须经**确认弹窗**（§9.3 未存档进度将丢失；`architecture §9.2` 存档触发只在 `node_resolved`/手动存档）。
- **改写面板 ↔ 系统 Tab**：二者**不同时全屏**（`panel-progression §2.6` 认知过载防线）；改写面板可呼出系统 Tab 的「快速兑换 RE」子页（§7.3）。
- **历史线演出（STG）= 强模态**：notable/critical 演出期间**禁用**其他面板跳转，仅允许 `ui_cancel` 跳过（见 §8.4）。

---

## 4. 关键屏幕一 · 主菜单（MM）

### 4.1 定位与支柱

- **定位**：垂直切片的**第一印象**——开场即建立「双轨反差」风格签名与 litRPG 基调（支柱②），并为 Loop A 起步提供入口。
- **支柱落地**：②（记录员语气冷光标题 × 水墨卷轴）、③（存档槽暗示「历史棋局」可重玩）。

### 4.2 用户流程图（入口 / 流转 / 退出）

```
                  ┌──────────────────────────────────────────┐
                  ▼                                          │
            ┌───────────┐   ui_accept(开始新游戏)            │
 boot.tscn▶│  主菜单 MM │─────▶ 选存档槽(空)──────────────┐   │
            │ (默认焦点 │       │ 确认覆盖弹窗(若槽非空) │   │
            │  =继续)   │◀──────┘ ui_cancel 回退         │   │
            └─────┬─────┘                                ▼   │
                  │ ui_up/down 选条目            change_scene_to(world)
                  │                                  (SaveManager 注入 baseline/存档)
   ┌──────────────┼──────────────┬─────────────┐        │
   ▼              ▼              ▼             ▼        │
 [继续游戏]    [开始新游戏]    [设置]       [退出]      │
   │ 选最近存档   │ 选空槽        │ MM 内嵌       │ 确认弹窗 │
   │ →world      │ →world        │ 或→PS设置    │ →关闭进程│
   │             │               │              │          │
   └─────────────┴───────────────┴──────────────┴──────────┘
   （存档槽面板内：[朝代切换] 禁用预留入口 → 见 §5.4 待审批）
```

- **入口**：`boot.tscn` 启动序列完成后（`architecture §8.4`：Autoload 就绪 → DynastyLoader 加载 → 若有最近存档则「继续」默认聚焦，否则「开始新游戏」默认聚焦）。
- **流转**：方向键/摇杆 `ui_up`/`ui_down` 切条目；`ui_accept` 确认；`ui_cancel` 回上级（槽位列表→主菜单条目）。
- **退出**：① [开始新游戏]/[继续] → `change_scene_to(world.tscn)`；② [退出] → 确认弹窗 → `get_tree().quit()`（⚠️待程基岩确认退出 API）。

### 4.3 线框（文字 + ASCII，标注分区 / 焦点 / 安全边距）

```
1920×1080 · 16:9 · 安全区边距 48px（四面，对齐 art-bible §3.1）

+0============================================================================0+
|▲48px 安全区                                                                 |
|        ┌────────────── 轨道 A 开场卷轴（水墨 / 留白 / 江雾）──────────────┐    |
|        │                          （动态：墨晕缓慢晕染）                  │    |   ← 背景层（轨道 A 暖色）
|        │     ╔══════════════════════════════════════════════╗             │    |
|        │     ║   《赤壁·改写者》                            ║  ◀ 系统冷光标题（轨道 B）   |
|        │     ║   [记录员·系统 v0.1 · 已就位]  ← litRPG 基调 ║             │    |
|        │     ╚══════════════════════════════════════════════╝             │    |
|        │                                                                │    |
|        │            ┌───── 主菜单条目（冷光描边，垂直居中偏左）─────┐    │    |
|        │            │ ▶ 继续游戏        （默认焦点，若有存档）       │    │    |   ← 焦点元素（冷光环描边）
|        │            │   开始新游戏                                   │    │    |
|        │            │   存档槽位                                     │    │    |
|        │            │   设置                                         │    │    |
|        │            │   退出游戏                                     │    │    |
|        │            └───────────────────────────────────────────────┘    │    |
|        │                                                                │    |
|        │   底部冷光数据条（等宽字）：                                   │    |   ← 系统侧（轨道 B）
|        │   > 朝代: dyn_threekingdoms_chibi · 存档槽: 2/3 已用 · v0.1   │    |    |
|        │   > 「历史基准线已载入。记录员待命。」  ◀ 记录员语气           │    |
|        └────────────────────────────────────────────────────────────────┘    |
|▼48px 安全区                                                                 |
+0============================================================================0+
```

**分区标注**：
- **背景层（轨道 A）**：水墨开场卷轴 + 留白江雾（VA-1/VA-2，`art-bible §1.2`）。冷光**不污染**卷轴（`art-bible §0`）。
- **标题区**：系统冷光标题 + litRPG 元幽默副标（记录员语气，待审批①）。
- **条目区（焦点）**：5 条主菜单项，冷光描边焦点框；默认焦点 = 继续（有存档）/ 开始新游戏（无存档）。
- **底部数据条**：朝代 / 存档槽占用 / 版本 / 记录员一句话（与系统面板同源系统材质）。

**「存档槽位」子面板线框**（`ui_accept` 进入后）：

```
        ┌──────────────── 存档槽位（系统材质面板）─────────────────┐
        │  存档管理 · dyn_threekingdoms_chibi        [朝代切换 ⌀禁用] │  ◀ §5.4 待审批
        │ ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
        │ │ 槽 1     │ │ 槽 2 ★最近│ │ 槽 3     │  ◀ 每槽冷光卡片   │
        │ │ 章节:ch_x│ │ 章节:ch_x│ │ （空）   │                   │
        │ │ Δ 累计:..│ │ Δ 累计:..│ │ 新存档   │                   │
        │ │ 世界线:稳│ │ 世界线:震荡│ │          │                   │
        │ │ 时间:... │ │ 时间:... │ │          │                   │
        │ └──────────┘ └──────────┘ └──────────┘                   │
        │  ▶ 选中槽 → [载入] [覆盖新存档]      [返回 ui_cancel]      │
        └──────────────────────────────────────────────────────────┘
```

- 每槽展示（读 `save_state_*`，`architecture §9.1`）：章节进度（C2 `chapter_progress`）、Δ 累计（C1 `resolved_nodes` Σ `delta_node`）、世界线状态（C1 `critical_flags.worldline_shaken`）、最后存档时间、朝代。
- **覆盖确认弹窗**（§9.3 模态）：空槽直接写；非空槽需二次确认。

### 4.4 输入映射（主菜单，对齐 §9 总表）

| 动作 | 键鼠 | 手柄 | 行为 |
|---|---|---|---|
| `ui_up`/`ui_down` | ↑/↓ | 左摇杆/D-pad ↑↓ | 切条目 |
| `ui_accept` | Enter | A(□? 见§9注) | 确认/进入 |
| `ui_cancel` | Esc | B | 回上级/取消 |
| `ui_left`/`ui_right` | ←/→ | 左摇杆/D-pad ←→ | 槽位面板内选槽 |
| （无 `ui_pause`） | — | — | 主菜单不响应暂停 |

### 4.5 litRPG 基调落地（守 `game-concept §9①` 待审批）

- 标题副标「[记录员·系统 v0.1 · 已就位]」+ 底部「历史基准线已载入。记录员待命。」——**冷峻第三方观测者**倾向。
- **元幽默仅限系统侧**（标题/数据条/按钮 tooltip），**绝不**出现在卷轴画面或会渗入世界的位置。
- 留接口：若主创定「带点毒舌」语气（`game-concept §9①` 待定），仅改文案数据（`game/data/panel/ui_strings.tres` 类，`panel-progression §3.5`），不改 UI 结构。

---

## 5. 关键屏幕二 · 核心 HUD（战斗态常驻）

### 5.1 定位与支柱

- **定位**：俯视角实时战斗时的**常驻可读层**。极简贴边，世界优先（`art-bible §6.2` HUD 行）。核心是「**让玩家看得见天平**」（支柱②）+ 「**一眼定位改写节点**」（支柱②胜任）。
- **支柱落地**：②（Δ/CP/RE 可读、极简不挡世界）、③（方位指引 + v_i 摘要暗示棋局）、①（节点名常驻提示改写机会）。

### 5.2 信息分区与三层密度（对齐 `panel-progression §2.1` / `combat §6.5`）

> ⚠️ **认知过载硬约束**（`panel-progression §2.1`）：**核心资源条恒定 ≤ 5 个信息单元**——HP / BF / CP / 当前节点名+Δ 指示条 / RE 条。小地图/警戒/intel 等为**空间类**或**按需**元素，不计入该 5 单元（见 §5.7 一致性张力）。

| 层 | 元素 | 数据源（系统 / 信号，见 §10） | 默认态 |
|---|---|---|---|
| **核心·资源条**（左下贴边） | HP 条、BF 条、CP 余额（数值+小条）、当前节点名 + Δ 指示条、RE 条 | S4 `hp_changed`/`bf_changed`、S3 `cp_balance_changed`、S2 `quest_objective_updated`、S1 `deviation_recomputed`、S1 `re`（`rewrite §3.6`） | 常驻 |
| **核心·方位**（屏缘） | 目标场所冷光环指引箭头（off-screen indicator） | S2 `quest_target_scene_set` → S5 冷光环 `art-bible §3.3` | 常驻（仅活跃节点时） |
| **进阶·战斗**（按需，右上） | 术法快捷栏（`ability_id` + `bf_cost` + cooldown 蒙层）、警戒指示 | S3 `ability_unlocked`、S4 `combat_alert_changed` | 战斗/警戒态显示；`alert_level≤1` 隐藏警戒 |
| **进阶·空间**（可收起，右上角） | 小地图（据点 + 活跃场所冷光环 + v_i 摘要） | S5 `minimap_updated` | 默认展开（非战斗）/ 可一键收起（战斗时） |
| **进阶·横幅**（顶部居中，短时） | 系统派单/完成/消失/情报采集/技能解锁提示 | S2 `quest_dispatch_voiced`、S3 `skill_unlocked_toast`、S5 `intel_collected_voiced` | 事件触发，自动消退 |
| **隐藏**（不进 HUD） | 内部数值（d_i/w_i、敌人 ATK/DEF、`disc`/`intel_cov` 精确值） | 系统面板折叠层查 | 不显示 |

### 5.3 线框（核心 HUD，ASCII）

```
1920×1080 · HUD 贴边，安全区边距 32px（HUD 略小于主菜单，贴边更紧）

+0============================================================================0+
|        ╔══ 系统横幅（顶部居中，短时·冷光扫描展开）══╗                          |   ← §5.6 横幅
|        ║「已锁定目标：借东风。当前节点偏差归零。记录员就位。」║  (3-4s 自动消退)   |
|        ╚══════════════════════════════════════════╝                          |
|                          ▲ 目标场所指引箭头（屏缘冷光）▲                      |   ← §5.5 方位
|                                                                             |
|                                                                             |
|                     【 轨道 A 世界（玩家+战场+冷光环改写场所） 】              |
|                                                                             |
|     [小地图 ◧]                                        [术法快捷栏 ▣]          |   ← 进阶·空间/战斗（右上）
|     夏口·乌林·赤壁                                    [青蓝爆发] (bf_cost 冷光)  |
|     ▣活跃:七星坛                                      冷却蒙层(灰)             |
|     连舟:全连 风向:东南（v_i 摘要）                                           |
|                                                                             |
|                                                                             |
|   ┌────────── 核心 HUD 资源条（左下贴边·冷光）──────────────────┐            |
|   │  HP ████████████░░  82/100     战意 BF ██████████░░  74/100  │            |   ← 核心·资源（≤5单元）
|   │  CP 余额 ▤ 180   RE ████████░░ 60/RE_max                     │            |
|   │  ──────────────────────────────────────────────              │            |
|   │  ◈ 节点 n2_east_wind·借东风    Δ ▓▓▓░░░░░░░ 32/100          │            |
|   │     「前往七星坛，决定东风是否借成」(objective_short)         │            |
|   │  ⚠ 警戒中·改写消耗 ×1.2   (alert_level=2 时才显，按需)       │            |   ← 进阶·战斗（警戒）
|   └─────────────────────────────────────────────────────────────┘            |
|   ▼ 底部安全区                                                              |
+0============================================================================0+
```

**焦点元素**：核心资源条 = 玩家**永远余光可读**的最高对比度（冷光白/青 on 网格墨蓝半透底，WCAG AA，`art-bible §6.3`）。

### 5.4 资源条细规（变量名对齐五 GDD）

| UI 元素 | 显示 | 数据源 / 信号 | 刷新 | 单位/域 |
|---|---|---|---|---|
| **HP 条** | `new_hp/max_hp` | S4 `hp_changed(new_hp,max_hp)` | 推送（受击/再生） | 点，`hp_max=100`（`combat §3.1`） |
| **BF（战意）条** | `new_bf/max_bf` | S4 `bf_changed(new_bf,max_bf)` | 推送 | 点，`bf_max=100`（`combat §3.1`） |
| **CP 余额** | `new_balance` | S3 `cp_balance_changed(new_balance,delta)` | 推送（入账/消耗） | 点（`panel §6.4`） |
| **Δ 指示条** | `delta_node` 实时 | S1 `deviation_recomputed(node_id,delta_node,is_preview)` | 推送；预览态（`is_preview=true`）即时跳动 | 分 [0,100]（`rewrite §4.1`） |
| **RE 条** | `re/RE_max` | S1 运行态 `re`（`rewrite §3.6`）；消耗/再生推送 | 推送 | 点 [0,`RE_max`]（`rewrite §4.3`） |
| **当前节点名+目标** | `objective_short` | S2 `quest_objective_updated(node_id,objective_short,objective_long)` | 推送（节点派发/消失） | 文案（`mainline §3.2`） |
| **警戒指示** | `alert_level` 文案 + `alert_mult` | S4 `combat_alert_changed(alert_level,alert_mult)` | 推送（跨档） | 档 {0,1,2,3}；仅 `≥2` 显示（`combat §6.5`） |
| **术法快捷栏** | `ability_id`+`bf_cost`+cooldown | S3 `ability_unlocked`；S4 释放态 | 推送；冷却每帧更新蒙层 | MVP 1 格 / 目标态多格（`combat §6.6`） |
| **小地图** | 据点/活跃场所/v_i 摘要 | S5 `minimap_updated(strongholds_visible,active_node_scene)` | 推送（揭示/节点激活）；v_i 摘要随 S1 `variable_changed` | `open-world §6.6` |

### 5.5 方位指引（满足 issue「方位」需求，不破 ≤5 单元）

- **目标场所冷光环 + 屏缘箭头**（`open-world §2.3`/`art-bible §3.3`）：玩家面向偏离活跃节点场所时，屏缘显示**冷光指引箭头**（L5，非资源条单元）；接近后箭头淡出、世界内冷光环浮现。
- 箭头数据：S2 `quest_target_scene_set(node_id,target_scene)` → S5 计算玩家与场所相对方位 → HUD 读 S5 方位只读契约（`[待程基岩确认]` 信号名）。
- **节点消失**（`node_vanished`）：箭头移除，横幅播消失旁白（S2 `quest_node_vanished_voiced`）。

### 5.6 系统横幅（顶部居中，短时模态）

- 触发与文案源（X1 表现，S2/S3/S5 产文案）：
  - 派单：S2 `quest_dispatch_voiced(node_id,system_dispatch_voice)`。
  - 完成：S2 `system_complete_voice`（经 `node_resolved`）。
  - 消失：S2 `quest_node_vanished_voiced`。
  - 情报采集：S5 `intel_collected_voiced(intel_entry,lore_text)`。
  - 技能解锁：S3 `skill_unlocked_toast(skill_id,display_name)`。
- **节制**（`panel-progression §2.5` 演出过频防线）：同屏**最多 1 条**横幅，新事件排队（队列≤2）；3–4s 自动消退或 `ui_cancel` 手动关。critical 演出（STG）**优先级最高**，压制普通横幅。

### 5.7 一致性张力：小地图 / intel_cov vs `panel §2.1` ≤5 单元

> **跨 GDD 张力（写入 §13 一致性备注）**：
> - `panel-progression §2.1` 锁定核心资源条**恒定 ≤5 单元**（HP/BF/CP/节点名+Δ/RE），**未含小地图与 intel_cov**。
> - `open-world §6.7` 把「情报计数 HUD（intel_cov 进度条）」列为「呼应 panel §6.5 核心 HUD」——隐含 intel_cov 也常驻，与 §2.1 的 5 单元口径**轻微冲突**。
> - 本 issue 又要求 HUD 含「小地图/方位」。
>
> **本规格的裁决（待主创/程基岩确认）**：
> 1. **核心资源条严守 ≤5 单元**（HP/BF/CP/节点名+Δ/RE）——这是 `panel §2.1` 的认知过载硬约束，不放宽。
> 2. **方位**用屏缘冷光箭头（空间指示，非资源条单元）满足，不计入 5 单元。
> 3. **小地图**作为**右上角可收起**的空间类元素（默认非战斗展开 / 战斗一键收起），与资源条**分属不同信息类别**（空间 vs 数值态），不挤占 5 单元；但**默认收起选项**写入设置（X5 可访问性，§11）。
> 4. **intel_cov 进度条**不进核心资源条；改作**进入改写场所/打开改写面板时**的情境化显示（§7.2），与 `intel_cov` 门控蓝图可见性（`rewrite §3.3 unlock_intel_cov`）同屏呼应。HUD 仅在 intel_cov 变化时以**短横幅**提示增量（§5.6），不做常驻条。

---

## 6. 关键屏幕三 · 系统面板（SP）

### 6.1 定位与支柱

- **定位**：「系统把赤壁翻译成可读变量」的化身（支柱②）。包含**改写面板**（节点激活情境化）与**系统 Tab**（非战斗配置）两大子形态，二者不同时全屏（`panel-progression §2.6`）。
- **支柱落地**：②（面板可读、系统材质）、①（改写面板=核心动词操作台）、③（任务 Tab 因果链预览、情报 Tab 探索→改写桥）。
- **归属节点**：`RewritePanel`（CanvasLayer，`architecture §8.3`），覆于 `L5_SystemCanvas` 之上。

### 6.2 系统面板子形态与打开层级

| 子形态 | 触发 | 内容 | 打开层级 | 关闭 |
|---|---|---|---|---|
| **改写面板**（节点激活情境化） | 进入改写场所冷光环（S5→自动呼出，`combat §6.6`）/ `ui_accept` 介入 | 蓝图卡 + 动词 + Δ 预览 + 确认 | L5 之上，**世界半透**（仍可见战场） | `ui_cancel` / 离开场所自动收 |
| **系统 Tab**（非战斗配置） | `ui_menu`（Tab/Select） | 偏差 / 技能树 / 兑换 / 情报 / 任务 5 Tab | L5 之上，**世界暂停渲染焦点**（不暂停游戏，仅 UI 聚焦） | `ui_menu`/`ui_cancel` 回 HUD |
| **历史线演出（STG）**（模态） | `feedback_tier` notable/critical | 横向卷轴分叉动画 | **强模态**（压制其他） | 自动结束 / `ui_cancel` 跳过 |

> **焦点切换**：改写面板↔系统 Tab 经 `panel_tab_next`（Q/LB）或 `ui_menu` 切换；**禁**鼠标点击跨面板（手柄无鼠标，`control-manifest` 焦点链节）。Tab 间 `ui_left`/`ui_right`（键鼠）/ D-pad（手柄）切页；面板内 `ui_up`/`ui_down` 焦点导航，`ui_focus_next`/`previous` 备用。

### 6.3 改写面板线框（核心动词操作台 · 对齐 `rewrite-causality §6.3` + `panel-progression §2.6`）

```
+0==================== 改写面板（RewritePanel · 冷光材质）====================0+
| ▌n2_east_wind · 借东风        「已锁定目标：借东风…记录员就位。」(派单语气)    |
| ──────────────────────────────────────────────────────────────────────── |
| 情报覆盖率 intel_cov ▓▓▓▓▓░░░░░ 0.46   有效蓝图门槛 unlock_intel_cov=0.6     |  ← §5.7 情境化 intel_cov
| ┌── 可用蓝图（按 intel_cov 过滤·冷光卡片，方向键焦点）──────────────────┐  |
| │ ▶ [bp_baseline_keep] 维持原线      target: v_wind=东南  M预估:高 Δ≈0   │  |  ← target_vars + M 预估
| │   [bp_player_self_wind] 由你借东风 target: v_wind=东南(玩家) M:? Δ≈+30│  |     (冷光描边=选中)
| │   [bp_fire_fail] ✕ 火攻失败        需 intel_cov≥0.6（当前不足·锁定）   │  |     (灰蒙层=锁定)
| └────────────────────────────────────────────────────────────────────┘  |
| ┌── 可用动词（verb_id + cost_RE 预览）─────────────────────────────────┐  |
| │   [verb_smash_altar] 破坏七星坛   cost_RE: 18  ▶选中                  │  |  ← cost_RE 实时（rewrite §4.3）
| │   [verb_self_borrow_wind] 自借东风 cost_RE: 30  需 ability: magic_wind│  |     (requires.ability 校验)
| │   [verb_block_kongming] 截断诸葛   cost_RE: 22                        │  |
| └────────────────────────────────────────────────────────────────────┘  |
|   RE ████████░░ 60/RE_max   尝试 attempts_used 1/3                        |  ← RE + max_attempts 预警
| ┌── 实时预览（is_preview=true · 不发CP不锁因果链）─────────────────────┐  |
| │   若执行 [verb_self_borrow_wind]：                                    │  |  ← deviation_recomputed 预览
| │   v_wind: 东南→东南(玩家)   Δ_node: ▓▓▓░░░░░ 32/100 (notable)         │  |     (冷光数值即时跳动)
| │   ⚠ 触发系统特殊旁白：self_replacement（功劳归于玩家）               │  |     (special_flags)
| └────────────────────────────────────────────────────────────────────┘  |
|              [ 快速兑换 RE ▷ ] (呼出兑换子页)        [ ✦ 确认改写 ]        |  ← 确认 → node_committed(S3→S1)
|                                        ui_accept=确认  ui_cancel=收起面板  |
+0============================================================================0+
```

**关键控件契约**（全部对齐 GDD，零臆造）：
- 蓝图卡：读 S1 蓝图数据（`blueprint_id`/`intent_label`/`target_vars`/`m_weights`/`unlock_intel_cov`/`special_flags`，`rewrite §3.3`）；选中→ S3 发 `blueprint_declared(node_id,blueprint_id)`（经 S1，`panel §6.1`）。
- 动词：读 S1 `verbs[]` + `cost_base`（`rewrite §3.2/§3.5`）；`requires.ability` 校验（`ability_system_magic_wind` 等）。
- Δ 预览：订阅 S1 `deviation_recomputed(node_id,delta_node,is_preview=true)`。
- M 预估：若可算，显示 `intent_match_computed` 预估（`rewrite §4.2`）。
- 「确认改写」：S3 发 `node_committed(node_id)`（S3→S1，`panel §6.3` 确认 S3 为玩家确认发出方）。
- 「快速兑换 RE」：呼出兑换 Tab 子页（不离开改写面板，`panel §2.3/§2.6`）。
- **信息密度**：核心（节点名/蓝图/动词/Δ 预览/确认）显眼；进阶（M 预估/`unlock_intel_cov` 门槛数值）次级；隐藏（`d_i`/`w_i`/`condition`）默认折叠（`panel §2.1`）。

### 6.4 历史线分叉演出（STG · 模态弹层 · 对齐 `panel-progression §2.5`）

```
+0================ 历史线分叉演出（TimelineStage · 强模态）================0+
|                                                                          |
|     ───── 墨色历史线（轨道 A）────  ▼ 当前节点 n2_east_wind              |
|                    │                                                      |
|          ┌─────────┴─────────┐  冷光偏差节点（轨道 B）                   |
|          ▼                   ▼                                            |
|     [ 基准:火攻成功 ]   [ 自借:功劳归玩家 ]   ← 分叉动画(冷光展开)        |
|                                                                          |
|   > 「节点已确认。偏差已记录，因果已传递。」  (X1 旁白·记录员)            |
|   > Δ_node 32(notable) · M 0.9 · CP_earned +96 · 因果→N3 华容道【出现】  |  ← 结算数值（节点锁定后）
|                                                                          |
|                      [ ui_accept 跳过/继续 ]   [ ui_cancel 跳过 ]         |
+0========================================================================0+
```

- **量级三档**（`feedback_tier` → `art-bible §2.5`/`rewrite §4.4`）：
  - `minor`（Δ<20）：**不进 STG**，仅 HUD 数值跳动 + 短横幅（`panel §2.5`）。
  - `notable`（20≤Δ<80）：短横向卷轴演出（≤3s）+ X1 短旁白。
  - `critical`（Δ≥80）：长演出（4–6s）+ 世界线震荡 glitch（橙红警示 + 边缘撕裂）+ X1 长旁白「世界线剧烈震荡」（`game-concept §6.3`）。
- **节制**（`panel §2.5`）：连续 critical → 后续演出**降级压缩**（缩时/合并旁白）防疲劳。
- **跳过**：`ui_accept`/`ui_cancel` 跳过演出（保留数值结算），但**不可跳过**结算数值显示（保证反馈可读）。

### 6.5 系统 Tab 子形态线框（偏差 / 技能树 / 兑换 / 情报 / 任务）

> 5 Tab 布局统一：左侧 Tab 栏（冷光）+ 主内容区。`panel_tab_next`（Q/LB）/ `ui_left`/`ui_right` 切 Tab。

**① 偏差 Tab**（读 S1 resolved）：
```
[偏差] 技能树 兑换 情报 任务
┌─ 当前节点 n2_east_wind ────────────────────┐
│ Δ_node 32/100 (notable)   M 0.9   I: notable │
│ 世界线: worldline_shaken=false              │
├─ 历史结算记录 ──────────────────────────────┤
│ n1_chain_scheme  Δ40  CP+90  bp_reveal      │  ← resolved_nodes 只读
│ ...                                          │
└─────────────────────────────────────────────┘
```

**② 技能树 Tab**（`panel §2.2` 三分支 · 杜绝主导策略）：
```
偏差 [技能树] 兑换 情报 任务
       efficiency(改写效率)     magic(系统术法)     cognition(认知/情报)
            ●━━━●━━━○              ●━━━○                ●━━━●━━━○
        disc↑ RE_max↑          解锁术法/动词        intel_gain_mult↑
        (已亮=解锁/描边脉动=可解锁/暗=锁定)         blueprint_insight↑
   ┌ hover 节点 ─────────────────┐   ⚠ 无最优路径高亮（§13.2 主导策略防线）
   │ skill_eff_re_discount_t1    │
   │ cost_skill: 80 CP (growth1.5)│  grants: disc +0.1 (封顶0.5)
   └─────────────────────────────┘   [ui_accept 解锁] (CP 不足则灰)
```

**③ 兑换 Tab**（`panel §2.3` RE 补充 · 递增防刷）：
```
偏差 技能树 [兑换] 情报 任务
┌─ CP 余额 180 ──────────────────────────────┐
│ ▶ RE 补充   cost_re_refill: 40 CP (本节点已兑 0 次) │  ← §4.6 递增预览
│   下次: 60 CP · 下下次: 80 CP（递增曲线）          │
│ [ui_accept 兑换 → re += 回 RE_max]                │
└──────────────────────────────────────────────────┘
```

**④ 情报 Tab**（`panel §2.4` 探索→改写桥）：
```
偏差 技能树 兑换 [情报] 任务
┌─ effective_intel_gain_mult: 1.2  effective_blueprint_insight: 0.0 ─┐
│ ▶ 采集速率强化  cost: 60CP  → intel_gain_mult +0.2 (封顶2.0)        │
│ ▶ 蓝图洞察      cost: 70CP  → blueprint_insight +0.1 (封顶0.3)      │
│ ▶ 因果链预览强化 cost: 50CP  → 任务面板预览更详细（UI 表现）         │
└────────────────────────────────────────────────────────────────────┘
```

**⑤ 任务 Tab**（读 S2，`mainline §2.4` 三层呈现）：
```
偏差 技能树 兑换 情报 [任务]
┌─ 章节 ch_chibi_war · 进度 ▓▓▓░░ 40% (P_ch) ─────────────────┐
│ ◈ 当前节点 n2_east_wind·借东风                              │
│   短目标: 前往七星坛，决定东风是否借成                       │  ← objective_short（核心）
│   长目标: 周瑜欲火攻却缺东南风…此节点成败将决定华容道是否出现 │  ← objective_long（进阶）
│   因果预览: 借东风成败 → 决定华容道是否出现  (causal_preview_hint)│
│ ▸ [折叠] 完整因果链规则（隐藏层，Explorer 向）               │
└─────────────────────────────────────────────────────────────┘
```

### 6.6 模态弹窗约定（SP 内）

- **确认改写弹窗**（点「确认改写」后，可选二次确认高危蓝图）：
  - 文案：记录员语气「即将锁定节点。偏差将被记录，因果将传递。此操作【不可悔棋】（已锁定节点）。」
  - 按钮：[确认 node_committed] / [返回]。
- **CP 不足/RE 不足提示**：动词/解锁/兑换按钮灰禁 + tooltip「RE 不足：需 30，当前 60…」（实际 60>30 则可，此处示意不足态）；不可点击时焦点跳过。
- **蓝图锁定（intel_cov 不足）**：卡片灰蒙层 + tooltip「情报不足：需 intel_cov≥0.6，当前 0.46。继续探索以揭示精确蓝图。」

---

## 7. 关键屏幕四 · 暂停菜单（PS）

### 7.1 定位与支柱

- **定位**：战斗/探索中按 `ui_pause`（P/Start）唤出。**手柄完全可导航**（基线）。提供继续 / 设置 / 手动存档 / 返回主菜单。
- **支柱落地**：②（记录员语气冷光菜单，不破坏正剧）、X4 存档入口（`architecture §9.2` 手动存档）。

### 7.2 用户流程图

```
   任意战斗/探索态(HUD/SP)
        │ ui_pause (P/Start)
        ▼ SceneTree.paused=true · PauseMenu(PROCESS_MODE_WHEN_PAUSED)
   ┌───────── 暂停菜单 PS ─────────┐
   │  ▶ 继续              (unpause) │── ui_accept ──▶ 回原屏(HUD/SP)
   │    手动存档          →选槽     │──▶ 存档子面板(同主菜单槽位 UI)
   │    设置              →设置子页  │──▶ 设置(键位/音量/字幕/缩放/对比度)
   │    返回主菜单        ⚠确认弹窗  │──▶ 确认(未存档进度丢失) →change_scene_to(main_menu)
   └───────────────────────────────┘
        │ ui_pause/ui_cancel
        ▼ 继续(unpause)回原屏
```

- **入口**：`ui_pause`（P / 手柄 Start）。
- **流转**：`ui_up`/`ui_down` 切条目；`ui_accept` 进入；`ui_cancel`/`ui_pause` 回上级或继续。
- **退出**：① 继续 → `unpause`；② 返回主菜单 → **确认弹窗**（`architecture §9.2`：存档只在 `node_resolved`/手动，未存档改写将丢）→ `change_scene_to(main_menu.tscn)`。

### 7.3 线框（暂停菜单）

```
+0==================== 暂停菜单（PauseMenu · 冷光材质）=====================0+
|        （背景: 世界静止画面 + 半透网格墨蓝遮罩 40%，冷光不污染）            |
|                                                                          |
|        ╔══════════════════════════════════════════╗                       |
|        ║   ◈ 暂停 · 记录员待命                    ║   ← 记录员语气        |
|        ╚══════════════════════════════════════════╝                       |
|                                                                          |
|            ┌───── 暂停条目（冷光描边焦点）─────┐                          |
|            │ ▶ 继续游戏                        │   ← 默认焦点             |
|            │   手动存档                        │                          |
|            │   设置                            │                          |
|            │   返回主菜单                      │   ⚠ 标红警示             |
|            └───────────────────────────────────┘                          |
|                                                                          |
|   > 最近自动存档: n1_chain_scheme 已确认 · 2 分钟前                       |
|   > 提示: 进度于节点确认时自动存档；返回主菜单前建议手动存档              |
+0========================================================================0+
```

**设置子页**（X5 可访问性，`adr-003` 决定3）：
- 键位重映射（InputMap 动作 → 重新绑键/手柄；P3-2 建默认，重映射 UI 进 P4-1，本规格定义入口）。
- 音量（BGM/SFX/旁白，归阮和鸣 X1 音频）。
- 字幕开关 + 字幕速度（X1 旁白）。
- UI 文字缩放（≥150%，`art-bible §6.3`）。
- 对比度/色盲滤镜（§11）。

### 7.4 手柄可导航性（守 `control-manifest` 焦点链）

- 全条目方向键/D-pad/摇杆焦点导航；焦点框冷光可见。
- `ui_accept`/`ui_cancel` 双设备绑定（A/B）。
- 设置子页的滑条/重绑：`ui_left`/`ui_right` 调值；重绑时「按下待绑键」捕获（`[待程基岩确认]` 捕获 API）。
- **暂停时游戏冻结**但 PauseMenu `PROCESS_MODE_WHEN_PAUSED` 仍响应输入（`adr-003` 决定5）。

---

## 8. 输入映射总表（键鼠 + 手柄双套）

### 8.1 动作集（对齐 `project.godot` 实际 InputMap + `adr-003` 决定1 + `control-manifest` 输入节）

> ⚠️ **以 `game/project.godot` 已实现 InputMap 为准**（工程实现已定稿）。下表「键鼠」/「手柄」列从 `project.godot` 的双事件反解（keycode/joybutton）。

| 动作 | 键鼠 | 手柄（JoyButton/Motion） | UX 用途（本规格） |
|---|---|---|---|
| `ui_accept` | Enter | A（btn 0） | 菜单/面板确认、对话推进、演出跳过 |
| `ui_cancel` | Esc | B（btn 1） | 回上级/收面板/跳过演出 |
| `ui_left/right/up/down` | ←/→/↑/↓ | 左摇杆 / D-pad | UI 焦点导航、滑条调值 |
| `ui_menu` | Tab | Select/Back（btn 4） | **打开/关闭系统 Tab 面板** |
| `ui_pause` | P | Start（btn 6） | **暂停菜单** |
| `panel_tab_next` | Q | LB（btn 9） | 系统 Tab 间循环 / 改写面板↔系统 Tab 切换 |
| `move_up/down/left/right` | W/A/S/D | 左摇杆（deadzone 0.2） | 世界移动（HUD 态） |
| `sprint` | Shift | L3（btn 7） | 奔跑 stance（S5） |
| `crouch` | Ctrl | R3（btn 8） | 潜行 stance 切换（S5） |
| `basic_attack` | 鼠标左键 | Square/X（btn 2） | 普攻连段（S4） |
| `skill_1` | 鼠标右键 | RB（btn 10） | 术法快捷栏槽 1 释放（S4） |
| `interact` | E | Triangle/Y（btn 3） | 采集/交互/介入改写（S5） |
| `dialogue_next` | Space | A（btn 0） | 对话下一条（S3 DLG） |

**UI 焦点链补充**（`control-manifest`）：面板内 `ui_focus_next`/`ui_focus_previous`（默认 Tab/Shift+Tab，建议 `panel_tab_next` 不与 `ui_focus_next` 冲突——前者切 **Tab 页**，后者切 **页内控件焦点**）。

### 8.2 与 ADR-003 / control-manifest 的一致性与张力

- ✅ 双绑定齐全：每个动作均绑键鼠 + 手柄两事件（`adr-003` 决定1、`control-manifest` 输入节）。
- ✅ 代码只查动作名（本规格不要求 UI 处理原始键码）。
- ⚠️ **张力 1（ADR-003 文字自相矛盾，工程已解）**：`adr-003` 决定1 文字把 `skill_1` 写「△/RB」、`interact` 写「△」——**同一手柄键 △（btn 3）给了两个动作**。`project.godot` 已定稿：`skill_1`=RB（btn 10）、`interact`=Triangle（btn 3）。**本规格以 `project.godot` 为准**，建议在跨文档评审修正 `adr-003` 该行（见 §13.3）。
- ⚠️ **张力 2**：`ui_menu`（Tab）与 `panel_tab_next`（Q）语义需区分——`ui_menu`=**开/关**系统面板，`panel_tab_next`=面板内**切 Tab**。本规格据此设计（§6.2）。`[待程基岩确认]` 是否需新增 `panel_tab_prev`（建议用 `ui_left`，避免动作膨胀）。
- ⚠️ **张力 3（ADR-003 缺口）**：手柄死区/`InputEventJoypadMotion` API、设备检测、`process_mode` 暂停枚举名标 `[待 P3-2 确认]`（`adr-003` 后果节）。本规格不臆造，UX 层不依赖精确值。

### 8.3 单手可达 / 可访问性考量

- **手柄全屏可达**：四关键屏所有操作均可在手柄上完成（无鼠标依赖），焦点链完整（§11）。
- **键鼠单手倾向**：常用动词（移动 WASD / 普攻鼠标左 / 术法鼠标右 / 交互 E）集中在左手+鼠标，右手可暂离；设置提供「左手/右手布局」倾向（`[待审批]`，X5 目标态）。
- **防误触**：高危操作（确认改写 / 返回主菜单）需二次确认弹窗（§6.6/§7.2）。

---

## 9. 关键模态约定（确认弹窗 / 改写结果反馈弹层）

> 集中定义跨屏出现的模态，避免各屏重复。

### 9.1 确认弹窗（通用）

```
+0============ 确认（系统材质·居中·遮罩 60%）============0+
|  ⚠ 即将 [动作描述]                                      |
|    [后果说明·记录员语气]                                |
|        [ ui_accept 确认 ]      [ ui_cancel 取消 ]        |
+0========================================================0+
```
- 用途：覆盖存档槽（MM）、确认改写高危蓝图（SP）、返回主菜单（PS）、退出游戏（MM）。
- 焦点默认在「取消」（防误触高危）；高危项标冷光橙红描边（`art-bible §2.1` 点睛 B 警示）。

### 9.2 改写结果反馈弹层（结算屏 · `panel-progression §2.5`）

> 节点锁定后 S1 发结算信号组（`rewrite-causality §6.1`），S3 呈现：

```
+0============ 节点结算（STG 内或 HUD 叠层）============0+
|  n2_east_wind 已确认                                   |
|  Δ_node 32/100 (notable)   意图匹配 M 0.9              |
|  CP_earned +96  → CP 余额 180  (数值打字机跳动)         |
|  feedback_tier: notable → 短历史线分叉演出             |
|  （若 critical）⚠ 世界线震荡 · 下游节点难度上浮         |
|                  [ ui_accept 继续 ]                     |
+0========================================================0+
```
- 数据源：S1 `cp_awarded`/`deviation_recomputed(is_preview=false)`/`intent_match_computed`/`feedback_tier`/`critical_deviation_triggered`（`rewrite §6.1`）。
- 量级由 `feedback_tier` 驱动（§6.4）：minor 仅数值跳，notable/critical 进 STG。

---

## 10. 数据 / 状态接口约定（HUD ↔ 各系统，对齐 GDD 变量名）

### 10.1 推送 vs 轮询（守 `control-manifest` 信号节：信号驱动禁轮询）

- **全部走 EventBus 信号推送**（`adr-004`/`architecture §7`）。HUD/面板 `connect` 生产方信号，**不每帧读属性**。
- **例外（允许每帧）**：① 术法快捷栏 cooldown 蒙层（UI 本地计时，非读 S4）；② 屏缘方位箭头（S5 方位只读，可低频轮询或 S5 推送，`[待程基岩确认]`）。
- **刷新频率**：数值态即时（信号到即刷）；演出动效 200–350ms（`art-bible §7.3`）；小地图 v_i 摘要随 S1 `variable_changed` 推送（非每帧）。

### 10.2 接口契约表（HUD/面板 → 系统 / 信号 / 字段 / 刷新）

| UI 消费方 | 系统生产方 | 信号 / 字段（精确名） | 载荷 | 刷新 | 回引 |
|---|---|---|---|---|---|
| HUD HP 条 | S4(C4) | `hp_changed` | `new_hp,max_hp` | 推送 | `combat §6.2` |
| HUD BF 条 | S4 | `bf_changed` | `new_bf,max_bf` | 推送 | `combat §6.2` |
| HUD CP 余额 | S3(C3) | `cp_balance_changed` | `new_balance,delta` | 推送 | `panel §6.4` |
| HUD Δ 指示条 | S1(C1) | `deviation_recomputed` | `node_id,delta_node,is_preview` | 推送 | `rewrite §6.1` |
| HUD RE 条 | S1 | 运行态 `re`（`save_state_rewrite_engine.re`） | `re,RE_max` | 推送（消耗/再生） | `rewrite §3.6/§4.3` |
| HUD 节点名+目标 | S2(C2) | `quest_objective_updated` | `node_id,objective_short,objective_long` | 推送 | `mainline §6.2` |
| HUD 警戒指示 | S4 | `combat_alert_changed` | `alert_level,alert_mult` | 推送 | `combat §6.2` |
| HUD 术法快捷栏 | S3 | `ability_unlocked` | `ability_id` | 推送（解锁） | `panel §6.3` |
| HUD 小地图 | S5(C5) | `minimap_updated` | `strongholds_visible,active_node_scene` | 推送 | `open-world §6.6` |
| HUD 方位箭头 | S5 | （方位只读契约，`[待程基岩确认]` 信号名） | 相对方位 | 推送/低频 | `open-world §6.6`/§5.5 |
| HUD 系统横幅 | S2/S3/S5 | `quest_dispatch_voiced`/`skill_unlocked_toast`/`intel_collected_voiced` 等 | 文案 | 推送 | 各 GDD §6 |
| 改写面板 蓝图 | S1 | `blueprint_declared`（S3 发，经 S1 持有数据） | `node_id,blueprint_id` | 玩家输入触发 | `rewrite §6.1`/`panel §6.1` |
| 改写面板 Δ 预览 | S1 | `deviation_recomputed`(`is_preview=true`) | 同上 | 推送 | `rewrite §6.1` |
| 改写面板 确认 | S3→S1 | `node_committed` | `node_id` | 玩家输入触发 | `panel §6.3` |
| 结算屏 | S1 | `cp_awarded`/`intent_match_computed`/`feedback_tier`/`critical_deviation_triggered` | 见 `rewrite §6.1` | 推送 | `rewrite §6.1` |
| 任务 Tab | S2 | `quest_progress_updated` | `chapter_id,p_ch` | 推送 | `mainline §6.2` |
| 技能树 Tab | S3 | 本地读 `unlocked_skills`/`cost_skill` | — | 解锁即刷 | `panel §3.1/§3.3` |
| 兑换 Tab | S3 | `re_refills_this_node`/`cost_re_refill` | — | 兑换即刷 | `panel §3.3/§4.6` |
| 情报 Tab | S3 | `effective_intel_gain_mult`/`effective_blueprint_insight` | — | 解锁即刷 | `panel §3.3` |

> ✅ **零臆造校验**：上表所有信号名/字段名均在对应 GDD §6 或 §3 数据节定义；HUD 不反向写任何生产方状态（DAG 无环，`control-manifest` DAG 节）。

---

## 11. 可访问性对齐（X5）

> ⚠️ `docs/design/accessibility-requirements.md` **不存在**。按 issue 指令：**本节内自定基线并标注「待补独立文档」**。待阮和鸣/林绘澄/程基岩联合产独立可访问性矩阵后，本节迁移。

### 11.1 自定基线（待补独立文档）

| 维度 | 基线 | UX 落地 | 引用 |
|---|---|---|---|
| **字体缩放** | UI 文字支持 ≥150% 缩放且保持可读 | 设置滑条；布局用锚点/容器自适应（非固定像素） | `art-bible §6.3` |
| **对比度** | WCAG AA（系统文字 4.5:1；大字 3:1） | 冷光白字 on 网格墨蓝底；忌低对比灰字 | `art-bible §6.3` |
| **色盲安全** | 不以纯色相作唯一信息通道 | 阵营色+旗号+形制多通道（`art-bible §2.3`）；Δ 三档用色+图标+文案多通道（`art-bible §2.5`/`open-world §7.5`）；提供色盲滤镜（设置） | `art-bible §2.3` |
| **按键重绑** | 每个 InputMap 动作可重绑（键鼠/手柄） | 暂停→设置→键位（`adr-003` 决定3）；默认方案 P3-2 已建 | `adr-003` |
| **字幕/提示音** | 系统旁白配字幕；关键事件配音效提示 | 横幅/结算/演出均带字幕（X1）；音效由阮和鸣定义 | `art-bible §6.3` |
| **焦点可见** | 焦点框冷光描边可见 | 四屏焦点框统一系统材质 | `control-manifest` |
| **减少动效** | 可关闭 glitch/抖动/扫描（前庭敏感） | 设置→「减少动效」开关；critical 演出降级为静态 | `art-bible §7.2` |
| **单手可达倾向** | 常用动词集中、高危二次确认 | §8.3 | `adr-003` |

### 11.2 待补项（写独立文档时落实）

- 完整 WCAG AA 对比度实测（需林绘澄配色取样）。
- 色盲滤镜具体实现（程基岩 shader，`[待程基岩确认]`）。
- 屏幕阅读/仅键盘流程（PC 端目标态）。

---

## 12. 节奏 / 认知负载 / 渐进披露（呼应 design-strategist 红线）

### 12.1 首屏信息量上限

- **战斗 HUD 核心**：≤5 信息单元（`panel §2.1`），余光可读，**不挡世界**（`art-bible §6.2`）。
- **系统面板**：单 Tab 单焦点；同屏不超 1 主内容区 + 1 hover 详情。
- **主菜单**：5 条目 + 1 副标 + 1 数据条；不堆砌。

### 12.2 渐进披露策略

- **情境化显示**：警戒指示仅 `alert_level≥2` 显（`combat §6.5`）；intel_cov 仅进改写场所/面板显（§5.7）；术法快捷栏仅战斗/有解锁时显。
- **折叠隐藏层**：内部数值（d_i/w_i/condition/敌人 ATK）默认折叠，供硬核玩家（Explorer，`game-concept §4.2`）。
- **模态压制**：STG 强模态压制其他面板（§6.4）；横幅排队≤2（§5.6）；连续 critical 演出降级（`panel §2.5`）。

### 12.3 认知过载防线（守 `systems-index §8`）

| 风险 | 缓解 |
|---|---|
| v_i/Δ/CP/RE/intel 同屏涌入 | 三层密度分级（核心≤5 / 进阶按 Tab / 隐藏折叠） |
| 改写面板信息爆炸 | 情境化（仅节点激活）+ 预览隔离（不发 CP） |
| 演出过频抢沉浸 | 演出节制 + minor 不进 STG + 连 critical 降级 |
| 双轨冷光污染 | 冷光仅 L5（`control-manifest` 渲染节） |

> **主导策略防线**（design-strategist 红线）：技能树 Tab **禁最优路径高亮**（`panel §2.2`）；Δ 预览只显数值不显「最优解」；信息呈现中立，不引导玩家「应该怎么改」。

---

## 13. 一致性备注（冲突 / 待审批汇总）

> 用 `rg`/`grep` 核对 HUD/控件名与各 GDD 后发现，集中列出。

### 13.1 HUD 小地图 / intel_cov vs `panel §2.1` ≤5 单元（张力）

- 见 §5.7。裁决：核心资源条严守 ≤5；方位走屏缘箭头；小地图可收起；intel_cov 情境化显示。**待主创/程基岩确认**是否正式修订 `panel §2.1` 措辞（明确「5 单元=数值态资源条，不含空间类」）。

### 13.2 `open-world §6.7` intel_cov 常驻 vs 本规格情境化（张力）

- `open-world §6.7` 称 intel_cov 进度条「呼应 panel §6.5 核心 HUD」（隐含常驻）。本规格为守 ≤5 单元，改为**情境化**（进改写场所/面板时显 + 变化时横幅提示）。**建议**修订 `open-world §6.7` 措辞与 `panel §2.1`/本规格对齐。

### 13.3 `adr-003` 决定1 文字 skill_1/interact 同绑 △（自相矛盾，工程已解）

- `adr-003` 文字把 `skill_1` 写「△/RB」、`interact` 写「△」。`project.godot` 已定稿 `skill_1`=RB(btn10)、`interact`=Triangle(btn3)。**本规格以工程为准**。建议修正 `adr-003` 该行（标 `adr-003` 为「建议，以 project.godot 为准」）。

### 13.4 `mainline §2.3` vs `rewrite §6.1` 的 `node_vanished` 归属（既有张力，与本规格无关）

- `mainline §2.3` 已记录：`rewrite §2.3` 表末行称「S2 发 node_vanished」，而 `rewrite §6.1/§7.1` 列为 S1→S2。本规格按 `mainline §2.3` 裁决（S1 发、S2 收后决策）处理 HUD「节点消失」横幅（订阅 S2 `quest_node_vanished_voiced`）。不新增信号。

### 13.5 `MainMenu`/`PauseMenu` 场景不存在（工程缺口，非冲突）

- `game/scenes/` 仅 `boot.tscn`、`world.tscn`。本规格定义 UX，P5 按本规格创建 `scenes/ui/main_menu.tscn`、`pause_menu.tscn`。`architecture §8` 未列 MainMenu，建议 P3/P4 补场景树约定。

---

## 14. 待主创审批项（不擅自定稿）

1. **【主菜单「朝代切换」入口】**：issue 要求入口存在，但朝代热切换 = X6 愿景外（`systems-index §1.2`/`game-concept §7.3`）。
   - **本规格处理**：存档槽面板内设**禁用预留入口**（灰禁 + tooltip「多朝代·愿景。垂直切片仅三国·赤壁」），不实现切换逻辑。
   - **待审批**：(a) 是否保留禁用入口（占位提示愿景）vs 直接隐藏；(b) 若保留，文案语气（记录员「更多朝代·数据未载入」）。**倾向**：保留禁用入口（暗示愿景，不破坏范围）。
2. **【系统人格语气】**（`game-concept §9①`）：本规格文案按「冷峻记录员」倾向。待主创定是否「带点毒舌」。
3. **【HUD 小地图默认态】**（§5.7/§13.1）：默认展开（非战斗）/ 收起（战斗）vs 始终收起。待主创 + 可访问性偏好确认。
4. **【单手布局】**（§8.3）：左手/右手布局倾向是否进 MVP。
5. **【演出跳过】**（§6.4）：`ui_cancel` 跳过 critical 演出是否允许（叙事峰值 vs 玩家自主）。倾向允许跳过但保留结算数值。

---

## 15. 已知风险与取舍

1. **冷光过强抢世界 vs 过弱失 litRPG 味**（`art-bible §12.2`）：靠 L5 叠层纪律 + 半透明面板约束，需 P5 Playtest 校准。
2. **手柄焦点链工程量**：改写面板蓝图卡 + 系统 Tab 完整焦点链是 P5 实现成本点（`control-manifest` 焦点链节）。
3. **存档槽 UI 复用**：主菜单/暂停菜单存档子面板应共用同一场景（DRY），程基岩 P5 设计。
4. **未锁定改写可回滚 / 已锁定不可悔棋**（`architecture §9.2`/`rewrite §5.4` 待审批）：影响「确认改写」弹窗文案与存档时机，待联合确认。

---

## 16. 下一步建议（给主理人 · 游承峰）

1. **本 issue（P4-1）完成后**，建议优先派 **P4-2 美术资产清单**（林绘澄）——本规格 §4.3/§5.3/§6.3/§7.3 线框可直接转资产需求（面板九宫格、HUD 图标、术法快捷栏、存档槽卡、确认弹窗）。
2. **请主创优先审批 §14 第 1 项（朝代切换入口）**——它决定主菜单存档面板是否含禁用占位。
3. **给程基岩**：§8.1/§10 接口表 + §13.3/§13.4 张力，建议 P3-2 复核 InputMap 与 `node_vanished` 归属，补 `MainMenu`/`PauseMenu` 场景树约定（§13.5）。
4. **给阮和鸣**：§5.6 横幅/§6.4 演出/§9.2 结算的音效与旁白配音触点已标注（X1），可起音频规格。

---

## 17. 验收标准（可逐条勾选 · 对照 issue 验收要点）

- [ ] **四关键屏齐全**（主菜单 §4 / 核心 HUD §5 / 系统面板 §6 / 暂停 §7），每屏含流程图（§4.2/§5.x/§6.x/§7.2）+ 线框（§4.3/§5.3/§6.3-6.5/§7.3）。✅
- [ ] **输入映射双套（键鼠/手柄）**，与 `control-manifest.md`、`adr-003` 不冲突（§8；张力 §13.3 已列）。✅
- [ ] **接口约定字段名与五系统 GDD 实际变量名一致**（§10.2，零臆造，逐条回引 GDD §6/§3）。✅
- [ ] **含可访问性节**（§11，自定基线 + 标注待补独立文档）。✅
- [ ] **含认知负载/渐进披露节**（§12）+ **勾选式验收清单**（本节）。✅
- [ ] **与美术圣经一致**（配色/字体/分区/系统材质，§2/§4.3/§5.3 引用 `art-bible`）；冲突写入一致性备注（§13）。✅
- [ ] **不脱离 Godot 4.7 + 现有工程骨架**（§3.1 对齐 `architecture §8`；存疑标 `[待程基岩确认]`，未臆造 API）。✅
- [ ] **屏间跳转矩阵**（§3.2）+ **关键模态**（§9 确认弹窗/改写结果反馈弹层）。✅
- [ ] **litRPG 基调落地**（§4.5 记录员语气）+ **设计理论红线标注**（§12.3 主导策略/认知过载）。✅
- [ ] **待审批项单独列出**（§14，不擅自定稿）。✅

---

*—— 文策渊（design-strategist）· Phase 4 预制作（P4-1）· 待主创评审*
