# 开场演出（web/src/opening.js）

> 源码：`web/src/opening.js` + `web/data/opening.json`（数据驱动，缺文件时模块内同构兑底 `FALLBACK_OPENING`）。
> 结构（导出/依赖）见 ../code-facts/module-map.md。本页只写业务意图与规则。MC-6 D-5 落地。

## 业务规则

- R1: **仅新档完整演出** —— 首次指针锁定（开卷）后播；有存档快照（读档续玩）或 `?opening=0` 时直接入局，不重复演出 —— 锚点 `main.js · maybeStartOpening`
- R2: **演出链路次序**：点击开卷 → D-5 开场演出（俯瞰→俯冲）→ 章节开卷黑屏卡（cutscene.js）→ gameplay。D-5 期间章节时间轴不推进（开场不偷游戏日历） —— 锚点 `main.js · maybeStartOpening` / `main.js · loop`（`started && !cutscene.isActive && !opening.isActive` 门）
- R3: **任意键/点击/失锁（ESC）= 跳过**，且不透传给 gameplay；收尾同步完成：`isActive` 即刻 false、粒子全量 dispose、DOM 淡出 0.65s 后隐藏、`body.opening` 移除（HUD 复位）、相机由 main 调 `player._syncCamera()` 精确回眼位 —— 锚点 `main.js · keydown/mousedown/pointerlockchange` + `opening.js · skip/_finish/_teardown`
- R4: **演出期间世界不冻结加载**：chunk 流式中心跟随镜头（`world.update(camera.position)`），且开场 2.5s（墨色淡入窗口）内双倍流式，防落地穿帮 —— 锚点 `main.js · loop`
- R5: **演出期间世界时钟冻结但天空照常刷**：`updateDayNight(opening.isActive ? 0 : dt)`——dt=0 只刷清屏色/雾/天体/灯光（否则高空露出默认黑天空），日历/追踪/奇遇/农耕仍冻结 —— 锚点 `main.js · loop`
- R6: 序幕文案/镜头控制点/粒子参数全部数据驱动 `web/data/opening.json`；**改 cards 文案后须重跑 `tools/gen-narration.mjs`** 重生成开场旁白（nar-opening-*.mp3，清单 narrations.json 按 text 精确匹配） —— 锚点 `tools/gen-narration.mjs · collectEntries`
- R7: 演出隐含 BGM event 态（music.tick 的 `cutsceneActive: cutscene.isActive || opening.isActive`）；字卡逐卡调 `music.speak`（无样音自动回落纯字幕） —— 锚点 `main.js · loop` / `opening.js · _updateCards`

## 关键计算/公式

| 指标 | 公式 | 锚点 |
|---|---|---|
| 镜头位置/视线 | `CatmullRomCurve3(points/look)`（centripetal）按 `u = remap(t)` 取点；remap 为 phaseTime→phaseParam 分段 smoothstep（全景慢/俯冲快/落地缓） | `opening.js · _remap/update` |
| 俯冲 FOV | `fov = fov0 + (dive − fov0) · sin(π·(t−t0)/(t1−t0))`，窗口 [phaseTime[1], phaseTime[2]]，起落归零无跳变 | `opening.js · update` |
| 高空晨雾 | `highK = clamp01((camY − spawnY − 6)/55)`；`fog.near/far` 在快照值与 highNear/highFar 间随 highK 插值（越高雾越远越柔，兼遮流式边缘；**highFar 必须大于相机高度+视线斜距，否则满屏纯雾色**） | `opening.js · update` |
| 烟柱粒子 | life = (age·speed + phase) % 1；y = 基点 + life·height；alpha = min(life/0.12, (1−life)/0.35, 1)·alphaMax；size 随 life 线性膨胀 | `opening.js · _updateParticles` |
| 飞鸟粒子 | 鸟群椭圆盘旋（半径/相位确定性伪随机 prand）；0.16s 双纹理切换拟扇翅 | `opening.js · _updateParticles` |
| 粒子透视尺寸 | `gl_PointSize = aSize · uScale / d`，`uScale = 画布高/2 / tan(fov/2)`（随 FOV/分辨率逐帧刷） | `opening.js · makePointsMaterial/update` |

## 状态机 / 事件流

```
idle →(首次开卷·新档) play() → active（墨色淡入→全景→俯冲→落地）
active →(任意键/点击/ESC 失锁 | t≥1) _finish → teardown（同步）→ idle（hasPlayed=true）
```

## 不变量 / 约束

- 演出相机末点必须与玩家眼位重合、末视线正对 −Z（玩家默认 yaw=0/pitch=0 即 identity）→ 无缝交接，无视角跳变（`opening.json · camera.points/look` 末项约定）。
- 热路径零分配：typed array 就地写 + 模块级 scratch Vector；曲线/粒子对象 play() 一次建好。
- 收尾必须全量 dispose（geometry/material/texture）且 DOM/body 类复位；清理异常被 try/catch 包裹，不得阻断状态复位与 Promise resolve（血泪案见 known-issues）。
- 模块不 import world/player/chapter：依赖经 `play(cfg)` 注入（camera/scene/groundAt/pixelScale/voice）。

## 现状 vs 规划

- ✅ 现状：镜头演出 + 烽烟/飞鸟粒子（含最近烽燧顶自动立烟柱，D-2 联动）+ 竖排书法题签 + 序幕字卡（mmx 旁白 4 条）+ 跳过/存档跳过 + `tools/verify-opening.mjs` 26 项断言。
- 未实现（规划）：镜头 banking 侧倾、按章节差异化开场路线（如第二章从废墟俯瞰）、字卡竖排变体。验证截图：`tools/verify-opening.png`。
