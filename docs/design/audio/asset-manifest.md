# 音频资产清单与接入规范 · MC-5c → MC-6 D-4

> 配套方向文档：`docs/design/audio/audio-direction.md`（四态/分层/旁白/混音规则）＋
> `docs/design/audio/sound-layer.md`（D-4 运行时接线规格）。
> 本文件：**文件级清单 + 命名规范 + 章节 JSON 扩展 schema + 引擎接入流程**。
> 所有资产均为 **mmx 生成（自研）**，无第三方版权，CREDITS 已同步登记。

---

## 1. 资产清单（已生成，`web/assets/audio/`）

| 文件 | 态/用途 | 规格 | 生成配置 | 状态 |
|---|---|---|---|---|
| `bgm-explore.mp3` | BGM·探索（古琴独奏+远箫，无鼓） | mp3 256kbps ≈3.3min / 6.4MB | music-3.0 instrumental | ✅ 待人工审听 |
| `bgm-danger.mp3` | BGM·危险（低鼓脉冲+琴刮擦，不解决） | ≈2.2min / 4.2MB | 同上 | ✅ 待人工审听 |
| `bgm-settle.mp3` | BGM·定居（筝指弹+柔箫，火塘感） | ≈3.2min / 6.3MB | 同上 | ✅ 待人工审听 |
| `bgm-chapter-event.mp3` | BGM·章节事件（建鼓群+埙角+琴轮拂，收于单音） | ≈3.8min / 7.3MB | 同上 | ✅ 待人工审听 |
| `amb-night.mp3` | 环境·夜背景层（虫鸣+远犬+草风） | ≈3.4min / 6.6MB | 同上（field-recording 提示） | ⚠️ 待人工审听（音乐性风险，见方向文档 E-音频⑤） |
| `amb-day.mp3` | 环境·昼背景层（风+鸟雀+远村，D-4 新增） | ≈38s / 0.6MB | 同上（field-recording 提示；无缝循环） | ⚠️ 待人工审听（同上） |
| `amb-distant-war.mp3` | 环境·事件层（战火远响，闷/远） | ≈1.2min / 2.3MB | 同上 | ⚠️ 同上 |
| `narration-chapter-open.mp3` | 旁白样音·章节开场（184 onEnter 三行） | mp3 128kbps ≈21s / 336KB | speech `male-qn-qingse` speed 0.9 | ✅ 样音（D-4 起被逐行版取代，留档） |
| `narration-event.mp3` | 旁白样音·事件触发（first-night narration） | ≈12s / 200KB | 同上 | ✅ 样音（同上） |
| `nar-<章节id>-{open\|close\|ev-*}.mp3` ×42 | D-4 成批旁白：两章开场/收卷逐行 + 全部 `events[].narration` | 每条 4~18s，共 ≈7.5min / 7.1MB | `tools/gen-narration.mjs`（章节 JSON 为唯一文案源，hash 增量重生成） | ✅ 待人工抽听 |

- 生成命令样例（可复现，重生成以章节 JSON 为唯一文案源）：
  - `mmx music generate --prompt "Ancient Chinese folk ambient, solo guqin ... (见方向文档 §3.1 情绪词)" --instrumental --out web/assets/audio/bgm-explore.mp3`
  - 旁白成批：`node tools/gen-narration.mjs`（内部调 `mmx speech synthesize --voice male-qn-qingse --speed 0.9`；详见 sound-layer.md §6）
- **总量 ≈41MB / 51 文件**（预算见 sound-layer.md §7；四态 BGM 128kbps 重压可回收 ≈12MB，待主创批准）。

## 2. 命名规范（后续资产一律遵守）

```
web/assets/audio/
├── bgm-<state>.mp3            # 四态 BGM，state ∈ explore|danger|settle|chapter-event
├── amb-<scene>.mp3            # 环境音循环：night|distant-war|day-wind|...
├── sfx-<event>.mp3            # P1 采样替换 sfx.js 程序合成时：sfx-chicken|sfx-dog-bark|...
└── nar-<章节id>-<场景>.mp3     # P1 成批旁白：nar-184-yellow-turban-open|-close；
                               # 样音例外：narration-*.mp3（本阶段两支）
```

- 小写 kebab-case；禁止中文文件名；改文案必须重生成文件（不手剪）。

## 3. 章节 JSON 音频扩展 schema（向后兼容，全部可选字段）

```jsonc
// data/chapters/<id>.json
{
  "seasons": {
    "autumn": { "params": { "skyTint": "#c8c0a0", "fogFar": 110,
      "ambient": "distant-war"        // 预留：该季背景/事件层覆盖（P1 接入，查 web/data/audio/ambient.json）
    } }
  },
  "events": [
    { "id": "guangzong-falls", "narration": "……",   // 现有字段：触发旁白（方向文档 §5.3）
      "effects": [
        { "type": "playBgm", "state": "event", "hold": 90 },   // D-4 已落地：强制 BGM 态 N 游戏秒
        { "type": "ambient", "layer": "distant-war", "fade": 10 }, // D-4 已落地：事件层开（fade=渐变秒）
        { "type": "ambient", "layer": "distant-war", "on": false, "fade": 30 } // D-4 扩展：关层
      ] }
  ]
}
```

- `chapter.js` 现有 normalize 对未知 when.kind 告警跳过、未知 effect 类型运行时告警——`playBgm`/`ambient` 已由 main.js `timeline.registerEffect` 注册（D-4 落地，处理器 music.js）。
- 已落地挂接：184 章 `yellow-turban-rises`→playBgm 120 / `autumn-smoke`→ambient distant-war / `guangzong-falls`→playBgm 90；190 章 `guandong-rises`→ambient 15 / `burn-luoyang-1`→playBgm 120+ambient 8 / `burn-luoyang-3`→ambient off 30（后三者为 D-4 音频侧判断，待文策渊复核）。

## 4. 引擎接入流程（D-4 已全部落地，music.js 为运行时实现）

1. ~~新模块 `web/src/music.js`~~ ✅（接口签名 = 方向文档 §8.1）。
2. ~~新数据 `web/data/audio/bgm.json` + `ambient.json` + `narrations.json`~~ ✅。
3. ~~main.js 四处挂接~~ ✅（ensureAudio→music.ensure；主循环→music.tick；registerEffect 两行；cutscene 逐行等旁白；另加 onEvent 旁白与切后台静音）。
4. sfx.js 交互音**音色不动**，仅 `setOutput` 迁入 busSfx 总线 + `windEnabled` 让位采样夜风 ✅。
5. 验证：`node --check web/src/*.js` ✅；`tools/verify-audio.mjs` 12 项自动化 ✅；浏览器手测清单见 sound-layer.md §8。

## 5. 审听清单（人工，浏览器 `npx serve web` 或任意静态服务器播放）

| # | 文件 | 审听要点 |
|---|---|---|
| 1 | bgm-explore | 是否古琴主导、无鼓、不甜腻 |
| 2 | bgm-danger | 是否「不解决」、鼓点是否过密（过密则 P1 剪前 60s 循环） |
| 3 | bgm-settle | 是否有火塘暖感、无华丽刮奏 |
| 4 | bgm-chapter-event | 是否收在单音（灰烬感）、是否误入英雄凯旋感 |
| 5 | amb-night | **是否为纯环境**（无旋律乐器混入）——不合格即触发降级路径 |
| 6 | amb-distant-war | 同上，「远/闷」是否成立 |
| 6b | amb-day | 同 5；另听无缝循环接缝是否突兀（38s 短环） |
| 7 | narration-* / nar-* | 音色是否符合「长卷画外音」（备选音色见方向文档 §5.1）；抽听 3~5 条事件旁白与 cutscene 逐行咬合 |

---

## 附：自验证记录（D-4 增量）

- 51 文件存在且均为有效 MP3（ID3/MPEG 帧头校验）✅
- 命名符合 §2 规范（成批旁白 `nar-<章节id>-{open|close|ev-*}.mp3`；样音 `narration-*` 保留留档）✅
- narrations.json 42 条与章节 JSON 文案逐字一致（脚本生成，hash 锚定）✅
- schema 与 chapter.js 效果路由机制兼容（registerEffect 已注册 playBgm/ambient）✅
- CREDITS.md 已同步登记 ✅
