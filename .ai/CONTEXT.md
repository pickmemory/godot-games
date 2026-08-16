# 三国长卷 · 项目总览

> AI 接手项目的**第一份必读**。读完这本 + `.ai/code-facts/` 就掌握项目骨架，不用从头摸代码。
> 业务规则细节看 `.ai/systems/<系统>.md`（每条断言带 `文件 · 符号` 锚点）。

## 这是什么？

体素沙盒 × 亲历式历史剧：玩家是 184 年黄巾之乱里的流民，不是英雄、不改写历史——**MC 的世界是被你改变的，我们的世界是改变你的**。MC 骨架 100%（挖掘手感/第一夜/工具天梯）+ 编年史时间轴冲刷世界状态 = 本作差异化。

## 技术栈

纯 Web、**零构建**：HTML + 原生 ES Modules + Three.js r160（CDN import map，无 npm/bundler）。
开发期浏览器即开即测（需 http 服务，`file://` 不行）；发布期 Electron + steamworks.js 上 Steam。

## 目录地图

```
web/
  index.html               入口：import map（unpkg three）+ 全部 UI DOM + 内联 CSS
  src/                     模块地图见 .ai/code-facts/module-map.md（自动）
    main.js                装配根：所有系统在此 new + 接线；主循环/昼夜 5 阶段/输入/粒子
    world/terrain/mesher   体素世界三件套：chunk 流式 / simplex 地形 / 面剔除网格化
    blocks/items/textures  数据三件套：方块注册表 / 物品工具 / atlas 瓦片绘制
    player/interaction     第一人称 AABB 碰撞 / DDA 射线挖放（REACH 6）
    chapter/npc/dialog/quests/cutscene   编年史系统簇（差异化核心，见 .ai/systems/chronicle.md）
    sky/lights             天体时辰 / 火把篝火点光池（见 .ai/systems/day-night-lighting.md）
    mining/crafting/inventory/drops/helditem   挖掘公式与工具天梯（见 .ai/systems/mining-tools.md）
    farming/building/health/mob/save/sfx/ui/diag/steam-adapter
  data/                    全部游戏数据 JSON（chapters/npc/quests/recipes/mining/farming…）
  assets/                  第三方素材 + CREDITS.md（许可登记红线）
docs/
  roadmap.md               路线图（主理人据此派单）
  design/                  demo-vision.md（Demo 冲刺总纲）· art-bible.md · mc3-chapter1.md…
  superpowers/             specs/（转向设计）+ plans/（含各模块 Interfaces 签名）
team/                      专家团人格（流水线角色定义）
scripts/ai-context/        .ai/code-facts 自动提取（refresh.sh）
tools/                     测试三件套（见下）+ 打包脚本
.github/                   自主接力流水线（cron 15min：主理人派单 → GLM 专家认领 → 自验 → 合入）
```

## 关键架构约定

- **零构建**：改完 JS 刷新浏览器即生效；禁引入 npm/bundler。
- **模块只经导出签名通信**；main.js 是唯一知悉所有模块的装配根。
- **数据驱动**：数值/事件/对话/配方全落 `web/data/*.json`，代码只做引擎。
- 新方块只改 `blocks.js` 注册表（+ textures.js 瓦片 + mesher.js shape 特判如需细几何）。
- **许可红线**：素材只准 CC0/CC-BY，逐项登记 `web/assets/CREDITS.md`；禁 MC 术语（附魔/红石/苦力怕…，见 docs/design/demo-vision.md §四）。

## 测试三件套（无头，改代码后必跑）

```bash
export PW_CHROMIUM="C:/Users/pickm/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"  # 本机
node tools/smoke-web.mjs          # 冒烟：加载/60fps/81 chunks/零 JS 错
node tools/repro-e-talk.mjs       # E 交谈回归（含视觉断言：面板必须在视口内）
node tools/verify-mc5x.mjs        # 功能：日晷/时钟/追踪/火把篝火点光 11 项
# CI 无浏览器时：node --check 全量 + 结构检查为底线
```

**铁律：UI 类交付必须断言 `getBoundingClientRect` 在视口内 + computedStyle**——状态机对了 ≠ 玩家看得见（血泪案见 `.ai/ops/known-issues.md` CSS 案）。

## AI 知识库导航（按任务选读）

| 你要干什么 | 读这份 |
|---|---|
| 模块依赖/导出 | `.ai/code-facts/module-map.md`（自动） |
| 方块数值/注册表 | `.ai/code-facts/blocks.md`（自动） |
| 数据文件清单 | `.ai/code-facts/data-files.md`（自动） |
| 挖掘/工具/掉落规则 | `.ai/systems/mining-tools.md` |
| 编年史/章节/NPC/对话/任务 | `.ai/systems/chronicle.md` |
| 昼夜/时辰/天体/灯光 | `.ai/systems/day-night-lighting.md` |
| 其余系统索引 | `.ai/systems/README.md`（已写/待补状态） |
| 踩过的坑 | `.ai/ops/known-issues.md` |
| 为什么这么设计 | `.ai/decisions/`（ADR） |
| Demo 目标与任务定义 | `docs/design/demo-vision.md` |

## 维护规矩

1. **任务开始前**：读本文件 + 按 NAV 表读对应 `.ai/` 文件；**禁止不查 `.ai/` 就翻源码**。
2. **任务完成后**：改了 `web/src/**` 或 `web/data/**` 就跑 `scripts/ai-context/refresh.sh`（code-facts 自动同步，随工作区一并合入）；改了业务规则/架构决策就增量更新对应 `.ai/systems/*.md`；踩了坑追加 `.ai/ops/known-issues.md`。
3. `.ai/code-facts/*.md` 是脚本产物，**勿手改**。
