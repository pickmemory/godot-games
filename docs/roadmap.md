# 开发路线图（主理人据此派单）

> 主理人每轮读本文件，为**第一个 `- [ ]` 未完成项**创建 `agent-build` issue（带角色标签），
> 并在本文件把该项标记为 `- [~] #N 已派发`；专家完成后改 `- [x]`。
> 全部 `- [x]` 则路线图耗尽，流水线退出等主创扩展。
> 格式：`- [ ] <id> <名称> → <输出路径> (<角色标签>)`
> 执行顺序 = 自上而下；勿越阶段派发。

## Phase 1 · 概念孵化
- [x] #1 ✓ 已派发 P1-1 游戏概念文档（设计支柱 / MDA / 范围分层 / 核心循环细化 / 赤壁改写节点示例×3） → docs/design/gdd/game-concept.md (design-strategist)
- [x] #2 ✓ 已派发 P1-2 美术圣经（九节视觉身份规范） → docs/design/art/art-bible.md (art-director)

## Phase 2 · 系统设计（依赖 Phase 1 产出）
- [x] #3 ✓ 已派发 P2-1 系统索引 → docs/design/gdd/systems-index.md (design-strategist)
- [x] #4 ✓ 已派发 P2-2 改写/因果引擎 GDD（专家已产出并合入 main，issue #4 agent-done；本轮主理人对账修复：创建 #4 时漏翻 - [~]，致 workflow 的 [~]→[x] 匹配落空，故手动回填完成态） → docs/design/gdd/systems/rewrite-causality.md (design-strategist)
- [~] #5 已派发 P2-3 主线任务系统 GDD → docs/design/gdd/systems/mainline-quest.md (design-strategist)
- [~] #6 已派发 P2-4 面板/成长系统 GDD → docs/design/gdd/systems/panel-progression.md (design-strategist)
- [~] #7 已派发 P2-5 实时战斗系统 GDD → docs/design/gdd/systems/combat.md (design-strategist)
- [~] #8 已派发 P2-6 开放世界/朝代地图系统 GDD → docs/design/gdd/systems/open-world.md (design-strategist)

## Phase 3 · 技术搭建（依赖 Phase 1/2）
- [~] #9 已派发 P3-1 主架构文档 + ≥3 条基础层 ADR → docs/architecture/architecture.md + docs/architecture/adr-*.md (engineering-lead)
- [~] #10 已派发 P3-2 Godot 4.7 工程骨架 + 玩家可移动最小场景（TileMap 测试图 + 角色 + 键鼠/手柄移动） → game/ (engineering-lead)

## Phase 4 · 预制作（依赖 Phase 2/3）
- [ ] P4-1 关键屏幕 UX 规格（主菜单 / 核心 HUD / 系统面板 / 暂停） → docs/design/gdd/ux-spec.md (design-strategist)
- [ ] P4-2 垂直切片资产清单 + 规格（赤壁 TileSet 占位 / 角色 / 系统面板 UI） → docs/design/art/asset-manifest.md (art-director)

## 后续阶段（Phase 5-7 · 待前序完成由主创细化）
制作 → 打磨（Playtest / 性能 / 音频） → 发布。当前不展开，避免摊薄焦点。
