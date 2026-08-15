# 开发路线图（主理人据此派单）
> 2026-08-15 项目转向：原 Godot 三国 ARPG 切片已废弃（git 历史可查），现为 Web 体素沙盒「三国长卷」。
> 概念与技术方案见 `docs/superpowers/specs/2026-08-15-minecraft-pivot-design.md`；模块接口见 `docs/superpowers/plans/2026-08-15-minecraft-pivot.md`。
> 主理人每轮读本文件，为**第一个 `- [ ]` 未完成项**创建 `agent-build` issue（带角色标签），
> 并在本文件把该项标记 `- [~] #N 已派发`；专家完成后由 workflow 翻 `- [x]`。
> 全部 `- [x]` 则路线图耗尽，流水线退出等主创扩展。
> 格式：`- [ ] <id> <名称> → <输出路径> (<角色标签>)`
> 执行顺序 = 自上而下；勿越阶段派发。

## MC-1 · 体素骨架（已完成 · 主创本地会话直接交付）
- [x] MC-1 体素骨架 + 挖掘手感包（Three.js 零构建：地形/挖放/hotbar/昼夜天空/碰撞飞行 + 裂纹·粒子·合成音反馈；`node --check` 全绿）→ web/ (engineering-lead)

## MC-2 · 生存弧线（给恐惧，给"挖矿的为什么"）
- [~] #27 已派发 MC-2a 第一夜弧线（昼夜加速至 dayLength 180s 保留 + 夜间敌对生物×1：僵尸型 AI 寻路追击 + 玩家血量/受伤/死亡重生 + 夜晚天空与恐惧氛围）→ web/src/ (engineering-lead)
- [~] #28 已派发 MC-2b 工具天梯（木/石/铁镐三级：硬度×效率数据表 + 矿石方块生成（煤/铁深层分布）+ 合成最小集：工作台+木镐配方 + 手持工具模型）→ web/src/ (engineering-lead)
- [~] #29 已派发 MC-2c 手感打磨（挖掘裂纹 overlay 分段贴图 + 掉落物实体拾取 + 受击屏幕反馈 + WebAudio 脚步/挖掘/受击 SFX 全覆盖）→ web/src/ (engineering-lead)

## MC-3 · 历史长卷引擎（差异化核心）
- [~] #30 已派发 MC-3a 章节时间轴引擎（数据驱动 `web/data/chapters/*.json`：编年事件/世界状态迁移/季节流转/触发器；读 AGENTS.md 基线）→ web/src/ + web/data/ (engineering-lead)
- [~] #31 已派发 MC-3b NPC 系统（低模角色 + 漫游/对话/任务接口；历史人物在编年时刻出场；Quaternius 角色适配）→ web/src/ (engineering-lead)
- [~] #32 已派发 MC-3c 第一章「184·黄巾」设计文档（平民流民开场→第一夜→生计→黄巾过境事件弧；MC 骨架与历史事件如何咬合；散文级体验脚本）→ docs/design/mc3-chapter1.md (design-strategist)
- [~] #33 已派发 MC-3d 第一章可玩切片（按 MC-3c 落地：黄巾村落世界状态 + 3 个编年事件 + 2 个 NPC + 章节开场/结尾演出）→ web/src/ + web/data/ (engineering-lead)

## MC-4 · 生计与定居
- [~] #34 已派发 MC-4a 农耕（开垦/播种/生长周期/收获，季节联动）→ web/src/ (engineering-lead)
- [~] #35 已派发 MC-4b 建造扩展（门/窗/楼梯/栅栏方块 + 简易村民 + 房屋判定）→ web/src/ (engineering-lead)
- [~] #36 已派发 MC-4c 存档抽象层（ISaveAdapter 接口：localStorage 实现 + chunk 差分 + 章节进度；为 Steam Cloud 预留同构替换）→ web/src/ (engineering-lead)

## MC-5 · 第二章 + 打磨 + 发布
- [~] #37 已派发 MC-5a 美术圣经 v2（体素三国视觉规范：色板/方块变体/UI 书法风/角色比例；Kenney+Quaternius 接入规范）→ docs/design/art-bible.md (art-director)
- [ ] MC-5b 第二章选段「190·讨董」（设计 + 可玩：迁都焚洛阳事件弧 + 世界状态迁移实例）→ web/src/ + docs/design/ (design-strategist + engineering-lead)
- [ ] MC-5c 音频方向（中式乐器 BGM 四态 + 环境音 + 历史事件旁白；mmx 生成真实资产）→ docs/design/audio/ + web/assets/audio/ (audio-director)
- [ ] MC-5d Playtest 报告 + 已知问题（对照设计信条：恐惧/天梯/沙盒三层动机是否成立）→ docs/playtests/round-1.md (quality-lead)
- [ ] MC-5e Steam 打包（Electron 壳 + steamworks.js 成就/云存档接入 + 构建脚本 + 商店素材清单）→ tools/ + docs/release/ (release-ops)
