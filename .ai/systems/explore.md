# 探索结构 / 罗盘（explore.js · world.js _generate · main.js updateCompass · ui.js drawCompass）

> 源码：`web/src/explore.js`（纯函数，Node 可直接 import 做无头验证）。结构/依赖见 ../code-facts/module-map.md。
> 数据：`web/data/structures/explore.json`（schema 见同目录 README.md；缺文件/离线 → explore.js `FALLBACK_EXPLORE` 同构兜底）。
> 本页只写业务意图与规则。目的：给玩家「朝某个方向走」的理由（MC-6 D-2，Demo 差距 #2）。

## 业务规则

- R1: **两类结构机制勿混用**：世界分布地标（explore.js `stampExplore`，烘进 chunk 基线）vs 章节事件建筑（structure.js `stampStructure`，走 setBlock 差分）。前者随 chunk 流式即到即有、不产生存档差分；后者开卷后数帧"长"出 —— 锚点 `explore.js 文件头`
- R2: **分布 = region 网格确定性哈希**：每类结构每 `region×region` chunk 至多 1 实例（间距下限 (region−1)×16 格）；region 内锚定 chunk 与 chunk 内锚点（留边 3..12，保证溢出 ≤1 chunk）均由 `hash2(坐标 × seed ^ 类型盐)` 决定 —— 锚点 `explore.js · instanceFor`。**同 seed 重算恒等，不读 chunk 数据、不依赖加载顺序**
- R3: **地形校验（确定性拒绝）**：锚点地表高须在 `terrain.minGround..maxGround` 带内，且 ±3 格采样高差 ≤ `maxSlope`；出生村禁建区 `keepout`（默认中心 (8,8) 半径 64）内不落任何锚定结构（防压新手区/NPC/章节锚点）—— 锚点 `explore.js · buildInstance`
- R4: **四种形状**（`genCells` 分派，产 [wx,wy,wz,id,hard] 格列表）：残破烽燧 `beacon`（3~5 格夯土塔+风化斑+塔基散石+顶部 1 个 CAMPFIRE）；汉代荒冢 `mound`（圆丘封土，表草内土；陪葬陶片 POTTERY 第 1 片嵌表面、其余埋丘体）；巨木 `greatree`（5~8 格主干+层叠圆冠+偶发露根）；河滩卵石 `pebbles`（无锚点不上罗盘：地表是 SAND 才动，沙面按比例换圆石/突起卵石——沙只在水位线生成 ⇒ 天然沿水线）
- R5: **hard/soft 写入语义**：hard（塔身/封土/树干）无条件写=整平语义；soft（篝火/碎石/树冠/露根）只写空气格 ⇒ 不啃山体、不覆盖相邻结构 —— 锚点 `explore.js · stampExplore`
- R6: **save 兼容**：`world.js · _generate` 在 `generateChunk` 之后、存档差分重放之前调 `stampExplore` ⇒ 结构方块属基线，玩家挖改是差分、重放永远在烘焙之后（玩家改动永远赢）；存档体积不随探索增加
- R7: **烽燧夜间火光**：顶部放普通 CAMPFIRE 方块，lights.js 0.6s 光源扫描自动点亮（不引入"灯"实体，世界数据免费）—— 锚点 `genBeacon`
- R8: **陶片收藏**：POTTERY=汉灰陶残片（cross 十字面片，hardness 0.15 无工具门槛，掊土即得，掉自身=可拾取收藏、可放置陈列）—— 锚点 `blocks.js · POTTERY`

## 罗盘（HUD）

- 位置：右上日晷下方（`index.html #compassWrap`，top:148px）；表盘随玩家 yaw 旋转（北/东/南/西刻度），金针指向最近未探结构（`ui.js · drawCompass`）；下一行目标名+步数。
- 目标查询 `nearestTarget`：region 窗口解析锚点（O(region 数) 纯哈希 + 少量 surfaceHeight 采样，**不读 chunk、不全图扫描**），搜索半径 `compass.searchRadius`（默认 384 格）。
- 已探标记：玩家进入 `markRadius`（默认 14 格）→ `ExploredMemory.add(key)`（localStorage `sgsc.explored.v1.<seed>`，按世界分册；坏 JSON/隐私模式降级内存）；被标记者不再上针。`?new` 开新档时清册。
- 限频：`main.js · updateCompass` 0.25s。

## 关键数值（缺省，explore.json 可覆盖）

| 参数 | 值 | 说明 |
|---|---|---|
| 烽燧 beacon-tower | region 12 · chance 0.8 | ≈每 192 格一个候选 region |
| 荒冢 han-mound | region 7 · chance 0.7 | 陶片 2~4 片/冢 |
| 巨木 great-oak | region 5 · chance 0.75 | 树冠 [2,3,4,4,3,2] |
| 河滩卵石 river-pebbles | chunk chance 0.55 | 沙面 32% 换圆石 + 5% 突起 |
| keepout / 搜索 / 已探 | 64 格 / 384 格 / 14 格 | 出生村保护 / 罗盘窗口 / 标记半径 |

## 不变量 / 约束

- **确定性**：一切位置/尺寸决策 = 纯哈希 + `terrain.surfaceHeight`（与地形生成同源）；改任何哈希盐/顺序 = 换世界（旧存档差分坐标会错位，视为不兼容变更）。
- 性能：锚点解析 O(1)/chunk（region 缓存 `_regionCache`）；`stampExplore` 只在 chunk 生成时跑一次；罗盘不触发 chunk 加载。
- 结构方块只能引用 `blocks.js` 已注册 id（数据容错：未登记字符/非法 id 跳过）。

## 现状 vs 规划

- 现状：四结构+罗盘+已探记忆已落地；无头验证 `tools/verify-explore.mjs`（A 组 Node 确定性/特征，B 组浏览器罗盘/标记）。
- 规划（未实现）：结构内可交互叙事物（荒冢碑文/烽燧狼烟事件钩子，待 D-3 奇遇系统对接）；更多形状（枯木/巨石阵）只加 explore.json + genCells 分派。
