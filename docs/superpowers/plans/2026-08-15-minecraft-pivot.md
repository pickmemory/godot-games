# 「三国长卷」转向 + MC-1 体素骨架 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把仓库从 Godot 三国 ARPG 完全转向 Web 体素沙盒「三国长卷」，并交付 MC-1 可玩骨架（浏览器打开即玩）。

**Architecture:** 纯静态 Web——index.html 用 import map 从 CDN 引 Three.js；ES Modules 直跑零构建。核心链路：terrain(噪声) → world(chunk 管理) → mesher(面剔除) → player(AABB 碰撞) + interaction(DDA 射线) + ui(hotbar/准星)。

**Tech Stack:** 原生 ES2022+ / Three.js 0.16x（CDN unpkg）/ 无测试框架（验证 = node --check + 结构检查 + 浏览器手测清单）。

## Global Constraints（全任务隐含遵守）

- 禁止 git 操作（add/commit/push/branch）——workflow 管 git
- 不碰 `.env*`、密钥；workflow 文件修改已获主创明确授权（2026-08-15"开工，允许你做任何改动"）
- 第三方素材只准 CC0 / CC-BY；CC-BY-SA、GPL 禁用；全部登记 `web/assets/CREDITS.md`
- 所有 JS 通过 `node --check`；模块间只通过本计划 Interfaces 段定义的签名通信
- Godot 相关验证全部废止

---

### Task 1: 旧内容清理（保留 git 历史可找回，直接删工作区文件）

**Files:**
- Delete: `game/`、`docs/design/`、`docs/architecture/`、`docs/playtests/`、`docs/engine-reference/`、`docs/project-charter.md`、`docs/README.md`（若为旧内容索引）

**Steps:**
- [ ] 确认 `docs/superpowers/`（本计划与设计文档）不会被误删
- [ ] `rm -rf` 上述目录；`ls docs/` 复核只剩 `superpowers/`（roadmap 在 Task 2 重建）
- [ ] 验证：`ls game 2>/dev/null || echo GONE`

### Task 2: AGENTS.md 与 roadmap.md 重写

**Files:**
- Rewrite: `AGENTS.md`、`docs/roadmap.md`

**Content 要点（AGENTS.md）：**
- 项目一句话：体素沙盒「三国长卷」——MC 骨架 × 亲历真实三国编年（平民视角）；Web/Three.js；PC Steam（发布期 Electron+steamworks.js）
- 目录结构：`web/` 游戏根 + `docs/` + `team/` + `.github/`
- 验证：`node --check web/src/*.js` + 浏览器打开 `web/index.html`
- 资产政策：CC0/CC-BY 纪律 + `web/assets/CREDITS.md` 必须更新 + mmx 特调用途
- 接力机制不变（cron / issue / roadmap 派单）
- 红线更新：删 Godot 红线，保留 git/密钥/测试红线，新增许可红线

**roadmap.md 路线（格式沿用 `- [ ] MC-N 名称 → 输出路径 (角色标签)`）：**
- MC-1 体素骨架+手感包 → web/ (engineering-lead) —— 本计划直接完成，标 `[x]`
- MC-2 生存弧线（第一夜+工具天梯） → web/src/ (engineering-lead)
- MC-3 历史长卷引擎+第一章黄巾 → web/src/ + docs/design/ (design-strategist + engineering-lead)
- MC-4 生计定居+存档抽象 → web/src/ (engineering-lead)
- MC-5 第二章+打磨+Steam 打包 → web/ + tools/ (release-ops)

### Task 3: 流水线配置切换（已授权）

**Files:**
- Modify: `.github/workflows/agent-build.yml`（验证命令 Godot headless → `node --check web/src/*.js` + 结构检查脚本）
- Modify: `.github/agent-build-prompt.md`、`.github/orchestrator-prompt.md`（Godot 字样与验证段替换；roadmap 派单逻辑不变）

**Steps:**
- [ ] 通读三个文件，仅改验证/引擎相关段落，派单机制保持原样
- [ ] 验证：`bash -n .github/agent-build-loop.sh`（若含）+ yml 目视校验缩进

### Task 4: MC-1 · 引擎骨架（blocks / textures / terrain）

**Files:**
- Create: `web/index.html`、`web/src/blocks.js`、`web/src/textures.js`、`web/src/terrain.js`

**Interfaces（后续任务依赖的精确签名）：**
- `blocks.js` 导出：`export const BLOCK = { AIR:0, GRASS:1, DIRT:2, STONE:3, WOOD_LOG:4, LEAVES:5, SAND:6, PLANK:7, COBBLE:8 }`；`export const BLOCK_DEFS`（数组，索引=块 id，元素 `{ name, solid, transparent, tiles:{top,side,bottom} }`，tiles 值 = atlas 瓦片索引）；`export const HOTBAR = [1,2,3,4,5,7,8,6,6]`
- `textures.js` 导出：`export function buildAtlas(canvasSize=16, tilePx=16): { texture: THREE.Texture, tilesPerRow: number }` —— 程序化 canvas 逐瓦片绘制（草顶/草侧/土/石/原木侧/原木顶/叶/沙/木板/圆石），NearestFilter 像素风；Kenney 贴图接入留 TODO 钩子但默认程序化
- `terrain.js` 导出：`export function generateChunk(cx, cz, seed): Uint8Array`（尺寸 16×16×64，列主序 `idx = x + z*16 + y*256`；simplex 噪声高度 8~40 起伏；表层草/下层土/基石；沙出现在低洼；每 chunk 概率种 2~5 棵树，树 = 原木 4~6 高 + 顶 3×3×2 叶团）；自带内嵌 simplex 实现（无 npm 依赖）
- `index.html`：import map（three + three/addons 走 unpkg）、全屏 canvas、准星/hotbar/FPS DOM 骨架、`<script type="module" src="src/main.js">`、WebGL 不可用降级提示

**Steps:**
- [ ] 写 index.html（含 UI DOM 与降级提示）
- [ ] 写 blocks.js（注册表 + HOTBAR）
- [ ] 写 textures.js（canvas atlas，9+ 瓦片，导出 THREE.Texture）
- [ ] 写 terrain.js（内嵌 simplex + generateChunk）
- [ ] 验证：`node --check` 三文件全过（terrain/textures 引 THREE 的部分用鸭子类型不直接 import THREE 或仅 import type 安全用法——textures 需 `import * as THREE from 'three'`，node --check 只查语法不执行，import 不影响）

### Task 5: MC-1 · 世界渲染（world / mesher）

**Files:**
- Create: `web/src/world.js`、`web/src/mesher.js`

**Interfaces:**
- `mesher.js`：`export function buildChunkGeometry(data: Uint8Array, world: WorldLike): {positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint32Array}` —— 面剔除：六方向邻块 transparent 或 AIR 才生成面；每面 4 顶点 6 索引；UV 从 BLOCK_DEFS.tiles 经 atlas tilesPerRow 换算；WorldLike 仅需 `getBlock(gx,gy,gz): number`（跨界块查询）
- `world.js`：`export class World` —— `constructor(scene, texture, seed)`；`getBlock(x,y,z)`（世界坐标→chunk，未加载返回 AIR）；`setBlock(x,y,z,id)`（改数据+标记 dirty）；`update(playerPos)`（每帧：按视距 4 chunk 半径入队生成，每帧最多 build 2 个 dirty chunk，超半径卸载 dispose）；内部持 Map<`cx,cz`, {data, mesh, dirty}>
- 挖掘/放置后需对邻 chunk 调 rebuild（setBlock 内处理跨界 dirty）

**Steps:**
- [ ] 写 mesher.js（面剔除 + atlas UV）
- [ ] 写 world.js（生成队列 + 装载/卸载 + dirty 重建）
- [ ] 验证：`node --check` 两文件

### Task 6: MC-1 · 玩家与交互（player / interaction）

**Files:**
- Create: `web/src/player.js`、`web/src/interaction.js`

**Interfaces:**
- `player.js`：`export class Player` —— `constructor(camera, world)`；`update(dt, input)`；AABB 0.6×1.8×0.6 碰撞（逐轴移动+回退）；WASD/空格跳跃/F 飞行切换；眼高 1.62；掉出世界底部 (<0) 传回地表
- `interaction.js`：`export class Interaction` —— `constructor(camera, world, scene, callbacks)`，callbacks = `{ onDigProgress(pct), onDigComplete(blockId, pos), onPlace(pos) }`；DDA 体素射线（最大 6 格）返回 `{hit, pos:[x,y,z], normal:[nx,ny,nz]}`；左键按住累计挖掘进度（按方块硬度，裂纹 overlay 用 onDigProgress 驱动 DOM/材质，MC-1 简化为高亮线框收缩）；右键放置 HOTBAR 当前块（禁止放进玩家 AABB）；选块线框高亮（THREE.LineSegments）
- `main.js`（Task 7 装配）中：挖掘完成→粒子爆发（简单 Points，寿命 0.5s）+ WebAudio 合成"噗"声（无外部音频文件，符合零依赖）

**Steps:**
- [ ] 写 player.js（AABB 逐轴碰撞）
- [ ] 写 interaction.js（DDA + 挖掘进度 + 放置 + 高亮）
- [ ] 验证：`node --check` 两文件

### Task 7: MC-1 · 装配与手感包（main / ui）+ 终验

**Files:**
- Create: `web/src/main.js`、`web/src/ui.js`

**Interfaces:**
- `ui.js`：`export class UI` —— `constructor()` 抓 DOM；`setHotbar(items: number[], selected: number)`（瓦片 canvas 缩略图）；`setFPS(n)`；`showBlockName(name)`（切换 hotbar 时短暂显示）；`setDigProgress(pct)`（0 隐藏）
- `main.js`：装配 World/Player/Interaction/UI；指针锁定（点击画布 requestPointerLock，ESC 释放暂停提示）；主循环 rAF（dt 钳制 0.05s）；昼夜：天空色/雾/平行光随时间插值（dayLength=180s）；挖掘手感包：粒子 + WebAudio 噪声爆音 + 挖掘中每 20% 一声轻响；FPS 每 0.5s 更新

**Steps:**
- [ ] 写 ui.js、main.js 并装配
- [ ] `node --check web/src/*.js` 全绿
- [ ] 起本地静态服务（`npx serve web/` 或 python http.server）+ 无头冒烟（若环境可用 Playwright/chromium 则截屏验证，否则记录手测清单让主创浏览器验收）
- [ ] 手测清单（交付给主创）：移动/跳/飞 ✓ 挖有裂纹粒子声 ✓ 放置 ✓ hotbar 1-9+滚轮 ✓ 昼夜变化 ✓ FPS≥60 ✓

### Task 8: 收尾

- [ ] `web/assets/CREDITS.md`（本阶段全程序化生成，无第三方——写明政策供后续登记）
- [ ] 全仓 grep 残留 `Godot|godot|赤壁|TileMap`（.git/、team/ 人格文件除外——team 人格是通用角色，检查是否有 Godot 特定措辞需微调）
- [ ] 向主创交付验收清单 + 流水线下一单（MC-2）已就位

## Self-Review 结论

- 覆盖检查：spec §4 结构（Task 4-7 全模块）、§5 资产（Task 4 textures 钩子 + Task 8 CREDITS）、§6 MC-1 范围（手感包=Task 7）、§7 清理（Task 1-3）、§9 验收（Task 7）✓
- 类型一致：BLOCK 枚举 / BLOCK_DEFS.tiles / generateChunk 列主序 / WorldLike.getBlock 在 Task 4/5/6 间签名一致 ✓
- 无占位符：所有接口给到精确签名与数据布局 ✓
