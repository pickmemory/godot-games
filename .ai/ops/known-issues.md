# 踩坑录（known-issues）

> 按"以后还会踩"的价值排序；新坑追加到顶部。每条：现象 → 根因 → 防再犯。

## P2 · 测试耦合（D-6 审计新发现）：verify-audio 的"BGM 首态起播"断言在慢无头机必挂

- 现象：`tools/verify-audio.mjs` 检查项「手势后激活 + BGM 首态起播」FAIL（state=null），其余 11 项 PASS。
- 根因：断言用固定 `waitForTimeout(2200)` 墙钟等待，但 music.js 的状态判定节流 `STEP=0.5s` 是**游戏时间**（dt 钳制 0.05 下慢无头机游戏时 ≈ 墙钟×0.2~0.35）。D-6 探针实测：+2.2s 时 `acc=0.4999`（差 0.0001 游戏秒未过阈值），+5.2s 时 `state='event'` 正确（开场演出隐含 event 态，符合 D-5 设计）。另：该脚本未进 D-5 双演出跳过同步清单（known-issues P2 老条的清单漏了它）。
- 防再犯：改 `waitForFunction` 轮询等 `state` 非空（上限 8s）；新增"按游戏时节流"的断言一律轮询，勿用固定墙钟。判定环境性失败先看 acc/游戏时拉伸比。

## P3 · CREDITS 对账（D-6 审计新发现）：MC-5c 旁白样音 2 文件漏登

- 现象：`web/assets/audio/narration-chapter-open.mp3`（332KB）/ `narration-event.mp3`（197KB）在 `web/assets/CREDITS.md` 无登记条目（孤儿文件，违反美术圣经 §8.5 对账纪律）。
- 根因：MC-5c 生成样音留档，D-4 批量逐行版（nar-*×46）登记时漏了旧样音两文件。
- 防再犯：引入/替换音频资产后跑一遍对账（`find web/assets -type f` vs CREDITS 表）；修复一行（见 docs/release/compliance-audit.md §1.4）或删除两文件（运行时 narrations.json 不引用，零影响）。自研 mmx 资产无法律风险，属纪律项。

## P1 · 演出类门控：冻结时间轴时必须仍以 dt=0 刷昼夜视觉层（否则黑天）

- 现象：D-5 开场演出期间整屏近纯色（像素方差 ≈ 2），且相机高空看下去地面也是纯雾色。
- 根因（两叠加）：① 主循环把 `updateDayNight` 与时间轴一起门控——`renderer.setClearColor` 只在 updateDayNight 里调，
  门控期间清屏色停在默认黑；② 高空雾把 highFar 设得比「相机高度+视线斜距」还小（96 < ~113）→ 地面全在雾外，满屏纯雾色。
- 防再犯：任何新演出/暂停层若冻结游戏时钟，视觉刷新用 `updateDayNight(0)`（dt=0 只刷天/雾/灯）；
  调雾时先算相机到主视目标的斜距，fogFar 必须大于它（已固化在 `.ai/systems/opening.md` 公式表）。

## P2 · 收尾清理链必须防御式：dispose 异常会中断后续状态复位（D-5 实踩）

- 现象：跳过开场后 body.opening 类未移除、演出层不隐藏、飞鸟 Points 残留场景，控制台 `Cannot read properties of undefined (reading 'dispose')`。
- 根因：粒子记录漏存 `tex` 字段 → `_teardown` 中途抛异常 → 后面的相机/雾/DOM/body 复位全部没执行；Promise 也不 resolve。
- 防再犯：teardown 顺序「先复位必须成功的状态（相机/雾/DOM/类），再防御式回收 GPU 资源（逐段 try/catch + 可选链）」；
  整个 _finish 包 try/catch 保证 resolve（opening.js 已固化，新演出层照抄）。

## P2 · 测试耦合清单：动这些地方要同步改测试计数/流程

- verify-audio.mjs 断言 `narrCount === 46`：narrations.json 条数随 gen-narration.mjs 扫描源（chapters/*.json + opening.json cards）变——
  加/删旁白文案时同步改这个数字。
- 开卷链路现有两场演出（D-5 开场镜头 → MC-3d 章节黑屏卡）：无头测试要点两次 Space 逐场跳
  （verify-mc5x / repro-e-talk / verify-encounters / verify-explore / probe-dialog 均已同步）。
- 演出时序断言在慢无头环境必须轮询（游戏时间 ≈ 墙钟×0.3）：`waitForFunction` 等条件，勿周定 setTimeout（同下 P1 老案）。

## P2 · mmx：vision 只支持图片，音频资产无自动审听

- 现象：想用 `mmx vision xxx.mp3` 校验生成音频是否"纯环境无旋律"→ 报 Unsupported image format。
- 根因：mmx vision 是图像理解接口，无音频分析能力。
- 防再犯：音频资产核验三步：① 文件头（ID3 或 MPEG 帧同步 0xFFEx）+ 大小/时长估算（128kbps≈16KB/s）；
  ② `tools/verify-audio.mjs` 跑运行时行为；③ 听觉审美走 asset-manifest.md §5 人工审听清单（不合格降级程序合成/OGA CC0）。
  另：shell 里 `od -c | grep ID3` 永远匹配不到（od 会把字节拆开带空格），用 python 读头。

## P1 · 测试环境：verify-mc5x 的 L 组（火把/篝火点光）在慢无头环境必挂（预存在，非代码 bug）

- 现象：`verify-mc5x.mjs` L1/L2/L3 间歇性 FAIL（sources=0 或挖掉后 sources 不降），**纯 HEAD（未改动）也能复现**；D-1 (#42) 时在 CI runner 实测 6/6 挂。
- 根因：`main.js` 主循环 `dt = Math.min(0.05, 真实dt)`（防大步长）；CI 无头软渲染实测仅 ~7fps → 游戏时间 ≈ 墙钟×0.35。测试用固定 `setTimeout(900)` 墙钟等待，而灯源 rescan 周期 0.6s 是**游戏时间**——0.9s 墙钟 ≈ 0.3s 游戏时间 < 0.6s，rescan 必然赶不上。本地 60fps 机器游戏时间=墙钟，永远测不出来。
- 防再犯：CI 上遇到 L 组 FAIL 先看 fps（`#fps` 文本）；判定标准：D 组/冒烟全绿 + L 组挂 ≈ 本坑。修复建议（需 QA/主理人定）：测试改轮询等条件（最多 5s）或把等待提到 2.5s+；勿改 rescan 周期或 dt clamp。宽松轮询验证脚本已证逻辑本身完好（#42 报告）。

## P0 · 流水线：agent-done issue 不关闭会永久阻塞认领队列

- 现象：cron run 每 15min 空转 40s 退出，不认领任何 issue（2026-08-16 连续 3 次）。
- 根因：`.github/agent-build-loop.sh` 认领只排除 `agent-running` 标签，不排除 `agent-done`——已完成的 #27~41 一直 open，**永久挡在队头**。
- 防再犯：issue 完成后必须 close（已清理 #1~41）；若再见"认领到老 issue"，查 agent-done open 列表。

## P1 · CSS：Chrome 遇孤立 `}` 会静默丢弃紧随其后的整条规则

- 现象：按 E 对话状态机全对（diag 日志 E:talk/dialog-open 全命中）但玩家看不见面板。
- 根因：`#death .go` 规则末尾多余 `}` → Chrome 丢弃下一条 `#dialog { position:fixed… }` → 面板退化文档流，渲染在 720px 视口外。已实测验证该解析行为。
- 防再犯：**UI 断言必须含 `getBoundingClientRect` 在视口内 + computedStyle**（repro-e-talk.mjs 已固化视觉断言）；改 CSS 后跑全套测试。

## P1 · WebGL：preserveDrawingBuffer=false 时帧外 readPixels 全零

- 现象：无头冒烟像素方差=0，误判"没渲染"。
- 防再犯：像素校验必须在 rAF 回调内同步回读（tools/smoke-web.mjs 已如此）。

## P2 · 编辑事故：枚举（TILE/BLOCK）条目丢失 → atlas NaN 炸

- 现象：`buildAtlas` 抛 "createRadialGradient non-finite"。
- 根因：TILE 表少了 TORCH/CAMPFIRE 条目 → `PAINTERS[TILE.TORCH]` = `PAINTERS[undefined]` → 对象键变字符串 "undefined" → `Number(key)=NaN` → 坐标计算 NaN。
- 防再犯：动 `blocks.js` 枚举后必跑 `node tools/smoke-web.mjs`；extract.mjs 的 blocks.md 可快速目检枚举完整性。

## P2 · main.js 模块顶层引用后声明的 const → TDZ 崩（仅 ?debug=1 触发）

- 现象：带 `?debug=1` 白屏，不带正常——极难发现。
- 防再犯：`window.__dbg` 调试钩子挂**文件末尾**（所有 const 已初始化）；新增模块引用先想 TDZ。

## P2 · 测试环境：headless 浏览器路径

- 本机：`export PW_CHROMIUM="C:/Users/pickm/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"`，playwright-core 装在项目 node_modules（已 gitignore，新机器 `npm i --no-save playwright-core`）。
- git-bash 传 Windows 路径 env 用 `export VAR="C:/..."`（正斜杠），`VAR=x && cmd` 内联形式会炸。

## P3 · 网络：git push 间歇 Connection reset

- 本机直连 GitHub 抖动（代理工具 127.0.0.1:57890 常停）。重试即可；连续失败开代理工具。

## P3 · 冒烟误报：章节专属 NPC 数据探测 404

- `data/npc/<章节>/npcs.json` 缺失走 fetchFirst 兜底链是**设计行为**，404 不是错。smoke-web.mjs 已过滤 `/data/npc/<章节>/` 的 404 与对应 console 报错。

## P1 · dt 钳制拉长节流：响应层限频被帧尖峰拖慢（无头/慢机测试超时假失败）

- 现象：`verify-mc5x.mjs` L1/L3 稳定失败（放/挖火把后 0.9s 内灯不亮/不灭）、`repro-e-talk.mjs` R2 偶发失败（贴脸 0.4s 内提示未出）——且在 **D-2 改动之前的提交上同样失败**（`git archive` 旧提交对照验证），非回归。
- 根因：主循环 `dt = Math.min(0.05, real)` 防物理爆炸；无头软件渲染 ~20fps 且 setBlock 后 chunk 重网格化帧尖峰 → 游戏时间被拉慢，**累积 dt 的节流**（灯光 0.6s 重扫、交谈提示 0.15s 轮询）在墙钟上远超标称值。
- 防再犯：**响应层节流（灯光发现/UI 提示类）一律墙钟调度**（`performance.now()` / rAF 时间戳，见 `lights.js · _lastScanMs`、`main.js · talkHintT`）；模拟层节流（昼夜/任务/罗盘）维持 dt 语义不变。测试等待窗要按「节流间隔 × 慢机拉伸系数」留余量；判定环境性失败先拿旧提交 `git archive` 对照，勿臆断回归。

## P2 · 无头截图两坑：CI 无 CJK 字体（汉字豆腐块）+ 开卷双演出吃按键

- 现象：D-7 商店截图首跑——03/04 图 UI 汉字全是方框；KeyH/KeyE 全部"没反应"（断言键位卡收起/对话面板全挂）。
- 根因一：CI runner `fc-list` 零 CJK 字体，Chromium 汉字渲染为 tofu。修法：装开源楷体到用户字体目录（`curl -L -o ~/.fonts/LXGWWenKai-Regular.ttf https://github.com/lxgw/LxgwWenKai/releases/download/v1.510/LXGWWenKai-Regular.ttf && fc-cache -f`，OFL 许可，开发机字体不随包分发；正式内嵌方案见 compliance-audit N4）。
- 根因二：开卷链路有**两场**演出（D-5 开场镜头 → MC-3d 章节黑屏卡），均拦截任意键，必须逐场 `Space` 跳过（repro-e-talk.mjs 早已如此，D-7 截图脚本首版漏抄）。
- 附带：商店摆拍要收 HUD——`#fps` 调试条常驻显示（`ui.setStats`），摆拍时 `display:none`；键位卡收起是 `.min` 类（`ui.setKeysMin`）不是 `.hidden`。传送摆拍点要落 `surfaceHeight(x,z,seed)` 地表，悬空或超出已生成区块会截出黑屏（像素方差=0 是铁证）。
- 防再犯：截图/无头 UI 断言统一走 `tools/capture-store-shots.mjs` 的 `skipAllCutscenes` + 视口内可见断言模板；换机器先查 `fc-list | grep -ci cjk`。
