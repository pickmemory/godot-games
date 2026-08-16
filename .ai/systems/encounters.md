# 奇遇系统（encounters.js + main.js 效果路由）

> 源码：`web/src/encounters.js`（调度引擎）+ `web/src/main.js`（装配/效果路由）。结构（导出/依赖）见 ../code-facts/module-map.md。设计依据 `docs/design/encounters.md`。本页只写业务意图与规则。

## 业务规则

- R1: **纯调度引擎**：不 import THREE、不碰 DOM；世界效果执行在 main.js `registerEffect(type, fn)` 注册的处理器（与 chapter.js 同一模式）——锚点 `encounters.js · EncounterEngine.update / _runEffect`
- R2: **抽签窗口 = 昼夜翻转沿**：`ctx.isNight` 翻转（入夜 false→true / 破晓 true→false）各触发一次检定；流程 = 全局静默期检查 → 命中判定（nightChance/dayChance）→ 资格过滤 → weight 加权抽签 —— 锚点 `encounters.js · _runCheck / _eligible / _weightedPick`
- R3: **资格过滤**：slot（night/day/any）匹配 + once 册 + 同类冷却（cooldownUntil）+ 同 id 不重复进行中 + gate（from/to 序数日窗、requireFlags/forbidFlags、nearStructure 近旁 D-2 结构）—— 锚点 `encounters.js · _eligible`
- R4: **followUp 延迟效果（传闻化）**：`inDays` 游戏日后到期，到期复查旗标门（不过即丢弃）；`serial = chapter.startSerial + timeline.elapsed`（与编年同根数轴）—— 锚点 `encounters.js · update`
- R5: **watch 接近反应**：锚 = 实例 placedBlocks（效果处理器回填 `{x,y,z,expect}`）任一坐标进入玩家 radius（3D 距离）→ effects；超 `inDays` → timeoutEffects —— 锚点 `encounters.js · _playerNear`
- R6: **实例收尾清旗标**：所有 followUp 结案 && watch 结案 → 对 resetFlags 逐个路由 `setFlag value:false`（防下次同 id 事件被旧选择污染）→ 出列 —— 锚点 `encounters.js · update`
- R7: **数据**：`web/data/encounters.json`（8 事件：夜叩门流民/斥候快报/夜半鬼火/货郎/鸦群/烽燧夜火/狼嚎/道旁遗囊）；缺文件 → `FALLBACK_ENCOUNTERS` 同构兜底。台词全在 JSON（含 giveFood 的 intel/none 文案）—— 锚点 `encounters.js · FALLBACK_ENCOUNTERS / normalizeEncounters`
- R8: **装配（main.js）**：ctx 每帧现递 `encCtx()`（isNight/serial/playerPos/hasFlag→timeline.flags/nearStructure→nearestStructureOf）；主循环与章节时间轴同门控（开卷后、非演出中才推进）；存档分节 `encounters`（once 册/冷却表/进行中实例含 placedBlocks）—— 锚点 `main.js · encCtx / encounters.registerEffect / saveSystem.registerProvider('encounters')`
- R9: **临时 NPC**：spawnNpc 生成 `enc-<id>-<序数日>` 前缀 NPC，def 可带内嵌 `dialogTree`（npc.js NPC.dialogTree，nearestTalkable 兼容）；despawnNpc 按前缀 `removeByIdPrefix` 回收（幂等）—— 锚点 `main.js · spawnNpc 处理器` + `npc.js · removeByIdPrefix`
- R10: **giveFood**（对话选项效果，dialogUI.onEffect 与 encounters 双路由）：行囊有粟米/葵菜 → 消耗 1 + 置数据旗标 + notify intel；无 → notify none —— 锚点 `main.js · giveFoodEffect`
- R11: **世界效果落点**：placeGhostFire/digMound 用 `nearestStructureOf('han-mound',…)`（explore.js `anchorAt` 的 192 格 chunk 窗扫描，仅抽签/触发时调用）；scarMark 落最近判定房屋门旁墙根（`BLOCK.SCAR_MARK` id 42，cross 面片）；undoBlocks 仅当方块仍是 `expect` 时回收（玩家改动优先）—— 锚点 `main.js · nearestStructureOf / 各处理器`

## 关键计算/公式

| 指标 | 公式 | 锚点 |
|---|---|---|
| 稳态触发率 | `λ ≈ min(nightChance + dayChance, 1/globalCooldownDays) 次/游戏日`（数据 0.72/0.5 → 0.5，dayLength 300s ≈ 每 10 分钟现实一次） | `_runCheck` |
| followUp 到期 | `serial ≥ at + inDays` | `update` |
| watch 触发 | `min ‖placedBlock − playerPos‖ ≤ radius` | `_playerNear` |
| 同类冷却 | `serial ≥ at + cooldownDays` | `_eligible` |

## 状态机 / 事件流

```
昼夜翻转沿 → 检定（静默期/命中/资格/加权）→ fire 效果路由
实例：fire → followUps（到期复查旗标）＋ watch（接近/超时）→ 全结 → 清 resetFlags → 出列
```

## 不变量 / 约束

- **历史不改道**（demo-vision §一柱一）：奇遇可读章节旗标（forbid/require gate），章节事件不读奇遇旗标（单向依赖）；引擎可路由的效果类型与章节事件同一能力集，无改写章节结果的通路。
- 引擎纯函数（Node 可直接 import 测试：tools/verify-encounters.mjs A 组）；rng 可注入（确定性测试）。
- 奇遇临时方块走 world.setBlock（差分持久）；回收只动 `expect` 匹配的方块。
- 基调红线：正剧+民间志怪，志怪只到"说不清"为止（鬼火天亮必有世俗解释口），无西幻语汇。

## 现状 vs 规划

- 现状：8 事件全落地（第一章窗口为主；crow-burst/beacon-smoke/ghost-fire 无日期门，跨章可用）；存档/读档往返已测。已知限制：奇遇临时 NPC 不随存档重建（在场时存档读档后离场，followUp 到期 despawn 兑底为 no-op）——氛围事件自洁优先，值得重建时再补 provider。
- 规划（未实现）：第二章专属事件（迁界告示/官道白骨，见设计文档 §5 储备表）；night-refugee 可选 `requireFlags:["settled"]`（playtest 后定）；雪夜借宿/里社社祭。
