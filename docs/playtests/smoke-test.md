# 垂直切片 · 烟雾自测说明（P5-9 收口）

> 角色：程基岩（engineering-lead） · Issue #21 · Phase 5 收口
> 范围：**冒烟级自测**（smoke test）—— 验证 Loop A 一条主路径不中断、不报错、能收到系统反馈。
> 本文档**不**替代 Phase 6 的正式 playtest 报告（`round-1.md`，design-strategist 产）；只做冒烟级闭环确认。

---

## 0. 一句话闭环

`主菜单 → 新游戏 → world（探索 + 击败山贼）→ 改写节点·借东风（收集线索 → 术士 → 抉择 → 系统反馈）→ 回到 world`

整条链路用既有 P5-1..8 产出**接线**而成（复用优先，见 §5）：
- 启动/存档（P5-8 #20）：`boot.tscn` → `MainMenu` → `world.tscn`；`SaveManager` 在节点确认时自动存档。
- 探索/战斗（P3-2 #10 / P5-1 #13 / P5-2 #14）：`world.tscn` 的 Player + EncounterSpawner + CombatSystem。
- 改写节点编排（P5-7 #19）：`rewrite_node_chibi.tscn` + `RewriteNodeDirector`（线索/术士/七星坛/延迟派发）。
- 改写引擎/抉择/反馈（P5-5 #17 / P5-6 #18）：`RewriteCausalityEngine` + `RewritePanel` + `RewriteFeedbackController` + `TimelineStage`。
- 本 issue（#21）新增的**胶水**：`world.gd`（遭遇清场/调试键 → 跳改写节点场景 + 防循环 + HUD）、`rewrite_node_director.gd`（节点完成后 interact → 回 world）、`world.tscn`（QuestSystem 延迟派发 + HUD）。

---

## 1. 前置与启动

- **引擎**：Godot 4.7.1 stable（`GODOT_BIN`）。工程根：`game/`。
- **启动方式**（任一）：
  - 编辑器 F5（主场景 = `scenes/boot.tscn`，已在 `project.godot` 设定）。
  - 命令行：`$GODOT_BIN --path game`（默认进 boot → MainMenu）。
- **输入**（键鼠为主，`project.godot` InputMap；手柄双绑见 adr-003）：

| 动作 | 键鼠 | 手柄 | 用途 |
|---|---|---|---|
| 移动 | WASD / 方向键 | 左摇杆 | 探索 |
| 冲刺 / 潜行 | Shift / Ctrl | R2 / L2 | stance |
| 普攻（连段） | 鼠标左键 | □ | 战斗 |
| 系统术法 | 鼠标右键 | R1/R3 | 借东风授予后可施（rewrite_proxy） |
| 交互 | E | △ | 收集线索 / 术士 / 七星坛 / 返回世界 |
| 确认推进 | 空格 / Enter | A | 推进历史线演出 / 结算屏 |
| 取消 | Esc | B | 关面板 / 跳过演出动画 |
| 系统面板 | Tab | L1 | 查看 等级 / CP / 当前任务 / 历史偏差 Δ |
| **烟雾自测跳过** | **R** | — | world 内跳过战斗直达改写节点（仅冒烟用） |

> ⚠️ `R` 是冒烟自测的调试捷径（不在 InputMap，用 physical_keycode 直判），免去「必须打赢山贼」才能进入改写节点；正式游玩走「击败山贼 → 自动转场」。

---

## 2. Loop A 操作步骤与每步预期

### 步骤 ①｜主菜单 → 新游戏
- **操作**：启动 → 主菜单出现 → 选「开始新游戏」（无存档时默认聚焦此项）。
- **预期**：
  - 标题《赤壁·改写者》+ 副标「记录员·系统 v0.1 · 已就位」。
  - 底部数据条：`朝代: dyn_threekingdoms_chibi · 存档槽: 0/3 已用`。
  - 点「开始新游戏」→ `SaveManager.new_game()` 选首个空槽（通常槽 0）→ 转场 `world.tscn`。

### 步骤 ②｜world：探索 + 击败山贼
- **操作**：WASD 移动探索；用鼠标左键普攻（3 段连段）击败场上 3 个山贼。
  - 冒烟捷径：直接按 **R** 跳到步骤 ③（免去战斗）。
- **预期**：
  - 左上 HUD：`目标：探索赤壁村落，击败山贼以触发改写节点（借东风）` + 操作提示。
  - 山贼有巡逻/追击/受击（P5-1 #13）；普攻命中盒/伤害/击退/无敌帧正常（P5-2 #14）。
  - **山贼全灭** → `EncounterSpawner` 发 `EventBus.encounter_cleared` → `WorldDirector` 转场 `rewrite_node_chibi.tscn`（控制台打印 `[WorldDirector] Loop A → 改写节点场景（encounter_cleared）`）。
  - Tab 可呼出系统面板（world 阶段尚无活跃节点，数据为 baseline）。

### 步骤 ③｜改写节点·借东风：收集气象线索
- **操作**：在村落里走到 3 个发光线索点（蓝/青色占位方块，带标签），各按 **E** 采集。
- **预期**：
  - 每采集一条：HUD `气象线索：n/3 · intel_cov：x.xx` 递增；`intel_updated` 发出（0.25 → 0.50 → 0.75）。
  - 控制台（debug_log 开）：`[RewriteNodeDirector] clue collected … intel_cov=…`。
  - ⚠️ **至少采集 2 条**才能让术士开门（`required_clue_count=2`）；采集 3 条（intel_cov=0.75）才能解锁精确蓝图 `bp_player_self_wind`（需 intel_cov≥0.6）。

### 步骤 ④｜术士：触发改写
- **操作**：走到「术士（求东风）」标记（橙黄色），按 **E**。
- **预期**（线索 ≥ 2）：
  - 术士授术：`ability_unlocked(ability_system_magic_wind)` → 右键系统术法可用。
  - 延迟派发：`QuestSystem.enter_chapter()` → emit `node_activated(n2_east_wind)` → 改写引擎初始化 v_i=baseline + **RewritePanel 呼出**。
  - HUD 目标切到「改写节点已激活…」；状态：`术士已授术法·改写节点激活`。
  - 控制台：`[RewriteNodeDirector] shaman granted ability …` + `quest.enter_chapter dispatched node n2_east_wind`。
- 线索 < 2 时：术士拒绝（`术士：线索不足，无法开启改写…`），不派发、不授术。

### 步骤 ⑤｜（推荐）七星坛施术 + 选蓝图
- **操作**：
  1. 面板已呼出但仍可移动（WASD）；走到「七星坛」标记（紫色），按 **E** 破坛 → `verb_executed(verb_smash_altar)` → 引擎应用 `v_altar=smashed`（DAG §5.3，由 C1 自改，面板/导演不写 v_i）。
  2. 在 RewritePanel 选 **`bp_player_self_wind`**（intent：玩家自代东风；需 intel_cov≥0.6，即 3 条线索）。
- **预期**：选中蓝图后面板高亮 + 意图旁白；Δ 预览刷新。v_altar=smashed 会在结算时贡献 Δ。
- 冒烟极简路径（不破坛、选 `bp_baseline_keep`）：也能完成节点，但 Δ≈0、反馈为 minor 短横幅（见 §4）。

### 步骤 ⑥｜确认改写 → 系统反馈
- **操作**：在 RewritePanel 点「**确认改写**」按钮（或聚焦后 Enter）。
- **预期**（canonical 路径：3 线索 + bp_self + 破坛）：
  - 面板发 `node_committed` → 引擎结算 → 发一组结算信号（`deviation_recomputed`/`intent_match_computed`/`cp_awarded`/`feedback_tier`/`node_resolved`）。
  - RewritePanel 收起 → **TimelineStage 历史线分叉演出**（notable 档，Δ=20 ∈ [20,80)）+ 结算屏（显示 Δ / CP / 旁白）。
  - 结算数值（与单测 `test_rewrite_node_chibi.gd` H 一致）：**Δ_node = 20**（v_altar smashed，w0.2·d1.0·100）、**CP_earned = 92**（round(120·0.7·1.1)）、blueprint=bp_player_self_wind。
  - 演出中按 空格/Esc 可跳过动画（结算数值不可跳）；再按 空格 关闭演出。
  - `node_resolved` 触发 **SaveManager 自动存档**到当前槽（控制台无报错即成功；可用「继续游戏」复查，见步骤 ⑧）。
  - 导演进 NODE_COMPLETE：HUD「Loop A 闭环完成 · 按 E（interact）返回世界」。

### 步骤 ⑦｜回到 world
- **操作**：演出关闭后（TimelineStage 不可见），按 **E** 返回 world。
- **预期**：
  - 控制台：`[RewriteNodeDirector] Loop A → 返回 world（节点已确认并存档）`。
  - 转场回 `world.tscn`：HUD 显示 `目标：改写节点（借东风）已完成 · 自由巡游…` + `闭环已达成…`（`_is_loop_a_complete()` 检测到存档含已确认节点，**不再重复触发**改写节点，防循环）。
  - 玩家可继续探索/战斗（山贼随新 world 实例重新生成）。

### 步骤 ⑧｜（验收）读档重同步
- **操作**：关闭窗口退出 → 重启 → 主菜单「继续游戏」（默认聚焦最近槽）→ 进 world。
- **预期**：
  - `SaveManager.continue_game()` 读最近槽 + 一致性校验通过 → 预载 `_pending_load`。
  - `world._ready` 调 `SaveManager.apply_pending_load()` → C1/C2 deserialize 恢复（N2=已确认、chapter_progress、resolved_nodes）。
  - world HUD 仍显示「已完成」（`_is_loop_a_complete()` 命中）。
  - Tab 系统面板可见章节进度/Δ 累计（读档 resync 信号重发，防 UI 失同步）。

---

## 3. 闭环判定（PASS 条件）

冒烟自测 **PASS** 当且仅当以下全部成立：

1. ✅ 主菜单「新游戏」能进 world，无报错。
2. ✅ world 击败山贼（或按 R）能转场到改写节点场景，无报错。
3. ✅ 改写节点场景：能采集线索 → 术士触发 → RewritePanel 呼出（不卡死、不报错）。
4. ✅ 在 RewritePanel 选蓝图 + 确认改写 → 引擎结算 → 收到系统反馈（TimelineStage 演出 / 结算屏 显示 Δ 与 CP；至少 minor 短横幅）。
5. ✅ 节点完成后按 E 能回到 world，且 world 不再重复触发改写节点（防循环生效）。
6. ✅ 退出后「继续游戏」能重同步（C1/C2 恢复，不报错、不崩）。
7. ✅ `$GODOT_BIN --headless --import --quit`（在 `game/` 下）零 ERROR。
8. ✅ 既有 8 套单测全部 ALL PASS（不回归，见 §6）。

---

## 4. 已知卡点 / 待打磨项（移交 Phase 6，**非本 issue 阻塞**）

> 这些是冒烟自测中暴露的、属「打磨/正式 S5 落地」范畴的粗糙点，记录在案，不在本收口 issue 修。

1. **RewritePanel 呼出时玩家仍可移动**：面板是 Control（非全屏强模态暂停），术士触发后玩家可边移动边操作（如走至七星坛破坛）。体验略怪但功能正确；正式强模态/输入隔离留 Phase 6（ux-spec §3.2 强模态细化）。
2. **回到 world 不做运行时态重同步**：返回 world 后 world 的 C1/C2 为 fresh（仅存档为真值）；故用「窥探存档」判定闭环完成，而非运行时态。完整的「回 world 即重建 C5 世界态（TileMap/NPC/遭遇 spawn_state/v_i 视觉重同步）」依赖 S5 开放世界核心层（open-world §5.5 / architecture §9.2 完整版），属后续 issue / Phase 6。
3. **world 重入后山贼重生**：每次进 world（新场景实例）EncounterSpawner 重新生成山贼；因 §2 防循环已禁用再触发，不会死循环，但「已完成的 world」仍刷新敌人——待 S5 遭遇 spawn_state 持久化（open-world §3.6）。
4. **C3 面板成长 / C5 开放世界核心层未落地**：SaveManager 对 C3/C5 存防御性空快照（不崩、不丢字段结构）；系统面板的「等级/CP 余额」权威账户（C3）落地前为占位显示。
5. **无暂停菜单 / 退出回主菜单**：垂直切片仅主菜单→world→改写节点→world；world 内无暂停菜单（退出靠关窗）。`SaveManager.atomic_save(slot)` API 已暴露，待暂停菜单 issue 接线。
6. **`QuestSystem: chapter_data 未赋值` WARNING**：world.tscn 故意置空 chapter_data（延迟派发，见 `world.gd` 类注），触发 `quest_system.gd` 的防御性 `push_warning`。这是 **WARNING 不是 ERROR**，不违反「零 ERROR」红线；信息性提示，可忽略。
7. **美术/音频为 greybox 占位**：玩家/山贼/村落/UI 全为纯色占位（P5-10 由 art-director 用 mmx 生成真实资产替换）；无 BGM/音效（P6-1 audio-director）。本 issue 不生成多模态资产（工程整合 issue）。
8. **mmx 不可用**：CI 无 `MINIMAX_API_KEY`（`mmx` 未装/无 key），本 issue 无美术/音频交付物，未生成实资产——符合降级约定（本 issue 本就无资产交付物）。

---

## 5. 复用与胶水说明（验收要点 3：优先复用而非重写）

本 issue **未重写任何 P5-1..8 系统**，只做接线/胶水/校时/默认配置：

| 改动文件 | 性质 | 说明 |
|---|---|---|
| `game/scripts/gameplay/world.gd` | **胶水（改）** | 新增：遭遇清场/调试键 → 跳改写节点场景；`_is_loop_a_complete()` 防循环；HUD 刷新。保留原 Camera 跟随 + apply_pending_load。 |
| `game/scenes/world/world.tscn` | **配置（改）** | QuestSystem `chapter_data` 置空（延迟派发，校时）；新增 HUDLayer（ObjectiveLabel/HintLabel）。其余系统节点全部保留（供「继续」读档注入 C1/C2）。 |
| `game/scenes/rewrite_node_chibi/rewrite_node_director.gd` | **胶水（改）** | 新增：NODE_COMPLETE + interact → 回 world（守卫：仅当前场景根 + 演出不在进行）。原编排逻辑零改动。 |
| `docs/playtests/smoke-test.md` | **新（本文档）** | 冒烟自测说明。 |

未改动：boot/main_menu/save_manager/quest_system/rewrite_causality_engine/rewrite_panel/rewrite_feedback_controller/timeline_stage/combat_system/player/enemy/encounter_spawner 及全部数据 `.tres`。

---

## 6. 自验证证据

### 6.1 Godot 4.7 headless import（红线级，AGENTS.md）

```
$ cd game && $GODOT_BIN --headless --import --quit
Godot Engine v4.7.1.stable.official.a13da4feb
[ DONE ] first_scan_filesystem
[ DONE ] update_scripts_classes   （注册 Boot/MainMenu/SaveSlotPanel/WorldDirector…）
[ DONE ] loading_editor_layout
=== IMPORT EXIT: 0 ===            （零 ERROR / 零 SCRIPT ERROR / 零 PARSE ERROR）
```

### 6.2 既有单测（不回归）

```
$ for t in combat enemy quest rewrite rewrite_feedback rewrite_node_chibi save_manager system_panel; \
    do $GODOT_BIN --headless res://tests/unit/test_$t.tscn ; done

combat:             TEST SUMMARY: pass=48  fail=0   RESULT: ALL PASS
enemy:              TEST SUMMARY: pass=14  fail=0   RESULT: ALL PASS
quest:              TEST SUMMARY: pass=50  fail=0   RESULT: ALL PASS
rewrite:            TEST SUMMARY: pass=86  fail=0   RESULT: ALL PASS
rewrite_feedback:   TEST SUMMARY: pass=65  fail=0   RESULT: ALL PASS
rewrite_node_chibi: TEST SUMMARY: pass=36  fail=0   RESULT: ALL PASS   ← 导演改动未回归
save_manager:       TEST SUMMARY: pass=28  fail=0   RESULT: ALL PASS   （C1 resolved==C2 confirmed 一致性校验生效）
system_panel:       TEST SUMMARY: pass=41  fail=0   RESULT: ALL PASS
合计：pass=368 fail=0
```

> `save_manager` 测试中那行 `ERROR: [SaveManager] 槽 2 一致性校验失败…` 是**一致性校验门测试**（C 测试用例）**故意**构造不一致存档、断言其被拒读档——是预期产出（`push_error` 来自被测的生产代码），该测试本身 `fail=0`。

### 6.3 场景级 headless 冒烟（_ready/运行时无 ERROR）

- `world.tscn`（6s headless）：仅 1 条 `WARNING: QuestSystem: chapter_data 未赋值`（预期，见 §4.6），零 ERROR。
- `rewrite_node_chibi.tscn`（6s headless）：`[RewriteNodeDirector] flow=east_wind clues=3 threshold=2 total_intel=0.75 quest=true engine=true`，零 ERROR。
- `boot.tscn`（5s headless）：boot → MainMenu 正常加载，零 ERROR（等待输入超时退出）。

### 6.4 闭环可跑性

闭环各环节均已由对应单测覆盖其逻辑（director 编排 = `test_rewrite_node_chibi` 8 节；存档/读档/重同步 = `test_save_manager` 7 节；转场为标准 `change_scene_to_file`，headless 场景加载已验证）。本 issue 未引入新单测（无新可单测纯逻辑；转场/UI 交互属集成层，由本文档冒烟步骤覆盖）。

---

## 7. 设计/技术决策摘记

1. **world 作「探索+战斗」前奏，改写节点为独立场景，转场桥接**（而非把改写节点内容塞进 world）：最大化复用 P5-7 #19 已就位且自测通过的自包含改写节点场景；world 仅加转场胶水 + 校时（chapter_data 置空避免一进 world 就弹 RewritePanel，破坏「探索→战斗→改写」序列）。代价：跨场景 C1/C2 不共享运行时实例（真值在存档），用「窥探存档」防循环（§4.2）。
2. **校时：world 的 QuestSystem chapter_data 置空**（延迟派发）：N2 派发改由改写节点场景内的 `RewriteNodeDirector` 在术士触发时 `quest.enter_chapter()` 显式完成（与 #19 既有「延迟派发」范式一致）；C1/C2 仍留 world 供「继续」读档 `apply_pending_load` 注入。
3. **防循环用存档窥探，不做运行时态重同步**：返回 world 后用 `SaveManager.load_slot` 只读判定「是否已有已确认节点」，避免 world↔改写节点来回转场死循环；完整的回 world 世界态重建（C5）依赖未落地的 S5 核心层，留后续 issue（§4.2），不在本收口 issue 做。
4. **知识诚实**：转场一律用 `SceneTree.change_scene_to_file`（Godot 4.7 标准，architecture §8.4）+ `call_deferred`（避开 _ready/信号回调中直接 change_scene 的「busy set」错误，同 `boot.gd` 既有范式）；未臆造引擎 API。
