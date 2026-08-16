# NPC / 对话 / 任务数据 schema（MC-3b · npc-system）

> 引擎：`web/src/npc.js`（`NPCManager`）、`web/src/dialog.js`（`DialogUI`）、`web/src/quests.js`（`QuestSystem`）。
> 装配见 `web/src/main.js`。本目录数据只描述「谁、在哪、何时在场、说什么」；
> 行为执行（任务开启/旗标/通知）在 main.js 注册的 effect 路由里——与 `data/chapters/README.md` 的 effects 模式同构。

## npcs.json

```json
{
  "npcs": [
    {
      "id": "elder-chen",
      "name": "陈叟",
      "title": "里中老者",
      "model": { "type": "procedural", "robe": "#8a6f4d", "skin": "#d9b38c", "hat": true },
      "portrait": { "bg": "#3d3226", "fg": "#e8d9b0" },
      "spawn": { "x": 14, "z": 10 },
      "wander": { "radius": 9, "speed": 1.4 },
      "appear": { "date": { "year": 184, "month": 3, "day": 6 } },
      "disappear": { "date": { "year": 184, "month": 11, "day": 1 } },
      "dialog": "elder-01"
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✓ | NPC 标识（任务/调试引用） |
| `name` / `title` | string | — | 头顶名牌两行（title 可空） |
| `model` | object | — | `type:'procedural'`（占位体素村民：`robe`/`skin`/`hat`/`headband` 配色）或 `type:'glb', url:'assets/npc/xxx.glb'`（异步加载，动画按 clip 名含 Idle/Walk 匹配；失败自动兑底程序化模型。引入 GLB 须登记 `web/assets/CREDITS.md`） |
| `portrait` | `{bg,fg}` | — | 对话立绘占位配色（底色/前景字色） |
| `spawn` | `{x,z}` | — | 锚点世界坐标（引擎落该处地表；缺省 8,8） |
| `wander` | `{radius,speed}` | — | 游走半径（格）/ 步速（格/秒，默认 1.4） |
| `appear` / `disappear` | `{date}` | — | **编年出场/离场钩子**：`{year,month,day}` 简化格里历；日期复用 MC-3a `chapter.js` 的 `dateToSerial` 折算序数日，由 `NPCManager.setChronicle(currentSerial)` 在开卷与每个游戏日翻页时判定。缺省 = 开卷在场 / 永不离场 |
| `dialog` | string | — | 对话树键 → `dialogs.json` 顶层键；缺省不可交谈。运行期可由章节事件效果 `setDialog` 切换（`NPCManager.setDialog(id, treeKey)`，如陈叟战前/战后双树） |
| `dialogTree` | object | — | MC-6 D-3：内嵌对话树（`{start, nodes}`，与 dialogs.json 单树同构）。奇遇临时 NPC（encounters.json 的 spawnNpc 效果）用它免登记全局dialogs 册，台词生命周期随事件；`dialogUI.open` 优先于 `dialog` 键 |

漫游 AI 三态：`idle`（待机）→ `wander`（锚点圆内随机游走）→ `approach`（玩家 5 格内走近至 2.2 格站定面向玩家，玩家离开 9 格放弃）。决策限频 0.35s 且个体错峰；物理为重力 + 逐轴 AABB 体素碰撞 + 撞墙小跳（可上 1 格台阶），与 player/mob 同算法思路、按 NPC 自身宽高独立实现。

## dialogs.json

顶层 = 树键（与 npcs.json 的 `dialog` 对应）→ `{start, nodes}`：

```json
"elder-01": {
  "start": "greet",
  "nodes": {
    "greet": {
      "text": "……",
      "effects": [ { "type": "startQuest", "id": "settle-down" } ],
      "choices": [ { "text": "选项文案", "next": "nodeId", "effects": [] } ]
    }
  }
}
```

- 节点进入时执行节点 `effects`；选中选项时执行选项 `effects` 再跳 `next`；`next:null` = 对话结束。
- 无 `choices` 的叶子节点默认渲染「告辞」。
- 节点引用断链 → console.warn 并安全收束对话（不卡死）。

### effects（type → main.js 路由）

| type | 参数 | 语义 |
|---|---|---|
| `startQuest` | `id` | 开启任务（quests.js `begin`） |
| `setFlag` | `flag, value=true` | 置/清章节时间轴旗标（chapter.js `setFlag`，与章节事件共享剧情记忆） |
| `notify` | `text` | HUD 短旁白 |

MC-3d 历史人物台词沿同一管线：扩本文件 + 章节事件 effects 即可，零代码。

## ../quests.json

```json
{ "quests": [ { "id", "title", "desc", "objective": { "event": "blocksPlaced", "count": 20 } } ] }
```

- 状态机 `locked → active → done`；`begin(id)` 开启（对话效果触发），`notify(event, n)` 推进（main.js 把玩家行为翻译成事件，事件名与 chapter.js `ctx.stats` 同名约定：`blocksPlaced` / `blocksMined` / `talk:<npcId>` …）。
- 进度达标自动 `done` 并回调 `onComplete`（HUD 提示在 main.js 挂）。
- 本阶段为占位定义验证管线；具体任务内容 MC-3d 充实，存档持久化留 MC-4。
