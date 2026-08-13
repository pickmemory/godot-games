# 控制清单 · Control Manifest（一页可执行编码规则）

> Phase 3 · P3-1　|　角色：程基岩（engineering-lead）
> **用途**：程序员据此立即编码；P5 Story 实现与代码评审的硬规则。违反即拒合并。
> 配套：`architecture.md`（详）/ `adr-001~005` / `review-report.md`。

## 🚦 分层与依赖（A4 · DAG 硬约束）
- [ ] **基础层零游戏知识**：`scripts/foundation/` 内不得出现 S1~S5 语义（Δ/CP/v_i/node...），只提供引擎服务。
- [ ] **核心层系统间只经 EventBus 信号通信**（adr-004）：禁止 Autoload 系统间直接方法调用/属性直读。C2 派发 → `EventBus.node_activated.emit` → C1 收，**不是** `RewriteCausalityEngine.activate()`。
- [ ] **DAG 守护**：任何系统**不得**反向写共享数值（C4 不写 v_i/Δ；C5 不写 Δ；C3 不改 CP_earned；C2 不重定义 existence condition）。违 DAG → 拒合并。
- [ ] **玩法层只单向调核心**：actors 调核心契约/发事件；核心不反向调 actors。
- [ ] **两段式 join 键不混淆**：节点按 `node_id`（C1↔C2）、能力按 `ability_id`（C3↔C4）、CP 产出(C1)↔账户(C3)。

## 📦 数据驱动（A3 · adr-002）
- [ ] **零硬编码数值**：GDD 数值落 `data/*.tres`（自定义 Resource）/ `*.json`（长文本/对话/本地化）；代码只读。
- [ ] **静态/运行时边界**：`.tres` 只读蓝图；运行时态入存档（SaveManager），**绝不写回 .tres**。
- [ ] **命名规约**：`class_name` PascalCase（`RewriteNodeData`）；文件/字段 id `snake_case`（`n2_east_wind`）；朝代 `dyn_threekingdoms_chibi`。
- [ ] **资源落点**：按 `architecture §6.2` 表（不另起路径）；`skills/`=C4 执行、`progression/skills/`=C3 解锁。
- [ ] **boot 数据校验**：F3 `validate_data()` 跑 `Σw_i=1.0` / 蓝图可达 / causal_links 引用 / ability_id join；**失败即拒启动报错**。
- [ ] **提交 `.tres` 不提交 `.res`**（Git 文本 diff 友好）。

## 📡 信号与总线（A2 · adr-004）
- [ ] **跨系统信号走 EventBus**：信号名严格按 `architecture §7.2` 总表；**P5 不得私加跨系统信号**（需 ADR/issue 评审）。
- [ ] **场景内信号就近原生/分组**：C4↔C5↔actors 高频信号用节点 signal/`call_group`，不塞 EventBus。
- [ ] **消费方主动 connect/disconnect**：C4/C5 在 world `_ready` connect EventBus，切场景时 disconnect（防悬挂回调）。
- [ ] **信号驱动禁轮询**：跨系统状态变更经信号回调；**不**每帧读生产方属性。
- [ ] **X1 纯消费**：旁白播放器只 connect `*_voiced` 回放，不持态、不反向通信。

## 🖼️ 渲染与场景（adr-001）
- [ ] **冷光仅 L5**：轨道 B 冷光（冷光环/数据浮标/glitch/术法叠层）**只允许在 `L5_SystemCanvas`**；L1~L4 保持暖色，禁冷光污染。
- [ ] **叠层固定**：L0 视差 / L1 地面 TileMapLayer / L2 实体 TileMapLayer / L3 YSort 角色 / L4 前景半透 / L5 CanvasLayer。
- [ ] **拉伸配置**：`stretch/mode=canvas_items`（不可改）、`aspect=expand`、视口 1920×1080、渲染 `gl_compatibility`（⚠️待 P3-2 复核）。
- [ ] **`variable_changed`→`world_visual` 切换 N 帧内完成**（F1 断言）；节点确认时全量重同步（防累积漂移）。

## 🎮 输入（adr-003）
- [ ] **双绑定**：每个 InputMap 动作绑键鼠 + 手柄两事件；代码只查动作名（`is_action_pressed`），**不碰原始键码**。
- [ ] **UI 焦点链**：改写面板/系统面板须方向键焦点导航（手柄无鼠标）；`ui_focus_next` 链完整。

## 💾 存档（F4 · §9）
- [ ] **原子写**：C1/C2/C3/C5 持久态单次事务写入（临时文件 + rename），禁分散写。
- [ ] **一致性校验（读档）**：C2 已确认集 == C1 resolved_nodes；C3 cp_credited_total == Σ(cp_awarded×加成)；**不一致即拒读档报错**。
- [ ] **Loop B 不持久化**：HP/BF/alert/敌人实例不入存档；读档满血 + 清警戒 + C5 重建遭遇。
- [ ] **读档世界重同步**：C5 据 C1 final_vars/working_vars 重建全部 world_visual；置玩家于 checkpoint。

## 🎯 范围红线（A6 · 守垂直切片）
- [ ] **只 1 朝代**：不实现跨朝代热切换/跨朝代累积（X6 愿景外）；不实现 NPC 关系深度（X2 目标态，只留 `relation_seed` 字段）；不做阵营逻辑（X3 仅视觉）。
- [ ] **公式朝代无关**：代码禁朝代字符串字面量（除 `dynasty` 字段读取）；换朝代只换数据包。
- [ ] **不做联网/多人/商城**（`project-charter` 范围）。

## 🧪 可测试（A7）
- [ ] **C1 可独立单测**：Δ/CP 公式只读 C1 自有数据 + 注入 v_i，不依赖 UI/世界。
- [ ] **每个 P5 Story 附测试证据路径**（`team/engineering-lead.md` 输出规范）。

## 🔍 知识诚实（A5）
- [ ] **不臆造 Godot API**：不确定项标 `[待 P3-2 确认]` 或代码内 `# TODO(p3-2-verify)`；缺口见 `architecture §13`。
- [ ] **P3-2 必须核对 §13 API 缺口表**并补 `docs/engine-reference/godot/4.7.md`。

## 🧹 提交卫生
- [ ] **不做 git 操作**（workflow 管）；不碰 `.env*`/`.github/workflows/`；不删测试弱化校验。
- [ ] 只做当前 issue 的事；需用户决策写 issue comment。

---

*程基岩（engineering-lead）· P3-1 控制清单 v0.1*
