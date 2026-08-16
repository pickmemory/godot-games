// encounters.js — MC-6 D-3 奇遇系统：编年之间的随机事件层（数据驱动调度引擎）
//
// 职责边界（模块间只经导出签名通信）：
//   - 纯调度引擎：不 import THREE、不碰 DOM。抽签窗口（入夜/破晓翻转沿）、编年日期门控、
//     一次性 / 事件冷却 / 全局静默期、followUp（数日后延迟效果，即「传闻化」）、watch
//     （玩家接近反应）全部在此；**世界效果的执行不在本模块**——与 chapter.js 同一模式：
//     main.js 通过 registerEffect(type, fn) 注册处理器，事件 fire/followUp/watch 里的
//     {"type": ...} 逐条路由过去。Node 可直接 import 做无头验证（tools/verify-encounters.mjs A 组）。
//   - 数据：web/data/encounters.json（schema 见该文件 _comment 与 docs/design/encounters.md §3）；
//     缺文件/离线 → FALLBACK_ENCOUNTERS 同构兜底（保持可跑）。
//   - 历史不改道（demo-vision §一柱一）：奇遇只提供视角与传闻。引擎层的不变量 =
//     本模块能路由的效果类型与章节时间轴完全同一集合（notify/setFlag/…），
//     不存在任何「改写章节事件」的能力；约束由数据与评审保证。
//
// ctx 契约（main.js 每帧喂入）：
//   { isNight: boolean, serial: number(编年序数日，可为小数), playerPos: {x,y,z},
//     hasFlag(name): boolean, stats: object, nearStructure(typeId, radius): boolean }

import { dateToSerial } from './chapter.js';

/* ---------- 兜底数据（web/data/encounters.json 缺失/离线时同构兑底） ---------- */

export const FALLBACK_ENCOUNTERS = {
  check: { nightChance: 0.35, dayChance: 0.3, globalCooldownDays: 2 },
  events: [
    {
      id: 'fallback-crows',
      title: '鸦群惊起',
      slot: 'day',
      weight: 10,
      cooldownDays: 3,
      gate: {},
      fire: [{ type: 'notify', text: '一声哨响，官道旁的枯树炸起一片鸦，黑压压掠过头顶，往南去了。（兜底奇遇：data/encounters.json 未加载）' }],
    },
  ],
};

/* ---------- 规整 ---------- */

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const strArr = (a) => (Array.isArray(a) ? a.map(String) : []);

/**
 * 规整奇遇数据：补默认值、日期 → 序数日（求值免逐次换算）。
 * @returns {{check:{nightChance,dayChance,globalCooldownDays}, events:object[]}|null}
 */
export function normalizeEncounters(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.events)) return null;
  const events = [];
  for (const [i, ev] of raw.events.entries()) {
    if (!ev || typeof ev !== 'object' || !ev.id) { console.warn(`[encounters] events[${i}] 缺 id，跳过`); continue; }
    const gate = ev.gate && typeof ev.gate === 'object' ? ev.gate : {};
    events.push({
      id: String(ev.id),
      title: String(ev.title ?? ev.id),
      slot: ['night', 'day', 'any'].includes(ev.slot) ? ev.slot : 'any',
      weight: Math.max(0, num(ev.weight, 1)),
      once: !!ev.once,
      cooldownDays: Math.max(0, num(ev.cooldownDays, ev.once ? 0 : 5)),
      gate: {
        fromSerial: gate.from ? dateToSerial(gate.from) : null,
        toSerial: gate.to ? dateToSerial(gate.to) : null,
        requireFlags: strArr(gate.requireFlags),
        forbidFlags: strArr(gate.forbidFlags),
        nearStructure: gate.nearStructure?.type
          ? { type: String(gate.nearStructure.type), radius: Math.max(1, num(gate.nearStructure.radius, 64)) }
          : null,
      },
      fire: Array.isArray(ev.fire) ? ev.fire : [],
      watch: ev.watch && num(ev.watch.radius, 0) > 0 ? {
        radius: num(ev.watch.radius, 7),
        inDays: Math.max(0.01, num(ev.watch.inDays, 0.5)),
        effects: Array.isArray(ev.watch.effects) ? ev.watch.effects : [],
        timeoutEffects: Array.isArray(ev.watch.timeoutEffects) ? ev.watch.timeoutEffects : [],
      } : null,
      followUps: (Array.isArray(ev.followUps) ? ev.followUps : []).map((f) => ({
        inDays: Math.max(0, num(f?.inDays, 0)),
        requireFlags: strArr(f?.requireFlags),
        forbidFlags: strArr(f?.forbidFlags),
        effects: Array.isArray(f?.effects) ? f.effects : [],
      })),
      resetFlags: strArr(ev.resetFlags),
    });
  }
  return {
    check: {
      nightChance: clamp01(num(raw.check?.nightChance, 0.35)),
      dayChance: clamp01(num(raw.check?.dayChance, 0.3)),
      globalCooldownDays: Math.max(0, num(raw.check?.globalCooldownDays, 2)),
    },
    events,
  };
}

/* ---------- 引擎 ---------- */

export class EncounterEngine {
  /**
   * @param {object} raw encounters.json 原始数据（内部 normalize；null → 兜底数据）
   * @param {object} [opts]
   *   onEvent(ev, instance)  事件触发回调（console/诊断用；世界效果走 registerEffect）
   *   rng()                  随机源（默认 Math.random；测试注入确定性序列）
   */
  constructor(raw, opts = {}) {
    this.cfg = normalizeEncounters(raw) ?? normalizeEncounters(FALLBACK_ENCOUNTERS);
    this.onEvent = opts.onEvent ?? null;
    this._rng = opts.rng ?? Math.random;
    this._effectHandlers = new Map();
    this._lastIsNight = null;          // 翻转沿检测（null = 首帧不判）
    this._firedOnce = new Set();       // once 事件已触发册
    this._cooldownUntil = new Map();   // id → 序数日（到期前不再抽中）
    this._globalUntil = -Infinity;     // 全局静默期（任何奇遇之后 globalCooldownDays 日内不再抽签）
    this._active = [];                 // 进行中的实例（还有 followUp/watch 未结）
    this.firedCount = 0;               // 累计触发数（诊断/测试）
  }

  /* --- 装配 API（main.js） --- */
  registerEffect(type, fn) { this._effectHandlers.set(type, fn); }

  /* --- 只读状态 --- */
  get activeCount() { return this._active.length; }
  get firedOnceLog() { return [...this._firedOnce]; }
  get activeIds() { return this._active.map((a) => a.id); }

  /* --- 每帧推进（main.js 主循环；ctx 见文件头契约） --- */
  update(_dt, ctx) {
    if (!ctx || !Number.isFinite(ctx.serial)) return;

    // 1) 入夜/破晓翻转沿 = 抽签窗口（每个游戏日至多 2 次；夜事件只在入夜沿抽、昼事件在破晓沿抽）
    if (this._lastIsNight !== null && !!ctx.isNight !== this._lastIsNight) {
      this._runCheck(ctx.isNight ? 'night' : 'day', ctx);
    }
    this._lastIsNight = !!ctx.isNight;

    // 2) 进行中实例：followUp 到期执行 / watch 接近或超时 / 全结出列
    for (let i = this._active.length - 1; i >= 0; i--) {
      const inst = this._active[i];

      for (const fu of inst.fu) {
        if (fu.done) continue;
        if (ctx.serial < fu.due) continue;
        fu.done = true;   // 到期即结案：gate 过 → 执行；不过 → 丢弃（时过境迁，如换宿未给食物）
        if (this._flagsOk(fu.def, ctx)) for (const eff of fu.def.effects) this._runEffect(eff, ctx, inst);
      }

      const w = inst.def.watch;
      if (w && !inst.watchDone) {
        if (ctx.serial >= inst.at + w.inDays) {
          inst.watchDone = true;
          for (const eff of w.timeoutEffects) this._runEffect(eff, ctx, inst);
        } else if (this._playerNear(inst, w.radius, ctx)) {
          inst.watchDone = true;
          for (const eff of w.effects) this._runEffect(eff, ctx, inst);
        }
      }

      if (!inst.fu.some((f) => !f.done) && (!w || inst.watchDone)) {
        // 收尾：清剧情旗标（防下次同类事件被旧选择污染；value:false 复用 setFlag 处理器）
        for (const flag of inst.def.resetFlags) this._runEffect({ type: 'setFlag', flag, value: false }, ctx, inst);
        this._active.splice(i, 1);
      }
    }
  }

  /* --- MC-4c 存档 --- */

  serialize() {
    return {
      lastIsNight: this._lastIsNight,
      firedOnce: [...this._firedOnce],
      cooldownUntil: [...this._cooldownUntil.entries()],
      globalUntil: Number.isFinite(this._globalUntil) ? this._globalUntil : null,
      firedCount: this.firedCount,
      active: this._active.map((a) => ({
        id: a.id, at: a.at,
        fu: a.fu.map((f) => f.done),
        watchDone: a.watchDone,
        placedBlocks: a.placedBlocks,
      })),
    };
  }

  restore(state) {
    if (!state || typeof state !== 'object') return false;
    this._lastIsNight = state.lastIsNight ?? null;
    this._firedOnce = new Set(Array.isArray(state.firedOnce) ? state.firedOnce.map(String) : []);
    this._cooldownUntil = new Map(
      (Array.isArray(state.cooldownUntil) ? state.cooldownUntil : [])
        .filter(([k, v]) => k != null && Number.isFinite(Number(v)))
        .map(([k, v]) => [String(k), Number(v)]));
    this._globalUntil = Number.isFinite(state.globalUntil) ? Number(state.globalUntil) : -Infinity;
    this.firedCount = Math.max(0, Math.round(Number(state.firedCount) || 0));
    this._active = [];
    for (const a of Array.isArray(state.active) ? state.active : []) {
      const def = this.cfg.events.find((e) => e.id === String(a?.id ?? ''));
      if (!def || !Number.isFinite(Number(a.at))) continue;
      this._active.push({
        def, id: def.id, at: Number(a.at),
        fu: def.followUps.map((f, idx) => ({ def: f, due: Number(a.at) + f.inDays, done: !!a.fu?.[idx] })),
        watchDone: def.watch ? a.watchDone === true : true,
        placedBlocks: (Array.isArray(a.placedBlocks) ? a.placedBlocks : [])
          .filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z)),
      });
    }
    return true;
  }

  /* --- 内部 --- */

  _runCheck(slot, ctx) {
    const c = this.cfg.check;
    if (ctx.serial < this._globalUntil) return;
    const chance = slot === 'night' ? c.nightChance : c.dayChance;
    if (this._rng() >= chance) return;

    const candidates = this.cfg.events.filter((ev) => this._eligible(ev, slot, ctx));
    if (!candidates.length) return;
    this._fire(this._weightedPick(candidates), ctx);
  }

  /** 资格：时段匹配 + 一次性册 + 冷却 + 未在进行中 + gate（日期窗/旗标/近旁结构） */
  _eligible(ev, slot, ctx) {
    if (ev.slot !== 'any' && ev.slot !== slot) return false;
    if (ev.once && this._firedOnce.has(ev.id)) return false;
    const cd = this._cooldownUntil.get(ev.id);
    if (cd != null && ctx.serial < cd) return false;
    if (this._active.some((a) => a.id === ev.id)) return false;
    const g = ev.gate;
    if (g.fromSerial != null && ctx.serial < g.fromSerial) return false;
    if (g.toSerial != null && ctx.serial > g.toSerial) return false;
    if (!this._flagsOk(g, ctx)) return false;
    if (g.nearStructure && !ctx.nearStructure?.(g.nearStructure.type, g.nearStructure.radius)) return false;
    return true;
  }

  _flagsOk(gate, ctx) {
    for (const f of gate.requireFlags) if (!ctx.hasFlag?.(f)) return false;
    for (const f of gate.forbidFlags) if (ctx.hasFlag?.(f)) return false;
    return true;
  }

  _fire(ev, ctx) {
    const inst = {
      def: ev, id: ev.id, at: ctx.serial,
      fu: ev.followUps.map((f) => ({ def: f, due: ctx.serial + f.inDays, done: false })),
      watchDone: !ev.watch,
      placedBlocks: [],   // 效果处理器回填（{x,y,z,expect}；undoBlocks 据此回收，引擎不解方块语义）
    };
    this._active.push(inst);
    if (ev.once) this._firedOnce.add(ev.id);
    if (ev.cooldownDays > 0) this._cooldownUntil.set(ev.id, ctx.serial + ev.cooldownDays);
    this._globalUntil = ctx.serial + this.cfg.check.globalCooldownDays;
    for (const eff of ev.fire) this._runEffect(eff, ctx, inst);
    this.firedCount++;
    this.onEvent?.(ev, inst);
  }

  /** watch 锚 = 实例 placedBlocks 的任一坐标进入玩家 radius（水平 + 竖直合成距离） */
  _playerNear(inst, radius, ctx) {
    const p = ctx.playerPos;
    if (!p || !inst.placedBlocks.length) return false;
    for (const b of inst.placedBlocks) {
      const d = Math.hypot(b.x + 0.5 - p.x, b.y + 0.5 - (p.y + 1), b.z + 0.5 - p.z);
      if (d <= radius) return true;
    }
    return false;
  }

  _weightedPick(list) {
    let total = 0;
    for (const e of list) total += e.weight;
    let r = this._rng() * total;
    for (const e of list) { r -= e.weight; if (r <= 0) return e; }
    return list[list.length - 1];
  }

  _runEffect(eff, ctx, inst) {
    if (!eff || typeof eff !== 'object') return;
    const fn = this._effectHandlers.get(eff.type);
    if (fn) fn(eff, ctx, inst);
    else console.warn(`[encounters] 未注册的效果类型: ${eff.type}`);
  }
}
