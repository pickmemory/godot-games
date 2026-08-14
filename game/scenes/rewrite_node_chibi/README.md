# rewrite_node_chibi · 赤壁·借东风改写节点（P5-7 · issue #19）

> 第一个**端到端可玩**改写节点：把 Loop A（探索 → 改写 → 反馈）在 N2 借东风节点上跑通。
> **整合型 Story**：串联 P5-1..P5-6 已落地系统，本目录只做**节点编排 + 场景内数据驱动**，不重写前置系统。

## 场景文件
- `rewrite_node_chibi.tscn` — 自包含可玩场景（村落 TileMap + 线索点 + 术士 + 七星坛 + 敌人遭遇 + 全系统编排）。
- `rewrite_node_director.gd` — `RewriteNodeDirector` 节点状态机编排器（探索→收集→门→术士→抉择→结算→完成）。

## 运行
```bash
# 独立运行（headless 仅验证装载；带窗口可实际操作 Loop A）
$GODOT_BIN --path game res://scenes/rewrite_node_chibi/rewrite_node_chibi.tscn
# 或临时设为主场景运行（不修改 project.godot）：
$GODOT_BIN --path game res://scenes/rewrite_node_chibi/rewrite_node_chibi.tscn
```
可被主世界加载：本目录为自包含 `PackedScene`，future world loader 可 `instantiate()`（architecture §8.2 叠层）。

## 玩法流程（Loop A · 对照 issue §2）
1. **村落探索**：玩家（WASD/手柄）在赤壁村落 TileMap 自由移动；沿途有山贼遭遇（复用 #13/#14：普攻左键 + 系统术法右键 skill_1）。
2. **收集气象线索**：3 个光点（芦苇观察点 / 江岸渔夫 / 观天老叟），靠近按 **E**（interact）采集 → `intel_cov` 累加 → 发 `intel_updated`（S5→S1）。
3. **求术士**：村中心的「术士」，靠近按 E。线索数 **≥ 2**（门阈值）→ 术士授予「系统·借风术」（`ability_unlocked`）并触发改写派发。
4. **触发抉择**：术士派发 → `RewritePanel`（#18）呼出，列出蓝图（按 `intel_cov` 门控：`bp_player_self_wind` 需 intel_cov≥0.6）。
5. **系统反馈**：玩家选蓝图 +（可选）在七星坛施术/破坏 → 点「确认改写」→ 改写引擎（#17）结算 Δ/CP/分支 → 系统旁白 + 历史线分叉演出/结算屏（#18）。
6. **节点完成**：`node_resolved` → `QuestSystem`（#16）置 N2「已确认」+ 推进章节进度 + `quest_reward_declared`。

> 改写面板为**非阻塞叠加层**（`mouse_filter=ignore`，仅消费 ui_cancel）：移动/普攻/术法/交互键在面板打开时仍生效——
> 玩家可「边走边改」：打开面板后走到七星坛施术（skill_1，发 `verb_self_borrow_wind`）或破坏（E，发 `verb_smash_altar`），面板 Δ 实时预览。

## 数据驱动（AGENTS.md 数据驱动约定）
| 文件 | 作用 |
|---|---|
| `data/intel/poi_wind_reed_observatory.tres` | 线索 POI（芦苇观察点，wind_intel，intel_raw 0.25） |
| `data/intel/poi_wind_fisherman.tres` | 线索 POI（江岸渔夫） |
| `data/intel/poi_sky_old_man.tres` | 线索 POI（观天老叟） |
| `data/scenes/rewrite_node_chibi/east_wind_flow.tres` | 节点编排配置（线索集/门阈值/术士授术/七星坛动词/落位/HUD 文案） |
| `data/nodes/n2_east_wind.tres`（#17） | 节点数值模型（vars/blueprints/verbs/causal_out）— **引用不改** |
| `data/quests/nodes/n2_east_wind.tres`（#16） | 节点派发/文案 — **引用不改** |

## 复用契约（issue 验收要点 3 · 不重写前置系统）
- 敌人/战斗：`bandit.tscn` + `EncounterSpawner`（#13）/ `CombatSystem`（#14）既有信号。
- 改写引擎：`RewriteCausalityEngine`（#17）的 `node_activated`/`verb_executed`/`node_committed` → 结算信号组。
- 抉择 UI：`RewritePanelView`（#18）`node_activated` 呼出 + `node_committed` 确认。
- 反馈演出：`RewriteFeedbackController` + `TimelineStage` + `SettlementScreen`（#18）。
- 任务回写：`QuestSystem`（#16）`_on_node_resolved` 自行置「已确认」+ 章节进度。
- 本导演**不写 v_i/Δ/CP**（DAG 硬契约）；只发 `intel_updated` / `verb_executed` / `ability_unlocked` / 调 `quest.enter_chapter`。

## 测试
```bash
$GODOT_BIN --headless --path game res://tests/unit/test_rewrite_node_chibi.tscn
```
覆盖 A-H：初始态 / 线索采集 / 术士门拒/通 / 蓝图 intel 门 / 七星坛 verb / 确认结算（Δ=20, CP=92）/ quest 完成回写。

## 已知设计决策与缺口（issue comment 级）
1. **派发延迟**：`QuestSystem.chapter_data` 在本场景置空（`_ready` 不自动派发），由导演在术士触发时 `quest.enter_chapter()` 显式派发。
   原因：① 场景树 `_ready` 顺序下自动派发的 `node_activated` 会在引擎/面板 connect 前发出（信号丢失）；
   ② 设计要求「探索→收集→术士→抉择」先后序（issue §2.3-§2.4）。**未改 QuestSystem 代码**（用其公共 `enter_chapter` API）。
2. **S5 代理**：S5 探索核心层（C5）未落地。本导演作为**玩法层 S5 代理**聚合 `intel_cov`、发 `intel_updated`/`verb_executed`/`ability_unlocked`，
   信号契约与 rewrite-causality §7.4 / open-world §6.2 一致；正式 C5 落地后由其接管。
3. **美术 greybox**：本 issue 不生成美术（留 P5-10）；线索点/术士/七星坛用纯色 `PlaceholderTexture2D` 占位。
4. **verb_block_kongming 未演练**：需截杀「诸葛亮」敌人才触发（需新敌人数据，超出本 issue 范围）；本节点演练了 `verb_self_borrow_wind`（战斗术法）与 `verb_smash_altar`（交互）两条动词路径。
