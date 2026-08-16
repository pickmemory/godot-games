# 挖掘 / 工具天梯 / 掉落（mining.js · items.js · interaction.js · drops.js）

> 数值镜像以 `../code-facts/blocks.md`（自动）为准；本页写规则与公式。

## 业务规则

- R1: **挖掘耗时公式** `digSeconds = hardness × baseSeconds ÷ speed`，下限 0.05s —— 锚点 `mining.js · digTime`
- R2: **speed 三档判定**（锚点 `mining.js · digTime` 内）：
  - 手持匹配工具 → `toolDef.speed`（木镐 2.0 / 石镐 4.0 / 铁镐 6.0，`items.js · ITEM_DEFS`）
  - 方块 `tool: 'pickaxe'` 但没拿镐（或拿错工具）→ `mismatchFactor`（0.5）
  - 方块有 `minDropTier` 且工具等级不足 → speed 再乘 `tierPenalty`（0.25）
- R3: **掉落规则** `dropOf()`：`drop` 字段覆盖一切（0=无掉落，如树叶）；`minDropTier` 不满足 → 0（教"先换镐"，铁矿拿木镐挖了白挖）；缺省掉自身 —— 锚点 `mining.js · dropOf`
- R4: **交互距离 REACH = 6 格**，DDA 体素射线（Amanatides-Woo）；按住左键累积进度，松开清零；右键放置冷却 0.22s 且拒绝与玩家 AABB 重叠 —— 锚点 `interaction.js`
- R5: 掉落物为实体（`drops.js · DropManager`），靠近自动拾取入行囊；门是双格方块，拆任一半=整扇门掉一件（`building.js · breakDrops` 特判）
- R6: **调优史**（2026-08-16，commit bc1a343）：baseSeconds 1.5→1.2、mismatchFactor 0.3→0.5——徒手挖石 7.5s→3.6s。主创反馈"挖石头太影响体验"；保留铁矿教学惩罚（木镐挖铁 7.2s 无掉落，逼升石镐）

## 关键数值表（当前）

| 场景 | 耗时 |
|---|---|
| 石头 徒手 / 木镐 / 石镐 | 3.6s / 0.9s / 0.45s |
| 煤矿 木镐 / 石镐 | 1.8s / 0.9s |
| 铁矿 木镐(无掉落) / 石镐 | 7.2s / 0.9s |
| 原木/泥土 徒手 | 1.2s / 0.6s |

> 全部参数在 `web/data/mining.json`（数据驱动，缺文件时 FALLBACK_MINING 同构兜底，`mining.js`）。

## 不变量

- 工具 `tier`：木1/石2/铁3；`speed` 2/4/6 —— 与 `blocks.js · minTier/minDropTier` 联动构成天梯
- 火把/篝火 hardness 0.05/0.4，秒挖可回收（照明道具，见 day-night-lighting.md）

## 现状 vs 规划

- 现状：三级镐 + 锄（锄地不参与挖掘公式，走 farming）
- 规划（未实现）：铁砧修工具耐久、火系工具；**无任何工具耐久系统**（当前工具永久）
