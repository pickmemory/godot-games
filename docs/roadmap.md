# 开发路线图（主理人据此派单）

> P1–P4 全部交付物均已合入 main（git log feat(#1)…feat(#12) 可证）。
> Phase 5–7（制作/打磨/发布）已展开为 `- [ ]` 项，流水线已重启。
>
> 2026-08-14 主理人修正：上轮头部误标「全部完成」，实际 Phase 5 已列 9 项 `- [ ]`；本轮派发 P5-1（#13），流水线恢复自上而下派单。
>
> 对账修复（2026-08-13，主理人·游承峰）：#5–#12 交付物均已合入 main 且文件充实，
> 但 workflow 的 `- [~]→- [x]` 自动翻转再次失效（与 #4 同类 bug），故本轮一次性手动回填完成态。

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
- [x] #5 ✓ 已派发 P2-3 主线任务系统 GDD → docs/design/gdd/systems/mainline-quest.md (design-strategist)
- [x] #6 ✓ 已派发 P2-4 面板/成长系统 GDD → docs/design/gdd/systems/panel-progression.md (design-strategist)
- [x] #7 ✓ 已派发 P2-5 实时战斗系统 GDD → docs/design/gdd/systems/combat.md (design-strategist)
- [x] #8 ✓ 已派发 P2-6 开放世界/朝代地图系统 GDD → docs/design/gdd/systems/open-world.md (design-strategist)

## Phase 3 · 技术搭建（依赖 Phase 1/2）
- [x] #9 ✓ 已派发 P3-1 主架构文档 + ≥3 条基础层 ADR → docs/architecture/architecture.md + docs/architecture/adr-*.md (engineering-lead)
- [x] #10 ✓ 已派发 P3-2 Godot 4.7 工程骨架 + 玩家可移动最小场景（TileMap 测试图 + 角色 + 键鼠/手柄移动） → game/ (engineering-lead)

## Phase 4 · 预制作（依赖 Phase 2/3）
- [x] #11 ✓ 已派发 P4-1 关键屏幕 UX 规格（主菜单 / 核心 HUD / 系统面板 / 暂停） → docs/design/gdd/ux-spec.md (design-strategist)
- [x] #12 ✓ 已派发 P4-2 垂直切片资产清单 + 规格（赤壁 TileSet 占位 / 角色 / 系统面板 UI） → docs/design/art/asset-manifest.md (art-director)

## Phase 5 · 制作（可玩原型 · 依赖 Phase 1-4，逐项实现 Loop A 闭环）
- [~] #13 已派发 P5-1 敌人与遭遇原型（1 种山贼/妖异：巡逻 + 追击 + 受击；读 combat.md / open-world.md） → game/scenes/enemies/ (engineering-lead)
- [~] #14 已派发 P5-2 实时战斗实现（普攻连段 + 1 个系统术法，命中盒 / 伤害 / 无敌帧 / 击退；读 combat.md） → game/systems/combat/ (engineering-lead)
- [~] #15 已派发 P5-3 系统面板 UI（呼出/关闭，显示 等级 / 因果点 CP / 当前任务 / 历史偏差 Δ；读 panel-progression.md + ux-spec.md） → game/ui/system_panel/ (engineering-lead)
- [~] #16 已派发 P5-4 主线任务系统（接取 / 追踪 / 完成 + 任务日志；生命周期状态机 + 派发决策 + 数据驱动章节/节点 + 任务日志只读 API + 存档态契约；读 mainline-quest.md §2.1/§2.3/§3/§4/§6 + rewrite-causality §7.1） → game/systems/quest/ (engineering-lead)
- [~] #17 已派发 P5-5 改写/因果引擎（C1/S1 核心层；关键变量 + 历史偏差 Δ 计算 + 因果点 CP 发放 + 历史线分支判定；读 rewrite-causality.md） → game/systems/rewrite/ (engineering-lead)
- [ ] P5-6 抉择与历史线反馈（改写节点抉择 UI + 系统旁白 + 分叉播报；读 rewrite-causality.md） → game/systems/rewrite/ (engineering-lead)
- [ ] P5-7 第一个改写节点可玩内容（赤壁·借东风：村落探索 → 收集气象线索 / 求术士 → 触发抉择 → 系统反馈；串联 P5-1..6） → game/scenes/rewrite_node_chibi/ (engineering-lead)
- [ ] P5-8 主菜单 + 简易存档（新游戏 / 继续 / 设置；进入垂直切片） → game/scenes/menu/ (engineering-lead)
- [ ] P5-9 垂直切片整合 + 烟雾自测（主菜单 → 新游戏 → 探索 → 战斗 → 完成 1 个改写节点闭环；Godot headless import 自测通过；附 playtest 说明） → game/ (engineering-lead)
- [ ] P5-10 核心可玩美术资产 AI 生成（玩家精灵 / 山贼敌人 / 赤壁村落 TileSet / 系统面板背景，用 mmx image 按 art-bible 生成，替换 greybox） → game/assets/sprites/ + game/assets/tilesets/ + game/assets/ui/ (art-director)

## Phase 6 · 打磨（依赖 Phase 5 可玩原型）
- [ ] P6-1 音频方向文档 + 占位音效/BGM（菜单 / 探索 / 战斗 / 抉择；读 art-bible.md 情绪 + 各系统触发点） → docs/design/audio/sound-design.md + game/assets/audio/ (audio-director)
- [ ] P6-2 视觉打磨与 juice（占位美术风格化：玩家 / 敌人 / 赤壁村落 TileSet 配色对齐 art-bible；屏幕震屏 / 命中停顿 / 拖尾） → game/assets/ + game/shaders/ (art-director)
- [ ] P6-3 Playtest 自测报告 + 已知问题清单（跑垂直切片，记新玩家体验 / 难度曲线 / 卡点，开 follow-up issues） → docs/playtests/round-1.md (design-strategist)

## Phase 7 · 发布（待 Phase 5-6 完成后细化）
发布清单 / 本地化 / 构建 / 补丁说明。当前不展开。
