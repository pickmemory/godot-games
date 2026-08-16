# 声音层（music.js · sfx.js · cutscene.js 旁白钩）

> 源码：`web/src/music.js`（BGM 四态状态机/环境分层/旁白）、`web/src/sfx.js`（程序合成交互音）、
> `web/src/cutscene.js`（演出逐行旁白同步）。结构见 ../code-facts/module-map.md。
> 设计规范：`docs/design/audio/audio-direction.md`（信条）+ `sound-layer.md`（D-4 运行时规格）。
> 本页只写业务意图与规则。

## 业务规则

- R1: **世界先于音乐**：世界大部分时间没有音乐——BGM 只在状态改变时短促进入（交叉淡化禁止硬切）；
  BGM 总线 0.35 永远低于交互音总线 0.60 —— 锚点 `music.js · _switchState` / `data/audio/bgm.json · bus`
- R2: **BGM 四态**（优先级 event > danger > settle > explore，互斥单实例）：
  event=cutscene 播放中或章节 `playBgm{state:'event',hold:N}` 效果（**不循环**，放完即静默等待回落；
  hold 在 cutscene 期间顺延）；danger=`isNight` 或任一行尸（非 sinking）<20 格（**全局硬规则，章节数据不可关闭——第一夜的恐惧是设计信条**）；
  settle=昼 且距已判定房屋门（building.houses）≤32 格，无房屋时 `blocksPlaced≥40` 粗代理；explore=默认 —— 锚点 `music.js · tick / _settleCond`
- R3: **迟滞防抖**：进入任一态需条件连续成立 2s；danger 退出需昼+无敌连续 8s（防 nightK 0.9 破晓抖动）；
  settle 退出（离家）连续 20s —— 锚点 `music.js · _onT/_offT` + `data/audio/bgm.json · machine`
- R4: **淡化表**：→danger 1.5s（恐惧要快）；danger→任意淡出 5s（余悸）；→event 0.5s（演出准点）；
  event→任意 1.5s；其余 3s/3s；首次起播（手势/读档后）2s 低起 —— 锚点 `data/audio/bgm.json · fade` / `music.js · _switchState`
- R5: **环境三层**：背景层（昼 amb-day / 夜 amb-night，isNight 翻沿 5s 交叉淡化，冬季 ×1.3）；
  事件层（章节 `ambient{layer,fade,on?}` 效果开关，**同时 ≤1 层新层顶旧层**）；单次层（鸡鸣/犬吠，P1 未实现）——
  锚点 `music.js · _updateBed / ambientLayer` + `data/audio/ambient.json`
- R6: **夜风让位**：music.ensure() 成功后 `sfx.windEnabled=false`（amb-night 已含草风，程序合成夜风退位防双风叠加）——
  锚点 `main.js · ensureAudio` / `sfx.js · windEnabled`
- R7: **交互音只迁不改**：sfx.js 全部程序合成音色不动，仅 `setOutput` 把输出从 destination 迁入 busSfx 总线 —— 锚点 `sfx.js · setOutput/_dest`
- R8: **旁白文案源唯一**：`web/data/chapters/*.json`（onEnter/onExit cutscene lines 逐行 + events[].narration）；
  `data/audio/narrations.json` 只做 文案→文件 精确匹配（tools/gen-narration.mjs 生成，hash 增量重生成，勿手改）；
  文案改动未重生成 → speak 返回 false → **自动回落纯字幕**（零风险降级）—— 锚点 `music.js · speak/_narrMap`
- R9: **cutscene 逐行旁白同步**：演出每行淡入后 `await voice.speak(line)`，播毕（+0.8s 呼吸）再淡入下一行；
  未发声回落固定 lineMs=2800；skip 立即收声放行 —— 锚点 `cutscene.js · play`（cfg.voice）
- R10: **ducking**：旁白发声期间 bgm×0.3 / ambient×0.3 / sfx×0.7（0.3s 达到），结束 1s 恢复；新句 0.25s 顶旧句
  （长卷画外音只有一个人）—— 锚点 `music.js · _duck/_stopNarration`
- R11: **手势门**：一切出声在 `ensureAudio()`（用户手势）之后；切后台主总线 0.25s 归零+流暂停，回前台续播 ——
  锚点 `music.js · ensure/setPageMuted` / `main.js · ensureAudio`
- R12: **流式不解码**：BGM/环境/旁白全部 HTMLAudioElement+MediaElementSource（四态 BGM 共 24MB mp3 若预解码
  AudioBuffer 需 ≈460MB PCM，已避开；方向文档 §7.1 的「预解码」方案按此修订）—— 锚点 `music.js · _makeStream`

## 总线结构

```
master(0.9) → destination
├── busBgm(0.35)        四态（轨内 volume 0.75~0.85）
├── busAmbient(0.25)    背景层 + 事件层
├── busSfx(0.60)        sfx.js 程序合成（setOutput 迁入）
└── busNarration(0.9)   旁白（触发 ducking）
```

## 状态机 / 事件流

```
                    ┌──────────────────────────────┐
                    │ event（cutscene/playBgm hold）│ 不循环，放完静默等回落
                    └──────────────────────────────┘
  isNight ∨ 行尸<20格 ──2s──▶ danger ──昼+无敌 8s──▶ ┐
  昼 ∧ (房屋 32 格 ∨ blocksPlaced≥40) ──2s──▶ settle ──离家 20s──▶ explore（默认）
```

## 不变量 / 约束

- danger 不可被章节数据关闭（信条层「先给恐惧」）；夜晚定居点也是 danger。
- 章节数据只经 `playBgm`/`ambient` 两个 effect 追加，不允许反向关闭 danger（引擎无此通路）。
- 音乐状态不序列化（存档恢复按当前条件即时定态，2s 低起）。
- 全部参数读表 `data/audio/*.json`；music.js 内 FALLBACK 同构兑底（缺文件/离线）。

## 现状 vs 规划（严格分开）

- ✅ 已实现（MC-6 D-4 #45）：四态状态机/环境三层/42 条旁白/ducking/切后台静音/verify-audio.mjs 自动化 12 项。
- 未实现（规划）：单次层采样（鸡鸣 sfx-chicken / 犬吠 sfx-dog-bark，破晓窗口/danger 概率 ×3）；
  设置面板旁白三档 UI（`setNarrationMode` API 已就绪）；seasons.params.ambient 季节层覆盖；DynamicsCompressor（P2）；
  BGM 128kbps 重压（总量 41MB 超预算线 1MB，重压回收 ≈12MB，待主创批准）。
