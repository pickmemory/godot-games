# 0002 .ai/ 知识库 + code-facts 自动提取

日期：2026-08-16 · 状态：生效

## 背景

项目由多 agent（本地 pi 会话 + GitHub Actions 流水线 GLM 接力）协作推进，文档曾散落 `docs/`（按阶段写、快速过期），新会话上手要重读大量源码，且无机制保证文档随代码更新。

## 决策（参考 oral-learning-app 工程实践）

建立 `.ai/` 知识库，**"文档 = 代码投影"** 分三层：

1. **code-facts（自动）**：`scripts/ai-context/refresh.sh`（node 零依赖 extract.mjs）机械提取模块图/方块注册表/数据清单——永不手改、永不过期；改 `web/src|web/data` 必跑，产物随工作区合入。
2. **systems（手写锚点）**：每系统一页业务规则，断言带 `文件 · 符号` 锚点（可 grep），现状与规划严格分开。
3. **decisions（ADR）/ ops（踩坑录）**：append-only。

执行协议写进 AGENTS.md（任务前先读 `.ai/`、任务后跑 refresh + 增量更新），流水线自验证步（.github/agent-build-prompt.md）强制执行。

## 后果

- 流水线 agent 改完代码若忘记跑 refresh，code-facts 落后一拍——由下一任 agent 重跑自愈（提取是幂等全量）。
- 行号锚点会漂移，故用 `文件 · 符号` 而非 `文件:行`。
