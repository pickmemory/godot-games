# 上架合规审计报告 · 《三国长卷》Demo 发布前门控（MC-6 · D-6）

> **任务来源**：issue #47（MC-6 / D-6）· **执行角色**：严守真（quality-lead）
> **审计对象**：main 分支当前 `web/` 全量产物（MC-1~MC-4 + MC-5a/b/c/e + D-1~D-5 已合入后）
> **审计日期**：2026-08-16 · **审计基线提交**：D-5（#46）合入后的工作区
> **四条审计红线**（issue 定义）：① 素材许可合规 ② 术语与文案一致性 ③ 视觉距离 QA ④ 发布门控汇总

## 0. 方法与证据等级（QA 诚信声明）

沿用 round-1 的证据分级：

| 等级 | 含义 | 本轮覆盖 |
|---|---|---|
| **E1 实测** | 无头 Chromium（`/usr/bin/chromium` + playwright-core 1.49）实跑，console/状态/截图为证 | 冒烟 + 五套功能/回归脚本全套重跑（§4.3） |
| **E2 静态可复算** | 文件走查 + 色值/清点逐项比对（命令可复核） | CREDITS 双向对账、术语全仓 grep、色板对账、JSON 全量解析 |
| **E3 需人工复测** | CI 无头环境无法完成的体验项 | 听感审美、指针锁定手感、FPS 观感（沿 round-1 §7 清单，未复测不下结论） |

本轮**未修改任何游戏代码/数据/素材**（临时探针脚本已删）；唯一写入物为本报告 + `.ai/ops/known-issues.md` 追加两条（见 §5.3）。

---

## 1. 素材许可合规（最高优先）

### 1.1 结论

> **判定：PASS（附 1 项 Minor 漏登，零法律风险）** —— 全仓 59 个素材文件全部为程序化自绘或 mmx 生成（自研），**零第三方素材、零 CC-BY-SA、零 GPL**；`web/assets/CREDITS.md` 与实际文件双向对账 57/59，2 个 MC-5c 样音漏登（N1，修复建议见 §1.4）。

### 1.2 红线复查（逐源溯源）

| 来源 | 文件数 | 许可 | 判定 | 证据 |
|---|---|---|---|---|
| 程序化 canvas / BoxGeometry / WebAudio / CSS（`web/src/*.js`、`web/index.html`） | 0 个资产文件（代码内生成） | 自研 | ✅ | CREDITS 前 13 行逐条对应源码文件，均存在（textures/main/mob/drops/sfx/npc/dialog/quests/index.html） |
| mmx 生成（样张 / BGM / 环境音 / 旁白） | 57 | 自研（生成物即自研，AGENTS.md 政策） | ✅ | §1.3 逐文件清单 |
| Kenney.nl | 0 | — | ✅ 未引入 | `find web/assets` 无 textures/kenney-* |
| Quaternius.com | 0 | — | ✅ 未引入 | 无 models/*.glb（npc.js `type:'glb'` 仅预留接口，未启用） |
| OpenGameArt.org | 0 | — | ✅ **零引入，BY-SA/GPL 传染风险=0** | 无任何 OGA 来源文件 |

**CC-BY 署名义务**：当前无 CC-BY 素材 → release-checklist D-2（商店页鸣谢）暂无待办；若后续引入 CC-BY，须同步商店页/游戏内鸣谢（登记表格式已备，CREDITS.md 末尾）。

### 1.3 逐文件对账清单（59 文件 → 登记条目 → 许可 → 判定；可复核）

复核命令：`find web/assets -type f | sort` 对照 `web/assets/CREDITS.md`；大小为实测。

| 文件 | CREDITS 登记条目 | 来源 | 许可 | 引入阶段 | 大小 | 判定 |
|---|---|---|---|---|---|---|
| `audio/amb-day.mp3` | 昼环境音循环 | mmx field-recording 风 | 自研 | MC-6 D-4 | 589 KB | ✅ |
| `audio/amb-distant-war.mp3` | 环境音循环 | mmx field-recording 风 | 自研 | MC-5c | 2268 KB | ✅ |
| `audio/amb-night.mp3` | 环境音循环 | mmx field-recording 风 | 自研 | MC-5c | 6670 KB | ✅ |
| `audio/bgm-chapter-event.mp3` | 四态 BGM | mmx music-3.0 instrumental | 自研 | MC-5c | 7383 KB | ✅ |
| `audio/bgm-danger.mp3` | 四态 BGM | mmx music-3.0 instrumental | 自研 | MC-5c | 4208 KB | ✅ |
| `audio/bgm-explore.mp3` | 四态 BGM | mmx music-3.0 instrumental | 自研 | MC-5c | 6546 KB | ✅ |
| `audio/bgm-settle.mp3` | 四态 BGM | mmx music-3.0 instrumental | 自研 | MC-5c | 6445 KB | ✅ |
| `audio/nar-184-yellow-turban-close-1..4.mp3`（4 文件） | 成批旁白（章节） | mmx speech male-qn-qingse 0.9 | 自研 | MC-6 D-4 | 39~125 KB | ✅ |
| `audio/nar-184-yellow-turban-ev-*.mp3`（10 文件：army-marches-through / autumn-smoke / changshe-victory / first-iron / first-night / first-shelter / guangzong-falls / helped-the-widow / year-end / yellow-turban-rises） | 成批旁白（章节） | 同上 | 自研 | MC-6 D-4 | 102~293 KB | ✅ |
| `audio/nar-184-yellow-turban-open-1..3.mp3`（3 文件） | 成批旁白（章节） | 同上 | 自研 | MC-6 D-4 | 106~201 KB | ✅ |
| `audio/nar-190-dong-zhuo-close-1..4.mp3`（4 文件） | 成批旁白（章节） | 同上 | 自研 | MC-6 D-4 | 41~129 KB | ✅ |
| `audio/nar-190-dong-zhuo-ev-*.mp3`（18 文件：ashes-fall / biansui-defeat / burn-luoyang-1..3 / fireproof-home / first-night-190 / guandong-rises / helped-the-tang / heso-stalemate / left-behind / liangzhou-troops / relocate-decree / ruin-scrapper / small-coins / south-market-days / summer-end / yangcheng-raid） | 成批旁白（章节） | 同上 | 自研 | MC-6 D-4 | 123~286 KB | ✅ |
| `audio/nar-190-dong-zhuo-open-1..3.mp3`（3 文件） | 成批旁白（章节） | 同上 | 自研 | MC-6 D-4 | 129~183 KB | ✅ |
| `audio/nar-opening-1..4.mp3`（4 文件） | 开场序幕旁白 | 同上 | 自研 | MC-6 D-5 | 20~64 KB | ✅ |
| `audio/narration-chapter-open.mp3` | **MISSING（漏登，N1）** | — | — | — | 332 KB | ❌ |
| `audio/narration-event.mp3` | **MISSING（漏登，N1）** | — | — | — | 197 KB | ❌ |
| `art/blocks/rammed-earth-sample.jpg` | 美术圣经风格样张 4 张 | mmx 生成（自研） | 自研 | MC-5a | 308 KB | ✅ |
| `art/blocks/han-tile-sample.jpg` | 美术圣经风格样张 4 张 | mmx 生成（自研） | 自研 | MC-5a | 510 KB | ✅ |
| `art/blocks/yellow-banner-sample.jpg` | 美术圣经风格样张 4 张 | mmx 生成（自研） | 自研 | MC-5a | 188 KB | ✅ |
| `art/ui/title-calligraphy-sample.jpg` | 美术圣经风格样张 4 张 | mmx 生成（自研） | 自研 | MC-5a | 287 KB | ✅ |

清点核对：nar-\* 共 **46** 个（184 章 17 + 190 章 25 + 开场 4），与 CREDITS「×42 + 4 = 46」及运行时旁白清单 `web/data/audio/narrations.json`（verify-audio 实测 `_narrMap.size = 46`）三方一致 ✅。`CREDITS.md` 本身不计入资产。

### 1.4 发现与修复建议

**N1（Minor · 合规纪律，非法律风险）**：`audio/narration-chapter-open.mp3`（332KB）与 `audio/narration-event.mp3`（197KB）为 MC-5c 阶段 mmx 生成的旁白样音（`docs/design/audio/asset-manifest.md` §21-22 行有档：「D-4 起被逐行版取代，留档」），**未在 CREDITS.md 登记**——违反美术圣经 §8.5「CREDITS 与 web/assets 实际内容一一对应（孤儿文件=FAIL）」的对账纪律。因二者为 mmx 自研、无第三方版权，**不构成上架法律风险**。
**修复建议（一行登记，交下个 art/release 任务或主创随手合入）**，在 CREDITS 登记表追加：

```
| audio/narration-chapter-open.mp3 / narration-event.mp3 | mmx 生成（自研）：speech male-qn-qingse speed 0.9 样音 | 自研 | MC-5c 旁白样音（D-4 起被逐行版取代，留档不进运行时清单） |
```

或：若确认不再需要，直接删除两个文件（运行时 `narrations.json` 不引用它们，删除零影响）。已按 issue 要求登记 `.ai/ops/known-issues.md`。

---

## 2. 术语与文案一致性

### 2.1 结论

> **判定：PASS（附 2 项 Minor 提示，无侵权术语）** —— MC 特有词在玩家可见内容中**零命中**；人名/地名/年号在数据与设计文档间一致；抽样的中文文案无错别字。

### 2.2 MC 特有词排雷（demo-vision §四红线）

全仓 grep（`web/`、`docs/`、`team/`、`.ai/`，排除 web/assets 二进制）：`苦力怕|爬行者|附魔|红石|下界|末影|经验球|Creeper|Nether|Redstone|Enchant|Enderman|Minecraft`——

- **玩家可见内容（web/index.html / web/src / web/data）：零命中** ✅（E2）
- 命中项全部为**内部文档**对品类/竞品的正当引用（roadmap、art-bible §1.2「Minecraft 手感基准…DMCA 红线」、转向设计 spec、ADR-0001、demo-vision 自身的红线条款）——不随游戏分发，无风险 ✅
- 游戏用语核对：光源叫「火把/篝火」、农具「锄」、建材「夯土/汉瓦/茅草」、敌对生物「流民行尸」、合成界面「合成」（无「附魔台/工作台 3×3 摆位」语汇）✅

### 2.3 人名 / 地名 / 年号交叉核对（数据 ↔ 设计文档）

| 项 | 设计文档 | 游戏数据 | 判定 |
|---|---|---|---|
| 年号 | 184=中平元年、183=光和七年（mc3-chapter1 §1.1/§5）、190=初平元年（mc5-chapter2） | chapters/184 subtitle「中平元年」、开场「光和七年，天下大疫」、190 subtitle「初平元年」 | ✅ 一致 |
| NPC | 陈叟 elder-chen / 吕嫂 refugee-lu / 传道人 taiping-envoy（mc3-chapter1 §4.1） | npcs.json 同 id 同名，出场区间 2-20/3-10、3-06 一致；陈叟无 disappear（设计 §4.1 建议已采纳） | ✅ 一致 |
| 史实人名 | 皇甫嵩/朱儁/卢植/张角/张梁/张宝/波才/唐周/马元义/董卓 | 数据同拼写（grep 逐一比对，无「皇甫蒿/董桌/洛杨/翼州」类错字） | ✅ 一致 |
| 地名 | 钜鹿（mc3-chapter1 通篇） | dialogs/encounters 均作「钜鹿」 | ✅ 数据-文档一致（钜为巨之异体，历史语境惯用，全仓统一即可） |
| 游戏名 | 《三国长卷 / Scroll of the Three Kingdoms》（demo-vision §四，正式名 D-7 前终定） | index.html `<title>三国长卷 · 长卷之始</title>`、竖排题签「三国长卷」 | ✅（终名清单仍待 D-7，见 §4.4） |
| 章节题签 | 第一章·黄巾 / 第二章·讨董 | chapters json title/subtitle | ✅ |

### 2.4 中文文案抽样（错别字扫描）

- 7 个剧情数据 JSON 全量解析通过（合法 JSON，共 ~41k 字符）；高危错字对（皇甫蒿/董桌/洛杨/翼州/朱隽等）零命中（E2）。
- 抽样朗读级核对：开场字卡 4 行（「青史不载无名之人——而你，是这条长卷里的一个名字」）、184/190 旁白（「三万余黄巾赴河」「推袁绍为盟主」）、对话/奇遇文案——**未发现错别字**；文风与 demo-vision「平民尺度、克制」一致。
- 题签/旁白文字全部 DOM 真字渲染（美术圣经 §5.3 红线），无 mmx 带字贴图进 UI ✅（title-calligraphy-sample.jpg 仅文档样张，且有「AI 书法错字」实测警示在案）。

### 2.5 发现与提示（Minor，不阻塞）

| # | 项 | 证据 | 说明 |
|---|---|---|---|
| N2 | 传道人名牌「黄巾使者」 | `web/data/npc/npcs.json`（name: 黄巾使者）vs mc3-chapter1 §4.1 主称「太平道传道人」 | 他 2-20 入村时黄巾尚未起事（3-25），名牌提前用「黄巾」称谓轻微剧透+与设计主称不一致。建议 name 改「太平道传道人」（或起事日 setDialog/setName 换称）——文案层微调，交文策渊确认 |
| — | round-1 m1/m3 沿袭 | quests.json first-fuel「挖下 10 块木头或泥土」vs objective 任意 blocksMined；dialogs.json:63「三月初五」（农历）vs 事件公历 3-25 | 见 §4.2 遗留表，仍 OPEN |

---

## 3. 视觉距离 QA（对照美术圣经 MC-5a v2 + D-1 color-pass）

### 3.1 结论

> **判定：PASS** —— 程序化像素贴图 + 体素方块属品类惯例不构成侵权（demo-vision §四）；色板/时段色/方块变体贴图逐值与美术圣经一致；UI 无 MC 特有形态（合成为列表式）。无头截图取证通过。

### 3.2 色板对账（textures.js ↔ art-bible §2.1/§4.4 ↔ color-pass §1）

| 角色 | 规范值 | textures.js 实测（行号） | 判定 |
|---|---|---|---|
| 草·生长 / 黄绿带 / 枯黄带 | `#5d9c3f` / `#7fa24a` / `#a8974a` | `BAND_PALETTE.grass`（L14-15） | ✅ |
| 叶·浓 / 黄绿 / 枯黄赭 | `#3e7a2e` / `#5c8a35` / `#8a8438` | `BAND_PALETTE.leaves`（L15） | ✅ |
| 土·熟 / 木·深 / 木·浅 / 石 / 沙 / 铁锈 | `#7a5335` / `#6b4a2b` / `#b08a52` / `#8a8a8a` / `#d9c47f` / `#c99a68` | L56 / L75 / L97 / L120 / L90 / L143 | ✅（表层岩 `#6e7680` 为 color-pass §1.3 登记的夜光调优版，圣经 §2.3 有注） |
| 夯土 | 基 `#b39b6f` + 版筑线 `#9c8358` | L298 / L304 | ✅（§4.4：水平层理、无垂直结构） |
| 汉瓦 | 基 `#5a6360` + 垄脊/谷 + 苔斑 `#7a8a6a` | L313 / L318 | ✅ |
| 茅草 | `#c9b06a` + 束根 `#a58f52` | L325 / L329 | ✅ |
| 焦木 | `#26211c` + 内层 `#3a322a` + 余烬 `#d4622a` | L337 / L343 / L350 | ✅ |
| 灰烬 | `#9a938a` | L356 | ✅ |
| 昼夜四态 | 白昼 `#87ceeb` / 日落 `#e29a68` / 破晓 `#e8c79e` / 深夜 `#0b1026` | main.js L886-889（SKY_* 常量） | ✅ 与 color-pass §3（D-1 调整值）一致，章节 tint 经 seasons/sky 效果走引擎，无绕过 |

### 3.3 UI 形态距离（demo-vision §四「规避 MC 特有 UI 形态」）

- **合成面板 = 列表式**（`#craft .recipe` flex 行：缩略图 + 名称 + 材料行，index.html L56-61）——**不是** MC 的 3×3 摆位合成格 ✅
- hotbar 48px 槽位 + 绢金选中态、血量红心、准星——品类通用形态，配色走绢/墨体系（`#ffd76a`/`#e8d9b0`）✅
- 竖排书法题签（writing-mode: vertical-rl）+ 章节黑屏卡为自有形态 ✅
- 提示（N4，非侵权项）：美术圣经 §5.2 P0「全局字体栈改楷体四级」为**部分落地**——题签/旁白/面板标题已是 KaiTi 栈（index.html L195/223/234），但 body 全局仍 `Microsoft YaHei`（L11）、L4 正文宋体栈未覆盖。**视觉距离无风险**（皆为系统字体），但发布前 Electron 壳内嵌开源楷体（霞鹜文楷 OFL）的决定未落地——引入字体文件时须登记 CREDITS（release-checklist D-4 关联项）。

### 3.4 取证（E1）

`PW_CHROMIUM=/usr/bin/chromium node tools/smoke-web.mjs`（2026-08-16 本轮实跑）：

| 指标 | 值 | 判定 |
|---|---|---|
| 截图 | `tools/smoke-web.png`（1280×720，本轮覆写） | 证据路径 |
| 像素方差 | **586**（阈值 >100） | ✅ 画面非单色、色彩带可见（D-1 验收指标） |
| WebGL / chunks | hasWebGL=true，99 chunks | ✅ |
| JS 错误 | 0（pageerror/console.error） | ✅（round-1 Blocker B1 修复后的干净启动） |
| FPS（软渲染参考值） | 20 fps | 仅环境参考（E3 真机复测沿 round-1 §7-1） |

D-1 交付时的带分布实测（草 45/33/22、叶 57/20/23，seed 1337）见 color-pass §2，本轮不重复。

---

## 4. 发布门控汇总

### 4.1 结论

> **质量门判定：CONCERNS**（对 D-7 itch.io 试玩包路径：可推进，风险入清单监控）。
> **Steam 首发 Go/No-Go（release-checklist §7）：NO-GO**——G2（Critical 决策）未清、G3/G4/G6/G7 未验证/未备料。详见 §4.5。

### 4.2 round-1（MC-5d）遗留问题勾稽（逐项核对当前 main）

| round-1 编号 | 严重度 | 内容 | 当前状态 | 证据（本轮） |
|---|---|---|---|---|
| B1 | Blocker | npc.js:85 未闭合字符串，浏览器无法启动 | **已修复 ✅** | npc.js L85 `color: '#b09455'` 引号完整；全套 ESM 语法检查绿；smoke 实跑零错误启动（§3.4） |
| R1 | P0 流程 | node --check CJS 路径误报，门禁需升级 ESM 解析 + 无头冒烟 | **部分落地 ⚠️** | ESM 检查命令（`cat f \| node --check --input-type=module -`）已在团队口头采用（本轮全绿）；但 `.github` 合并门禁仍是旧 `node --check` 写法（agent-build-prompt.md L31）——见 N5 |
| C1 | Critical | 第一夜锚点：第 1 夜即刷行尸，警告在第 18 游戏日 | **OPEN ❌** | mob.js `_trySpawn` 无 day/旗标门控；first-night 仍 `gameDaysElapsed:18`（300s/日 ≈ 现实 90 分钟处）；**决策仍未拍板**（#40 comment 三选项在案） |
| C2 | Critical | 生存模式 F 飞行无门槛，消解恐惧层 | **OPEN ❌** | main.js L721-722 KeyF 直接切换；L104/L1052 随存档持久化；index.html L285/L350 把「F 飞行」印在正式操作说明 |
| C3 | Critical | 章节现实时长与设计自估差一个数量级 | **OPEN 且数值恶化 ❌** | dayLengthSeconds 180→**300**（两章同；`.ai/systems/day-night-lighting.md` R2 记录系主创 2026-08-16 要求调慢白天）→ 184 全章 334 日×300s ≈ **27.8 小时**；无时间流速分层机制（grep timeScale/fastClock 零命中）。**视觉决策与编年节奏的冲突需合并裁决**（见 §5.2 待审批 ①） |
| M1 | Major | 死亡惩罚近零（不掉行囊） | OPEN | main.js 重生路径注释仍「死亡不掉行囊（最小集决定；掉落留 MC-4）」，MC-4 已过未补 |
| M2 | Major | 无光照系统 / 「生火」无机制承载 | **已修复（主要）✅** | MC-5x 火把/篝火方块 + 点光池（lights.js）；verify-mc5x L1-L3 本轮全 PASS（含挖除灭灯）；洞穴 per-voxel 黑暗仍无（可接受降级） |
| M3 | Major | 煤零用途、铁断头路 | OPEN | items.js L9 注释依旧「燃料用途留给后续熔炉」；recipes 无 COAL 消费 |
| M4 | Major | 9 槽行囊瓶颈 | OPEN | inventory.js 构造默认 9（注释「扩容留 MC-4」未兑现） |
| M5 | Major | 刷怪不查围墙/屋顶 | OPEN | mob.js `_trySpawn`（L265-276）仍仅查地表上两格空气，无可达性判定 |
| m1 | Minor | first-fuel 文案「木头或泥土」vs 任意方块计数 | OPEN | quests.json desc 原文未改 |
| m2 | Minor | 湿耕地 0.5 日 + wetBlockIds 恒空 | OPEN | farming.json L19-21 原值未改 |
| m3 | Minor | 「三月初五」农历 vs 事件公历混用 | OPEN | dialogs.json L63 原文未改 |
| m4 | Minor | canvas willReadFrequently 性能告警 | OPEN | textures.js L484/L536 等仍裸 `getContext('2d')` |
| m5 | Minor | mp3 未接入播放代码 | **已修复 ✅（D-4）** | music.js 已装配进 main.js（L21/L261-266）；verify-audio 11/12 PASS（唯一 FAIL 为环境性，见 N3） |
| m6 | Minor | clearNear 死代码 | OPEN | 全仓 grep 无调用方 |
| m7 | Minor | interval 打满重计语义 | 记录在案 | 无需动作 |

**小结**：Blocker 清零 ✅；Critical 0/3 落地（C1/C2/C3 全部等主创决策，#40 comment 在案）；Major 1/5 修复；Minor 2/7 修复。Round 1b 人工复测（round-1 §7 十条）**仍未组织**——B-5/E3 签收依旧空缺。

### 4.3 本轮全套测试运行记录（E1，2026-08-16，CI runner + /usr/bin/chromium）

| 套件 | 结果 | 备注 |
|---|---|---|
| `for f in web/src/*.js; do cat "$f" \| node --check --input-type=module -; done`（34 文件） | **全绿** | round-1 R1 建议的 ESM 门禁形态 |
| `node tools/smoke-web.mjs` | **SMOKE PASS** | 零 JS 错、方差 586、99 chunks（§3.4） |
| `node tools/repro-e-talk.mjs` | **PASS** | 对话面板在视口内（视觉断言）、两场演出跳过链路正常 |
| `node tools/verify-mc5x.mjs` | **PASS（含 L 组 3/3）** | 本轮未复现 known-issues P1 的慢机 L 组假失败 |
| `node tools/verify-encounters.mjs` | **PASS** | D-3 奇遇 8 事件、9 类效果路由 |
| `node tools/verify-explore.mjs` | **PASS** | D-2 罗盘/已探记忆 |
| `node tools/verify-opening.mjs` | **PASS** | D-5 演出跳过/续玩不重演/无残留 |
| `node tools/verify-audio.mjs` | **11/12 PASS，1 FAIL（环境性，N3）** | 失败项「手势后激活 + BGM 首态起播」：固定 2200ms 墙钟等待 < 慢无头机上 0.5s 游戏时 STEP 节流的实际墙钟耗时。探针实测：+2.2s 时 `state=null, acc=0.4999`（差 0.0001 游戏秒），+5.2s 时 `state='event'` 正确（开场演出隐含 event 态，符合设计）。**非代码回归**，属 known-issues P1/P2 类慢机拉伸；修法见 §5.3-N3 |

### 4.4 release-checklist.md（MC-5e）逐项勾稽

| 区块 | 当前状态 | 依据 |
|---|---|---|
| 0 版本元数据 | 未勾（待发布期回填） | Build ID/AppID 属 Steam 后台流程 |
| A 代码与构建 | A-1 可判绿（本轮 ESM 全绿 + smoke 过）；A-2 冒烟过（浏览器直开两章，190 结构落成 round-1 E1 + 本轮 smoke）；A-3~A-8 未验证（Electron/真机项，CI 无法覆盖） | §4.3 |
| B 内容与 QA | **B-1 ✅ 可勾**（B1 修复 + 本轮复测）；**B-2 ❌ 未清**（C1/C2/C3 无决策记录无豁免）；B-3 部分（两章可开、事件引擎绿；完整通关冒烟未跑）；B-4 未验（中文 UI 无乱码——本轮 DOM 断言间接支持，正式签收待真机）；B-5 未做（Round 1b 未组织） | §4.2/§4.3 |
| C 商店物料 | 全部待产出（store-assets.md §1 多数「待美术」；截图 5 张「可截取」未截） | store-assets.md |
| D 法务合规 | **D-1 本审计已核：PASS 附 N1 一行补登**；D-2 暂无待办（无 CC-BY）；D-3/D-4/D-5 未做 | §1 |
| E 发布工程 | 未开始（E-1~E-5 均待 App ID/证书决策） | — |
| F 社区运营 | 未开始（F-3 应引用本报告 §4.2 遗留清单） | — |

### 4.5 Go/No-Go 门控初判（release-checklist §7，本轮可判项）

| 门 | 判定 | 责任 |
|---|---|---|
| G1 Blocker=0 | **GO**（B1 已修复并复测） | 严守真 |
| G2 Critical 已修复或书面豁免 | **NO-GO**（C1/C2/C3 三项决策悬置） | 游承峰 |
| G3 干净虚机安装 + 两章通关冒烟 | 未验证（NO-GO 直至完成） | 程基岩/严守真 |
| G4 Steam Cloud/成就真机验证 | 未验证 | 路远行 |
| G5 法务清零 | **D-1 已清（本审计）**；D-3 分级问卷未提交 → NO-GO 直至提交 | 游承峰 |
| G6 商店物料齐备或明确降级 | 未齐备、无降级决定 | 林绘澄/游承峰 |
| G7 回滚预案演练 | 未演练 | 路远行 |

---

## 5. 质量门判定与修复清单

### 5.1 判定

> ## **CONCERNS**
>
> **对 D-7（itch.io 试玩包）**：无阻塞项，可推进——试玩包本身即 Round 1b 复测的投放载体；但下列风险必须写入发布说明/监控清单。
> **对 Steam 首发**：NO-GO（G2/G3/G4/G5-D3/G6/G7 未清，见 §4.5）。
> 判定依据（team/README.md 质量门语义）：Blocker=0（G1 GO）、许可红线零违规（§1 PASS）、术语/视觉距离零违规（§2/§3 PASS）；但 3 项 Critical 设计决策悬置 + 若干 Major 未修，属「有风险但非阻塞」——条件是风险显式登记（本节）。

### 5.2 阻塞/风险清单（按优先级）

| # | 级别 | 项 | 建议责任 | 建议动作 |
|---|---|---|---|---|
| ① | **Critical（Steam 阻塞；itch 风险）** | C3×dayLength 冲突：主创把昼夜放慢到 300s（视觉决策，已记录），使编年节奏问题恶化（184 全章 ≈27.8h、第一夜警告在 ~90min） | 游承峰拍板 → 程基岩实施 | 三选一：时间流速分层（编年快钟/夜慢钟）/ dayLength 回调 + 事件重排 / 明确豁免并把 demo 定位为「开放沙盒+事件偶遇」。**建议与 C1 合并裁决**（同一时间模型） |
| ② | **Critical（itch 风险）** | C1 第一夜锚点：第 1 夜（开卷 ~2.5min@300s）即遇行尸、无预警 | 同上 | 刷怪门控 day≥N 或 first-night 事件前置（#40 三选项在案） |
| ③ | **Critical（itch 风险）** | C2 生存模式 F 飞行 + overlay 正式印出：恐惧层可被一键消解 | 程基岩（30min 级修复，待主创确认方案） | 默认禁用 + `?fly` 调试参数 + overlay 改「调试」字样 |
| ④ | Major | M1 死亡零代价 / M3 煤无用途·铁断头 / M4 行囊 9 槽 / M5 刷怪穿墙 | 文策渊数值决策 → 程基岩 | 列入 demo 后第一轮迭代；itch 版发布说明披露 |
| ⑤ | Minor | N1 CREDITS 漏登 2 样音 / N2 黄巾使者名牌 / m1~m4,m6 | 各归属角色 | §1.4/§2.5 给了逐条一行修法 |
| ⑥ | 流程 | N5 合并门禁未升级（round-1 R1 半途）：`.github` 校验仍是旧 `node --check` 写法，同类语法事故会再漏 | 游承峰（.github 属主理人域，QA 不越权改） | loop/prompt 内命令换 ESM 形态 + CI 加一次无头冒烟（本报告 §4.3 命令可直接用） |
| ⑦ | 流程 | Round 1b 人工复测未组织（round-1 §7 十条，B-5 签收空缺） | 严守真 + 主创排期 | itch 包发放即测；FPS/手感/听感为 E3，CI 永远替代不了 |

### 5.3 本轮追加 known-issues（已写入 `.ai/ops/known-issues.md`）

- **N3**：verify-audio.mjs「首态起播」断言在慢无头机必挂（固定 2200ms 墙钟 < 0.5s 游戏时 STEP 的慢机墙钟耗时；且该脚本未进 D-5 双演出跳过同步清单）——修法：`waitForFunction` 轮询（≤8s）。
- **N1**：CREDITS 漏登 2 个 MC-5c 样音（自研无法律风险，违反对账纪律）——修法：补一行或删文件。

### 5.4 待用户审批项（不擅自定）

1. §5.2-①：C3 与 dayLength=300 的合并裁决（含 C1 联动）。
2. §5.2-③：C2 飞行开关方案确认（默认禁用 + ?fly）。
3. §2.5-N2：传道人名牌是否改「太平道传道人」。
4. itch.io 试玩包发布说明中 Critical/Major 遗留项的披露口径（F-3）。

---

## 附：自验证记录

- 本报告结构：标题/元信息 + 四节审计（§1 许可 / §2 术语 / §3 视觉 / §4 门控）+ §5 判定与清单 + 附录 ✅（issue 验收要点「标题/四节/结论」齐备）
- 引用的文件路径全部实测存在（`for p in …; do [ -f ]` 校验通过）✅
- 质量门措辞明确：CONCERNS（itch 路径）/ NO-GO（Steam 门），无模糊表述 ✅
- 本轮未改任何 `web/src/**`、`web/data/**` → 无需跑 `scripts/ai-context/refresh.sh`；改动仅 `docs/release/compliance-audit.md`（本文件）+ `.ai/ops/known-issues.md`（追加 2 条）✅
- 临时探针脚本 `tools/probe-audio-d6.mjs` 已删除，未留实验残留 ✅

*严守真 · MC-6 D-6 交付。审计为 advisory：判定给主创，放行权在用户。*
