# 世界结构数据 schema（MC-6 D-2 · explore）

> 引擎：`web/src/explore.js`（分布哈希 + 形状生成 + 罗盘查询）；装配：`web/src/main.js`
> （fetch 本目录 `explore.json` → `new World(..., exploreCfg)`），烘焙入口：`web/src/world.js · _generate`
> （`generateChunk` 之后、存档差分重放之前调用 `stampExplore`）。

## 本目录两类"结构"机制（勿混用）

| | `explore.json`（本文件） | 章节模板（如 `../chapters/190-dong-zhuo/luoyang-fang.json`） |
|---|---|---|
| 引擎 | `explore.js · stampExplore` | `structure.js · stampStructure` |
| 用途 | **世界分布**地标（烽燧/荒冢/巨木/卵石），给玩家"朝某处走"的理由 | **章节事件**固定锚点建筑（洛阳坊等），编年叙事载体 |
| 落成 | 烘进 chunk 生成基线（随 chunk 流式即到即有，**不产生存档差分**） | 事件触发时 `world.setBlock` 批量写入（落差分，开卷后数帧"长"出） |
| 位置 | region 网格确定性哈希（同 seed 可复现，无固定坐标） | 模板 JSON 里显式 `origin` |
| 玩家改动 | 差分重放在烘焙之后 → 永远覆盖结构方块（save 兼容） | 同为差分覆盖 |

## explore.json 字段

```jsonc
{
  "keepout":  { "x": 8, "z": 8, "radius": 64 },   // 出生村禁建区：锚点落入即跳过（防压新手区/章节锚点）
  "compass":  { "searchRadius": 384, "markRadius": 14 },
  //   searchRadius: 罗盘搜索半径（格；region 窗口解析锚点，O(region 数)）
  //   markRadius:   玩家进入即标记"已探"的半径（格；localStorage `sgsc.explored.v1.<seed>`）
  "types": [ /* 结构类型数组，见下 */ ]
}
```

### types[]（结构类型）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✓ | 类型标识（已探记忆 key / 测试引用） |
| `name` | string | — | 展示名（罗盘/已探提示） |
| `shape` | string | ✓ | `beacon` / `mound` / `greatree` / `pebbles`（引擎内形状分派） |
| `region` | int ≥2 | 锚定类 | 每 `region×region` 个 chunk 至多 1 个实例（**结构间距下限** = (region−1)×16 格） |
| `chance` | 0..1 | 锚定类 | region 占据率（哈希命中概率；真实密度再乘地形校验通过率） |
| `terrain` | object | 锚定类 | 锚点地表约束：`minGround`/`maxGround`（surfaceHeight 高度带）+ `maxSlope`（±3 格采样高差上限）。不满足 → 本 region 无实例（确定性） |
| `params` | object | — | 形状参数（见下，各形状私有） |

### 形状 params

- **beacon 残破烽燧**：`minHeight/maxHeight`（3~5 格夯土塔）、`footprint`（塔基半径，2 → 5×5）、
  `speckle`（圆石风化斑比例）、`rubble`（塔基散石比例）、`ruinRate`（外圈列缺 1 格豁口概率——"残破"天际线）。
  中心柱顶自动放 1 个 `CAMPFIRE`（夜间 lights.js 0.6s 扫描自动点亮，远见火光）。
- **mound 汉代荒冢**：`minRadius/maxRadius`（封土半径 4~6）、`minHeight/maxHeight`（丘高 3~5）、
  `shardsMin/shardsMax`（陪葬陶片数）。圆丘 = 表草内土；陶片（`BLOCK.POTTERY`）第 1 片嵌封土表面，
  其余埋入丘体（挖开封土才见），挖出可拾取收藏。
- **greatree 巨木**：`minTrunk/maxTrunk`（主干 5~8 格）、`canopy`（自下而上各层圆冠半径数组，如
  `[2,3,4,4,3,2]`；层叠圆盘，角修剪）。树冠只写空气格（不啣山体/邻结构）；主干四斜角偶发露根。
- **pebbles 河滩卵石**（无锚点，不上罗盘）：`chance`（chunk 命中率）、`cobbleRate`（水位线沙面→圆石比例）、
  `raisedRate`（沙面上突起单频卵石比例）。判定"沿水位线"= 地表方块是 SAND（沙面只在水位线及以下生成）。

## 确定性 & 存档兼容（不变量）

- 所有位置/尺寸决策 = 纯哈希（chunk/region 坐标 × seed × 类型盐）+ `terrain.surfaceHeight`（与地形生成同源）；
  **同 seed 任意时刻重算恒等**——不读 chunk 数据、不依赖加载顺序。
- 锚点在 chunk 内留边 3..12 且形状最大半径 ≤ 5 → 跨界溢出 ≤ 1 chunk；`stampExplore` 扫锚点 chunk ±1
  邻域即可完整落成（每个 chunk 只写落在自己界内的格）。
- 结构方块属于 chunk **基线**而非差分：存档体积不随探索增加；玩家挖掉烽燧/挖穿荒冢 = 普通差分，
  重生成时差分重放在烘焙之后 → 玩家改动永远赢。
- 新增结构类型：`explore.json` 加条目 + `explore.js · genCells` 加形状分派；方块只准在 `blocks.js` 注册表加。
