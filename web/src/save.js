// save.js — MC-4c 存档抽象层：ISaveAdapter 契约 + localStorage 实现 + chunk 差分 + 章节进度
//
// 职责边界（模块间只经导出签名通信）：
//   - 本模块只做「存档编排骨架」：适配器契约、差分跟踪/序列化、快照捕获/恢复、自动存档计时。
//     不知道玩家/行囊/章节的具体形状——各状态方由 main.js 以 provider（capture/restore 闭包）注册。
//   - 世界差分是本层核心职责：只记相对地形生成的方块改动（Map<"cx,cz", Map<体素索引, 块id>>），
//     载入时地形按 seed 确定性重建 + 差分重放（world.js pendingDiffs 钩子）。探索不增体积，改动才增。
//
// ISaveAdapter 契约（发布期 Steam Cloud 适配器按此同构替换，业务代码零改动）：
//   load():            object|null   读整档（解析失败/无档返回 null）
//   save(data):        {ok:boolean, bytes?:number, error?:string}   写整档；不可静默吞错
//   clear():           void          清档
//   available:         boolean       存储介质当前是否可用
//   persistent:        boolean       是否跨页面刷新持久（内存 mock 为 false）
//
// 快照 schema（version 门控；不兼容版本直接弃读不删档）：
//   { version, savedAt, seed, world:{chunks:{"cx,cz":[idx,id,idx,id,…]}}, …provider 分节 }
//
// 决策记录（ADR 摘要）：
//   D1 差分在 setBlock 处增量记录（O(1)/次），而非存档时对每个 chunk 重新跑 generateChunk 对拍——
//      避免自动存档时 81+ chunk × 16K 体素的噪声重算造成帧尖刺；代价：绕过 setBlock 的旁路改动会漏记
//      （当前所有写路径——玩家挖放/农耕/门/章节 blockReplace——均走 world.setBlock，见 world.js 钩子）。
//   D2 存档 seed 优先于 URL seed：差分相对「该 seed 的地形生成」，换 seed 重放会得到错误世界。
//   D3 localStorage 溢出/不可用：返回 {ok:false} 并回调 onWarn（HUD+console 提示），旧档保留不清，
//      自动存档退避（间隔 ×4），绝不静默丢档。

import { CHUNK_X, CHUNK_Z, CHUNK_VOL } from './blocks.js';

export const SAVE_VERSION = 1;

/* ---------- 适配器实现 ---------- */

/** 内存适配器：非持久（演示同构替换 / 无头冒烟用）；接口与 localStorage 版完全一致 */
export class MemorySaveAdapter {
  constructor(key = 'memory-save') {
    this.key = key;
    this._store = new Map();
    this.available = true;
    this.persistent = false;
  }

  load() {
    const raw = this._store.get(this.key);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  save(data) {
    const json = JSON.stringify(data);
    this._store.set(this.key, json);
    return { ok: true, bytes: json.length };
  }

  clear() { this._store.delete(this.key); }
  get label() { return `memory:${this.key}`; }
}

/** 开发期默认实现：localStorage 单槽整档 JSON（发布期换 SteamCloudSaveAdapter，装配点在 main.js） */
export class LocalStorageSaveAdapter {
  /** @param {string} key 槽位键名 */
  constructor(key = 'sgsc-save') {
    this.key = key;
    this.persistent = true;
    this.available = (() => {
      try {
        const probe = key + ':probe';
        localStorage.setItem(probe, '1');
        localStorage.removeItem(probe);
        return true;
      } catch { return false; }
    })();
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw == null ? null : JSON.parse(raw);
    } catch (e) {
      console.warn('[save] 读档失败：', e);
      return null;
    }
  }

  save(data) {
    const json = JSON.stringify(data);
    try {
      localStorage.setItem(this.key, json);
      return { ok: true, bytes: json.length };
    } catch (e) {
      // QuotaExceededError / 隐私模式 / 键值被锁 —— 上抛错误名，由 SaveSystem 决定提示与退避
      return { ok: false, error: e?.name ?? String(e) };
    }
  }

  clear() {
    try { localStorage.removeItem(this.key); } catch { /* 忽略：本来就不可用 */ }
  }

  get label() { return `localStorage:${this.key}`; }
}

/* ---------- 差分序列化 ---------- */

/** Map<"cx,cz", Map<idx,id>> → 纯对象 {key:[idx,id,idx,id,…]}（JSON 可存；体素索引 = x + z*16 + y*256，见 terrain.js） */
export function serializeDiffs(diffs) {
  const out = {};
  for (const [key, m] of diffs) {
    const arr = new Array(m.size * 2);
    let i = 0;
    for (const [idx, id] of m) { arr[i++] = idx; arr[i++] = id; }
    out[key] = arr;
  }
  return out;
}

/** 纯对象 → Map<key, Map<idx,id>>；逐项校验（坏索引/坏 id 跳过，不抛） */
export function parseDiffs(raw) {
  const out = new Map();
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, arr] of Object.entries(raw)) {
    if (!Array.isArray(arr)) continue;
    const m = new Map();
    for (let i = 0; i + 1 < arr.length; i += 2) {
      const idx = arr[i], id = arr[i + 1];
      if (!Number.isInteger(idx) || idx < 0 || idx >= CHUNK_VOL) continue;
      if (!Number.isInteger(id) || id < 0 || id > 255) continue;
      m.set(idx, id);
    }
    if (m.size) out.set(key, m);
  }
  return out;
}

/** 快照顶层校验：版本/seed/world 形状不对 → 返回 null（调用方当作无档；旧数据保留不删） */
export function validateSnapshot(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.version !== SAVE_VERSION) {
    console.warn(`[save] 存档版本不兼容（档 v${data.version} / 引擎 v${SAVE_VERSION}），弃读不删`);
    return null;
  }
  if (!Number.isFinite(data.seed)) { console.warn('[save] 存档缺 seed，弃读'); return null; }
  if (data.world != null && (typeof data.world !== 'object' || typeof data.world.chunks !== 'object')) {
    console.warn('[save] 存档 world 分节形状非法，弃读');
    return null;
  }
  return data;
}

/* ---------- 存档编排 ---------- */

export class SaveSystem {
  /**
   * @param {ISaveAdapter} adapter
   * @param {object} [opts]
   *   interval        自动存档间隔（秒，默认 30）
   *   backoffFactor   写失败后的退避倍数（默认 4；成功一次即恢复）
   *   minGap          两次 saveNow 最小间隔（秒，默认 2；防止 hide+unload 双写抖动）
   *   onWarn(msg)     非致命告警回调（配额溢出/介质不可用/单节捕获失败）——main 接 ui.showPickup + console
   */
  constructor(adapter, opts = {}) {
    this.adapter = adapter;
    this.interval = opts.interval > 0 ? opts.interval : 30;
    this.backoffFactor = opts.backoffFactor > 1 ? opts.backoffFactor : 4;
    this.minGap = opts.minGap >= 0 ? opts.minGap : 2;
    this.onWarn = opts.onWarn ?? ((msg) => console.warn('[save]', msg));

    this._providers = new Map();   // id → {capture(), restore?(data)}
    this._world = null;            // attachWorld 后持有（只用 seed/pendingDiffs/onBlockChanged）
    this._diffs = null;            // 与 world.pendingDiffs 同引用：载入重放的旧差分 + 后续新改动共用
    this._autoT = 0;               // 自动存档倒计时
    this._backoff = false;
    this._lastSaveAt = -Infinity;  // performance.now() 毫秒
  }

  /* --- 装配（main.js） --- */

  /**
   * 接入世界（须在 world.warmup / 任何 chunk 生成之前调用）：
   * 把存档差分灌入 world.pendingDiffs（chunk 生成时确定性重放），
   * 并挂 setBlock 增量记录钩子（此后新改动写回同一 Map，旧差分随档延续）。
   */
  attachWorld(world, snapshot) {
    this._world = world;
    world.pendingDiffs = parseDiffs(snapshot?.world?.chunks);
    this._diffs = world.pendingDiffs;
    world.onBlockChanged = (x, y, z, id) => this._record(x, y, z, id);
  }

  /** 注册状态分节：capture() 返回可 JSON 数据；restore(data) 恢复（二者都可只给其一） */
  registerProvider(id, provider) { this._providers.set(String(id), provider); }

  /** 读档 + 校验；无档/不可用/不兼容 → null */
  loadSnapshot() {
    if (!this.adapter.available) return null;
    return validateSnapshot(this.adapter.load());
  }

  /* --- 快照 --- */

  capture() {
    const snap = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      seed: this._world?.seed ?? 0,
      world: { chunks: serializeDiffs(this._diffs ?? new Map()) },
    };
    for (const [id, p] of this._providers) {
      try { snap[id] = p.capture(); }
      catch (e) { this.onWarn(`存档分节 ${id} 捕获失败，本节跳过：${e}`); }
    }
    return snap;
  }

  /** 逐节恢复（单节失败不拖垮整档）；返回恢复成功的分节 id 列表 */
  restoreProviders(snapshot) {
    const restored = [];
    if (!snapshot) return restored;
    for (const [id, p] of this._providers) {
      if (snapshot[id] === undefined || typeof p.restore !== 'function') continue;
      try { p.restore(snapshot[id]); restored.push(id); }
      catch (e) { this.onWarn(`存档分节 ${id} 恢复失败，跳过：${e}`); }
    }
    return restored;
  }

  /* --- 写档 --- */

  /**
   * 立即存档（自动/事件触发共用）。失败：回调告警 + 进入退避；旧档保留。
   * @returns {{ok:boolean, bytes?:number, error?:string, diffCount:number, reason:string}}
   */
  saveNow(reason = 'manual') {
    const now = performance.now();
    if (now - this._lastSaveAt < this.minGap * 1000) {
      return { ok: true, skipped: true, diffCount: this.diffCount, reason };
    }
    this._lastSaveAt = now;
    const snap = this.capture();
    const r = this.adapter.save(snap);
    if (!r.ok) {
      this._backoff = true;
      this.onWarn(`存档写入失败（${r.error ?? '未知错误'}）——本次进度未落盘，游戏内改动仍在；可稍后重试或清理站点数据。适配器：${this.adapter.label}`);
    } else {
      this._backoff = false;
    }
    return { ...r, diffCount: this.diffCount, reason };
  }

  /** 主循环每帧调用：active=false（未开卷/演出中）时倒计时冻结 */
  update(dt, active = true) {
    if (!active) return;
    this._autoT += dt;
    if (this._autoT >= this.interval * (this._backoff ? this.backoffFactor : 1)) {
      this._autoT = 0;
      this.saveNow('auto');
    }
  }

  clear() {
    this.adapter.clear();
    if (this._diffs) this._diffs.clear();
    this._autoT = 0;
    this._backoff = false;
  }

  /** 当前差分条数（HUD/调试：存档体积随此增长，不随探索面积） */
  get diffCount() {
    let n = 0;
    for (const m of this._diffs?.values() ?? []) n += m.size;
    return n;
  }

  /* --- 内部 --- */

  /** setBlock 钩子：世界坐标 → chunk 键 + 体素索引（与 terrain.js 列主序一致），Map 覆盖写 */
  _record(x, y, z, id) {
    const cx = Math.floor(x / CHUNK_X), cz = Math.floor(z / CHUNK_Z);
    const key = cx + ',' + cz;
    let m = this._diffs.get(key);
    if (!m) { m = new Map(); this._diffs.set(key, m); }
    m.set((x - cx * CHUNK_X) + (z - cz * CHUNK_Z) * CHUNK_X + y * (CHUNK_X * CHUNK_Z), id);
  }
}
