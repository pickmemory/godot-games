# 章节数据 schema（MC-3a · chapter-timeline）

> 引擎：`web/src/chapter.js`（`loadChapter` / `normalizeChapter` / `ChapterTimeline`）。
> 装配与效果处理器的实现见 `web/src/main.js`。示例：`184-yellow-turban.json`。
> 本目录数据只描述「何时发生什么」，世界迁移的**执行**在 main.js 注册的 effect 处理器里——数据零代码、代码零章节内容。

## 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✓ | 章节标识（存档/跨章引用） |
| `title` / `subtitle` | string | — | 章名 / 年号等 |
| `start` | `{year,month,day}` | ✓ | 开卷编年日期 |
| `end` | `{year,month,day}` | — | 章末日期；越过即触发 `onChapterEnd`（章节迁移） |
| `dayLengthSeconds` | number | — | 现实秒/游戏日（默认 180，须与昼夜系统一致） |
| `seasons` | object | — | 季节定义（见下） |
| `worldState.onEnter` | effect[] | — | 开卷时一次性执行的世界迁移 |
| `worldState.onExit` | effect[] | — | 章末（越过 end）一次性执行的收束迁移（结尾演出等；MC-3d） |
| `events` | event[] | — | 编年事件（见下） |

**日历约定**：`{year,month,day}` 为简化格里历，引擎以 `Date.UTC` 折算序数日排序比较；史实农历→公历的校订由 MC-3c 设计文档提供，数据只落换算后的日期。

## seasons

```json
"spring": { "label": "春", "months": [2,3,4], "params": { "skyTint": "#87ceeb", "fogFar": 130 } }
```

- `months`：归入该季的月份（1–12，须互斥；未覆盖的月份引擎按默认四季兑底并 console.warn）。
- `params`：季节参数包，引擎原样暴露给 main.js（当前消费 `skyTint`/`fogFar`；`grassTint` 等留给 MC-3c）。
- 季节随游戏日历月份自动流转，切换时回调 `onSeasonChange({name,label,params})`。

## events

每个事件 **`date`（日期触发）或 `when`（条件触发）二选一**，触发一次即作废（`fired`）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 事件标识（去重/日志） |
| `title` | string | 事件名（HUD/console） |
| `date` | `{year,month,day}` | 编年到 → 触发（引擎按序数升序检查） |
| `when` | `{kind, ...}` | 条件满足 → 触发（每帧求值） |
| `narration` | string | 亲历式旁白文案（MC-3c 长卷叙事消费） |
| `effects` | effect[] | 世界状态迁移（见下） |

### 条件 `when.kind`（引擎内置，可扩充）

| kind | 参数 | 语义 |
|---|---|---|
| `gameDaysElapsed` | `days: N` | 开卷满 N 个游戏日 |
| `isNight` | — | 任意一次入夜 |
| `flag` | `flag: name` | 旗标被置位（见 `setFlag` 效果） |
| `minStat` | `stat, count` | 玩家统计达标（ctx.stats，如 `blocksPlaced`） |

## effects（type → 处理器，main.js `registerEffect` 注册）

| type | 参数 | 语义 |
|---|---|---|
| `notify` | `text` | 屏幕短旁白 + console 日志 |
| `setFlag` | `flag, value=true` | 置/清旗标（剧情记忆 + 条件触发链） |
| `blockReplace` | `center:'player'｜{x,y,z}, radius, yRange:[lo,hi], from, to` | 圆柱区域内 `from` 方块批量替换为 `to`（方块 id 见 `blocks.js`） |
| `mobs` | `spawn: {maxCount, interval, ...}` | 合并覆盖生物生成参数（`data/mobs.json` 同构） |
| `sky` | `fogNear, fogFar, ...` | 天光/雾参数覆盖（后续扩充 `sunDim`/`skyTint`） |
| `cutscene` | `title, subtitle, lines[], epilogue?` | MC-3d 章节开场/结尾演出：全屏黑底题签 + 旁白逐行淡入（cutscene.js），演出期间冻结玩家/AI/时间轴；任意键跳过；`epilogue` 在演出结束后作 HUD 短旁白弹出 |
| `startQuest` | `id` | MC-3d 开启任务（quests.js `begin`；与对话效果同构，幂等） |
| `setDialog` | `npc, dialog` | MC-3d 运行期切换 NPC 对话树（npc.js `NPCManager.setDialog`；用于旗标后台词切换，免 disappear/reappear 闪场） |

未注册的 type 触发时 console.warn 并跳过，不会中断时间轴。
