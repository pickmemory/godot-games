# 设计文档：项目转向「三国长卷」体素沙盒（Web/Three.js）

> 日期：2026-08-15 · 状态：已获主创批准（含 workflow 修改授权："开工，允许你做任何改动"）
> 决策路径：原 Godot 4.7 三国 ARPG 垂直切片 → 方案 D（彻底清空做 MC-like）→ 方案 B 变体（MC 骨架 + 亲历真实历史钩子）

## 1. 背景

原「赤壁改写」项目已产出可玩垂直切片（54 个 GDScript / 44MB）。主创决定**完全转向我的世界类型**，且不做纯克隆：

- 竞品结论（已核实）：纯 MC 克隆无法出圈且有 DMCA 风险（Allumeria 事件）；"不一样的 Minecraft"永远有席位（Terraria/Vintage Story/DQB2/Valheim 均以一个核心维度差异化存活）。
- 出圈判断：AI 接力流水线的迭代速度是真实优势；差异化钩子 + 主创品味掌舵 + 流水线叙事（全程 AI 自主接力）三者叠加是可赌的路径。

## 2. 概念：三国长卷（暂名）

**体素沙盒 × 亲历式历史剧。**

> 你不是改写者，你是长卷里的一个名字：从 184 年黄巾之乱的流民开始，在真实时间线里活着——挖矿种田筑屋是你的生计，烽火烧过来时你怎么活下来是你的抉择。历史不因你而改道，但你在场。

三支柱：
1. **MC 骨架 100%**：挖/建手感、第一夜弧线、工具天梯——好玩的地基照抄不抄会死的部分。
2. **章节 = 真实编年**：黄巾乱 → 讨董 → …… 世界状态真实迁移（村落焚毁、军队过境、季节流转），NPC 历史人物在史实时刻地点出场。
3. **平民尺度**：不指挥赤壁，你在赤壁前夜的乌林村头。大历史冲刷小人物 = 情感钩子 = 中文玩家共鸣点 = 零 DMCA 风险。

设计信条：**先给恐惧，再给天梯，最后给沙盒。**

## 3. 技术方案

| 项 | 决定 |
|---|---|
| 引擎 | 纯 Web：HTML + ES Modules + Three.js（CDN import map，零构建） |
| 理由 | AI 生成命中率最高（流水线接力质量）、浏览器即开即测、迭代最快 |
| 上架 | 开发全程浏览器；发布期 Electron + steamworks.js 打包上架 Steam（Vampire Survivors 先例已核实） |
| 存档 | 开发期 localStorage；抽象存档层，上架时同构替换 Steam Cloud |
| 验证 | `node --check`（语法）+ 结构检查（模块/文档齐全）；Godot headless 验证废止 |

## 4. 工程结构

```
godot-games/                （仓库名不动）
├── web/                    ← 游戏根
│   ├── index.html          import map + canvas + UI 骨架
│   ├── src/
│   │   ├── main.js         装配/主循环/窗口事件
│   │   ├── world.js        chunk 管理（16×16×64，视距加载/卸载队列）
│   │   ├── terrain.js      Simplex 噪声地形 + 树
│   │   ├── mesher.js       面剔除网格化（暴露面合并 BufferGeometry）
│   │   ├── blocks.js       方块注册表（id/纹理/透明度/硬度/掉落）
│   │   ├── textures.js     纹理 atlas（Kenney 贴图优先，程序化 canvas 为占位）
│   │   ├── player.js       第一人称 + WASD + 重力跳跃 + AABB 体素碰撞 + F 飞行
│   │   ├── interaction.js  DDA 射线选块 + 线框高亮 + 左挖右放 + 挖掘进度
│   │   └── ui.js           十字准星 + hotbar（1-9/滚轮）+ FPS
│   └── assets/             第三方素材（含 LICENSE/CREDITS）
├── docs/roadmap.md         MC 路线图
├── team/                   保留
└── .github/                机制保留，验证命令改 web 版
```

## 5. 美术与资产政策

管线：**Kenney Voxel Pack（贴图/UI/SFX 打底）+ Quaternius（低模角色/道具/建筑）+ OpenGameArt 严格筛选补充 + mmx 特调**（中文书法 UI、三国方块变体、中文旁白、中式 BGM——CC0 库没有的）。

许可纪律（红线）：
- Kenney、Quaternius：CC0，商用免署名 ✅
- OpenGameArt：**仅允许 CC0 与 CC-BY**（CC-BY 需进 CREDITS）；**禁用 CC-BY-SA / GPL**（传染性，闭源商用风险）
- `web/assets/CREDITS.md` 记录每个第三方素材的来源与许可；流水线 review 校验
- 程序化 canvas 贴图仅作占位，非最终美术

## 6. 路线图

- **MC-1** 体素骨架 + 真实美术接入：地形/挖放/hotbar/昼夜天空 + **挖掘手感包**（裂纹·粒子·SFX·微屏震）——手感是地基不是装饰
- **MC-2** 生存弧线：第一夜（昼夜 + 敌对 + 血量）+ 木/石/铁工具天梯——给恐惧，给"挖矿的为什么"
- **MC-3** 历史长卷引擎：数据驱动章节时间轴 + 世界状态迁移 + NPC 系统 + 第一章「184·黄巾」可玩切片
- **MC-4** 生计与定居：农耕/建造/村民 + 存档抽象层
- **MC-5** 第二章选段 + 打磨 + Steam 打包（Electron + steamworks.js + Cloud 存档）

每阶段可玩、可验证、可展示。流水线（GLM 接力）按 roadmap 逐项派单。

## 7. 清理清单（已批准）

删：`game/`（44MB）、`docs/design/`、`docs/architecture/`、`docs/playtests/`、`docs/engine-reference/`、`docs/project-charter.md`。
改：`AGENTS.md`（Godot 章节换 Web 约定）、`docs/roadmap.md`（重写）、`.github/workflows/agent-build.yml` + 相关 prompt（验证命令 Godot headless → node --check + 结构检查；已获明确授权）。
留：`team/`、`tools/`、`.gitignore`（微调）。
git 历史可找回一切；本 session 不做任何 git 操作（红线）。

## 8. 错误处理

- WebGL 不可用 → 降级提示页
- chunk 生成 try/catch 隔离，不炸主循环；远 chunk 生成入队分帧
- 指针锁定失败（iframe 环境）→ 明确 UI 提示点击画布

## 9. 验收口径（MC-1）

浏览器打开 `web/index.html`：可走可跳可飞、无限地形、挖有手感（裂纹+粒子+声）、放有反馈、hotbar 选块、昼夜天空、FPS ≥ 60（中端机）。`node --check` 全绿。
