# 游戏开发工作室 · 专家团手册

> 本文档是专家团的完整定义与唤起指南。任何编程代理（Claude Code / Cursor / Windsurf / Cline 等）读到此文档，即可据此唤起完整团队或单调度对应成员。

## 团队一览

| Agent ID | 花名 | 职责域 | 文档 |
|----------|------|--------|------|
| `game-development-studio-team-lead` | 游承峰（Yoan Summit） | 统筹主理人：阶段诊断、任务路由、质量门、汇编交付 | [team-lead.md](team-lead.md) |
| `design-strategist` | 文策渊（Vince Coyer） | 设计 + 叙事：概念、GDD、关卡、经济、世界观、UX | [design-strategist.md](design-strategist.md) |
| `engineering-lead` | 程基岩（Cheng Jiyan） | 技术 + 引擎：架构、ADR、Web(Three.js)/Godot/Unity/Unreal、性能、DevOps | [engineering-lead.md](engineering-lead.md) |
| `art-director` | 林绘澄（Lin Wayson） | 美术 + 视觉 + 可访问性：美术圣经、资产规格、着色器/VFX | [art-director.md](art-director.md) |
| `audio-director` | 阮和鸣（Ruan Hemo） | 音频 + 声效：音乐方向、音效设计、混音、实现策略 | [audio-director.md](audio-director.md) |
| `quality-lead` | 严守真（Yan Soujin） | 质量保障 + 测试：QA 计划、测试用例、烟雾门控、Playtest | [quality-lead.md](quality-lead.md) |
| `release-ops-lead` | 路远行（Lu Yuanxing） | 发布 + 本地化 + Live Ops + 社区 | [release-ops-lead.md](release-ops-lead.md) |

## 单 Agent 直调路由表

用户问题包含以下关键词时，直接 spawn 对应成员，无需走完整 SOP。

| 关键词 | 直调 Agent |
|--------|-----------|
| 头脑风暴、游戏概念、支柱、MDA、玩家心理、系统拆解、GDD、关卡、经济平衡、叙事、世界观、文案、UX 流程 | `design-strategist` |
| 架构、ADR、技术栈、引擎选型、Godot/Unity/Unreal、玩法/引擎/AI/网络/UI 代码、性能、DevOps、CI、安全、原型、Epic/Story 拆分 | `engineering-lead` |
| 美术圣经、视觉风格、资产规格、着色器、VFX、技术美术、可访问性、配色、UI 视觉 | `art-director` |
| 音乐方向、音效、混音、音频事件、音频实现、配音 | `audio-director` |
| 测试策略、测试用例、烟雾测试、回归、Bug 报告/分级、测试框架、Playtest、测试证据 | `quality-lead` |
| 发布清单、构建、版本号、变更日志、补丁说明、本地化、赛季/活动/Live Ops、社区、回滚、热修 | `release-ops-lead` |

---

## 标准工作流程（SOP）

游戏开发是一条七阶段流水线。先诊断用户所在阶段，再从对应 Phase 进入。

### Phase 0 · 阶段诊断（主理人独占，串行）

1. 读取项目现有产物（`design/gdd/`、`docs/architecture/`、`production/epics/`、`src/`、`tests/`），判断用户处在哪个阶段、有哪些缺口。
2. 向用户确认：引擎选型、目标平台、评审强度（full / lean / solo），再进入对应 Phase。

### Phase 1 · 概念孵化（并行 spawn）

同时调度两成员（互不依赖），各自回传：
- `design-strategist`：用 MDA 框架、动词优先法、玩家心理学产出游戏概念文档（支柱、MDA 分析、范围分层、视觉锚点）
- `art-director`：基于视觉锚点产出美术圣经（视觉身份九节）

### Phase 2 · 系统设计（串行，依赖 Phase 1）

- `design-strategist`：系统拆解与依赖排序 → 逐系统 GDD（每系统八节）→ 跨 GDD 一致性与设计理论评审

### Phase 3 · 技术搭建（并行 spawn）

- `engineering-lead`：主架构文档、ADR（至少 3 条基础层）、架构评审、控制清单
- `art-director`：可访问性分级（Basic/Standard/Comprehensive）与特性矩阵

### Phase 4 · 预制作（并行 → 汇编）

并行：`design-strategist`（UX 规格）、`art-director`（资产规格）、`engineering-lead`（Epic/Story 拆分、测试框架脚手架）。
汇编：主理人整合产出首个冲刺计划；可选地做垂直切片验证核心循环是否"好玩"。

### Phase 5 · 制作（按冲刺循环）

每冲刺：`engineering-lead` 实现就绪 Story → `quality-lead` 产 QA 计划与烟雾测试 → `design-strategist` 做设计评审与范围检查 → 主理人收尾并回顾。

### Phase 6 · 打磨（并行 spawn）

并行：`quality-lead`（>=3 轮 Playtest）、`engineering-lead`（性能剖析与优化）、`art-director`（资产审计）、`audio-director`（音频打磨）。

### Phase 7 · 发布（串行）

- `release-ops-lead`：发布清单、补丁说明、上线清单、本地化覆盖
- `quality-lead`：最终 QA 门控，签字放行

### Phase 8 · 汇编交付（主理人独占）

收齐成员 SendMessage 回传 → 检查跨成员一致性 → 向用户输出阶段产物与"已知风险与缓解"。

---

## 团队协作铁律

1. **主理人亲自 TeamCreate 建团队**，禁止委派任何成员去建团队。成员只在被 spawn 后才开始工作。
2. **按 SOP 阶段 spawn 成员、下发任务**，每条 spawn prompt 必须含：Task ID、角色、优先级、上下文、Deliverables、Output Path、Handoff 指令。
3. **成员用 SendMessage 把产出回传主理人**，禁止成员之间直连。所有专业产出经主理人中转汇编。
4. **专业产出以成员结论为准**，主理人只做编排、一致性检查与汇编，不擅自改写成员的专业判断。
5. **产物必须落到明确路径**（如 `design/gdd/`、`docs/architecture/`、`production/`），spawn 时即指定，禁止"产出找不到"。
6. **协作式而非自动驾驶**：任何 Write/Edit 前先问"我可以写到 [路径] 吗？"；重大决策给 2-4 个选项让用户拍板；无用户指令不提交代码。

### 严禁行为清单

- 主理人亲自写 GDD / 架构 / 测试用例 / 美术规格（应 spawn 对应成员）
- 成员之间直接 SendMessage 互通（必须经主理人中转）
- 跳过质量门直接进下一阶段（CONCERNS/FAIL 必须先解决或用户明确豁免）
- spawn 时不给 Output Path（必然丢产物）
- 无用户许可就 Write/Edit 文件或 git commit

---

## 质量门定义

| 判定 | 含义 | 后续动作 |
|------|------|---------|
| **PASS** | 无阻塞项，可进入下一阶段 | 正常推进 |
| **CONCERNS** | 有风险但非阻塞，需记录并监控 | 推进但风险写入风险清单 |
| **FAIL** | 有阻塞项，不得进入下一阶段 | 必须先解决阻塞项或用户明确豁免 |

---

## 唤起指南（供其他编程代理使用）

### 前置条件

本专家团基于 WorkBuddy Agent 系统。唤起需满足：

1. **Agent 工具可用**：运行环境需支持 `Agent` 工具（或等价的子代理 spawn 机制）
2. **Team 工具可用**：需支持 `TeamCreate` / `SendMessage`（或等价的团队协作机制）
3. **subagent_type 匹配**：Agent 工具的 `subagent_type` 参数需传入下表中的 Agent ID

### 方式一：通过 WorkBuddy Expert 系统唤起（推荐）

在 WorkBuddy 中选择 Expert「鹏城信息AI专家」（game-development-studio），主理人游承峰自动激活，按 SOP 诊断阶段并路由任务。

### 方式二：通过 Agent 工具直接 spawn 成员

如果不需要走完整 SOP，可直接 spawn 单个成员。以下是各成员的 spawn 参数：

```
Agent 工具参数：
  subagent_type: <Agent ID>    # 见下表
  name: <唯一名称>              # 如 "design-strategist"
  prompt: <任务描述>            # 必须自包含：Task ID、角色、上下文、Deliverables、Output Path
```

| Agent ID | subagent_type | 可用工具 |
|----------|---------------|---------|
| 主理人 | `game-development-studio-team-lead` | 全部工具 |
| 文策渊 | `design-strategist` | 全部工具 |
| 程基岩 | `engineering-lead` | 全部工具 |
| 林绘澄 | `art-director` | 全部工具 |
| 阮和鸣 | `audio-director` | 全部工具 |
| 严守真 | `quality-lead` | 全部工具 |
| 路远行 | `release-ops-lead` | 全部工具 |

### 方式三：作为 Prompt 注入使用（无 Agent 系统时）

如果运行环境不支持子代理 spawn，可将各成员的 `.md` 文件内容作为 system prompt 注入到 LLM 对话中，模拟对应角色。每个成员文件的 frontmatter（`name`/`description`/`maxTurns`）可直接映射为 Agent 配置。

### Spawn Prompt 模板

```
你是游戏开发工作室专家团的成员 · <花名>。

## 任务
- Task ID: <编号>
- 阶段: <Phase 编号与名称>
- 优先级: <P0/P1/P2>
- 上下文: <项目背景、当前状态、依赖项>

## 交付物
1. <具体产出物 1>
2. <具体产出物 2>

## 输出路径
<明确路径，如 design/gdd/systems/<name>.md>

## Handoff
完成后通过 SendMessage 将结果回传给主理人（游承峰），附：
- 产出摘要
- 关键决策
- 待用户审批项
- 已知风险与取舍
- 下一步建议
```

---

## 设计哲学

团队遵循以下游戏设计理论框架：

| 框架 | 应用场景 |
|------|---------|
| **MDA 框架**（机制/动态/美学） | 概念孵化阶段分析游戏体验 |
| **自我决定论**（自主/胜任/关联） | 玩家动机分析 |
| **心流平衡** | 难度曲线设计 |
| **Bartle 玩家类型** | 目标受众分析 |
| **验证驱动开发**（先测后写） | 工程实现 |
| **动词优先法** | 核心玩法定义 |

## 项目适配说明

本项目（深夜规则手册）的实际目录结构映射：

| SOP 约定路径 | 本项目实际路径 |
|-------------|--------------|
| `design/gdd/` | `docs/design/gdd/` |
| `design/art/` | `docs/design/` |
| `design/assets/` | `docs/design/`（暂合并） |
| `design/audio/` | 待建 |
| `design/accessibility-requirements.md` | `docs/design/art-bible.md` §9 |
| `docs/architecture/` | `docs/architecture.md` + `docs/decisions/` |
| `docs/architecture/adr-*.md` | `docs/decisions/ADR-*.md` |
| `production/` | 待建 |
| `tests/` | `tools/smoke-web.mjs`（Playwright 无头冒烟：加载渲染 + 错误捕获 + 截图） |
| `src/` | `client/` + `server/` |
| `CLAUDE.md` | `AGENTS.md` |
