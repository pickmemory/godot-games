# itch.io 发布手册 · 《三国长卷》Demo 试玩包（MC-6 · D-7）

> 归属：路远行（release-ops）· issue #48 · 版本快照：v0.1.0（D-1~D-6 合入后的 main）
> 姊妹文档：商店文案 `itch-copy.md` · 素材规格 `store-assets.md`（#41，Steam）· Steam 清单 `release-checklist.md`（#41）· 合规审计 `compliance-audit.md`（D-6 #47）· 回滚总案 `rollback-plan.md`
> 定位：**外部试玩投放渠道**（Round 1b 复测 + 主创指定的外部玩家）。Steam 仍是正式发布渠道，itch 是 demo 窗口。

## 0. 基线与关键取舍（必读）

| 项 | 决定 | 理由 |
|---|---|---|
| 技术形态 | itch.io **HTML5（浏览器直接游玩）**，zip 上传 | 零构建 Web 基线（AGENTS.md）原样复用；无 Electron/安装步骤，试玩门槛最低 |
| CDN 依赖 | **打包时本地化** three.js（`vendor/three/`，import map 改写） | itch 试玩包必须自包含：玩家断网 / unpkg 抽风 / 企业网络墙 CDN 都会黑屏。代价：zip +1.3MB（three + GLTFLoader），无运行时差异 |
| 改动范围 | `web/` 源目录**零改动**（import map 改写只作用于打包副本） | 开发期「浏览器即开即测 + CDN」基线不受影响；与 `tools/electron/build.mjs` 同一策略 |
| 存档 | 沿用 localStorage（`sgsc-save-v1`），**不做** itch 专改 | iframe 内为浏览器分区存储（见 §4.1）；正式云存档走 Steam Cloud，itch 不建设 |
| 体积 | 40.7 MB / 115 文件（v0.1.0） | 音频 42MB 为大头；远低于 itch 免费档单文件上限（以后台上传页提示为准） |

## 1. 打包

### 1.1 产出物

```bash
node tools/pack-itch.mjs                      # 联网首跑（缓存 three）
node tools/pack-itch.mjs --offline            # 之后离线重跑（用 .vendor-cache）
# 可选旗标：--version=0.1.1（默认读 tools/electron/package.json，两端单源）
#           --keep-art / --keep-orphan-audio（保留默认剔除项）--out=<目录>
```

产物（默认 `tools/dist/itch/`，已加 .gitignore，不入库）：

| 文件 | 用途 |
|---|---|
| `sgsc-itch-v0.1.0.zip` | **上传物**。zip 根即 `index.html`（itch 硬要求），含 `src/ + data/ + assets/ + vendor/three/` |
| `manifest.json` | 构建留档：版本 / 文件表 / 体积 / sha256（发布记录与审计用） |
| `stage/` | 打包中间副本（本地预验用） |

### 1.2 自校验（脚本内置，失败即退出非零）

- zip 回读：条目数一致、`index.html` 在根、含 `src|data|assets|vendor`、**不含** `tools/ .ai/ docs/` 开发产物
- 抽验解压无损（CRC）+ 解压出的 `index.html` **无 `unpkg/jsdelivr/cdn` 残留**
- 端到端（发布前必跑）：`PW_CHROMIUM=<chrome> node tools/verify-itch-zip.mjs` —— 解压 zip → 本地静态服务 → 无头加载 → 断言**零外部请求** + 零 JS 错误 + hotbar 装配 + 画面渲染（v0.1.0 实测 PASS：var=588）

### 1.3 默认剔除项（体积卫生；`--keep-*` 可保留）

| 剔除 | 理由 |
|---|---|
| `web/assets/art/`（4 张美术圣经风格样张，1.3MB） | 文档参考物，运行时不加载（CREDITS 已注明「非运行时贴图」） |
| `audio/narration-chapter-open.mp3` `audio/narration-event.mp3` | MC-5c 样音，D-4 起被逐行旁白取代；运行时清单 `web/data/audio/narrations.json` 不引用（D-6 审计 N1 孤儿文件） |

### 1.4 版本命名

- zip 名：`sgsc-itch-v<semver>.zip`（semver 与 `tools/electron/package.json` **同源**，Steam/itch 两端版本号永不分叉）
- itch 后台每个版本是**新上传文件**，旧文件保留可回退（见 §6）；channel 命名建议在文件说明里写 `demo`（正式版上 Steam 后 itch 停更或转 `legacy`，主创定）
- 发布说明模板：`itch-copy.md` §5（披露口径待批）

## 2. 上传步骤（照做清单）

1. 登录 itch.io → **Create new project**（无账号则先注册——**主创账号决策，见 §8**）。
2. 基本字段：Kind of project = `Game`；标题/URL 按 `itch-copy.md` §1。
3. **Uploads** 页：拖入 `tools/dist/itch/sgsc-itch-v0.1.0.zip` → 勾选 **「This file will be played in the browser」**（HTML5 硬要求，漏勾则只当下载包分发）。
4. **Embed options**（HTML5 游戏专属，以后台实际选项为准）：
   - Viewport：选可用的最大档或自定义 **1280×720 起**（HUD/题签为桌面 16:9 设计；不要勾 Mobile friendly——本作需键鼠+指针锁定）
   - 勾选 **Fullscreen button**（玩家一键全屏，指针锁定体验必需）
   - 建议勾选自动调整尺寸类选项（若有），使画面随窗口撑满
5. 素材页：封面 `docs/release/assets/cover-itch-v1.jpg`（正式版建议林绘澄补书法标题字后替换）+ 截图 5 张（`assets/screenshots/`，图注见 `itch-copy.md` §6）。
6. 正文：粘贴 `itch-copy.md` §3（含 §3.1 技术说明段）。
7. 标签/分类：`itch-copy.md` §4。
8. **先存 Draft** → 用右上 Preview 自测一轮（首屏加载、开卷、挖掘、存档提示）→ 过 §5 门控 → Publish。
9. Publish 后记录：页面 URL + 上传文件版本 + sha256（来自 `manifest.json`）→ 回填本文件 §7 台账。

## 3. 页面配置摘要

| 字段 | 值 | 出处 |
|---|---|---|
| 封面 | `cover-itch-v1.jpg`（1:1 产出；itch 展示区约 630×500，会自动裁切） | D-7 mmx 生成（自研），美术圣经 §2 大地色 |
| 截图 | 5 张 1920×1080 实机（01 开场 / 02 白昼村落 / 03 对话 / 04 合成 / 05 190 焚城氛围） | D-7 `tools/capture-store-shots.mjs` 采集 |
| 文案 | 中文短/长描述 + 已知问题披露 + 鸣谢 | `itch-copy.md` |
| 可见性 | Public / Restricted（密码）/ Draft | **主创决策**（建议先 Restricted 给 Round 1b 复测，再转 Public） |
| 定价 | $0（免费）或「name your own price」 | **主创决策**（demo 建议免费或 0 起自愿付） |

## 4. HTML5 embed 注意事项（itch iframe 环境）

### 4.1 存档（localStorage）
- itch 页内游戏跑在 iframe：现代浏览器（Chrome/Firefox）对第三方帧**分区存储**——存档绑定「该浏览器 + itch 域」，**能跨会话保留**，但换浏览器/设备不跟随、清站点数据即丢。
- Safari 严格隐私模式可能整体禁用 localStorage：游戏已有降级（`save.js` 探针 + HUD 告警「本会话改动不会持久化」），不崩溃、不丢已有行为。
- **页面必须披露**（`itch-copy.md` §3.1 已写），避免「存档没了」差评。

### 4.2 音频
- 浏览器自动播放策略：首次用户手势前不能出声。本作开卷点击即手势，BGM/环境音此后起播（`tools/verify-audio.mjs` 已验证手势链路）。页面无需额外处理，但客服口径：「先点一下画面」。

### 4.3 指针锁定 / 输入
- Pointer Lock 在 itch iframe 内 Chrome/Edge/Firefox 可用；个别环境（老 Safari / 某些嵌入场景）可能拒绝 → 现象为点击画面无反应/ESC 后失焦，重进页面即可。归入已知问题披露，不阻塞。
- 键鼠必需（WASD/鼠标挖放/E 交谈）：页面写明**桌面浏览器**，不承诺移动端。

### 4.4 性能 / 兼容
- Webgl2（回退 WebGL1）+ ES Modules：桌面现代浏览器均满足；无 SharedArrayBuffer/COOP-COEP 需求，无 iframe 限制项。
- 首载 40MB（音频占 9 成）：宽带几十秒内；3G 环境不承诺。若后续要瘦身，优先音频转 mono/低码率（工程项，另立 issue）。

### 4.5 itch app（桌面客户端）
- HTML5 包在 itch app 内同样以浏览器容器运行，支持安装后离线游玩（我们已自包含，无 CDN 依赖——这点比多数 itch HTML5 游戏稳）。

## 5. Go / No-Go 门控（itch 公开投放）

**判定规则：硬门全绿 = GO；任一红 = NO-GO**（Blocker 语义同 `release-checklist.md` §7）。

| # | 门 | 判定依据 | 状态（D-7 交付时） |
|---|---|---|---|
| I1 | zip 自包含可玩：`verify-itch-zip.mjs` PASS（零外部请求 + 零 JS 错 + 画面渲染） | `tools/dist/itch/manifest.json` + 本轮实跑记录 | ✅ GO（v0.1.0 实测 PASS） |
| I2 | 许可红线：D-6 §1 PASS + 本任务新增素材已登记 CREDITS | `compliance-audit.md` §1 + `web/assets/CREDITS.md` | ✅ GO（N1 漏登本任务已补） |
| I3 | 术语/视觉距离零违规 | D-6 §2/§3 | ✅ GO |
| I4 | 商店物料齐备：封面 + ≥3 截图 + 中文文案 | `docs/release/assets/` + `itch-copy.md` | ✅ GO（5 截图） |
| I5 | 已知问题披露口径经主创批（C1/C2/C3 + Major 遗留） | D-6 §5.4-4 | ⏳ **待审批**（建议稿 `itch-copy.md` §5） |
| I6 | itch 账号 / 页面 URL / 可见性 / 定价决策 | 本文件 §8 | ⏳ **待审批** |
| I7 | Draft 预览自测一轮（加载/开卷/挖掘/存档提示/全屏按钮） | 上传者（主创或授权者） | ⏳ 上传后执行 |

> 对齐 D-6 审计结论：**itch 路径无阻塞项**（审计原文「可推进，风险入清单监控」）。Steam 门（G1~G7）与本表无关，勿混用。

## 6. 回滚 / 下架预案（itch 渠道；总案见 `rollback-plan.md`）

| 场景 | 动作 | 备注 |
|---|---|---|
| 新版本翻车（崩溃/坏档） | 后台 Uploads → 对该文件 **Revert**（itch 保留历史文件）或把旧 zip 重新设为当前 | 秒级生效，无需重传；sha256 对 `manifest.json` 核版本 |
| 单一 Blocker 急修 | 修复 → `node --check` + smoke + `pack-itch.mjs` → 新 zip 上传 → 页面公告置顶 | 热修走简化流程，审计不简化（记录构建号/sha256/变更） |
| 存档事故 | itch 无服务端存档，无迁移义务；页面公告引导（存档在浏览器本地）+ 若游戏侧有 schema 变更必须走 `SAVE_VERSION` 门控弃读不删档 | `save.js` 已内建 |
| 页面物料事故（文案/图） | 后台直接改，即时生效 | 不涉构建 |
| 整体下架 | 后台 Edit → **Revert to draft**（立即对外不可见，链接失效）或删除项目 | **高影响动作，须主创审批**；下架前截图留档 + 公告 |
| 舆情/合规 | 与 `rollback-plan.md` §5 商店页事故条款同流程（P2→P1），通报模板沿用其 §6 | — |

值班与责任矩阵沿用 `rollback-plan.md` §7（执行=路远行，审批=游承峰）。

## 7. 试玩包清单（与 #41 `release-checklist.md` 衔接）

> 用法：itch 投放按本表勾选；Steam 首发仍按 #41 全表。**差异项**单列于 §7.2，不重复不冲突。

### 7.1 共用项（itch 侧只需核对对应行）

- [x] A-1 等价：ESM 语法全绿 + smoke PASS（D-6 §4.3 已跑；本任务另加 zip 端到端 I1）
- [x] D-1 等价：CREDITS 双向对账 + N1 补登（本任务完成）
- [ ] F-3 等价：已知问题披露公告（`itch-copy.md` §5，**待批后贴**）
- [ ] F-1 等价：首发公告文案（`itch-copy.md` 即底稿）

### 7.2 itch 渠道差异项（Steam 清单**没有**的）

- [x] zip 根 `index.html` + 「played in the browser」勾选（§2 步骤 3）
- [x] CDN 本地化声明与验证（§0/§1.2）
- [x] iframe 存档行为披露文案（§4.1，已入 `itch-copy.md` §3.1）
- [x] 音频手势说明（§4.2）
- [ ] Embed options 配置核对（viewport ≥1280×720 + 全屏按钮 + 不勾 mobile）
- [ ] Draft 预览自测（§5 I7）
- [ ] 页面 URL + 定价/可见性决策（§5 I6）
- [ ] 发布后台账回填：URL / 文件版本 / sha256 / 日期（下行）
- [ ] Round 1b 复测投放安排（D-6 §5.2-⑦：itch 包即复测载体）

### 7.3 发布台账（Publish 后回填）

| 日期 | 版本 | sha256（前 8 位） | 页面 URL | 操作人 | 备注 |
|---|---|---|---|---|---|
| （待填） | | | | | |

## 8. 待主创审批项（本任务不臆造，列出待决）

1. **itch 账号与页面 URL**：用主创 itch 账号（页面归属=账号归属，后期转让麻烦）；URL slug 定稿（公开后不可改）。
2. **可见性与投放节奏**：建议 Restricted（密码）先给 Round 1b 复测 → 转 Public；或直接 Public。
3. **定价**：$0 / 自愿付（demo 建议）。
4. **已知问题披露口径**：`itch-copy.md` §5 建议稿（对应 D-6 §5.4-4）。
5. **C2 飞行开关**：D-6 §5.2-③ 建议公开前落地「默认禁用 + ?fly」——属工程改动，需主创确认后另派（不阻塞 itch，披露可覆盖）。
6. **正式名终定**：demo-vision §四遗留，itch 页面标题/URL 都吃这个名字。
