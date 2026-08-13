# 架构评审报告 · Architecture Review Report

> Phase 3 · P3-1　|　角色：程基岩（engineering-lead）· 单代理自验证（替代会审）
> 评审对象：`architecture.md` + `adr-001~005` + `control-manifest.md`
> 评审依据：issue #9 验收要点、`AGENTS.md` 基线/红线、`team/engineering-lead.md` 输出规范、5 GDD + art-bible。

## 总体结论：**PASS（带 CONCERNS）**

> 架构**支撑垂直切片范围（1 朝代 + Loop A 闭环）**，分层清晰、ADR 完备、需求可追溯、无悬空依赖、无臆造 API（缺口已标记）。可进入 P3-2 工程骨架。
> **CONCERNS** = 一批 Godot 4.7 API 待 P3-2 实测核对 + 2 项 GDD 跨系统数值待联合确认（非架构阻塞，已记录）。

---

## 1. 验收要点逐条核对（issue #9）

| 验收点 | 状态 | 依据 |
|---|---|---|
| 主架构文档：分层 + 每层模块/职责/依赖方向/数据流 | ✅ | `architecture §3`（三层模块表）、`§4`（DAG + 依赖规则）、`§5`（数据归属）、`§10`（Loop A 数据流走查） |
| 从 GDD 抽技术需求 | ✅ | 5 GDD + art-bible 全部读完并显式引用；`§14` 需求可追溯矩阵 |
| ADR ≥3 条基础层决策，含上下文/备选/决定/后果 | ✅ | 5 条（adr-001~005），每条四节齐全；覆盖渲染/数据驱动/输入/节点信号/朝代热切换 5 个候选全量 |
| 架构评审报告 PASS/CONCERNS/FAIL + 依据 + 遗留风险 | ✅ | 本文件 §1~§4 |
| 控制清单一页可执行 | ✅ | `control-manifest.md` |
| 对齐基线（Godot 4.7.1/GDScript/2D/canvas_items/数据驱动/game 根/headless 命令） | ✅ | `architecture §2`；adr-001/002；缺口 K1 已标 |
| ADR 含备选方案与后果 | ✅ | 每条 ADR 均有「备选方案（≥3 选项）+ 后果（正面/负面/缺口）」 |
| 引擎一致性（Godot 4.7.1 兼容） | ✅（带缺口） | 不臆造 API；§13 缺口表 9 项待 P3-2 核对 |
| 知识诚实（不臆造 API） | ✅ | §13 + 各 ADR「缺口」节；`AGENTS.md`「渲染 2d」字面歧义已澄清（adr-001） |
| 需求可追溯（架构模块回指 GDD 需求 ID） | ✅ | §14 矩阵抽样 + §5/§7/§10 全量映射 |
| 支撑垂直切片范围（勿过度设计多朝代/多人/网络） | ✅ | §6.4/adr-005/`control-manifest` 范围红线节；X2/X3/X6 明确不做 |

## 2. 自验证 · 文档结构核对（角色输出规范）

| 检查项 | 结果 |
|---|---|
| 三层分层（基础/核心/玩法）清晰，每模块有职责/所有者/部署形态 | ✅ §3.1/§3.2/§3.3 |
| DAG 无环论证 + 与 `systems-index §3.1` 对齐 | ✅ §4.2（S1 根；C4→C1 事件不写 Δ；C3→C1 只读契约） |
| 数据归属表（共享实体唯一所有者 + 两段式） | ✅ §5（含 CP/节点/存在性/能力两段式 join） |
| 信号契约总表（与 5 GDD §6 零新增冲突） | ✅ §7.2（逐条回引 GDD 节号） |
| 场景树组织（叠层 + Autoload 注册 + world 树） | ✅ §8.1/§8.2 |
| 存档（原子写 + 一致性校验 + 读档重同步） | ✅ §9 |
| Loop A 端到端走查闭合 | ✅ §10（N2 自借东风全链路） |
| 性能预算落地 | ✅ §11 |
| 可访问性/输入 | ✅ §12 + adr-003 |
| 待审批项与 GDD 对齐 | ✅ §15 |
| ADR 覆盖 issue 列举的全部 5 个基础层抉择 | ✅ adr-001~005 |
| 控制清单覆盖全部分层/数据/信号/渲染/输入/存档/范围/测试/诚实 | ✅ control-manifest |

## 3. 遗留风险（CONCERNS）

> 非架构阻塞，按风险分级列；均已在正文/ADR 标注。

### 3.1 待 P3-2 实测的 Godot 4.7 API（9 项，§13）
- 渲染方法字段、TileMapLayer 多层/碰撞、YSort 用法、NavigationRegion2D、typed signal 语法、存档原子写 API、异步加载、手柄死区、Camera2D 属性。
- **缓解**：P3-2 工程骨架逐一核对 → 回填各 ADR + 建 `docs/engine-reference/godot/4.7.md`。`control-manifest` 强制 P5 不臆造、标 `TODO(p3-2-verify)`。

### 3.2 GDD 跨系统数值待联合确认（2 项，§15）
- **alert_mult 应用方**（`combat §7.7①`）：C1 `diff` 公式无 alert 项；待 C1/C4 确认。
- **intel_cov 上限**（`open-world §7.6②`）：`=1` 可能 `cost_RE≈0`（经济失衡）；待 C1/C5 确认封顶 <1 或保底项。
- **影响**：均不破坏架构结构（C1 公式模块可平滑增补），但影响 P5 数值实现。建议主创在 P3-2 前审批。

### 3.3 EventBus「上帝总线」风险（adr-004）
- 跨系统信号集中可能膨胀。
- **缓解**：信号名锁 §7.2 总表；P5 禁私加跨系统信号；场景内信号走原生；调试钩子可观测。

### 3.4 Autoload 与场景节点生命周期（adr-004）
- C4/C5 场景切换重建，Autoload connect 绑旧节点失效风险。
- **缓解**：C4/C5 `_ready` 主动 connect、切出 disconnect；P3-2 实测验证。

### 3.5 手绘风性能预算未冻结（§11 / `art-bible §8.4`）
- 同屏精灵/粒子/遭遇上限是美术倾向，精确值待 P3-2 + P6 剖析。
- **缓解**：C5 遭遇互斥队列 + 图集合批；P6 性能剖析冻结。

## 4. 是否过度设计检查（守范围）

- ❌ 多朝代热切换：**只铺路不实现**（adr-005 明确本切片仅加载 1 朝代）。
- ❌ 跨朝代偏差累积：愿景外（§6.4）。
- ❌ NPC 关系深度（X2）/ 阵营逻辑（X3）：只留字段/视觉，不实现（§5）。
- ❌ 联网/多人/商城：范围外（`project-charter`）。
- ❌ 复杂因果网：因果链限 3 节点最小链（守 `game-concept §7.4`，架构不扩展）。
- ✅ 架构聚焦：1 朝代 + Loop A 闭环 + 可演进接口（不挡愿景）。

> **结论**：未越垂直切片范围；可演进接口为「数据维度留口」而非「提前实现」，符合 `AGENTS.md`「架构不挡路」与 `project-charter`「严守范围」。

## 5. 自验证 · Godot headless 状态

- **未跑 headless 校验**。原因：`game/` 工程目录尚未创建（本项 P3-1 是纯架构文档；Godot 工程骨架属下一个 issue **P3-2**）。`GODOT_BIN=/tmp/godot/Godot_v4.7.1-stable_linux.x86_64` 存在且可执行，但无可校验的 `project.godot`。
- **本任务为纯文档**（无脚本/场景产出），自验证走**文档结构核对**（§2）+ **DAG/范围/诚实核对**（§3/§4），已完成。
- **P3-2 验收项**：在 `game/` 下跑 `$GODOT_BIN --headless --import --quit` 确保无脚本/场景加载错误；并核对 §13 API 缺口表。

---

## 6. 交付物清单

| 文件 | 内容 |
|---|---|
| `docs/architecture/architecture.md` | 主架构（16 节：目标/基线/分层/DAG/数据归属/资源/信号/场景树/存档/Loop A 走查/性能/可访问性/缺口/追溯/待审批/下一步） |
| `docs/architecture/adr-001-rendering-and-stretch.md` | 渲染管线与拉伸策略 |
| `docs/architecture/adr-002-data-driven-resources.md` | 数据驱动方案（.tres/.json 与代码边界） |
| `docs/architecture/adr-003-input-system.md` | 输入系统（键鼠+手柄） |
| `docs/architecture/adr-004-node-and-signal-architecture.md` | 节点/信号架构 vs 单例滥用 |
| `docs/architecture/adr-005-dynasty-pack-hot-swap.md` | 朝代热切换（铺路，不实现切换） |
| `docs/architecture/control-manifest.md` | 一页可执行编码规则 |
| `docs/architecture/review-report.md` | 本评审报告 |

> **PASS（带 CONCERNS）**：架构可作为 P3-2 工程骨架的技术地基。CONCERNS（API 缺口 + 2 项数值待确认）已记录且有缓解路径，不阻塞推进。

---

*程基岩（engineering-lead）· P3-1 架构评审 · 单代理自验证 · 待主创评审*
