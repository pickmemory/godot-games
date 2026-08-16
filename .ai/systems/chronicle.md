# 编年史系统（chapter.js · npc.js · dialog.js · quests.js · cutscene.js + main.js 效果路由）

> 本作差异化核心：**历史不改道，但玩家在场**。本页写系统如何咬合。

## 业务规则

- R1: **章节 = JSON**（`web/data/chapters/<id>.json`）：`start/end`（格里历日期）、`dayLengthSeconds`、`seasons`、`worldState.onEnter/onExit`（开卷/收卷效果）、`events[]`。加载链：fetch 章节 JSON → 缺失时 `FALLBACK_CHAPTER` 同构兜底 —— 锚点 `chapter.js · loadChapter / normalizeChapter`
- R2: **日期→序数日** `dateToSerial`，事件触发器 `when.kind`：`gameDaysElapsed`（游戏天数）/ `minStat`（统计阈值）/ `flag`；已触发不重放（读档恢复触发态，开场演出不重播）—— 锚点 `chapter.js · ChapterTimeline.update / _runEffect`
- R3: **效果路由在 main.js**：`timeline.registerEffect(type, fn)` 逐类注册（startQuest/setDialog/cutscene/notify/skyTint/fogNear/fogFar/stampStructure/blockReplace…）。模块不互相 import，全在装配根汇流
- R4: **NPC 编年出场**：数据声明 `appear/disappear.date` → `dateToSerial` 比较 → `setChronicle(serial)` 在开卷与每日翻页时判定在场/离场 —— 锚点 `npc.js · NPCManager.setChronicle`。NPC 数据缺章节专属时兜底 `data/npc/npcs.json` 再兜底模块内 FALLBACK（fetchFirst 链）
- R5: **NPC AI 三态** idle/wander/approach（决策限频 0.35s 错峰；approach 半径 5.0、停在 1.8；交谈距离 TALK_RANGE=4.5，与迎客半径对齐）—— 锚点 `npc.js · NPC.update / nearestTalkable` + `main.js · TALK_RANGE`
- R6: **E 键优先级**（`main.js` keydown）：演出中任意键=跳过 > 对话开着 E=关闭 > 4.5 格内可交谈 NPC=开对话 > 8 格内=提示"再走近些"（不开合成台）> 合成面板。**E 语义优先 = 交谈**
- R7: **对话树** `dialog.js · DialogUI`：`{start, nodes}`，node 可带 `effects`（选项级+节点级），效果经构造注入的 `onEffect` 路由回 main.js；节点断链静默收尾不卡死
- R8: **任务** `quests.js · QuestSystem`：`objective {event, count}` 事件计数制；`notify(event, n)` 推进所有匹配 active 任务；`talk:<npcId>` 交谈即事件。任务开启由对话效果 `startQuest` 触发（不自动派发）
- R9: **演出** `cutscene.js`：开卷/章节事件 cutscene 效果 → 全屏黑底逐行淡入；期间冻结玩家/AI/交互（`main.js` 主循环 `cutscene.isActive` 门）；任意键跳过（skip 后 sleep 直通快进收尾）

## 事件流（一次典型奇遇链）

```
游戏日推进 → ChapterTimeline.update → when 满足且未触发
→ _runEffect → main.js 注册的处理器 → startQuest/setDialog/notify/cutscene…
→ NPC setChronicle 判出场 → 对话树/任务状态变化 → 存档（save.js 章节进度分节）
```

## 不变量

- **历史不改道**：事件效果只做世界状态迁移/演出/任务/传闻，**不得改变后续章节事件的结果**（demo-vision §一）
- 对话台词全在 JSON，代码零台词；NPC 模型 GLB 失败自动降级程序化体素村民

## 现状 vs 规划

- 现状：第一章 184·黄巾完整（10 事件/3 NPC）、第二章 190·讨董选段（18 事件，含洛阳焚城世界迁移）
- 规划（未实现）：D-3 奇遇系统（编年之间的随机事件层，issue #44）；更多章节（官渡/赤壁…）
