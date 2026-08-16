# 方块注册表（blocks.js 运行时镜像）

> **自动提取**（运行时 import web/src/blocks.js，与代码零漂移）。勿手改。
> 改注册表后重跑 refresh.sh。挖掘公式见 .ai/systems/mining-tools.md。

## BLOCK 枚举 → 定义摘要

| id | 枚举名 | 名称 | solid | transparent | hardness | tool/minTier | light | shape/cross | drop |
|---|---|---|---|---|---|---|---|---|---|
| 0 | AIR | 空气 |  | ✓ | 0 |  |  |  | 自身 |
| 1 | GRASS | 草方块 | ✓ |  | 0.45 |  |  |  | 2 |
| 2 | DIRT | 泥土 | ✓ |  | 0.5 |  |  |  | 自身 |
| 3 | STONE | 石头 | ✓ |  | 1.5 | pickaxe t1 |  |  | 8 |
| 4 | WOOD_LOG | 原木 | ✓ |  | 1 |  |  |  | 自身 |
| 5 | LEAVES | 树叶 | ✓ | ✓ | 0.2 |  |  |  | 0 |
| 6 | SAND | 沙子 | ✓ |  | 0.4 |  |  |  | 自身 |
| 7 | PLANK | 木板 | ✓ |  | 1 |  |  |  | 自身 |
| 8 | COBBLE | 圆石 | ✓ |  | 1.6 | pickaxe t1 |  |  | 自身 |
| 9 | COAL_ORE | 煤矿石 | ✓ |  | 3 | pickaxe t1 |  |  | 103 |
| 10 | IRON_ORE | 铁矿石 | ✓ |  | 3 | pickaxe t2 |  |  | 自身 |
| 11 | CRAFT_TABLE | 工作台 | ✓ |  | 1.2 |  |  |  | 自身 |
| 12 | FARMLAND | 耕地 | ✓ |  | 0.5 |  |  |  | 2 |
| 13 | FARMLAND_WET | 湿润耕地 | ✓ |  | 0.5 |  |  |  | 2 |
| 14 | MILLET_0 | 粟·发芽 |  | ✓ | 0.05 |  |  | cross | 0 |
| 15 | MILLET_1 | 粟·抽穗 |  | ✓ | 0.05 |  |  | cross | 0 |
| 16 | MILLET_2 | 粟·成熟 |  | ✓ | 0.05 |  |  | cross | 0 |
| 17 | GREENS_0 | 葵菜·发芽 |  | ✓ | 0.05 |  |  | cross | 0 |
| 18 | GREENS_1 | 葵菜·展叶 |  | ✓ | 0.05 |  |  | cross | 0 |
| 19 | GREENS_2 | 葵菜·成熟 |  | ✓ | 0.05 |  |  | cross | 0 |
| 20 | DOOR_X | 木门 | ✓ | ✓ | 1 |  |  | door | 0 |
| 21 | DOOR_X_OPEN | 木门 |  | ✓ | 1 |  |  | door | 0 |
| 22 | DOOR_Z | 木门 | ✓ | ✓ | 1 |  |  | door | 0 |
| 23 | DOOR_Z_OPEN | 木门 |  | ✓ | 1 |  |  | door | 0 |
| 24 | DOOR_X_TOP | 木门·上 | ✓ | ✓ | 1 |  |  | door | 0 |
| 25 | DOOR_X_TOP_OPEN | 木门·上 |  | ✓ | 1 |  |  | door | 0 |
| 26 | DOOR_Z_TOP | 木门·上 | ✓ | ✓ | 1 |  |  | door | 0 |
| 27 | DOOR_Z_TOP_OPEN | 木门·上 |  | ✓ | 1 |  |  | door | 0 |
| 28 | WINDOW | 木窗 | ✓ | ✓ | 0.5 |  |  |  | 自身 |
| 29 | FENCE | 栅栏 | ✓ | ✓ | 1 |  |  | fence | 自身 |
| 30 | STAIRS_PZ | 木梯阶 | ✓ | ✓ | 1 |  |  | stairs | 自身 |
| 31 | STAIRS_NZ | 木梯阶 | ✓ | ✓ | 1 |  |  | stairs | 30 |
| 32 | STAIRS_PX | 木梯阶 | ✓ | ✓ | 1 |  |  | stairs | 30 |
| 33 | STAIRS_NX | 木梯阶 | ✓ | ✓ | 1 |  |  | stairs | 30 |
| 34 | RAMMED_EARTH | 夯土 | ✓ |  | 0.9 |  |  |  | 自身 |
| 35 | HAN_TILE | 汉瓦 | ✓ |  | 1.8 | pickaxe t1 |  |  | 自身 |
| 36 | THATCH | 茅草顶 | ✓ |  | 0.4 |  |  |  | 自身 |
| 37 | CHARRED_WOOD | 焦木 | ✓ |  | 0.7 |  |  |  | 0 |
| 38 | ASH | 灰烬层 | ✓ |  | 0.2 |  |  |  | 自身 |
| 39 | TORCH | 火把 |  | ✓ | 0.05 |  | 7.5/1.25 | torch | 自身 |
| 40 | CAMPFIRE | 篝火 |  | ✓ | 0.4 |  | 15/2.1 | campfire | 自身 |
| 41 | POTTERY | 陪葬陶片 |  | ✓ | 0.15 |  |  | cross | 自身 |

## TILE 瓦片表（atlas 序号；绘制逻辑在 textures.js PAINTERS）

| 枚举 | 序号 |
|---|---|
| GRASS_TOP | 0 |
| GRASS_SIDE | 1 |
| DIRT | 2 |
| STONE | 3 |
| LOG_SIDE | 4 |
| LOG_TOP | 5 |
| LEAVES | 6 |
| SAND | 7 |
| PLANK | 8 |
| COBBLE | 9 |
| COAL_ORE | 10 |
| IRON_ORE | 11 |
| TABLE_TOP | 12 |
| TABLE_SIDE | 13 |
| FARMLAND | 14 |
| FARMLAND_WET | 15 |
| MILLET_0 | 16 |
| MILLET_1 | 17 |
| MILLET_2 | 18 |
| GREENS_0 | 19 |
| GREENS_1 | 20 |
| GREENS_2 | 21 |
| DOOR_LOWER | 22 |
| DOOR_UPPER | 23 |
| WINDOW | 24 |
| FENCE | 25 |
| RAMMED_EARTH | 26 |
| HAN_TILE | 27 |
| THATCH | 28 |
| CHARRED_WOOD | 29 |
| ASH | 30 |
| TORCH | 31 |
| CAMPFIRE | 32 |
| POTTERY | 33 |
