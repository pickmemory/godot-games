// steam-adapter.js — MC-5e Electron/Steam 桥适配层（渲染进程侧）
//
// 职责边界（模块间只经导出签名通信）：
//   - 实现 save.js 的 ISaveAdapter 契约的 SteamCloudSaveAdapter：所有读写经
//     window.sgsc 桥（tools/electron/preload.js 注入，contextBridge 隔离）转发到
//     Electron 主进程（tools/electron/main.js），由 steamworks.js 落 Steam Cloud；
//     无 Steam 环境时主进程写本地镜像文件（userData/steam-mirror/），此处不感知。
//   - pickSaveAdapter(fallback)：装配工厂——桥存在则用云适配器，否则原样返回 fallback
//     （localStorage）。main.js 只改一行装配即完成 localStorage → Steam Cloud 的
//     同构替换，业务代码（SaveSystem/provider）零改动，浏览器直开行为不变。
//   - platformUnlock(id)：成就解锁入口。浏览器（无桥）为 no-op，返回 null；
//     Electron 侧由 Steam 幂等去重（已解锁的成就重复 activate 不会重复弹提示）。
//
// ISaveAdapter 契约对齐（见 save.js 头注，逐字段同构）：
//   load(): object|null   save(data): {ok,bytes?,error?}   clear(): void
//   available / persistent / label
//
// 决策记录（ADR 摘要）：
//   D1 本模块放在 web/src/ 而非 tools/electron/：它是纯 ES Module、零 npm 依赖
//     （只用 window.sgsc 平坦函数），不违反「npm 依赖隔离在 tools/electron/」红线；
//     放渲染侧使 main.js 的装配点（save.js 头注预留）与 node --check 覆盖最小化。
//   D2 一次性迁移：Electron 壳首次启动若云档为空而本机 localStorage 有 MC-4c 旧档
//     （键 sgsc-save-v1，Electron file:// 下 localStorage 可用），自动搬运上云；
//     失败静默（旧档不动，游戏内仍可从浏览器继续玩）。
//   D3 ipcRenderer.sendSync 同步往返：steamworks.js 的文件读写本身是主进程同步调用，
//     契约要求 load()/save() 同步返回，sendSync 是最小摩擦实现；存档为单 JSON
//     （当前 < 100KB 量级），同步阻塞可忽略。

/** Steam 成就 API 名登记表（与 Steamworks 后台配置一一对应；新增成就只改此处 + 后台） */
export const STEAM_ACHIEVEMENTS = {
  SURVIVE_FIRST_NIGHT: 'ACH_SURVIVE_FIRST_NIGHT', // 活过第一夜（夜→昼翻转且为本档首夜）
};

/** 判断当前运行环境是否为 Electron 壳（preload 在页面脚本前注入，时序有保证） */
export function hasSteamBridge() {
  return typeof window !== 'undefined' && !!(window.sgsc && window.sgsc.isBridge);
}

/** Steam Cloud 存档适配器：ISaveAdapter 同构实现（契约见 save.js 头注） */
export class SteamCloudSaveAdapter {
  /** @param {object} [api] 桥对象，默认 window.sgsc（测试可注入 mock） */
  constructor(api) {
    this.api = api ?? window.sgsc;
    this.persistent = true; // 云 + 本地镜像双写，跨会话持久
    this.available = !!(this.api
      && typeof this.api.loadSave === 'function'
      && typeof this.api.writeSave === 'function');
    try {
      this._env = this.available ? this.api.getEnvironment() : null;
    } catch { this._env = null; }
    if (this.available) this._migrateLegacyOnce();
  }

  /** D2 一次性迁移：云档为空 + 本机有 localStorage 旧档 → 搬运上云（失败静默） */
  _migrateLegacyOnce() {
    try {
      if (this.load() != null) return;
      const raw = localStorage.getItem('sgsc-save-v1');
      if (!raw) return;
      const snap = JSON.parse(raw); // 解析失败即抛 → catch 静默
      const r = this.save(snap);
      if (r.ok) console.log('[steam] 已迁移本机 localStorage 旧档 → Steam Cloud');
    } catch { /* 迁移失败不阻塞开卷：旧档保留在 localStorage */ }
  }

  load() {
    if (!this.available) return null;
    try {
      const r = this.api.loadSave(); // {json: string|null, source: 'cloud'|'mirror'|null}
      if (!r || r.json == null) return null;
      return JSON.parse(r.json);
    } catch (e) {
      console.warn('[steam] 读档失败：', e);
      return null; // 与 LocalStorageSaveAdapter 同语义：坏档当无档，由 validateSnapshot 兜底
    }
  }

  save(data) {
    if (!this.available) return { ok: false, error: 'steam-bridge-unavailable' };
    const json = JSON.stringify(data);
    try {
      const r = this.api.writeSave(json); // {ok, error?}（bytes 由主进程按写入量回报）
      return { ok: !!(r && r.ok), bytes: json.length, error: r?.error };
    } catch (e) {
      return { ok: false, error: String(e) }; // 不静默吞错：SaveSystem 会退避 + HUD 告警
    }
  }

  clear() {
    try { this.api.clearSave(); } catch { /* 忽略：与 LocalStorage 版同语义 */ }
  }

  get label() {
    const mode = this._env?.steam ? 'online' : 'mirror';
    return `steamcloud:sgsc-save-v1(${mode})`;
  }
}

/**
 * 装配工厂（main.js 装配点唯一调用）：桥在 → Steam Cloud，桥不在（浏览器直开）→ fallback。
 * @param {ISaveAdapter} fallback 浏览器实现（LocalStorageSaveAdapter）
 * @returns {ISaveAdapter}
 */
export function pickSaveAdapter(fallback) {
  if (!hasSteamBridge()) return fallback;
  const steam = new SteamCloudSaveAdapter();
  if (!steam.available) {
    console.warn('[steam] 桥存在但不可用，回退 localStorage');
    return fallback;
  }
  console.log(`[steam] 存档适配器切换 → ${steam.label}（localStorage 同构替换）`);
  return steam;
}

/**
 * 平台成就解锁：浏览器 no-op 返回 null；Electron 返回主进程结果 {ok, alreadyUnlocked?}。
 * @param {string} id STEAM_ACHIEVEMENTS 里登记的 API 名
 */
export function platformUnlock(id) {
  if (!hasSteamBridge() || typeof window.sgsc.unlockAchievement !== 'function') {
    return null; // 浏览器：静默 no-op（成就系统只在发布壳内生效）
  }
  try {
    const r = window.sgsc.unlockAchievement(id);
    if (r?.ok && !r.alreadyUnlocked) console.log(`[steam] 成就解锁：${id}`);
    return r ?? null;
  } catch {
    return null; // 成就失败绝不影响玩法主流程
  }
}
