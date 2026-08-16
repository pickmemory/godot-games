# 体素世界（world.js · terrain.js · mesher.js · blocks.js 注册表）

> 源码：`web/src/world.js`（chunk 装载/卸载/脏块限流）、`terrain.js`（simplex 地形 + 色彩带）、`mesher.js`（面剔除网格化）。
> 结构（导出/依赖）见 ../code-facts/module-map.md。本页只写业务意图与规则；方块数值见 ../code-facts/blocks.md。

## 业务规则

- R1: **chunk 16×64×16 列主序**（idx = x + z·16 + y·256）；装载视距 4（切比雪夫）、卸载 6，每帧限 2 生成 + 2 重建 —— 锚点 `world.js · update`
- R2: **地表高度** `surfaceHeight = 22 + 大起伏(±10) + 细节(±3)`，clamp [3, 56] —— 锚点 `terrain.js · surfaceHeight`（npc/mob/structure 共用，勿改签名）
- R3: **D-1 色彩带**：每 chunk 一次产出 16×16 列级带索引 LUT（`chunkColorBands`，world 缓存于 chunk 记录）；mesher 查表 O(1) 换 GRASS_TOP/GRASS_SIDE/LEAVES 变体瓦片（textures.js `BAND_TILES` 追加瓦片 33~38，blocks.js 注册表零改动）。**禁止逐方块重采样噪声** —— 锚点 `terrain.js · chunkColorBands` / `mesher.js · buildChunkGeometry(bands)`
- R4: **带公式**：湿度 v = simplex(seed+1201, 0.006) + (h−24)·0.03 干燥偏置 → 草带阈值 0.40/0.62（嫩绿/黄绿/枯黄）；树冠独立相位（seed+4501）阈值 0.45/0.70（浓绿/黄绿/枯黄赭）。色板 `BAND_PALETTE`（#5d9c3f/#7fa24a/#a8974a；#3e7a2e/#5c8a35/#8a8438）登记于 art-bible §2.1 + color-pass.md
- R5: **高度带裸岩**：h ≥ 32±2（高频抖动破等高线）→ 表层 STONE，30% 列混 COBBLE 碎石斑驳；亚表层同步 STONE —— 锚点 `terrain.js · generateChunk`
- R6: **河滩延伸**：沙表层阈值 h ≤ 16 + 滩宽噪声×2.5（低频 0.03）；树的地表判定 = "地表是草皮"（沙/裸岩自动无树）—— 锚点 `terrain.js · generateChunk`
- R7: **细几何**（门/楼梯/栅栏/火把/篝火）子盒体拼入同一 BufferGeometry，单 draw call/chunk 不变；十字面片（作物）不参与邻面剔除 —— 锚点 `mesher.js · addBox/addCross`

## 关键计算/公式

| 指标 | 公式 | 锚点 |
|---|---|---|
| 带索引采样成本 | 每 chunk ~1.5k 次噪声（生成期一次），运行时查 Uint8Array | `terrain.js · chunkColorBands` |
| 色带补丁宽度 | ≈ 1/0.006 ≈ 80~160 格（低频大色块） | 同上 MOIST_FREQ |

## 不变量 / 约束

- **TILE 序号 / atlas 布局函数（4 瓦/行）/ blocks.js 注册表结构不被色彩系统改动**：变体瓦片只能追加（textures.js `VARIANT_BASE`），选带逻辑只准住在 mesher+terrain
- `chunkColorBands` 必须是 (cx,cz,seed) 纯函数（存档/跨界一致性；世界数据不存颜色）
- `buildChunkGeometry` 的 bands 参数可缺省（回退基准瓦片，兼容旧调用）

## 现状 vs 规划（严格分开；规划注明"未实现"）

- 现状：色彩带 = 空间维度（湿地/干燥/山脊）；高度带裸岩 + 碎石；河滩噪声外延
- 规划（未实现，color-pass.md §6）：季节级全局 tint（冬草 #9aa884/冬叶 #6a7a54，LUT 可直接乘）；挖掘粒子按列带取色；湿沙暗带
