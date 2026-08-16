# 昼夜 / 时辰 / 天体 / 灯光（main.js updateDayNight · sky.js · lights.js · ui.js 日晷）

> 太阳即时钟：抬头看天 = 看表。右上日晷常亮（系统提示性质，夜晚不降亮度——主创 2026-08-16 要求）。

## 业务规则

- R1: **昼夜 5 阶段**：`c = dayTime / DAY_LEN`——白天 <0.42 / 日落 <0.5 / 入夜 <0.58 / 深夜 <0.92 / 破晓 ≥0.92；每阶段插值 sky/sun/ambient 颜色与强度，产出 `nightK∈[0,1]`（>0.9 = 夜间生物窗口）—— 锚点 `main.js · updateDayNight`
- R2: **DAY_LEN 章节数据驱动**（`dayLengthSeconds`，两章均 300s；缺省 180）——锚点 `main.js · DAY_LEN`。2026-08-16 主创要求从 180s 调慢（白天 76s→126s）
- R3: **十二时辰** `sky.js · shichen(c)`：c=0 → 卯时（日出），c=0.25 → 午时（天顶），c=0.5 → 酉时（日落）。与 R1 阶段精确对齐
- R4: **天体** `sky.js · CelestialBodies`：太阳/月亮 canvas 径向渐变 sprite，东升西落弧线（略偏北，正午不穿天顶），随玩家平移（"无限远"近拟）；`fog:false + renderOrder:-10` 不被雾吞不写深度，但被地形正常遮挡；日落时段太阳金白→橙红
- R5: **灯光池** `lights.js · LightManager`：**固定 8 盏 PointLight 常驻**（intensity=0 关闭）——灯数变化会触发 Three 材质重编译卡顿，所以永不增删灯对象；每 0.6s 扫玩家周围 5×5 chunk 的 Uint8Array（约 1ms）收集火把/篝火（`blocks.js` 注册表 `light` 字段：dist/intensity/color），按距离最近调度入池
- R6: **flicker**：篝火大幅跳动（双正弦 9Hz+23Hz，幅度 ±0.18），火把轻微呼吸（6.5Hz ±0.06）——锚点 `lights.js · update`
- R7: **手持火把照明**：行囊手持 TORCH 时专用灯跟随玩家（y+1.3，亮度 1.1 呼吸）——锚点 `lights.js · hand`
- R8: **日晷/时钟**：HUD 文字 `午时 · 日中 昼`（0.25s 限频）+ 右上 canvas 日晷（卯上/午右/酉下/子左刻度，日月双针，中心时辰大字）——锚点 `ui.js · setClock / drawSundial`
- R9: **夜景调优史**（2026-08-16，主创反馈"夜晚白花花"）：石头贴图 #8a8a8a→#6e7680 深青灰+暗斑；深夜 ambient 0.16→0.12、颜色 #9aa8d0→#6d7fae 压暗转蓝 —— commit bc1a343
- R10: **D-1 汉代绢画暖调**（2026-08，docs/design/art/color-pass.md §3）：日落 `#ff9a5a→#e29a68`（赭石琥珀）；破晓新增独立暖色停点 `#e8c79e`（两段插值：深夜→绢赭(55% 处)→天蓝）；日落/破晓窗口内季节 skyTint 混入额外 ×(1−0.55·warmK) 平滑压制；白昼 `#87ceeb` / 深夜 `#0b1026` 两基线不变 —— 锚点 `main.js · SKY_SUNSET/SKY_DAWN/warmK`

## 关键数值

| 参数 | 值 | 位置 |
|---|---|---|
| 火把点光 | dist 7.5 · intensity 1.25 · #ffb35c | `blocks.js` TORCH light |
| 篝火点光 | dist 15 · intensity 2.1 · #ff9a3c | `blocks.js` CAMPFIRE light |
| 灯池/扫描 | 8 盏 · 0.6s · 半径 2 chunk | `lights.js` 常量 |

## 不变量

- 太阳即时钟三元组（天上天体/HUD 时辰/日晷）必须同源（同一个 c）；新增读时 UI 禁止另算时间
- 火把/篝火是普通方块（存档天然免费），灯池只是渲染层调度，**世界数据里没有"灯"实体**

## 现状 vs 规划

- 现状：无动态阴影（PointLight castShadow=false，性能优先）；天体为程序化占位贴图
- 规划（未实现）：Kenney 天空盒/日月贴图替换（只换贴图不改逻辑）；D-2 烽燧顶部挂篝火做夜间地标
