# 音频资产清单与接入规范 · MC-5c

> 配套方向文档：`docs/design/audio/audio-direction.md`（四态/分层/旁白/混音规则）。
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
| `amb-distant-war.mp3` | 环境·事件层（战火远响，闷/远） | ≈1.2min / 2.3MB | 同上 | ⚠️ 同上 |
| `narration-chapter-open.mp3` | 旁白样音·章节开场（184 onEnter 三行） | mp3 128kbps ≈21s / 336KB | speech `male-qn-qingse` speed 0.9 | ✅ 样音 |
| `narration-event.mp3` | 旁白样音·事件触发（first-night narration） | ≈12s / 200KB | 同上 | ✅ 样音 |

- 生成命令样例（可复现，重生成以章节 JSON 为唯一文案源）：
  - `mmx music generate --prompt "Ancient Chinese folk ambient, solo guqin ... (见方向文档 §3.1 情绪词)" --instrumental --out web/assets/audio/bgm-explore.mp3`
  - `mmx speech synthesize --text "光和七年，天下大疫。……" --voice male-qn-qingse --speed 0.9 --out web/assets/audio/narration-chapter-open.mp3`
- **总量 ≈34MB**（预算见方向文档 §7.1；P1 可整体 128kbps 重压至 ≈18MB，审美不受影响）。

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
      "ambient": "distant-war"        // 可选：该季背景/事件层覆盖（查 web/data/audio/ambient.json）
    } }
  },
  "events": [
    { "id": "guangzong-falls", "narration": "……",   // 现有字段：触发旁白（方向文档 §5.3）
      "effects": [
        { "type": "playBgm", "state": "event", "hold": 90 },   // 新效果：强制 BGM 态 N 游戏秒
        { "type": "ambient", "layer": "distant-war", "fade": 10 } // 新效果：环境事件层开关（fade=渐变秒）
      ] }
  ]
}
```

- `chapter.js` 现有 normalize 对未知 when.kind 告警跳过、未知 effect 类型运行时告警——新增 `playBgm`/`ambient` 属**新 effect type**，由 main.js `timeline.registerEffect` 注册 handler（引擎扩展，程基岩落地）。
- 建议第一章落地挂接（文案侧由文策渊定案）：`yellow-turban-rises`→`playBgm event hold 120`；`autumn-smoke`→`ambient distant-war`；`guangzong-falls`→`playBgm event hold 90`。

## 4. 引擎接入流程（音频侧只列步骤，实现归程基岩）

1. 新模块 `web/src/music.js`（接口签名见方向文档 §8.1）。
2. 新数据 `web/data/audio/bgm.json` + `ambient.json`（状态机参数与层定义收表，勿硬编码）。
3. main.js 四处挂接（方向文档 §8.3）：ensureAudio→music.ensure；主循环→music.tick；registerEffect 两行；cutscene 逐行等旁白。
4. sfx.js 现有交互音**不动**（P1 迁总线时只改输出连接，不改音色）。
5. 验证：`node --check web/src/*.js`；浏览器手测清单——①首夜 BGM 切换恐惧感 ②破晓回落不抖动 ③cutscene 旁白逐行同步 ④静音降级。

## 5. 审听清单（人工，浏览器 `npx serve web` 或任意静态服务器播放）

| # | 文件 | 审听要点 |
|---|---|---|
| 1 | bgm-explore | 是否古琴主导、无鼓、不甜腻 |
| 2 | bgm-danger | 是否「不解决」、鼓点是否过密（过密则 P1 剪前 60s 循环） |
| 3 | bgm-settle | 是否有火塘暖感、无华丽刮奏 |
| 4 | bgm-chapter-event | 是否收在单音（灰烬感）、是否误入英雄凯旋感 |
| 5 | amb-night | **是否为纯环境**（无旋律乐器混入）——不合格即触发降级路径 |
| 6 | amb-distant-war | 同上，「远/闷」是否成立 |
| 7 | narration-* | 音色是否符合「长卷画外音」（备选音色见方向文档 §5.1） |

---

## 附：自验证记录

- 8 文件存在且均为有效 MP3（ID3 头校验）✅
- 命名符合 §2 规范（样音 `narration-*` 已标注为例外）✅
- schema 与 chapter.js 现有效果路由机制兼容（registerEffect 扩展点核对）✅
- CREDITS.md 已同步登记 ✅
