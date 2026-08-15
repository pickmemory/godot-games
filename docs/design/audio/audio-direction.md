# 音频方向 · 《三国长卷》听觉规范（MC-5c）

> **任务来源**：issue #39（MC-5c）· **执行角色**：阮和鸣（audio-director）
> **听觉锚点**：与美术圣经（`docs/design/art-bible.md`）「土的、旧的、会烧掉的」一一对位——
> **音乐是荒野里的一张旧琴，环境是活着的村子，旁白是长卷的画外音**。
> 平民苍凉，不做英雄史诗：禁铜管齐鸣、禁凯旋大调、禁好莱坞打击乐堆叠。
>
> **本文档对接的已落地现状**（写作时核对过源码）：
> - `web/src/sfx.js`：WebAudio 程序合成全套交互音（挖掘/脚步/受击/呻吟/夜风 `setNight`），单例挂 main.js
> - `web/src/main.js`：`ensureAudio()` 用户手势激活 AudioContext；`updateDayNight()` 返回 `nightK∈[0,1]`（>0.9 为夜间生物窗口）；`isNight` 全局量；`sfx.setNight(isNight)` 在入夜/破晓调用
> - `web/src/chapter.js`：`ChapterTimeline.tick(ctx)` 每帧收 `ctx={isNight, playerPos, stats}`（**BGM 状态机的现成挂接管线**）；事件 `narration` 字段；`registerEffect(type, fn)` 效果路由（未注册类型告警，可扩展）
> - `web/src/cutscene.js`：章节开场/结尾演出（题签+逐行淡入旁白，`cutscene.isActive` 冻结游戏）
> - `web/data/chapters/184-yellow-turban.json` / `190-dong-zhuo.json`：`events[].narration`、`worldState.onEnter/onExit[].lines`（旁白文案源）、`seasons.params`（季节氛围，音频侧扩展点）
> - `web/src/mob.js`：`MobManager.mobs[]`（`pos` 可测距）、spawn 窗口即 `nightK>0.9`
>
> **资产清单与接入规范**（文件级）见同目录 `asset-manifest.md`；真实资产已落 `web/assets/audio/`。

---

## 目录

1. [音频总纲与三层信条](#1-音频总纲与三层信条)
2. [声音调色板](#2-声音调色板)
3. [BGM 四态系统](#3-bgm-四态系统命名循环切换状态机)
4. [环境音分层系统](#4-环境音分层系统)
5. [历史事件旁白规范](#5-历史事件旁白规范)
6. [混音总线与响度](#6-混音总线与响度)
7. [性能预算与边缘情况](#7-性能预算与边缘情况)
8. [实现策略（交程基岩）](#8-实现策略交程基岩)

---

## 1. 音频总纲与三层信条

| 信条层 | 听觉手段 | 反例（禁止） |
|---|---|---|
| **先给恐惧** | 夜间=信息剥夺：BGM 抽走旋律只剩鼓点与不规则静默；环境音只剩虫鸣与「墙外的东西」的响动 | 夜间加英雄化战斗音乐（恐惧≠燃） |
| **再给天梯** | 工具/材质交互音随天梯「变实」：木石的脆、铁的沉（sfx.js 已有材质脚步表，方向固化） | 交互音越级豪华（铁器音不该像宝剑出鞘） |
| **最后给沙盒** | 定居的听觉奖励：自家火塘边的暖筝、鸡犬之声——「家」是被听出来的 | 定居 BGM 甜腻化（保持"穷人的安稳"） |

**一句话基调**：世界大部分时间**没有音乐**——音乐只在状态改变时短促进入，像荒野里偶尔听见的琴声。BGM 音量整体压低（§6），玩家大多数时间听到的是**环境与自己的动作**。这是「平民尺度」在音频上的第一原则。

---

## 2. 声音调色板

### 2.1 乐器色板（BGM）

| 角色 | 乐器 | 用途 | 使用纪律 |
|---|---|---|---|
| **主奏** | 古琴 | 探索/章节事件的叙事主音 | 滑音、留白优先于音量；独奏段落不加伴奏 |
| **副奏** | 箫 | 探索的远方感、危险的呜咽 | 永远「远」处理（低通+混响感），像隔着雾听见 |
| **节奏** | 大鼓/建鼓 | 危险态脉冲、章节事件的战鼓 | **只用于恐惧与兵灾**，禁止用于胜利/凯旋 |
| **暖色** | 筝 | 定居态的火塘感 | 指弹颗粒感，禁华丽刮奏 |
| **点缀** | 埙/角 | 章节事件的历史重量 | 每章 ≤2 次入场，出现即「历史在场」（对位美术圣经 §2.2 点缀色） |
| 禁用 | 铜管齐鸣、交响弦乐群、电子鼓、钢琴 | — | 与汉代民间世界观撕裂 |

### 2.2 环境音色板

| 类 | 声源 | 态 |
|---|---|---|
| 自然 | 风（昼/夜两档，sfx.js 夜风已有程序版）、雨（P2）、虫鸣（夏夜） | 背景层循环 |
| 村落 | 鸡鸣（破晓）、犬吠（随机/敌对接近时）、孩童远声（P2） | 单次层 |
| 战争 | 远处战鼓号角、火声闷响、大军行进低频 | 事件层（章节事件驱动） |
| 静默 | **静默是武器**：重大事件（如 `guangzong-falls`）触发后 30 秒全总线压 50%——「世界停了一拍」 | 混音手法 |

---

## 3. BGM 四态系统（命名/循环/切换状态机）

### 3.1 四态定义与命名（资产名即状态名）

| 状态 id | 资产文件 | 中文名 | 情绪词 | 乐器配置 |
|---|---|---|---|---|
| `explore` | `bgm-explore.mp3` | 探索·行路 | 荒野独步·陌生 | 古琴独奏为主，箫远远应和；无鼓 |
| `danger` | `bgm-danger.mp3` | 危险·长夜 | 恐惧·墙外有物 | 低鼓慢脉冲 + 古琴刮擦不谐和音 + 箫呜咽；**不解决**（无终止感） |
| `settle` | `bgm-settle.mp3` | 定居·火塘 | 穷人的安稳·喘息 | 筝指弹 + 箫柔线；中慢板 |
| `event` | `bgm-chapter-event.mp3` | 章节·风云 | 兵灾·历史碾过 | 建鼓群 + 埙/角 + 古琴密集轮拂；收在单音古琴（灰烬感） |

### 3.2 状态机（优先级从高到低，互斥单实例）

```
event（最高，覆盖一切）
  ▲ 触发：cutscene 播放期间 / 事件显式指定（§3.4）
  ▼ 退出：cutscene 结束（1.5s 淡出）→ 回落至下述三态判定
danger
  ▲ 触发：isNight == true（main.js 现有全局量）
        或 任一行尸 distanceTo(playerPos) < 20 格（mobManager.mobs 遍历，tick 节流 0.5s 一次）
  ▼ 退出：昼 + 20 格内无敌（迟滞：需连续 8 秒满足才退出，防破晓抖动）
settle
  ▲ 触发：昼 且 玩家 24 格半径内「玩家放置方块」≥ 40（stats.blocksPlaced 的粗代理，
        精确方案见 §8 数据接口 `settleHotspot`——引擎已有 structure anchor 时优先用锚点半径 32 格）
  ▼ 退出：离开定居半径连续 20 秒（迟滞）
explore（默认态，以上皆不满足）
```

**迟滞规则（防抖，全部状态切换共用）**：进入需条件连续成立 2 秒；退出按各态上表。任何切换 = 双轨交叉淡化（见 3.3），**禁止硬切**。

**循环规则**：四轨全部无缝循环（生成时已按 loop 提示制作；接入时 `<audio loop>` 或 AudioBufferSourceNode `loop=true`）。`event` 态**不循环**——放完即回落（历史碾过就走了，不驻场）；cutscene 比音频长则静默等待，比音频短则 1.5s 淡出。

### 3.3 切换淡化参数

| 转换 | 淡入 | 淡出 | 备注 |
|---|---|---|---|
| → `danger` | **1.5s** | 3s | 恐惧要快——入夜/行尸逼近不能等 |
| `danger` → 任意 | 3s | **5s** | 缓出：余悸 |
| 其余互转 | 3s | 3s | |
| → `event` | 0.5s | — | 演出开场，准点进入 |
| `event` → 任意 | — | 1.5s | |
| 旁白触发时 | — | — | 全 BGM/环境 ×0.3 ducking，旁白结束 1s 恢复（§5.4） |

### 3.4 与章节状态机的对接点（数据驱动，勿硬编码）

章节 JSON（`web/data/chapters/*.json`）扩展两个**可选**效果类型（经 `timeline.registerEffect` 注册，引擎侧新增 handler，见 §8）：

```jsonc
// events[].effects 内：
{ "type": "playBgm", "state": "event", "hold": 90 }   // 强制 event 态 90 秒（游戏秒），到期回落
{ "type": "ambient", "layer": "distant-war", "fade": 10 } // 环境事件层开（§4）
// worldState.onEnter/onExit 的 cutscene 效果天然隐含 event 态（cutscene.isActive 期间）
```

建议挂接示例（第一章 `autumn-smoke`、`guangzong-falls` 加 `playBgm`；`army-marches-through` 加 `ambient: distant-war`）——**文案/数值由文策渊在章节 JSON 落地，音频侧只定 schema**。

### 3.5 四态与昼夜/敌对的默认映射（无章节数据时的兜底行为）

引擎内建：`explore`（昼·默认）/`danger`（夜 或 敌近）为**全局硬规则**，章节数据只能追加 `event` 覆盖与 `settle` 微调（如定居半径），不可关闭 danger——**第一夜的恐惧是设计信条，不交给数据**。

---

## 4. 环境音分层系统

### 4.1 三层架构

| 层 | 生命周期 | 声源 | 触发方 | 实例数上限 |
|---|---|---|---|---|
| **背景层**（bed） | 长循环，昼夜/季节交叉淡化 | 风·昼、风·夜、虫鸣·夏夜 | 引擎内建昼夜规则 + 章节 `seasons.params.ambient` 覆盖 | 同时 ≤2 |
| **事件层**（event-ambient） | 中长循环（30s~3min），事件驱动开关 | 战火远响、烟期闷响 | 章节 `{"type":"ambient","layer":...}` 效果 | 同时 ≤1 |
| **单次层**（oneshot） | 一次性播放 | 鸡鸣（破晓窗口）、犬吠（随机 60~180s；danger 态概率 ×3） | 引擎内建调度 + 事件 | 无硬限（稀疏） |

### 4.2 背景层状态表（数据文件 `web/data/audio/ambient.json`，§8）

| 昼夜 | 默认 | 季节/章节覆盖（示例） |
|---|---|---|
| 昼 | 风·昼（程序合成版已有：sfx.js `_startWind`，P1 换采样 `amb-day-wind.mp3`） | 冬：风音量 ×1.3（对位美术圣经冬季 fogFar 90 的「世界更空」） |
| 夜 | 风·夜 + 虫鸣（`amb-night.mp3`，已生成：蟋蟀+远犬+草风） | `autumn-smoke` 事件后：+事件层 `distant-war`（`amb-distant-war.mp3`，已生成） |

### 4.3 挂接模块建议（数据驱动）

- 全部环境音定义收在 `web/data/audio/ambient.json`（层名→文件、音量、淡入出、调度规则），引擎读表执行；**禁止在 main.js/mob.js 散落 `new Audio('...')` 硬编码**。
- 鸡鸣挂破晓：`updateDayNight` 已有 c 段（`0.58→0.75` 破晓插值段），破晓进入时掷骰（60% 播 `sfx-chicken.mp3` P1 / 程序合成 P0 兜底）。
- 犬吠与敌对联动：danger 态下犬吠频率 ×3 且音量 +20%——「狗比你先知道」。

---

## 5. 历史事件旁白规范

### 5.1 音色（mmx speech，已实测可用）

| 角色 | mmx voice id | 参数 | 理由 |
|---|---|---|---|
| **主旁白（长卷画外音）** | `male-qn-qingse` | speed 0.9 | 冷静中年男声，克制不煽情；`narration-chapter-open.mp3`/`narration-event.mp3` 即此音色样音 |
| 备选 A（编年史感更重） | `Chinese (Mandarin)_Male_Announcer` | speed 0.9 | 庄重播报腔，适合章末捷报类（如 `changshe-victory`）；主创可二选一 |
| 备选 B（苍老智者） | `Chinese (Mandarin)_Wise_Women` | speed 0.85 | 若主创想要「说书人」感 |
| NPC 配音（P2 预留） | 陈叟=`Chinese (Mandarin)_Kind-hearted_Elder` | — | 仅对话立绘场景；旁白线不用 |

**定案建议**：主旁白用 `male-qn-qingse`。同一段落**永远单音色**——长卷的画外音是一个人。

### 5.2 文案节奏规范（供文策渊写 `narration` 字段时遵循）

- 每行 ≤30 字（现章节 JSON 已符合，固化）；一段 ≤4 行。
- 语速 0.9× ≈ **4 字/秒**；句间（句号后）停顿 0.6~0.8s；段末留白 ≥2s 再交还游戏。
- 短句>长句；**数字一律汉字**（「三万余」而非「30000余」——TTS 读法与文风双重要求）。
- 禁叹号滥用：旁白是「说给你听」，不是「喊给你听」（现 JSON 已符合）。

### 5.3 触发器映射（对应章节 JSON 字段，全部现成）

| 章节 JSON 字段 | 旁白行为 | 音频侧处理 |
|---|---|---|
| `worldState.onEnter[].lines` | 章节开场旁白（cutscene 逐行淡入时**同步逐行播报**：上一行语音播毕再淡入下一行，替代固定行间隔） | cutscene 层调 `narration.speak(line)` |
| `worldState.onExit[].lines` + `epilogue` | 收卷旁白（同上；epilogue 不配音，纯字幕） | 同上 |
| `events[].narration` | 事件触发即播（一次）；同时 `notify` 文字照常出 | 与 notify 同帧触发，**先 duck 后 speak**（§5.4） |
| `events[].effects[notify]` | 不配音（UI 短文案） | — |

P1 成批落地建议：每章开场/收卷旁白预生成（命名 `nar-<章节id>-open.mp3` / `-close.mp3`，事件旁白量大走运行时缓存策略见 §8）。

### 5.4 混音协作（ducking）

旁白总线发声期间：`bgm`×0.3、`ambient`×0.3、`sfx`×0.7（交互音保留手感）；结束 1s 线性恢复。旁白自身不 duck。cutscene 期间 BGM 已是 `event` 态，ducking 照常生效（鼓点让位于人声）。

### 5.5 可访问性与降级

- 设置面板（P1）三档：「旁白 开 / 仅字幕 / 关」；默认开。
- 无 WebAudio/静默失败：旁白自动降级为「仅字幕」（现有 cutscene 字幕路径即兜底，零风险）。

---

## 6. 混音总线与响度

### 6.1 总线结构（WebAudio graph，main.js `ensure()` 后构建）

```
master(0.9)
├── busBgm(0.35)      ── BGM 四态 + 章节 event
├── busAmbient(0.25)  ── 环境三层
├── busSfx(0.60)      ── sfx.js 全部交互音（现直连 destination，P1 迁入总线）
└── busNarration(0.9) ── 旁白（最高优先，触发 ducking）
```

- 响度参考：以 `sfx.pickup` 为手感基准（现状音量不动），BGM 永远低于交互音——**世界先于音乐**（§1 原则的混音落实）。
- 主总线不做动态压缩（WebAudio DynamicsCompressor 留 P2，当前实例数下无削波风险）。

---

## 7. 性能预算与边缘情况

### 7.1 预算（PC/浏览器，对齐 AGENTS.md Web 约定）

| 项 | 预算 | 现状 |
|---|---|---|
| 同时发声实例 | ≤8（2 BGM 淡化交叠 + 2 环境 + 1 旁白 + 3 SFX 余量） | sfx.js 短音即发即弃，安全 |
| 音频文件总量 | P0 ≤40MB（当前 8 文件 ≈34MB ✅；P1 整体 128kbps 重压至 ≈18MB） | `web/assets/audio/` |
| 单 BGM | ≤8MB（256kbps ≈2~4min；当前最大 bgm-chapter-event 7.3MB ✅） | ✅ |
| 解码时机 | 章节加载后 idle 解码入 AudioBuffer（BGM 四态预解码；环境按需） | P1 |

### 7.2 边缘情况

- **E-音频①**：浏览器自动播放策略——BGM 与旁白**必须**在 `ensureAudio()`（用户手势）之后启动；章节开场 cutscene 在手势前触发 → 旁白降级字幕，BGM 延至首次手势淡入（3.1 的淡化时间已容忍此延迟）。
- **E-音频②**：`event` 态 BGM 播完早于 cutscene 结束 → 保持静默（不回落三态判定，演出期间免打扰）；`hold` 秒数到期但 cutscene 仍活跃 → 顺延至 cutscene 结束。
- **E-音频③**：danger↔explore 在破晓窗口（`nightK` 0.9 上下抖动）→ 8 秒退出迟滞（3.2）已覆盖；若行尸白天残留 20 格内，danger 持续（**正确行为**：威胁以实体为准，不以昼夜为准）。
- **E-音频④**：存档恢复（save.js `restore`）→ BGM 状态机重新判定（不序列化音乐状态，重进按当前 isNight/位置即时定态，无淡化直接低音量起播 2s 淡入）。
- **E-音频⑤**：mmx 生成物的音乐性偏差（环境音生成为「带旋律的音乐」风险）——已生成的 `amb-night.mp3`/`amb-distant-war.mp3` **标记「待人工审听」**：若审听不合格，降级路径为程序合成（sfx.js 夜风模式扩展）或 OGA(CC0) 环境音包替换，CREDITS 同步更新。
- **E-音频⑥**：旁白文案后续由文策渊改动 → 样音与新文案不一致 → P1 成批生成时以章节 JSON 为唯一源，构建脚本式重生成（不手改 mp3）。

---

## 8. 实现策略（交程基岩，规格非代码）

### 8.1 新模块 `web/src/music.js`（建议接口签名）

```js
export class MusicSystem {
  constructor(sfx)            // 复用 sfx.actx（同一 AudioContext）；无 actx 时全静默降级
  ensure()                    // 手势后激活；预解码 BGM 四态
  tick(dt, ctx)               // ctx 复用 chapter.js tick 同款 {isNight, playerPos, stats, mobs}
                               // 内部节流 0.5s：敌距检测/定居判定/状态机迁移/交叉淡化推进
  setChapterOverride(state, holdSec)  // playBgm 效果入口（timeline.registerEffect 路由）
  speak(text)                 // 旁白：ducking + HTMLAudio 播放（返回 Promise<结束时刻>，cutscene 逐行同步用）
  setNarrationMode('on'|'subtitle'|'off')
}
```

### 8.2 数据文件（引擎读表，勿硬编码）

- `web/data/audio/bgm.json`：四态 → `{file, volume, fadeIn, fadeOut, loop}` + 状态机参数（敌距 20/定居半径 24/迟滞秒数）。
- `web/data/audio/ambient.json`：三层定义（§4.1）。
- 章节 JSON 扩展效果 `playBgm` / `ambient`（§3.4/§4.1，schema 见 `asset-manifest.md` §3）。

### 8.3 挂接点（main.js，共 4 处，均在现有代码结构上）

1. `ensureAudio()` 内追加 `music.ensure()`；
2. 主循环 `timeline.tick(ctx)` 处（或并列）追加 `music.tick(dt, ctx)`（ctx 补 `mobs: mobManager.mobs`）；
3. `timeline.registerEffect('playBgm'|'ambient', ...)` 两行路由；
4. `cutscene` 逐行推进改「等旁白播毕」：`await music.speak(line)`（无旁白模式回落现有固定间隔）。

### 8.4 存疑标注【需程基岩确认】

- 定居判定的 `blocksPlaced` 半径统计需要 world 的「放置方块坐标」记录（现 stats 只计数不记位置）——若成本高，P0 用「structure anchor 半径 32 格」替代（structure.js 锚点已有）。
- HTMLAudio（旁白）与 WebAudio graph 的 ducking 联动：HTMLAudio 无 GainNode，需经 MediaElementSource 接入总线（同源本地文件无 CORS 问题，零构建下 file:// 协议除外——Electron 发布期无此问题，开发期用本地 http 服务即可）。

---

## 附：本文档自验证记录

- 八节结构齐全（总纲/调色板/BGM 四态/环境音/旁白/混音/预算/实现策略）✅
- 验收对照：四态命名与切换规则含昼夜/敌对/章节对接点（§3）✅；环境音三层+数据驱动挂接（§4）✅；旁白音色/节奏/触发器映射（§5）✅；真实资产落 `web/assets/audio/`（见 asset-manifest.md）✅
- 引用现状源码值均经核对（main.js nightK/isNight、chapter.js tick ctx、mob.js mobs[].pos、cutscene.js isActive）✅
- 环境音 mmx 生成物标「待人工审听」+ 降级路径（E-音频⑤）✅

*阮和鸣 · MC-5c 交付。主旁白音色三选一（§5.1）待主创拍板。*
