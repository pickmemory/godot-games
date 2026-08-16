# 声音层实现规格 · MC-6 D-4（运行时接线）

> **任务来源**：issue #45（MC-6 · D-4）· **执行角色**：阮和鸣（audio-director）
> 上游规范：`audio-direction.md`（四态/分层/旁白信条，MC-5c）＋ `asset-manifest.md`（资产清单与命名）。
> 本文：**D-4 落地后的运行时事实**——模块接线、事件清单、总线/音量、数据 schema、边缘情况与验收清单。
> 引擎实现：`web/src/music.js`（新模块）＋ `sfx.js`/`cutscene.js`/`main.js` 增量接线；数据 `web/data/audio/*.json`。

---

## 目录

1. [接线总览](#1-接线总览)
2. [音频事件清单](#2-音频事件清单)
3. [混音总线与音量](#3-混音总线与音量)
4. [数据 schema](#4-数据-schema)
5. [边缘情况与降级](#5-边缘情况与降级)
6. [资产生成与再生成](#6-资产生成与再生成)
7. [性能预算](#7-性能预算)
8. [验收清单](#8-验收清单)

---

## 1. 接线总览

```
main.js（装配根）
├── ensureAudio()  ──→ sfx.ensure() + music.ensure()；成功即 sfx.windEnabled=false
│                      （环境采样层 amb-night 已含草风，程序夜风退位，防双风叠加）
├── 主循环 loop()  ──→ if (started) music.tick(dt, ctx)     ← 演出中也照常推进
│                      ctx = {isNight, playerPos, stats, mobs, cutsceneActive,
│                             season, settlePoints(=已判定房屋门坐标)}
├── timeline.registerEffect('playBgm',  eff → music.setChapterOverride(eff.state, eff.hold))
├── timeline.registerEffect('ambient',  eff → music.ambientLayer(eff.layer, eff.on !== false, eff.fade))
├── timeline.onEvent(ev) ──→ ev.narration 非空 → music.speak(ev.narration)
├── playCutscene(eff) ──→ cutscene.play({..., voice: {speak, stop}})
│                      （逐行等旁白播毕再淡入下一行；无样音回落固定 lineMs）
└── visibilitychange ──→ music.setPageMuted(hidden)（主总线归零 + 流暂停，回前台续播）
```

- `music.js` 不 import THREE / cutscene / chapter——所需上下文全部由 main.js 每帧递入（模块只经导出签名通信）。
- `sfx.js` 新增 `setOutput(node)`（交互音迁入 busSfs 总线，只改连接不改音色）与 `windEnabled` 开关。
- `cutscene.js` 新增可选 `cfg.voice = {speak(line):Promise<boolean>, stop()}`：`speak` 返回是否真发声，
  false 时演出回落固定行间隔（2.8s）；skip 时 `stop()` 立即收声并放行等待门。
- 流式播放全部走 `HTMLAudioElement + MediaElementSource → GainNode`：长文件不整段解码入内存（见 §7），
  交叉淡化全部在 GainNode 上做（禁止硬切，audio-direction §3.3）。

## 2. 音频事件清单

### 2.1 BGM 四态（状态机，优先级 event > danger > settle > explore）

| 事件 | 触发条件 | 进入迟滞 | 退出条件/迟滞 | 淡入/淡出 | 变体 | 备注 |
|---|---|---|---|---|---|---|
| `bgm/explore` | 默认态（以上皆不满足） | — | — | 3s/3s | 1 | 古琴独奏+远箫，无鼓 |
| `bgm/danger` | `isNight`（nightK>0.9 翻沿，main.js 既有全局量）或 任一行尸（非 sinking）水平距离 < 20 格（tick 节流 0.5s） | 2s | 昼 **且** 20 格内无敌连续 8s | **1.5s**/出危险 5s | 1 | 全局硬规则：章节数据不可关闭（§3.5 信条）；夜晚=信息剥夺 |
| `bgm/settle` | 昼 且 距任一已判定房屋门坐标（building.houses）≤32 格；无房屋时 `blocksPlaced ≥ 40` 粗代理（audio-direction §8.4 的 P0 方案） | 2s | 离开定居半径连续 20s（或 danger 抢占） | 3s/3s | 1 | 筝指弹火塘感；夜里定居点也是 danger——恐惧优先 |
| `bgm/event` | `cutscene.isActive`（章节开场/结尾演出、隐含）或章节效果 `playBgm {state:'event', hold:N}` | 无（准点） | cutscene 结束（1.5s 淡出）或 hold 到期；**cutscene 期间 hold 顺延**（E-音频②） | **0.5s**/1.5s | 1 | **不循环**：放完即静默等待回落（历史不驻场）；再触发从头播 |
| 首次起播 | 手势激活/读档后第一次进入任意态 | — | — | 2s 低起 | — | E-音频①④：不序列化音乐状态，重进按当前条件即时定态 |

### 2.2 环境音（三层架构，audio-direction §4）

| 事件 | 层 | 触发 | 衰减/淡化 | 变体 | 备注 |
|---|---|---|---|---|---|
| `amb-day.mp3` | 背景层 | 昼（isNight=false），手势激活后即起 | 昼夜翻转沿 5s 交叉淡化 | 1 | D-4 新生成（风+鸟雀+远村，38s 无缝循环）；冬季增益 ×1.3（seasonGain） |
| `amb-night.mp3` | 背景层 | 夜（isNight=true） | 同上 5s | 1 | 接管原程序合成夜风（sfx.windEnabled=false） |
| `amb-distant-war` | 事件层 | 章节效果 `ambient {layer:'distant-war', fade:N}` | fade 秒淡入；`on:false` + fade 淡出 | 1 | **同时 ≤1 层：新层顶旧层**；战火远响（闷/远） |
| （单次层：鸡鸣/犬吠） | 单次层 | P1 采样接入（破晓窗口/danger 概率 ×3） | — | — | 未落地，见 §6 |

### 2.3 旁白（文案源唯一：`web/data/chapters/*.json`）

| 事件 | 触发 | 音频侧处理 | 淡化/ducking |
|---|---|---|---|
| 章节开场/收卷逐行 | cutscene lines 逐行淡入时 `voice.speak(line)` | 播毕一行再淡入下一行（替代固定 2.8s），播毕后 0.8s 呼吸 | 发声期间 bgm/ambient ×0.3、sfx ×0.7；结束 1s 线性恢复 |
| 编年事件 `events[].narration` | `timeline.onEvent` 与 notify 同帧 | `music.speak(text)`：清单（narrations.json）按**文案精确匹配**；未命中 → 纯字幕 | 同上 |
| `notify` / `epilogue` | — | 不配音（UI 短文案） | — |
| 新句顶旧句 | 任何 speak | 0.25s 收掉上一条（长卷画外音只有一个人） | — |

### 2.4 章节数据挂接现状（效果即数据，代码零章节内容）

| 章节 | 事件 | 效果 | 听觉意图 |
|---|---|---|---|
| 184 | `yellow-turban-rises` | `playBgm event hold 120` | 七州俱起——战鼓碾过（asset-manifest §3 建议落地） |
| 184 | `autumn-smoke` | `ambient distant-war fade 10` | 兵燹连绵，四野的烟 |
| 184 | `guangzong-falls` | `playBgm event hold 90` | 首乱平了——灰烬感收卷 |
| 190 | `guandong-rises` | `ambient distant-war fade 15` | 兵锋未至，远处的战事先到了 |
| 190 | `burn-luoyang-1` | `playBgm event hold 120` + `ambient distant-war fade 8` | 焚洛阳·初火（**D-4 音频判断，待文策渊复核**） |
| 190 | `burn-luoyang-3` | `ambient distant-war on:false fade 30` | 火自己灭了——「世界停了一拍」的留白 |

## 3. 混音总线与音量

```
master(0.9) → destination
├── busBgm(0.35)       ── BGM 四态（轨内 volume 0.75~0.85 再衰减）
├── busAmbient(0.25)   ── 背景层（昼 0.55 / 夜 0.7，冬 ×1.3）+ 事件层（0.6）
├── busSfx(0.60)       ── sfx.js 全部程序合成交互音（setOutput 迁入；手感基准不破）
└── busNarration(0.9)  ── 旁白（最高优先；触发 ducking）
```

- ducking：旁白发声 → bgm×0.3 / ambient×0.3 / sfx×0.7（0.3s 达到），结束 1s 恢复；并发 speak 计数收敛（嵌套不重复 ramp）。
- 主总线不做动态压缩（WebAudio DynamicsCompressor 留 P2；当前实例数下无削波风险，audio-direction §6.1）。
- 切后台：master 0.25s 归零 + 全部 HTMLAudio 暂停（省流）；回前台续播「应正在播」的流。
- 响度基准不动：以 `sfx.pickup` 为手感基准，BGM 永远低于交互音——**世界先于音乐**。

## 4. 数据 schema（`web/data/audio/*.json`，引擎读表勿硬编码）

- **bgm.json**：`bus`（总线响度）／`states`（四态 → file/volume/loop；event `loop:false`）／`machine`
  （enterHysteresis=2、dangerMobRadius=20、dangerExitHysteresis=8、settleRadius=32、settleExitHysteresis=20、
  settleStatBlocks=40）／`fade`（toDanger 1.5 / fromDangerOut 5 / toEvent 0.5 / fromEventOut 1.5 / default 3 / first 2）／
  `duck`（0.3/0.3/0.7，restoreSec 1）。
- **ambient.json**：`bed`（day/night → file/volume；fadeSec 5；seasonGain.winter 1.3）／`layers`
  （distant-war → file/volume/loop；同时 ≤1 层）。
- **narrations.json**：`tools/gen-narration.mjs` 生成（勿手改）：`entries[]{chapter, kind(open|close|event),
  index, id, text, hash(md5 前 8), file}`；music.js 启动时建 `text → file` 精确匹配表。
- **章节效果扩展**（`data/chapters/README.md` effects 表已同步）：
  - `{"type":"playBgm","state":"event","hold":90}` —— 强制 event 态 N 游戏秒（cutscene 期间顺延）。
  - `{"type":"ambient","layer":"distant-war","fade":10}` —— 事件层开；`"on":false` 关层（schema 相对
    asset-manifest §3 的扩展，向后兼容）。
- 模块内兜底：`music.js` 导出 `FALLBACK_BGM_CFG`/`FALLBACK_AMBIENT_CFG`（与 JSON 同构；缺文件/离线时兑底）。

## 5. 边缘情况与降级

| # | 场景 | 行为 |
|---|---|---|
| E-音频① | 手势前触发任何音频路径 | `music.ready=false` 全静默直通；cutscene 字幕照常（首次锁定=开卷前必有 overlay 点击，实际窗口极小） |
| E-音频② | event 态音频放完早于 hold/cutscene 结束 | 保持静默等待（不回落三态判定）；hold 到期但 cutscene 活跃 → 顺延 |
| E-音频③ | 破晓 nightK 0.9 上下抖动 | 8s 退出迟滞；白天行尸残留 20 格内 → danger 持续（威胁以实体为准，正确行为） |
| E-音频④ | 存档恢复 | 不序列化音乐状态；按当前 isNight/位置即时定态，2s 低起淡入 |
| E-音频⑤ | mmx 生成物音乐性偏差 | amb-day 同 amb-night/distant-war 标「待人工审听」；不合格降级程序合成（sfx 夜风模式）或 OGA(CC0) |
| E-音频⑥ | 文案改动未重生成样音 | `text` 精确匹配未命中 → speak 返回 false → 纯字幕；重跑 `tools/gen-narration.mjs` 修复 |
| — | 单条 mp3 加载失败（404/损坏） | 流标记 `ok=false` 永久静默，状态机照常（其余轨不受影响） |
| — | cutscene skip | 旁白立即收声（voice.stop），后续行直通收尾 |
| — | 切后台 | 主总线归零 + 流暂停；回前台续播；期间事件旁白被收掉（字幕日志仍在 console） |
| — | 旁白模式（P1 设置面板） | `setNarrationMode('on'|'subtitle'|'off')` 已实现，默认 on；subtitle/off 即「仅字幕」 |

## 6. 资产生成与再生成

```bash
# 旁白成批（增量：文案 hash 不一致的条目才重生成；--force 全量；--dry 只看计划）
node tools/gen-narration.mjs [--force|--dry]

# 环境音单件（样例：昼背景层；prompt 对齐 audio-direction §4.2 情绪词）
mmx music generate --prompt "Ancient Chinese countryside daytime field recording ambience, ...
  strictly no music, no melody, no instruments" --instrumental --out web/assets/audio/amb-day.mp3
```

- 旁白音色定案沿用 MC-5c 样音：`male-qn-qingse` speed 0.9（备选音色见 audio-direction §5.1，换音色=全量重生成）。
- mmx 不可用 → 脚本退出码 2；降级路径：旁白自动回落纯字幕（零风险），环境音回落程序合成。
- **单次层（鸡鸣/犬吠）P1**：`sfx-chicken.mp3`/`sfx-dog-bark.mp3` 采样接入破晓窗口/danger 概率调度（本阶段未做，交互音继续程序合成）。

## 7. 性能预算

| 项 | 预算 | D-4 现状 |
|---|---|---|
| 同时发声实例 | ≤8 | 2 BGM 交叠 + 2 环境床/层 + 1 旁白 + sfx 短音余量 ✅ |
| 内存 | — | **流式播放（HTMLAudio）不整段解码**：四态 BGM 共 24MB mp3 若按 AudioBuffer 预解码需 ≈460MB PCM——已避开；预解码方案（方向文档 §7.1）按此修订为「流式 + 浏览器自主缓冲」 |
| 音频文件总量 | P0 ≤40MB | **≈41MB**（8 旧文件 34MB + amb-day 0.6MB + 旁白 42 条 7.1MB），超线 1MB：P1 将四态 BGM 128kbps 重压（256→128）可回收 ≈12MB（总量 ≈29MB），审美不受影响——**待主创批准后执行** |
| tick 开销 | — | 状态判定 0.5s 节流；mobs 遍历为 O(n) 距离平方比较（n≤8） |

## 8. 验收清单

自动化（CI 可跑，`tools/verify-audio.mjs`，12 项，D-4 交付时全绿）：

1. 手势前不发声（ready=false）→ 手势后激活、四态流齐全、首态起播；
2. sfx 迁入总线 + 程序夜风退位；主总线 0.9 在线；
3. 旁白清单 42 条加载；真实文案 speak=true / 未知文案=false（回落字幕）；
4. `playBgm`/`ambient`（开/关）效果路由；切后台主总线归零/恢复；旁白模式 off 不发声；零 JS 错误。

浏览器手测（`npx serve web` 或任意静态服务器，需音响/耳机）：

1. **昼→夜**：昼有日间环境层（风+鸟雀）；入夜 1.5s 内 BGM 切 danger（低鼓+呜咽），环境层 5s 交叉到虫鸣夜；
2. **破晓回落**：晨光中 danger 缓出（5s），无抖动切歌；日间靠近自家房（32 格内）2s 后转 settle（筝火塘感）；
3. **事件触发**：`?new` 快进到 184-03-25 后（或直接 `?chapter=190-dong-zhuo&new` 走焚洛阳）：黄巾起事 →
   event BGM 0.5s 准点进入（建鼓+埙角），120 游戏秒后回落；秋烟后远处战火环境层 10s 淡入并常驻；
4. **旁白对齐演出**：开场题签逐行淡入与语音逐句咬合（上一句播毕下一句才出现）；任意键跳过 → 语音即停；
5. **事件旁白 ducking**：事件 narration 触发时 BGM/环境明显压低、交互音保留，语音结束 1s 恢复；
6. **静音降级**：DevTools 里把某 nar 文件名改错（或临时改文案）→ 事件仍出字幕、无报错；
7. **切后台**：标签页切走声音即停，切回续播无爆音。

---

## 附：自验证记录

- `node --check web/src/*.js` 全绿（music.js 新增 + sfx/cutscene/main 增量）✅
- `tools/smoke-web.mjs` SMOKE PASS（零 JS 错误，81 chunks，渲染正常）✅
- `tools/verify-audio.mjs` AUDIO PASS 12/12（见 §8）✅
- 51 个 mp3 全部通过 MPEG 帧头/ID3 校验；narrations.json 42 条与章节 JSON 文案逐字一致（脚本生成）✅
- 资产登记：CREDITS.md、asset-manifest.md 已同步 ✅
- 知识库：`.ai/systems/audio.md` 新建（业务规则锚点），code-facts 已 refresh ✅

*阮和鸣 · D-4 交付。待主创审批项见 roadmap/issue：① 190 章事件音挂接数值；② BGM 128kbps 重压（§7）；③ amb-day 人工审听。*
