# tools/electron —— 《三国长卷》Electron 发布壳（MC-5e）

> 角色归属：路远行（release-ops）· issue #41。
> **零构建红线不破坏**：`web/` 源目录零 npm 依赖、浏览器直开照常；所有 npm 依赖（electron / steamworks.js / electron-builder）隔离在本目录。构建只操作 `dist/` 副本，从不改 `web/`。

## 目录

| 文件 | 职责 |
|---|---|
| `main.js` | 主进程：BrowserWindow 加载 `web/index.html`（开发/打包双路径解析）、steamworks 初始化（优雅降级）、Steam Cloud 存档 + 成就 IPC（同步应答） |
| `preload.js` | contextBridge 注入 `window.sgsc` 平坦同步桥（contextIsolation:true，渲染进程无 Node 权限） |
| `build.mjs` | 打包装配脚本（零 npm 依赖）：staging `web/` 副本 → three.js 本地化（CDN→`vendor/`，import map 改写，离线可玩）→ Steam 上传骨架（app_build/depot vdf 模板）+ `steam_appid.txt` |
| `package.json` | npm 依赖隔离 + electron-builder 配置（extraResources 携带 `dist/stage/web` → `resources/web`） |
| `dist/` | 构建产物（gitignore）：`stage/`（装配副本）、`package/`（electron-builder）、`steamupload/`（vdf 骨架） |

## 构建与运行步骤

```bash
# 0) 前置：Node ≥ 18；Windows 打包需 Windows 机器（NSIS）
cd tools/electron

# 1) 安装依赖（只落在本目录 node_modules/）
npm install

# 2) 开发期试跑壳（加载仓库 web/index.html，须本机能访问 unpkg CDN；或先跑步骤 3 再 SGSC_WEB_ROOT=dist/stage/web npm start 离线验证）
npm start

# 3) 装配 + 打 Windows 安装包
npm run dist:win          # = node build.mjs && electron-builder --win --x64
#   离线重放（复用 dist/.vendor-cache）：npm run dist:win:offline
#   产物：dist/package/（NSIS .exe + win-unpacked/）

# 4) Steam 上传
#    a. 拿到正式 App ID 后：node build.mjs --appid=<正式ID> 重新生成 vdf/steam_appid.txt
#    b. 逐项核对 dist/steamupload/*.vdf 占位符（@@BUILD_DESC@@、ContentRoot、depot 布局与 Steamworks 后台一致）
#    c. steamcmd +login <账号> run_app_build /<path>/app_build_<ID>.vdf
```

## 架构与降级

- **存档（ISaveAdapter 同构替换，见 `web/src/save.js` 契约 / `web/src/steam-adapter.js`）**：
  `main.js` 装配点 `pickSaveAdapter(new LocalStorageSaveAdapter(...))` —— 桥在 → `SteamCloudSaveAdapter`（IPC→主进程→steamworks Cloud），浏览器直开 → 原行为。**业务代码（SaveSystem/各 provider）零改动。**
- **云优先、镜像补位**：主进程读档先 Steam Cloud，无云/无 Steam → 本地镜像 `userData/steam-mirror/sgsc-save-v1.json`；写档双写（云可用时）。Steam 客户端未运行/`steam_appid.txt` 缺失 → steamworks.init 抛错被捕获，**只降级不崩溃**（成就返回 `{ok:false,error:'steam-unavailable'}`）。
- **旧档迁移**：Electron 首启若云档空 + 本机 localStorage 有 MC-4c 旧档（`sgsc-save-v1`）→ 一次性搬运上云（失败静默，旧档不动）。
- **成就**：`web/src/steam-adapter.js` `STEAM_ACHIEVEMENTS` 登记 API 名（已接 `ACH_SURVIVE_FIRST_NIGHT`「活过第一夜」，触发点 `main.js` 昼夜翻转处）；Steamworks 后台需按同名 API 配置——**待主理人后台登记**。

## 待主理人/用户审批项（勿臆造）

1. **Steam App ID**：开发默认 480（Spacewar，仅本地测试）；正式 ID 下来后 `--appid` 重跑。
2. **Steamworks 后台配置**：depot 布局（当前提案 AppID 主 depot + AppID+1 备用）、Cloud 配额（建议 ≥1MB/文件、auto-cloud 或按本方案 ISteamRemoteStorage API 模式）、成就 `ACH_SURVIVE_FIRST_NIGHT` 登记。
3. **商店物料**：见 `docs/release/store-assets.md`（多数待美术产出）。

## 回滚预案（摘要，全文见 docs/release/rollback-plan.md）

- 客户端坏构建：Steamworks 后台「previous build」回滚 depot 或设 Beta 分支回收流量；NSIS 安装包允许覆盖安装旧版本。
- 存档兼容：`SAVE_VERSION` 门控（不兼容版本弃读不删档），回滚旧客户端仍能读回旧档。
- 触发条件与分级响应见全文。

## 已知限制

- steamworks.js API 面（fileRead/fileWrite/fileDelete/activate）按文档签名防御式调用，未在真 Steam 环境实测（CI 无 Steam 客户端）——**待发布前在 Steamworks sandbox 实测一轮**（已列入 docs/release/release-checklist.md E-3）。
- macOS/Linux 壳未做（PC/Windows 优先基线）；`app-builder` 产物未签名（代码签名证书待主理人决策）。
