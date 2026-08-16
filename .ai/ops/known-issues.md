# 踩坑录（known-issues）

> 按"以后还会踩"的价值排序；新坑追加到顶部。每条：现象 → 根因 → 防再犯。

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
