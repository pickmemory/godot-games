# 奇遇系统设计文档（MC-6 D-3）

> **任务来源**：issue #44（MC-6 D-3）· **执行角色**：文策渊（design-strategist）
> **下游消费者**：本 issue 同批交付的引擎（`web/src/encounters.js`）与数据（`web/data/encounters.json`）——本文档 §3 即该 JSON 的 schema 说明书，§4 事件表即其内容来源。
> **上游依据**：`docs/design/demo-vision.md` §一（柱一：亲历编年史，历史不改道）、§三（短板 3：事件密度低）、`docs/design/mc3-chapter1.md`（第一章编年与旗标）、D-2 探索结构（`web/src/explore.js`：烽燧/荒冢/巨木锚点）。
> **状态**：已实施（引擎 + 8 事件落地，`tools/verify-encounters.mjs` 27 项守护）。

---

## 1. 概述（它解决什么问题）

### 1.1 一句话

> 编年时间轴只在大节点动，日常"世界静悄悄"。奇遇层 = **编年之间的日子里，世界主动来敲你的门**——夜叩门的流民、掠过官道的斥候、荒冢上的游火。它们不改变历史，只让你**听见历史走近的脚步声**。

### 1.2 定位与红线

- 奇遇是**编年引擎的"感知层"**，不是第二条叙事线：章节事件（`chapters/*.json`）决定世界**何时**变，奇遇决定玩家**如何先感觉到**它要变。
- **历史不改道**（demo-vision §一柱一）：奇遇只提供视角与传闻。引擎层不变量 = 可路由的效果类型与章节事件**同一能力集**（notify/setFlag/spawnNpc/…），不存在任何「改写章节事件结果」的通路；约束由数据（事件表 §4 逐条标注）与评审保证。
- **基调：正剧 + 民间志怪**（非西幻）：鬼火是荒冢磷火与盗墓传说的民间尺度，不出现妖法/诅咒值/魔法伤害——志怪只到"说不清"为止，天亮必有一个世俗的解释口（冢被挖开、人来的、兽过的）。

### 1.3 体验目标（MDA·动态层）

| 目标 | 玩家感受 | 承载机制 |
|---|---|---|
| 世界在呼吸 | "哪怕不推进任务，日子也有事发生" | 昼夜沿抽签（每游戏日至多 2 次机会） |
| 传闻先行 | "起事前三天我就听贩夫说过驿马跑死了" | followUp 延迟效果 =「传闻化」 |
| 平民的信息网络 | "我的情报来自叩门的流民和摇铃的货郎，不是任务面板" | 对话式奇遇（临时 NPC + 内嵌对话树） |
| 善念有回声 | "分他半块饼，换来一句『少走北边官道』" | giveFood：消耗真食物 → 口述情报 |
| 拒绝有代价 | "门板上那几道刻痕，是我没开门的凭证" | 次日 scarMark 方块 + 旗标 |

## 2. 机制（触发模型）

### 2.1 触发管线

```
主循环每帧 → EncounterEngine.update(dt, ctx)
  ├─ 昼夜翻转沿检测：isNight false→true = 入夜检定点；true→false = 破晓检定点
  │    （每游戏日至多 2 次抽签窗口；演出中/未开卷不推进——与章节时间轴同门控）
  ├─ 全局静默期检查：距上次任意奇遇 < globalCooldownDays → 跳过
  ├─ 命中判定：rng() < nightChance / dayChance
  ├─ 资格过滤（eligible）：slot 匹配 + 一次性册 + 同类冷却 + 未在进行中 + gate 全过
  │    gate = 编年日期窗（from/to 序数日）+ requireFlags/forbidFlags + nearStructure
  └─ 加权抽签（weight）→ 触发：fire 效果逐条路由到 main.js 注册的处理器
```

### 2.2 实例生命周期

```
fire（触发即执行）
  └─ followUps[]：inDays 游戏日后到期；到期复查 requireFlags/forbidFlags
  │     ├─ 过 → 执行（数日后的"传闻化"/"次日结果"）
  │     └─ 不过 → 丢弃（时过境迁：没给食物的流民，清晨什么也没留下）
  └─ watch（可选）：锚 = 本实例放置的方块坐标
        ├─ 玩家进入 radius → effects（鬼火"靠近熄灭"）
        └─ 超过 inDays → timeoutEffects（天亮自灭）
收尾：所有 followUp 结案 && watch 结案 → 清 resetFlags（防污染下次同类事件）→ 出列
```

- **一次性（once）**：整档一次（斥候快报/道旁遗囊）。
- **同类冷却（cooldownDays）**：同一事件两次触发间的最小间隔（流民投宿 16 日）。
- **全局静默（globalCooldownDays=2）**：任何奇遇后 2 游戏日内世界安静——奇遇是"日子里的涟漪"，不是雨点。

## 3. 数据（web/data/encounters.json schema）

```jsonc
{
  "check": { "nightChance": 0.4, "dayChance": 0.32, "globalCooldownDays": 2 },
  "events": [
    {
      "id": "…", "title": "…",
      "slot": "night | day | any",        // 抽签窗口（入夜沿/破晓沿/两者）
      "weight": 10,                        // 加权抽签权重
      "once": false, "cooldownDays": 16,   // 整档一次 / 同类冷却（游戏日）
      "gate": {
        "from": { "year": 184, "month": 2, "day": 12 },   // 编年日期窗（可单侧）
        "to":   { "year": 184, "month": 12, "day": 20 },
        "requireFlags": [], "forbidFlags": ["war-begun"], // 与 chapter.js 共享旗标池
        "nearStructure": { "type": "han-mound", "radius": 48 }  // D-2 锚点近旁门
      },
      "fire": [ /* 效果数组，类型见 §6 */ ],
      "watch": { "radius": 7, "inDays": 0.45, "effects": [], "timeoutEffects": [] },
      "followUps": [ { "inDays": 1, "requireFlags": [], "forbidFlags": [], "effects": [] } ],
      "resetFlags": ["enc-refugee-fed", "enc-refugee-refused"]
    }
  ]
}
```

- 日期为简化格里历（复用 `chapter.js · dateToSerial`），与章节编年同一根数轴。
- 旗标与章节事件共享 `timeline.flags` 池：奇遇可读章节旗标（`forbidFlags: ["war-begun"]` = 起事后狼嚎让位给行尸），章节事件不读奇遇旗标（单向依赖，防改道）。
- 对话树内嵌在 `spawnNpc.npc.dialogTree`（与 `data/npc/dialogs.json` 同构的 `{start, nodes}`），不登记全局 dialogs 册——临时 NPC 的台词生命周期与事件绑定。
- `giveFood` 效果字段：`flag`（成功置位）、`intel`（有食物时的口述情报文案）、`none`（无食物时的兜底文案）。

## 4. 公式（参数与单位）

| 指标 | 公式 | 设计值 | 锚点 |
|---|---|---|---|
| 期望奇遇间隔 | `dayLength × (1/夜机会 + 1/昼机会)⁻¹ 折算`：每游戏日 2 次检定，单次命中 P=nChance；全局冷却 G 压频 | 见下 | `encounters.js · _runCheck` |
| 稳态触发率 | `λ ≈ min(P_night + P_day, 1/G) 次/游戏日` | `min(0.72, 0.5) = 0.5 次/游戏日`（第一章 dayLength 300s → 约每 10 分钟现实时间一次） | 同上 |
| followUp 到期 | `serial ≥ at + inDays`（serial = startSerial + elapsed 游戏日，小数） | 流民离场 0.42 日 ≈ 入夜到破晓 | `encounters.js · update` |
| watch 触发 | `min dist(placedBlocks, playerPos) ≤ radius`（3D 欧氏，格） | 鬼火 7 格 | `encounters.js · _playerNear` |
| 同类冷却 | `serial ≥ cooldownUntil[id] = at + cooldownDays` | 流民 16 日 | `encounters.js · _eligible` |
| 加权抽签 | `r = rng() × Σweight；逐事件 r -= weight；r ≤ 0 即中` | 鸦群 12 / 流民 10 / 鬼火·狼嚎 9 | `encounters.js · _weightedPick` |

- 密度校准依据：第一章事件间距约 15~35 游戏日（mc3-chapter1 §3.3），目标两节点之间 5~15 次奇遇把"日子"填出声；实测（A2 模拟）80 游戏日 27 次、7 种事件，落在目标带内。
- **待调参（playtest 后校）**：`nightChance/dayChance` 与 `globalCooldownDays` 是全局节奏旋钮——嫌吵先调 G，再调 P。

## 5. 事件表（≥8 个：散文级描述 / 世界效果 / 历史信息量评级）

> 信息量评级：★★★ = 直接指向章节事件的前兆；★★ = 时代氛围与背景；★ = 志怪/生存氛围；☆ = 纯氛围涟漪。

| # | id | 槽 | 窗口/门 | 散文级描述（玩家所见） | 世界效果 | 评级 |
|---|---|---|---|---|---|---|
| 1 | night-refugee 流民投宿 | 夜 | ≥2-12；冷却 16 日 | 夜半有人敲你的门，声音很轻。门外是个抱着蓝布包袱的男人，眼窝深陷："讨口吃的。孩子他娘走不动了，在前头破庙里躺着。俺不敢停——停下来，就得跪下去了。" | spawnNpc（临时流民+内嵌对话树）；**给食物**：giveFood 消耗 1 份粟米/葵菜 → 旗标 enc-refugee-fed → 口述情报"钜鹿来的都在传，张大贤良师的人挨村送符水，官府已经开始拿人了"；**不给**：旗标 enc-refugee-refused → 次日门板刻痕（scarMark 新方块）+旁白。0.42 日后天亮离场 | ★★★（起事前兆的民间信源） |
| 2 | scout-gallop 斥候快报 | 昼 | 3-05~3-21；once | 官道方向尘头大起——一骑斥候打马疾驰而过，连铃铛都没挂。是往北去的。马蹄声过了很久，你手里的土才敢落。 | notify；**3 日后 followUp**："北边各县在换戍卒，驿马这半月跑死了好几匹——要出大事了"（章节事件 3-25 起事的**传闻化**，不改起事本身任何效果） | ★★★ |
| 3 | ghost-fire 夜半鬼火 | 夜 | 近荒冢 48 格；冷却 15 日 | 荒冢那边浮起一点幽幽的火，贴着封土打转。不像人举的火把——它不灭，也不走。 | placeGhostFire（最近荒冢封土顶放篝火，lights.js 自动点亮，夜雾缘可见）；watch 7 格**靠近熄灭**（undoBlocks）；0.45 日超时天亮自灭；**1 日后 followUp**：digMound 封土开 2×2×3 口子、坑底碎陶与翻土（接 D-2 荒冢——"被挖开"给探索一个志怪入口） | ★（志怪；冢的"答案"留给玩家） |
| 4 | peddler-bell 货郎摇铃 | 昼 | ≥2-08；冷却 12 日 | 村口传来一串货郎铃。担子上一头针头线脑，一头各处的消息——乱世里，后者反倒贱些。 | spawnNpc（摇铃货郎+对话树：北边"符水治病的大贤良师名声越来越响，官府嘴上说拿人，老人偷偷上香"/南边"洛阳米价一天三涨，宫里贵人还在修园子"）；0.4 日后离村 | ★★★（平民的信息网络） |
| 5 | crow-burst 鸦群惊起 | 昼 | 无门；冷却 3 日；weight 12 | 一声哨响，官道旁的枯树炸起一片鸦，黑压压掠过头顶，往南去了。它们落过的那片地，半天没有虫鸣。 | notify（纯氛围涟漪，高频低响） | ☆ |
| 6 | beacon-smoke 烽燧夜火 | 夜 | 近烽燧 90 格；冷却 10 日 | 远处残破的烽燧上，火光比往常亮。也许是戍卒换了防。也许——烽火重新点起来的时候，从来不是为了给人看热闹。 | notify（接 D-2 烽燧顶部既有篝火，文案解释"比往常亮"） | ★★（军情氛围） |
| 7 | night-wolves 群狼夜嚎 | 夜 | forbidFlags:[war-begun]；冷却 9 日 | 后山的狼嚎一声接着一声，此起彼伏，像在围什么。鸡窝方向传来一阵扑腾——今夜把门抵紧些。 | notify（战前夜的生存氛围；起事后该槽位让给"流民行尸"的主旋律） | ☆ |
| 8 | roadside-pouch 道旁遗囊 | 昼 | 3-01~6-30；once | 官道边的草窠里，你踢到一只行囊——半旧的麻布，口子被人匆匆撕开过。它不会再有人来认领了。 | notify + dropLoot（玩家附近掉落煤炭×1、木棍×2——逃难人顾不上捡的） | ★（乱世的无名死者） |

### 储备事件（P2，本批不落地；扩事件只加 JSON）

| id（拟） | 一句话 | 落点 |
|---|---|---|
| snow-knock 雪夜借宿 | 冬夜母子上门，给处所 → 次日院里多了半垛柴（沿用 giveFood 管线换判定物） | 第一章冬幕 |
| she-sacrifice 里社社祭 | 春二月村社醵酒祭社，陈叟分你一脔肉（近 NPC 门 + 食物反向流动） | 平民风俗层 |
| removal-notice 迁界告示 | 190 章坊门贴告示：西迁令（第二章董卓迁都的民间前奏） | 第二章 |
| bell-in-fog 雾中钟声 | 秋雾清晨远处废寺钟自鸣一声（纯 notify，接 autumn-smoke 雾期） | 氛围 |
| bone-road 官道白骨 | 190 章官道成列白骨（blockStamp 类结构叙事，需 D-2 型锚点变体） | 第二章 |

## 6. UI 接口（不加新面板）

- **notify** → 复用 `ui.showPickup`（HUD 短旁白）——所有氛围类事件的呈现层。
- **对话式奇遇**（流民/货郎）→ 复用 `DialogUI`（#dialog 面板）：临时 NPC 经 `spawnDynamic` 入场、`dialogTree` 内嵌树直接喂给 `dialogUI.open`；E 键交谈优先级链不变（`nearestTalkable` 已兼容内嵌树）。
- **giveFood**：对话选项效果，经 `dialogUI.onEffect` 路由（与 startQuest/setFlag 同一管线）。
- 世界呈现（篝火光/刻痕/挖开的冢）走方块与 lights.js 既有渲染路径，**零新增 UI 元素**（铁律：UI 类交付必须视口内可见——本系统无新 UI，回归由既有三件套守护）。

### 效果类型注册表（main.js 装配；与章节效果同构）

| type | 参数 | 语义 |
|---|---|---|
| `notify` / `setFlag` / `startQuest` / `sky` / `mobs` / `blockReplace` | 同章节效果 | 与 `chapter.js` 共用处理器语义（本批只用前三） |
| `spawnNpc` | `npc:{…含 dialogTree}` | 玩家旁 3 格落临时 NPC（id=`enc-<id>-<序数日>`） |
| `despawnNpc` | `id` | 按 id 前缀回收（幂等；长会话不积尸） |
| `giveFood` | `flag, intel, none` | 有食物→消耗 1+置旗标+情报；无→兜底文案 |
| `placeGhostFire` / `undoBlocks` | — | 荒冢顶放/回收篝火（坐标回填实例 placedBlocks） |
| `digMound` | — | 最近荒冢封土开口、坑底碎陶（差分持久） |
| `scarMark` | — | 最近房屋门旁墙根放「流民刻痕」方块（新方块 id 42） |
| `dropLoot` | `items:[{id,n}]` | 玩家附近撒掉落物实体 |

## 7. 依赖与咬合

- **chapter.js**：`dateToSerial`（同一根编年数轴）；旗标池共享（单向：奇遇读章节旗标，章节不读奇遇旗标）。
- **explore.js（D-2）**：`anchorAt` 提供 han-mound/beacon-tower 锚点（gate.nearStructure 与 placeGhostFire/digMound 的落点）；`nearestStructureOf`（main.js）做 192 格窗扫描，只在抽签时调用（≤每游戏日 2 次）。
- **npc.js / dialog.js**：`spawnDynamic` + `dialogTree` 内嵌树 + `removeByIdPrefix`（本 issue 的小改，3 处）。
- **blocks.js / textures.js**：新方块「流民刻痕」（cross 面片，复用陪葬陶片的渲染路径）。
- **save.js**：`encounters` 分节（once 册/冷却表/进行中实例含 placedBlocks——读档后未熄的鬼火仍可回收）。
- **与章节轴的咬合**（总述）：奇遇窗口全部嵌在章节事件的**间隙与前置**里——斥候快报窗（3-05~3-21）咬死在起事（3-25）之前 4 天以上；狼嚎在 war-begun 后自动退场；流民的情报只复述民间已传闻的起事前兆。**历史节点的结果、效果、日期一律不动。**

## 8. 验收标准（对照 issue #44 硬验收）

- [x] 触发模型四要素齐全：世界状态（flags/nearStructure）+ 时段（slot：入夜/破晓沿）+ 概率（chance/weight）+ 冷却（once/cooldownDays/globalCooldownDays）+ 编年日期门控（gate.from/to）
- [x] 事件表 ≥8 个，每个含散文级描述/世界效果/历史信息量评级（§5）
- [x] 数据驱动：事件全走 `web/data/encounters.json`，代码（encounters.js）只做引擎；台词零硬编码（giveFood 的 intel/none 也在数据）
- [x] 首批落地 ≥3 个可玩事件：流民投宿（夜叩门：给食物→口述情报 / 不给→次日墙上刻痕）/ 斥候快报（骑影→3 日后章节事件传闻化）/ 夜半鬼火（荒冢游火，靠近熄灭，翌日荒冢被挖开——接 D-2 结构）
- [x] 奇遇 UI 复用 pickup/对话系统，零新面板
- [x] `node --check` 全绿；既有三件套 PASS；`tools/verify-encounters.mjs`（模拟时间推进触发 ≥2 事件：A2 实测 80 游戏日 7 种 27 次）PASS
- [ ] 浏览器手测清单（留给 QA/主创，附下）：
  - 夜间靠近荒冢等触发鬼火 → 篝火光在封土顶亮起 → 走近 7 格内熄灭 → 次日封土开口见碎陶
  - 夜叩门事件：对话面板在视口内；给粟米 → 行囊少 1 + 情报旁白；不给 → 次日门旁见刻痕（十字面片）
  - 3 月上旬白昼等斥候快报 → 3 游戏日后传闻旁白
  - 刷新页面（读档）：已触发的 once 事件不重来；进行中的鬼火仍能被走近熄灭

## 9. 边缘情况（≥3 类）

**E1 · 玩家不在场/挂机时触发**
- 症状：夜叩门触发时玩家在地下挖矿/挂机，流民 NPC 生成在玩家旁 3 格的洞穴里，"敲门"语境穿帮。
- 处理：接受。临时 NPC 0.42 日后自动离场，事件自洁；文案"敲你的门"与实际位置脱节是引擎级取舍（奇遇以玩家为锚，不做建筑判定——房屋判定是 MC-4b 的重机制，不为氛围事件重复）。playtest 若穿帮感强，后续给 night-refugee 加 `gate.requireFlags:["settled"]`（有墙才有人敲门）——数据一行即可，无需改码。

**E2 · followUp 到期时旗标已变（竞态）**
- 症状：玩家在流民离场前又触发了别的事件置了同名旗标（当前数据无此冲突，未来扩表可能）。
- 处理：followUp 到期复查 gate，不过即**丢弃**（时过境迁语义）；resetFlags 在实例收尾统一清理，保证同 id 下次触发从干净状态开始。旗标命名约定 `enc-<事件>-<语义>` 防跨事件撞名。

**E3 · 存档/读档中断实例**
- 症状：鬼火已放（方块在差分里）、watch 未结时关页；读档后 watch 若丢失，篝火永亮成"死火"。
- 处理：`encounters` 存档分节含进行中实例的 placedBlocks；undoBlocks 只在方块仍是放置时的种类（`expect`）才回收——玩家若把鬼火挖走/改建，其改动优先，回收不毁玩家建筑。

**E4 · 抽签与章节事件同帧**
- 症状：破晓沿恰逢章节日期事件（如 3-25 起事当帧），notify 叠加覆盖（showPickup 单元素，后者顶掉前者）。
- 处理：接受（HUD 短旁白本就是瞬态层，console 有完整日志）；关键叙事走对话/演出不走 pickup。若 playtest 反馈强烈，后续给 notify 加队列——属 UI 层通用改进，不归奇遇系统。

**E5 · 全部候选被门控滤空**
- 症状：冬季深夜 + 无结构近旁 → 候选空，该检定点静默。
- 处理：设计如此（世界可以没事发生）；候选空时连 rng 命中判定都跳过，无性能损耗。

## 10. 关键设计决策（3 条，答 issue「报告」项）

1. **抽签窗口挂在昼夜翻转沿，而不是定时器**：每游戏日恰两次（入夜/破晓），与生存节奏（守夜/开耕）同拍——夜奇遇在恐惧窗口里发生、昼奇遇在生计窗口里发生，时段本身就是叙事。
2. **「传闻化」用 followUp 通用能力表达，不专设"预告"系统**：斥候快报 = 触发 + 3 日后延迟效果，同一机制还复用为流民"次日刻痕"、鬼火"翌日挖开"——一个调度原语喂三个叙事节拍。
3. **奇遇读章节旗标、章节不读奇遇旗标（单向依赖）**：狼嚎在 war-begun 后退场、给食物的情报只复述民间传闻——"历史不改道"从依赖方向上就不可能被违反。

---

*文策渊 · MC-6 D-3 交付。引擎/数据/验证脚本同批落地；扩事件只改 JSON，扩效果类型才动 main.js 注册表。*
