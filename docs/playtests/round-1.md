# 垂直切片 · Playtest 自测报告 · Round 1

> 阶段：Phase 6 · 打磨（P6-3）　|　执行角色：文策渊（design-strategist）　|　Issue #25
> 区别于 P5-9（#21 `smoke-test.md`）的「冒烟级闭环确认」，本轮是**体验/手感/设计意图落地**层面的可玩性评审。
> **本文档不臆造实测数据**：凡无法实机观测之处一律显式标注「设计层评审（代码/场景/数据读审）」。

---

## 0. 元信息

| 项 | 值 |
|---|---|
| 评审人 | 文策渊（design-strategist） |
| 评审日期 | 2026-08-14 |
| 引擎 | Godot 4.7.1 stable（`v4.7.1.stable.official.a13da4feb`，`$GODOT_BIN` 可用） |
| 被测对象 | 工程根 `game/`，主场景 `scenes/boot.tscn` → MainMenu → `scenes/world/` → `scenes/rewrite_node_chibi/` |
| **跑法** | **实机 attempted → Blocker FAIL 于 boot**；以下「Loop A 闭环」节为实机证据，「支柱/UX/难度/手感」节为**设计层评审（代码/场景/数据读审 + GDD 对照）** |
| 阻塞 | 游戏无法启动（详见 §2 / 卡点 BP-1 / follow-up #26） |

> ⚠️ **本轮结论一句话**：垂直切片当前**完全无法启动**（Autoload `SaveManager` 与系统心脏 C1、C2 全部编译失败，根因是 `game/scripts/foundation/data_resources/` 目录约 28 个数据资源脚本缺失），这是 smoke-test #21（headless 零 ERROR + 8 套单测合计 pass=368）之后的**严重回归**。Loop A 闭环在本轮**无法实跑**；本报告在 §3–§6 以「设计层评审」提供 Blocker 解除后即可对照实跑的基线，并标注每一处「待实机复核」。

---

## 1. 结论速览（给主理人）

| 维度 | 判定 | 一句话 |
|---|---|---|
| **Loop A 闭环** | **FAIL** | 游戏无法 boot（Blocker BP-1 / #26） |
| **支柱① 改写即玩法** | 实机 FAIL（待 Blocker）；**设计层 PASS** | 改写面板是「可丈量的意图操作台」（蓝图/动词/Δ 实时预览/确认），非 QTE/纯选择支——落地到位 |
| **支柱② 系统流掌控感×正剧底色** | 实机 FAIL（待 Blocker）；**设计层 PASS** | 系统材质冷光 + 记录员旁白 X1 + Δ 三档色 + 多通道受击反馈，对齐 art-bible/§9① |
| **支柱③ 赤壁是可丈量沙盘** | 实机 FAIL（待 Blocker）；**设计层 CONCERNS** | 情报→改写桥/v_wind 视觉化已接线；但 MVP 单节点范围下「据点咬合」体感弱（范围固有代价，非缺陷） |
| **范围漂移** | **PASS** | 无 §7.4「不做」清单功能渗入；朝代热切换/替代节点仅架构预留未实现（合规） |

> **质量门总判定**：**FAIL**（阻塞项 BP-1 未解决，不得进入下一阶段）。详见 §7 卡点清单。

---

## 2. Loop A 闭环确认（对齐 smoke-test.md §2 步骤）

### 2.1 实跑证据（headless）

执行 `$GODOT_BIN --headless --path game --import --quit` 与 `$GODOT_BIN --headless --path game res://scenes/boot.tscn`，两者均爆发**大量 SCRIPT ERROR / PARSE ERROR**，流程在 **boot 之前**即中断。逐步骤对照 smoke-test §2：

| smoke §2 步骤 | 本轮实机结果 | 判定 |
|---|---|---|
| ① 主菜单→新游戏 | Autoload `SaveManager` 编译失败（依赖未编译的 `QuestSystem`）→ 进程无法装载 autoload → **主场景无法启动** | ❌ 不可达 |
| ② world 探索+击败山贼 | 同上，world 场景依赖的系统节点（C1/C2）脚本未编译 | ❌ 不可达 |
| ③ 收集气象线索 | 改写节点场景的引擎/数据脚本未编译 | ❌ 不可达 |
| ④ 术士触发改写 | 同上 | ❌ 不可达 |
| ⑤ 七星坛+选蓝图 | 改写面板依赖 C1 引擎数据（`RewriteNodeData` 等），引擎未编译 | ❌ 不可达 |
| ⑥ 确认→系统反馈 | 同上 | ❌ 不可达 |
| ⑦ 回 world | 同上 | ❌ 不可达 |
| ⑧ 读档重同步 | `SaveManager` 编译失败 | ❌ 不可达 |

**冒烟自测 PASS 条件（smoke §3）全部不成立**：① 主菜单可进 ✗；② 转场到改写节点 ✗；③ 面板呼出 ✗；④ 收到系统反馈 ✗；⑤ 防循环 ✗；⑥ 读档重同步 ✗；⑦ **headless 零 ERROR ✗**（爆 ERROR）；⑧ **8 套单测 ALL PASS ✗**（`tests/unit/test_rewrite.tscn` 等因依赖未编译脚本无 `TEST SUMMARY` 输出）。

### 2.2 实机 ERROR 摘录（证据，非臆造）

```
# C1 系统心脏（systems/rewrite/rewrite_causality_engine.gd）—— 无法编译
SCRIPT ERROR: Parse Error: Could not find type "CausalLinksData"   at: L77
SCRIPT ERROR: Parse Error: Could not find type "RewriteNodeData"   at: L181/216/276/297/446/472/506/733…
SCRIPT ERROR: Parse Error: Could not find type "RewriteVariableData"   at: L195/460/519/736…
SCRIPT ERROR: Parse Error: Could not find type "RewriteBlueprintData"  at: L279/532/739…
SCRIPT ERROR: Parse Error: Could not find type "RewriteVerbData"   at: L219/545/742…

# C2（scripts/core/quest_system.gd）—— 无法编译
SCRIPT ERROR: Parse Error: Could not find type "QuestNodeDispatchData"  at: L130/159/183/191/267/312/348/356/387…
SCRIPT ERROR: Parse Error: Could not find type "ChapterData"            at: L207/365…
SCRIPT ERROR: Parse Error: Cannot infer the type of "sum_w"            at: L369

# Autoload（scripts/autoload/save_manager.gd）—— 依赖 QuestSystem → 编译失败
SCRIPT ERROR: Compile Error: Failed to compile depended scripts.   at: save_manager.gd:0
ERROR: Failed to load script "res://scripts/autoload/save_manager.gd" with error "Parse error".
```

### 2.3 根因

**`game/scripts/foundation/data_resources/` 目录完全缺失**（`ls` 与全项目 `class_name` grep 均确认不存在）。约 28 个数据资源脚本（`QuestNodeDispatchData` / `ChapterData` / `RewriteNodeData` / `RewriteVariableData` / `RewriteBlueprintData` / `RewriteVerbData` / `CausalLinksData` / `ability_data` / `enemy_data` / `player_combat_data` / `intel_poi_data` …）被 C1/C2 核心脚本与**全部** `.tres` 数据文件 `[ext_resource type="Script" path="res://scripts/foundation/data_resources/...gd"]` 引用，却无一存在。

**回归判定**：`smoke-test.md`（#21）§6.1 记录当时 headless 零 ERROR、§6.2 记录 8 套单测 **pass=368 fail=0**。当前状态与之完全相反 → **#21 之后引入的回归**（疑似某次合并/集成丢失该目录）。已开 follow-up **#26**（engineering-lead，Blocker）。

---

## 3. 支柱感知评估

> ⚠️ **诚实声明**：因 Blocker（§2），玩家视角的「实际感受到了吗」**无法实机观测**。本节对每条支柱给出**双判定**：(a) **实机感知**——本轮一律 FAIL（无法观测，非设计失败）；(b) **设计层落地评估**——基于代码/场景/数据读审 + GDD 契约对照，判断「设计意图在实现层是否被忠实落地」，作为 Blocker 解除后实跑的对照基线。质量门取自 `team/README.md`。

### 支柱①「改写即玩法——历史是你的可玩材料」

- **实机感知**：**FAIL**（Blocker，无法观测）。
- **设计层落地评估**：**PASS**。证据（代码读审）：
  - 改写面板 `ui/rewrite_panel/rewrite_panel.gd` 是完整的「**意图操作台**」，逐条落地 `rewrite-causality §6.3` + `ux-spec §6.3` 契约：蓝图卡显示 `intent_label` + `target_vars` + **M 预估**，并按 `intel_cov` **门控**（不足则灰禁 + tooltip「需 intel_cov≥X」）；动词卡显示 `cost_RE` + `requires.ability` + 执行状态（RE 不足/尝试耗尽）；**Δ 实时预览**（订阅 `deviation_recomputed(is_preview=true)` 即时刷新 + 三档色 minor/notable/critical）；「确认改写」emit `node_committed`（S3→S1，对齐 panel §6.3）。
  - 这**不是**纯 QTE 或纯选择支（`game-concept §2` 支柱①反例红线）：玩家须「声明意图（选蓝图）→ 物理执行（场景内采集/破坛/施术）→ 确认锁定」，每步都有可丈量的 Δ 反馈——符合支柱①「系统让你改并告诉你改了多少」。
  - DAG 守护到位（`rewrite-causality §5.3`）：面板 `_on_verb_pressed` 注释明确「物理执行归 S4/S5，面板不发 `verb_executed`」，只做预览。
- **待实机复核**：① 改写动词的「物理执行」体感（场景内走位/采集/破坛/施术）是否真的像「动手改」而非「点选项」——取决于 `rewrite_node_chibi` 场景交互，本轮无法观测。

### 支柱②「系统流掌控感 × 正剧底色——穿越者孤独，但你看得见天平」

- **实机感知**：**FAIL**（Blocker，无法观测）。
- **设计层落地评估**：**PASS**。证据（代码/数据读审）：
  - **系统材质冷光**（`art-bible §6.1`）：`rewrite_panel.gd` 定义 `_COLOR_CYAN`(0.6,0.85,1) / `_COLOR_DATA`(0.92,0.96,1) / `_COLOR_LABEL`(0.55,0.78,0.95) / `_COLOR_DIM` / `_COLOR_WARN`(警示红)——青蓝硬边 + 数据白等宽 + 冷光青标签，贴合双轨反差的轨道 B。
  - **记录员旁白 X1**（`game-concept §9①` 待审批倾向）：`systems/rewrite/rewrite_narration_chibi.tres` `system_tone = cold_recordist`，文案如「意图已归档：{label}。偏差将据此丈量。」「节点已确认。偏差已记录，因果已传递。」「世界线剧烈震荡。下游节点难度上浮，风险已转嫁。」——**冷峻第三方观测者**人格落地，元幽默**仅限系统侧**，不渗入 NPC（`mainline-quest §6.3` 红线）。VO 音频（#23 `vo_system_dispatch/complete/vanish.mp3`）已生成。
  - **看得见天平**：Δ 实时预览 + 三档色 + intent voice + `attempts_used/max` 预警（耗尽转警示色），让玩家清楚「改了多少、为什么」——支撑 SDT 胜任感（`game-concept §4.1`）。
  - **正剧底色资产**：玩家/山贼精灵、赤壁村落 TileSet（旱地/湿地/岸线/江水/营帐/芦苇）、四态 BGM（menu/explore/combat/choice）均由 #22/#23 mmx 生成真实资产，非 greybox。
- **待实机复核**：① 双轨反差的视觉冲击（冷光系统叠层 vs 水墨世界）实机是否成立；② 系统旁白 VO 听感（冷峻中性 vs 出戏）。

### 支柱③「赤壁是可丈量的沙盘——开放世界即历史棋局」

- **实机感知**：**FAIL**（Blocker，无法观测）。
- **设计层落地评估**：**CONCERNS**。证据（代码/场景/数据读审）：
  - **情报→改写桥已接线**（`game-concept §3.2` 收益回路）：`world.tscn` 有 `IntelPOIManager`；`data/intel/` 含 3 个情报点（观天老叟/江岸渔夫/芦苇观察点，各 `intel_raw=0.25`，合计 `intel_cov=0.75`）；`rewrite_panel` 显示 intel bar + 门控（`bp_baseline_keep.unlock_intel_cov=0.0` / `bp_player_self_wind.unlock_intel_cov=0.6`）。探索产出情报 → 降改写难度 + 解锁精确蓝图的回路在数据层闭环。
  - **v_wind 视觉化**（`art-bible §5.5`）：`world.tscn` 有 `WindDirector` 节点；`assets/tilesets/` 有 `reed_wind_se` / `water_wave_wind_se` 等东南风视觉资产。
  - **「据点咬合」体感弱（范围固有代价，非缺陷）**：MVP 收窄到单节点 N2（`game-concept §7.1` / `ch_chibi_war.tres` `mvp_subset=[n2_east_wind]`），因果链联动（N1 连舟 → N2 火攻 → N3 存在性）在 MVP 里**不激活**——玩家在单节点里感知不到「据点互相咬合」的棋局感。这是 `game-concept §7.1` MVP 范围的**有意收窄**，不违反支柱③，但意味着「沙盘」体感在 MVP 主要靠「情报/风向视觉」单薄支撑，需实机验证是否够「可丈量」。
  - **回 world 无运行时态重同步**（smoke §4.2）：改写节点完成后回 world 不重建 C5 世界态（连舟/坛状态视觉），玩家「改完看不到世界变了」——削弱支柱③「可丈量沙盘随 v_i 变化」体感。属 smoke §4 已记录的已知项，依赖未落地的 S5 核心层。
- **待实机复核**：① 探索/采集/风向视觉的「读棋盘」体感是否成立；② 回 world 后世界不随改写变化是否造成「改了白改」的违和。

---

## 4. 新玩家体验（设计层评审）

> 因 Blocker 无法实机；以下为代码/数据读审 + `ux-spec.md` 对照。

| 维度 | 读审判读 | 判定 |
|---|---|---|
| **上手门槛** | world 内 `HintLabel`（`world.gd _refresh_hud`）显示「操作：WASD 移动·鼠标左键普攻(连段)·右键系统术法·E 交互」——操作提示在场。但主菜单→新游戏→world 的**首次引导仅靠 HUD 文字**，无 tutorial/逐步教学。改写的「声明意图→物理执行→确认锁定」三步是新概念，有学习曲线。 | CONCERNS |
| **引导充分性** | 目标（`ObjectiveLabel`「探索赤壁村落，击败山贼以触发改写节点」）+ 操作提示在场；改写节点场景由 `RewriteNodeDirector` 编排（线索/术士/坛/延迟派发，smoke §2 step③④⑤）。但无 onboarding 高亮/箭头指引首个线索点位置。 | CONCERNS |
| **信息层级**（对齐 `ux-spec §5.2/§6.3`） | 改写面板**同屏信息密度高**：节点名 + 派单语气 + intel bar/gate + 蓝图卡（intent/target/M预估）+ 动词卡（cost/ability/status）+ RE bar + attempts + 预览 vars + 预览 Δ + special flag + 兑换子页 + 确认。代码用 color 分层（青/白/暗/警示），但**无折叠/分步引导**——可能触发 `panel-progression §2.1` 认知过载红线。 | CONCERNS |
| **读字量** | X1 旁白 + 蓝图 `intent_label` + 动词 `display_name` + 派单/完成/消失文案均为中文长句；改写面板一次呈现大量文本。新玩家首局读字量偏高。 | CONCERNS |
| **操作直觉** | 移动 WASD / 普攻左键 / 术法右键 / 交互 E 为标准映射（`ux-spec §8.1`），直觉性好。但「改写」核心动词无单一按键，是场景交互 + 面板确认的组合，需学习。 | CONCERNS（可接受） |

**小结**：UX 实现忠实于 `ux-spec`，但「信息层级/读字量/引导」三项对新玩家偏重——这是 `rewrite-causality §6.3` / `panel §2.1` 已预警的认知过载风险，需 Blocker 解除后**实机验证**新玩家首局的认知负荷，必要时加折叠/分步引导。

---

## 5. 难度曲线（设计层评审，数据为据）

### 5.1 山贼战斗（Loop B）

- **数据**（`data/enemies/npc_bandit_chibi.tres` + `world.tscn` 3 个 `SpawnPoint`）：3 个山贼，巡逻/追击/受击 FSM（P5-1 #13）。
- **玩家能力**（`data/combat/player_combat.tres` + `combat §3.2`）：MVP = 普攻 3 段连段（mult 1.0/1.0/1.4，第 3 段 knockback）+ **1 个系统术法**。⚠️ 关键：MVP 唯一术法 `ability_system_magic_wind` 是 `rewrite_proxy` 类**不造伤害**（`combat §3.2` 示例二），故**清怪实际只能靠普攻连段**。MVP **无闪避/无硬直**（`game-concept §7.1` 收窄）。
- **判读**：3 个无特殊攻击的巡逻近战 + 玩家无闪避，战斗应属**低难度**（符合 `combat §1.4` 战斗「轻」纪律与 MVP 收窄）。单次遭遇目标 8–20s。**无卡死风险**（普攻必杀，无免疫）。无脑解风险低。
- **待实机复核**：普攻命中的判定盒范围/手感、3 山贼是否会同时围攻造成被连砍无闪避的挫败。

### 5.2 改写节点抉择（认知负荷）

- **canonical 路径**（smoke §2 step⑥ 数据）：3 线索（intel_cov=0.75）+ `bp_player_self_wind`（需 intel≥0.6）+ 破坛 → **Δ_node=20（notable）/ CP_earned=92**。
- **防主导策略落地**（`rewrite-causality §4.2/§5.1`）：
  - `bp_baseline_keep`（不动）→ Δ≈0、CP 低 → **躺平非最优** ✓。
  - `bp_player_self_wind` 需 3 线索（探索投资）+ 破坛/施术（执行成本）→ **全力盲改非无脑** ✓。
  - `max_attempts=3` 封顶 + 实时 Δ 预览 → **试错成本可控，认知负荷有界** ✓。
- **判读**：抉择有认知负荷（理解蓝图 target_vars vs 动词 effect vs Δ 预览），但有实时预览 + max_attempts 兜底，**无卡死**。无单一无脑最优解（防主导策略数据齐备）。
- **待实机复核**：新玩家是否理解「蓝图=意图声明」这个 novel 概念（`game-concept §9③` 待审批方案的认知成本）。

---

## 6. 手感与反馈强度（juice · 对齐 combat §6.5/§7.6 + art-bible §2.5/§7 + P6-2 #24）

### 6.1 juice 基础设施（#24 产出）—— 完整

- **脚本**：`scripts/juice/juice_controller.gd` / `screen_shake.gd` / `weapon_trail.gd`（均 `class_name` 注册）。
- **着色器**：`shaders/hit_flash.gdshader` / `screen_damage_vignette.gdshader` / `weapon_trail.gdshader` / `glitch_deviation.gdshader` / `world_color_grade.gdshader`。
- **接线**（`world.tscn`）：`Systems/JuiceController` + `Camera2D/ScreenShake` + `L5_SystemCanvas/DamageVignette` 均挂载。

### 6.2 反馈通道判读

| 通道 | 实现状态 | 证据 |
|---|---|---|
| **受击反馈（被动·HP 下降）** | ✅ **已接线** | `juice_controller.gd _on_hp_changed` 自动监听 `EventBus.hp_changed`，HP 下降 → 朱赤边缘光 `pulse_vignette` + 微震屏 `add_trauma(0.35)`。多通道（颜色+震屏），`reduce_motion` 下保留红光（`art-bible §2.3` 可访问性红线）。对齐 `combat §6.5/§7.6`。 |
| **命中停顿（主动·玩家命中敌人）** | ⚠️ **API 建好但玩法层未调用** | `JuiceController` 暴露 `request_hit_stop(time_scale 0.06, 0.045s)`，但 `grep` 全 `scripts/`+`scenes/`（排除 juice 自身）**零调用**。即 combat/player 命中敌人时**未触发命中停顿**。类注释自承「接线点交程基岩」。 |
| **震屏/拖尾（主动·命中/击退）** | ⚠️ **API 建好但玩法层未调用** | 同上，`request_shake` / `WeaponTrail` 在玩法层**零调用**。第 3 段连段 knockback（`combat §2.3`）是否触发震屏/拖尾未在代码体现。 |
| **系统旁白 X1 存在感** | ✅ **覆盖 Loop A 全反馈环** | `rewrite_narration_chibi.tres` 13 条旁白模板（dispatch/intent/self_replacement/settle minor·notable·critical/worldline_shaken/intent_unreachable/node_vanished/causal_downstream/consecutive_critical）+ 3 条 VO 音频（#23）。`RewriteFeedbackController`/`TimelineStage`/`RewritePanel` 三处消费。 |
| **历史线演出节奏** | ✅ **三档分级落地**（代码层） | `TimelineStage` + `SettlementScreen`；`feedback_tier` minor(短横幅)/notable(短演出)/critical(长演出+震荡 glitch)。对齐 `panel §2.5` + `art-bible §2.5`。 |

### 6.3 判读

- **受击反馈 + X1 旁白 + 演出分级**：设计层 PASS，基础设施完整且对齐 GDD。
- **命中反馈接线缺口（Major MJ-2）**：juice 的**主动反馈**（命中停顿/震屏/拖尾）API 已建，但玩法层（`combat_system` 命中判定 / `player` 连段 / `enemy` 击退）**未调用** → 玩家「打中敌人」的手感（命中停顿 + 拖尾 + 震屏的 juice 三件套）在当前实现里**很可能缺失**，只剩敌人 hit_flash。这直接影响 `combat §6.6` 衔接要求的「普攻命中→juice」闭环，是手感的关键短板。
- **待实机复核**：① 命中敌人时是否有停顿/震屏/拖尾（若 MJ-2 确认未接线，则手感偏「软」）；② 朱赤边缘光 + 微震屏的受击反馈强度是否到位（`damage_trauma=0.35`，偏克制，符合 `art-bible §3.1` 节制）。

---

## 7. 卡点清单

| # | 严重度 | 问题 | 复现 / 证据 | 关联系统·文件 | 建议 | follow-up |
|---|---|---|---|---|---|---|
| **BP-1** | **Blocker** | 游戏无法启动：缺失 `data_resources/` 全部数据资源脚本 | `$GODOT_BIN --headless --path game --import --quit` 爆 C1/C2/SaveManager PARSE ERROR；boot.tscn 无法启动；8 套单测全失效 | C1 `systems/rewrite/rewrite_causality_engine.gd`、C2 `scripts/core/quest_system.gd`、Autoload `scripts/autoload/save_manager.gd`、`data/**/*.tres`、缺 `scripts/foundation/data_resources/` | 补齐 ~28 个数据资源脚本（`class_name … extends Resource` + 字段对齐 `.tres`/GDD）；修 `quest_system.gd:369 sum_w` 类型推断；目标回到 headless 零 ERROR + 单测 pass=368 | **#26** |
| **MJ-1** | Major | 改写面板非模态：玩家可边移动边操作面板 | `rewrite_panel.gd` 为 `Control`（非 `CanvasLayer` 强模态/未 `SceneTree.paused`）；`_unhandled_input` 仅处理 `ui_cancel`。smoke §4.1 已记录 | `ui/rewrite_panel/rewrite_panel.gd` + `rewrite_panel.tscn`；对照 `ux-spec §3.2/§6.2` 强模态 | Phase 6 加面板呼出时输入隔离/半暂停（术士触发→破坛的「边走边操作」是设计意图 vs 输入冲突的权衡，待主创定） | （待 BP-1 解除后实机确认体感再决定是否单开） |
| **MJ-2** | Major | juice 主动反馈（命中停顿/震屏/拖尾）玩法层未接线 | `grep request_hit_stop\|request_shake\|WeaponTrail` 全 `scripts/`+`scenes/`（排除 juice 自身）**零调用** | `scripts/juice/juice_controller.gd`（API）、`scripts/core/combat_system.gd`/`scripts/gameplay/actors/player.gd`（应调用处） | combat 命中/连段第 3 段 knockback 接 `request_hit_stop`+`request_shake`；普攻/术法接 `WeaponTrail`。对齐 `combat §6.6` | （待 BP-1 解除后由程基岩核查命中→juice 调用链） |
| **MN-1** | Minor | 回 world 无运行时态重同步（世界不随改写变化） | smoke §4.2；`world.gd _is_loop_a_complete` 用存档窥探而非运行时态 | C5 开放世界核心层未落地（`open-world §5.5/§9.2`） | 依赖 S5 核心层后续 issue | smoke §4.2 |
| **MN-2** | Minor | world 重入山贼重生 | smoke §4.3；`EncounterSpawner` 每次进 world 重新生成 | 遭遇 `spawn_state` 未持久化（`open-world §3.6`） | S5 遭遇 spawn_state 持久化 | smoke §4.3 |
| **MN-3** | Minor | 无暂停菜单（退出靠关窗） | smoke §4.5；`world.tscn` 无 PauseMenu | `scenes/ui/pause_menu.tscn` 未创建（`ux-spec §7`） | 新建暂停菜单 issue（`SaveManager.atomic_save` API 已暴露） | smoke §4.5 |
| **MN-4** | Minor | `QuestSystem: chapter_data 未赋值` WARNING | smoke §4.6；`world.tscn` 故意置空（延迟派发） | `scripts/core/quest_system.gd` 防御性 `push_warning` | 信息性 WARNING 非 ERROR，可忽略或降级为 verbose | smoke §4.6 |
| **MN-5** | Minor | 改写面板同屏信息密度高，新手认知负荷重 | `rewrite_panel.gd _populate` 一次呈现 ~10 类信息 | `ui/rewrite_panel/`；对照 `panel §2.1` 认知红线 | Phase 6 polish：蓝图/动词区折叠 + 进阶层默认收起 | （待 BP-1 解除后实机首局验证） |

> 说明：BP-1 是唯一可在当前状态立即行动的具体问题，已开 **#26**。MJ-1/MJ-2/MN-5 建议待 BP-1 解除、实机复跑后由 design-strategist 确认体感再决定是否单开 issue（避免对无法观测的现象盲目开单）。MN-1~4 回链 smoke §4 既有记录。

---

## 8. 已知问题清单（表格化）

| 问题 | 严重度 | 状态 | follow-up | 备注 |
|---|---|---|---|---|
| 缺失 `data_resources/` 全部脚本，游戏无法启动 | Blocker | 新发现（本轮） | **#26** | 需程基岩修复 |
| 改写面板非模态（边移动边操作） | Major | smoke §4.1 承接 | 待实机确认 | Phase 6 polish |
| juice 主动反馈（命中停顿/震屏/拖尾）玩法层未接线 | Major | 新发现（本轮） | 待程基岩核查 | 影响「打中」手感 |
| 回 world 无运行时态重同步 | Minor | smoke §4.2 承接 | 依赖 S5 后续 issue | — |
| world 重入山贼重生 | Minor | smoke §4.3 承接 | 依赖 S5 后续 issue | — |
| 无暂停菜单 | Minor | smoke §4.5 承接 | 待新 issue | SaveManager API 已就绪 |
| `chapter_data 未赋值` WARNING | Minor | smoke §4.6 承接 | 可忽略 | 非 ERROR |
| 改写面板信息密度高 | Minor | 新发现（本轮） | 待实机确认 | Phase 6 polish |
| ~~美术/音频为 greybox 占位~~ | — | **已解决** | smoke §4.7（过期） | #22/#23/#24 已生成真实资产 |

---

## 9. 范围漂移检查（对齐 `game-concept §7.4`「不做」清单）

| §7.4「不做」项 | 检查结果 | 证据 |
|---|---|---|
| ❌ 商城氪金/签到日常/在线服务 | ✅ 未出现 | 全项目无相关代码/数据 |
| ❌ 多朝代地图 | ✅ 未实现（仅命名空间预留） | `dyn_*` 字段预留，`X6` 跨朝代热切换愿景外 |
| ❌ 复杂因果网（超 3 节点最小链） | ✅ 未实现 | `ch_chibi_war.tres` `mvp_subset=[n2_east_wind]`，因果链限 N1/N2/N3 |
| ❌ 程序化生成历史线 | ✅ 未实现 | 历史线分叉为手工设计 + 数据驱动（`data/blueprints/*.tres`） |
| 闪避/硬直/格挡（`game-concept §7.2` 完整集，非 §7.4 但属 MVP 外） | ✅ MVP 未启用 | `player_combat.tres` `dodge/stagger mvp_enabled=false` |
| 替代节点 N3'/存在性级联（目标态） | ✅ 架构预留未激活 | `ch_chibi_war.tres` `alternative_nodes` 字段在，MVP 不派发 |

**结论**：**无范围漂移**。代码/场景/数据严守 MVP 单节点 N2 + 普攻 + 1 术法（借风）；多朝代/复杂因果/完整集战斗均仅架构预留未实现，符合 `game-concept §7.1/§7.4`。

---

## 10. 下一步建议（给主理人 · 优先级排序）

1. **【P0 · 必修·阻塞一切】解除 Blocker BP-1（#26）**：补齐 `game/scripts/foundation/data_resources/` 全部数据资源脚本，恢复 headless 零 ERROR + 8 套单测 pass=368。**不修则 Loop A 无法实跑，本报告 §3–§6 无法升级为实机观测**。
2. **【P0 · 必修】Blocker 解除后，design-strategist 复跑实机 round-1.5**：把本报告「设计层评审」逐条升级为「实机观测」，重点验证：① 支柱①的「亲手改写」体感；② 支柱②双轨视觉冲击 + X1 VO 听感；③ 支柱③探索/风向视觉的「读棋盘」体感；④ juice MJ-2 的命中手感；⑤ 新玩家首局认知负荷（MN-5）。
3. **【P1 · 打磨期】**：MJ-1 改写面板输入隔离 + MJ-2 juice 主动反馈接线闭合（命中停顿/震屏/拖尾）——这两项直接关系「改写手感」与「战斗手感」，是 Phase 6 打磨的核心收益点。
4. **【P2 · 可延后】**：MN-1/2/3（回 world 重同步 / 遭遇持久化 / 暂停菜单）——smoke §4 已记录，属 S5 开放世界核心层后续 issue，不影响 Loop A 成立，可排到 Phase 6 后段或 Phase 7 前。
5. **【P2 · 可延后】**：MN-5 面板信息分层 polish（折叠/分步引导）——待实机首局认知负荷数据出来再定方案。

---

## 11. 自验证（design-strategist 自检）

- [x] `docs/playtests/round-1.md` 存在且结构齐全（元信息/Loop A 闭环/支柱/新玩家/难度/手感/卡点/已知问题/范围漂移/下一步）。
- [x] 三条支柱各给 PASS/CONCERNS/FAIL + 证据（双判定：实机 FAIL[Blocker] + 设计层评估）。
- [x] 卡点清单每条可追溯到具体复现步骤（headless 命令/ERROR 摘录/grep 证据）或 GDD 条目。
- [x] 已发现问题中「需新工程介入」者已开 follow-up issue（BP-1 → **#26**）；MJ-2 同属工程介入，待 BP-1 解除实机确认后并入 #26 验收或新开。
- [x] 全文无不实臆造：实机不可达处一律标注「设计层评审（代码/场景/数据读审）/待实机复核」。

---

*—— 文策渊（design-strategist）· Phase 6 打磨（P6-3 · Playtest round-1）· 质量门 FAIL（阻塞项 BP-1 / #26 待解）*
