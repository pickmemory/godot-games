// main.js — MC-5e Electron 壳主进程（Steam 打包；npm 依赖隔离在本目录）
//
// 职责：
//   1. BrowserWindow 加载游戏根 web/index.html——开发期直指仓库 web/（浏览器直开不受影响），
//      打包期指 resources/web（build.mjs 预置 + import map 本地化，离线可玩）。
//   2. steamworks.js 接入：初始化（读 steam_appid.txt）、Steam Cloud 存档 IPC、成就激活 IPC。
//      无 Steam 环境（未登录客户端 / 非 Steam 启动 / steam_appid 缺失）→ **优雅降级**：
//      云读写降级为本地镜像文件（userData/steam-mirror/），待 Steam 可用后按「云优先、
//      镜像补位」策略读取；镜像永不清除，等价于云未同步时的本地缓存。
//   3. 所有 IPC 均为同步应答（ipcMain.on + event.returnValue），对齐 preload 契约。
//
// steamworks.js API 面（npm steamworks.js ^0.3，防御式调用，加载失败即降级不崩）：
//   steamworks.init() → SteamworksClient
//   client.remoteStorage.fileExists(name) / fileRead(name):Buffer / fileWrite(name, Buffer):boolean
//   client.remoteStorage.fileDelete(name):boolean
//   client.achievement.activate(apiName):boolean
//   ※ 以上为文档面签名；各方法调用前均做 typeof 校验，版本差异不致崩溃（不臆造：未核实处已注释）。

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

/* ---------- 配置 ---------- */

const SAVE_FILE = 'sgsc-save-v1.json'; // 与 web/src/save.js 槽位键对应（localStorage 旧档键 sgsc-save-v1，渲染侧 steam-adapter.js 迁移）
const MIRROR_DIR = () => path.join(app.getPath('userData'), 'steam-mirror');

/** 解析游戏入口：打包(resources/web) → 环境变量 SGSC_WEB_ROOT → 开发期仓库 web/ */
function resolveIndexHtml() {
  if (process.env.SGSC_WEB_ROOT) {
    return path.join(process.env.SGSC_WEB_ROOT, 'index.html');
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'web', 'index.html');
  }
  return path.join(__dirname, '..', '..', 'web', 'index.html');
}

/* ---------- Steamworks 初始化（优雅降级） ---------- */

let steam = null;      // SteamworksClient | null
let steamError = '';   // 降级原因（env IPC 回传，便于排查）
let steamworksLib = null; // steamworks.js 模块（whenReady 时才 require，失败即降级）

function initSteam() {
  // steam_appid.txt 由 build.mjs 生成（开发期默认 480 Spacewar，发布期换正式 App ID——待主理人配置）
  try {
    steamworksLib = require('steamworks.js');
  } catch (e) {
    steamError = `steamworks.js 加载失败：${e.message}`;
    console.warn('[steamworks]', steamError);
    return;
  }
  try {
    steam = steamworksLib.init();
    console.log('[steamworks] 初始化成功（Steam Cloud / 成就可用）');
  } catch (e) {
    steam = null;
    steamError = `steamworks.init 失败（Steam 客户端未运行或 steam_appid.txt 缺失？）：${e.message}`;
    console.warn('[steamworks]', steamError, '→ 云存档/成就降级为本地镜像');
  }
}

/* ---------- Steam Cloud 读写（云优先、镜像补位） ---------- */

function cloudExists(name) {
  const rs = steam?.client?.remoteStorage;
  return !!(rs && typeof rs.fileExists === 'function' && rs.fileExists(name));
}

function cloudRead(name) {
  const rs = steam?.client?.remoteStorage;
  if (!rs || typeof rs.fileRead !== 'function') return null;
  try {
    const buf = rs.fileRead(name);
    return buf ? buf.toString('utf8') : null; // steamworks.js fileRead 返回 Buffer（空/无文件返回空 Buffer——已按 null 处理）
  } catch (e) {
    console.warn('[steamworks] 云读失败：', e.message);
    return null;
  }
}

function cloudWrite(name, json) {
  const rs = steam?.client?.remoteStorage;
  if (!rs || typeof rs.fileWrite !== 'function') return false;
  try {
    return !!rs.fileWrite(name, Buffer.from(json, 'utf8'));
  } catch (e) {
    console.warn('[steamworks] 云写失败：', e.message);
    return false;
  }
}

function cloudDelete(name) {
  const rs = steam?.client?.remoteStorage;
  if (!rs || typeof rs.fileDelete !== 'function') return false;
  try { return !!rs.fileDelete(name); } catch { return false; }
}

function mirrorPath(name) { return path.join(MIRROR_DIR(), name); }

function mirrorRead(name) {
  try { return fs.readFileSync(mirrorPath(name), 'utf8'); } catch { return null; }
}

function mirrorWrite(name, json) {
  try {
    fs.mkdirSync(MIRROR_DIR(), { recursive: true });
    fs.writeFileSync(mirrorPath(name), json, 'utf8');
    return true;
  } catch (e) {
    console.warn('[steam] 本地镜像写失败：', e.message);
    return false;
  }
}

function mirrorDelete(name) {
  try { fs.rmSync(mirrorPath(name), { force: true }); return true; } catch { return false; }
}

/* ---------- IPC（同步应答，契约见 preload.js 头注） ---------- */

function registerIpc() {
  ipcMain.on('sgsc:env', (e) => {
    e.returnValue = {
      steam: !!steam,
      steamError: steamError || undefined,
      appid: process.env.SGSC_APPID || 'unknown',
      electron: process.versions.electron,
      platform: process.platform,
    };
  });

  ipcMain.on('sgsc:save:load', (e) => {
    // 云优先、镜像补位（云不可用时镜像即本地缓存；Steam 后续在线时 Cloud 自动按平台配置同步同名文件）
    const cloud = steam ? cloudRead(SAVE_FILE) : null;
    if (cloud != null && cloud.length > 0) { e.returnValue = { json: cloud, source: 'cloud' }; return; }
    const mirror = mirrorRead(SAVE_FILE);
    e.returnValue = { json: mirror, source: mirror != null ? 'mirror' : null };
  });

  ipcMain.on('sgsc:save:write', (e, json) => {
    if (typeof json !== 'string') { e.returnValue = { ok: false, error: 'bad-payload' }; return; }
    // 双写：云可用 → 云 + 镜像（云是真相源，镜像是离线兜底）；云不可用 → 仅镜像，等价于暂存待同步
    let ok = false, error;
    if (steam) {
      ok = cloudWrite(SAVE_FILE, json);
      if (!ok) error = 'cloud-write-failed';
    }
    const mirrorOk = mirrorWrite(SAVE_FILE, json);
    if (!ok && mirrorOk) { ok = true; error = 'mirror-only'; } // 降级成功：仍算写成功，但标记来源
    e.returnValue = { ok, error };
  });

  ipcMain.on('sgsc:save:clear', (e) => {
    if (steam) cloudDelete(SAVE_FILE);
    mirrorDelete(SAVE_FILE);
    e.returnValue = { ok: true };
  });

  ipcMain.on('sgsc:ach:unlock', (e, id) => {
    if (typeof id !== 'string' || !/^[A-Z0-9_]{2,64}$/.test(id)) {
      e.returnValue = { ok: false, error: 'bad-achievement-id' };
      return;
    }
    if (!steam) { e.returnValue = { ok: false, error: 'steam-unavailable' }; return; }
    const ach = steam.client?.achievement;
    if (!ach || typeof ach.activate !== 'function') { e.returnValue = { ok: false, error: 'api-missing' }; return; }
    try {
      // Steam 侧幂等：已解锁的成就重复 activate 不会重复弹提示（此处 alreadyUnlocked 为尽力回报）
      const ok = !!ach.activate(id);
      e.returnValue = ok ? { ok: true } : { ok: false, error: 'activate-failed' };
    } catch (err) {
      e.returnValue = { ok: false, error: String(err) };
    }
  });
}

/* ---------- 窗口与生命周期 ---------- */

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 900,
    title: '三国长卷 · Scroll of the Three Kingdoms',
    backgroundColor: '#0b1026',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // 默认值，显式声明：渲染进程无 Node 权限，只经 sgsc 桥
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  const indexHtml = resolveIndexHtml();
  console.log(`[shell] 加载游戏入口：${indexHtml}`);
  win.loadFile(indexHtml).catch((e) => {
    console.error('[shell] 加载失败：', e);
  });
}

app.whenReady().then(() => {
  initSteam();
  registerIpc();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit()); // PC 优先（Windows），无 macOS dock 惯例需求
