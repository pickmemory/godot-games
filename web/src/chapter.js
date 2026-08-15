// chapter.js — MC-3a 章节时间轴引擎（数据驱动编年：章节 JSON → 游戏内时间轴推进 → 事件触发）
//
// 职责边界（模块间只经导出签名通信）：
//   - 本模块只做「时间数学 + 编排」：读章节数据（loadChapter/normalizeChapter）、
//     推进游戏内日历（update(dt, ctx)）、按 date/when 触发事件（每事件仅一次）、维护季节与旗标。
//   - 世界状态迁移（换方块/改天光/调生物）不在本模块执行：main.js 通过 registerEffect(type, fn)
//     注册处理器，事件 effects 里的 {"type": ...} 逐条路由过去 —— 引擎不 import THREE，保持纯净可测。
//
// 章节数据 schema 见 web/data/chapters/README.md；示例见 web/data/chapters/184-yellow-turban.json。

/* ---------- 日历（简化格里历序数；章节编年日期按此记录，史实农历→公历换算由 MC-3c 设计文档充实） ---------- */

const MS_PER_DAY = 86400000;

/** {year, month, day} → 序数日（可为小数日跨章比较）；非法输入回退 day 1 */
export function dateToSerial({ year, month, day } = {}) {
  const y = Number(year), m = Number(month), d = Number(day) || 1;
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null;
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** 序数日 → {year, month, day} */
export function serialToDate(serial) {
  const dt = new Date(serial * MS_PER_DAY);
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

/* ---------- 兜底章节（data/chapters/*.json 缺失/离线时同构兑底，保持游戏可跑） ---------- */

export const FALLBACK_CHAPTER = {
  id: 'fallback-184',
  title: '第一章 · 184 黄巾（兜底）',
  subtitle: '中平元年',
  start: { year: 184, month: 2, day: 1 },
  end: { year: 184, month: 11, day: 30 },
  dayLengthSeconds: 180,
  seasons: defaultSeasons(),
  worldState: { onEnter: [] },
  events: [
    {
      id: 'fallback-open',
      title: '长卷之始',
      date: { year: 184, month: 2, day: 1 },
      narration: '甲子年，天下将乱。（兜底章节数据：data/chapters/184-yellow-turban.json 未加载）',
      effects: [{ type: 'notify', text: '甲子年，天下将乱。' }],
    },
  ],
};

function defaultSeasons() {
  return {
    spring: { label: '春', months: [2, 3, 4], params: {} },
    summer: { label: '夏', months: [5, 6, 7], params: {} },
    autumn: { label: '秋', months: [8, 9, 10], params: {} },
    winter: { label: '冬', months: [11, 12, 1], params: {} },
  };
}

/* ---------- 校验与归一化 ---------- */

/**
 * 归一化章节数据：补默认值、日期→序数、月→季节索引。
 * @returns {{ok: boolean, chapter: object|null, warnings: string[]}}
 */
export function normalizeChapter(raw) {
  const warnings = [];
  if (!raw || typeof raw !== 'object') return { ok: false, chapter: null, warnings: ['章节数据不是对象'] };

  const startSerial = dateToSerial(raw.start) ?? (warnings.push('start 缺失/非法，回退 184-02-01'), dateToSerial(FALLBACK_CHAPTER.start));
  const endSerial = raw.end ? dateToSerial(raw.end) : null;
  if (endSerial !== null && endSerial < startSerial) warnings.push('end 早于 start，忽略 end');

  // 季节表：月份 → {name, label, params}
  const seasons = raw.seasons && typeof raw.seasons === 'object' && Object.keys(raw.seasons).length
    ? raw.seasons : defaultSeasons();
  const monthToSeason = new Array(13).fill(null);
  for (const [name, def] of Object.entries(seasons)) {
    for (const m of def.months ?? []) if (m >= 1 && m <= 12 && !monthToSeason[m]) monthToSeason[m] = name;
  }
  for (let m = 1; m <= 12; m++) if (!monthToSeason[m]) {
    monthToSeason[m] = ['spring', 'summer', 'autumn', 'winter'][(m < 5 ? 0 : m < 8 ? 1 : m < 11 ? 2 : 3)];
    warnings.push(`月份 ${m} 未归入任何季节，默认 ${monthToSeason[m]}`);
  }

  // 事件：date（日期触发）或 when（条件触发），二选一；均缺 → 跳过并告警
  const events = [];
  for (const [i, ev] of (Array.isArray(raw.events) ? raw.events : []).entries()) {
    if (!ev || typeof ev !== 'object') { warnings.push(`events[${i}] 非对象，跳过`); continue; }
    const atSerial = ev.date ? dateToSerial(ev.date) : null;
    if (ev.date && atSerial === null) { warnings.push(`事件 ${ev.id ?? i} 的 date 非法，跳过`); continue; }
    if (!ev.date && !ev.when) { warnings.push(`事件 ${ev.id ?? i} 无 date/when，跳过`); continue; }
    events.push({
      id: String(ev.id ?? `event-${i}`),
      title: String(ev.title ?? ev.id ?? '无名事件'),
      narration: ev.narration ?? '',
      atSerial,
      when: ev.when ?? null,
      effects: Array.isArray(ev.effects) ? ev.effects : [],
      fired: false,
    });
  }
  // 日期事件按时间升序（条件事件保持声明序，靠后）
  events.sort((a, b) => (a.atSerial ?? Infinity) - (b.atSerial ?? Infinity));

  const chapter = {
    id: String(raw.id ?? 'unnamed-chapter'),
    title: String(raw.title ?? '未命名章节'),
    subtitle: raw.subtitle ?? '',
    startSerial,
    endSerial: endSerial !== null && endSerial >= startSerial ? endSerial : null,
    dayLengthSeconds: Number(raw.dayLengthSeconds) > 0 ? Number(raw.dayLengthSeconds) : 180,
    seasons, monthToSeason,
    worldState: {
      onEnter: Array.isArray(raw.worldState?.onEnter) ? raw.worldState.onEnter : [],
      onExit: Array.isArray(raw.worldState?.onExit) ? raw.worldState.onExit : [],   // 章末演出/收束迁移（MC-3d）
    },
    events,
  };
  return { ok: true, chapter, warnings };
}

/** fetch + 归一化；失败返回 {ok:false}，调用方应兑底 FALLBACK_CHAPTER */
export async function loadChapter(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, chapter: null, warnings: [`HTTP ${res.status}`] };
    return normalizeChapter(await res.json());
  } catch (e) {
    return { ok: false, chapter: null, warnings: [String(e)] };
  }
}

/* ---------- 条件求值器（when.kind → 函数；data-driven，可扩充） ---------- */

const CONDITIONS = {
  /** when: {kind:'gameDaysElapsed', days:N} —— 开卷满 N 个游戏日后触发 */
  gameDaysElapsed: (c, tl) => tl.day >= Number(c.days ?? 0),
  /** when: {kind:'isNight'} —— 任意一次入夜即触发 */
  isNight: (_c, _tl, ctx) => !!ctx?.isNight,
  /** when: {kind:'flag', flag:'settled'} —— 旗标被置位（事件效果 setFlag 或外部 setFlag） */
  flag: (c, tl) => tl.flags.has(String(c.flag ?? c.name ?? '')),
  /** when: {kind:'minStat', stat:'blocksPlaced', count:N} —— 玩家统计达标 */
  minStat: (c, _tl, ctx) => (ctx?.stats?.[c.stat] ?? 0) >= Number(c.count ?? Infinity),
};

/* ---------- 时间轴 ---------- */

export class ChapterTimeline {
  /**
   * @param {object} normalizedChapter normalizeChapter 产物（含 startSerial/events/seasons…）
   * @param {object} [opts]
   *   dayLength      现实秒/游戏日（与昼夜系统共用，main.js 传入同一常量）
   *   onEvent(ev)        事件触发（effects 路由完成后回调，用于旁白/UI/console）
   *   onDayChange(date)  游戏日翻页
   *   onSeasonChange(s)  季节切换（{name,label,params}）
   *   onChapterEnd()     越过 end 日期
   */
  constructor(normalizedChapter, opts = {}) {
    this.ch = normalizedChapter;
    this.dayLength = opts.dayLength > 0 ? opts.dayLength : 180;
    this.onEvent = opts.onEvent ?? null;
    this.onDayChange = opts.onDayChange ?? null;
    this.onSeasonChange = opts.onSeasonChange ?? null;
    this.onChapterEnd = opts.onChapterEnd ?? null;

    this.elapsed = 0;          // 自开卷起经过的游戏日（小数）
    this.day = 0;              // 整数日（= 序数日 - startSerial）
    this.finished = false;
    this.flags = new Set();
    this._effectHandlers = new Map();
    this._seasonName = this._seasonOf(this.date.month).name;
    this._entered = false;          // onEnter 延到首次 update：等 main.js 注册完效果处理器
  }

  /* --- 装配 API（main.js 调用） --- */

  /** 注册效果处理器：fn(effect, ctx) —— 世界状态迁移的实现方在 main.js */
  registerEffect(type, fn) { this._effectHandlers.set(type, fn); }

  /** 置/清旗标（条件触发与 MC-3c 剧情记忆用） */
  setFlag(name, has = true) { has ? this.flags.add(String(name)) : this.flags.delete(String(name)); }

  /* --- 每帧推进（main.js 主循环调用；ctx = {isNight, playerPos, stats}） --- */

  update(dt, ctx) {
    if (this.finished) return;
    if (!this._entered) {
      this._entered = true;
      for (const eff of this.ch.worldState.onEnter) this._runEffect(eff, ctx);
    }
    this.elapsed += dt / this.dayLength;

    const newDay = Math.floor(this.elapsed);
    if (newDay !== this.day) {
      this.day = newDay;
      this.onDayChange?.(this.date);
      const s = this._seasonOf(this.date.month);
      if (s.name !== this._seasonName) { this._seasonName = s.name; this.onSeasonChange?.(s); }
    }

    const currentSerial = this.ch.startSerial + this.day;
    for (const ev of this.ch.events) {
      if (ev.fired) continue;
      if (ev.atSerial !== null) {                       // 日期触发：编年时间已到
        if (ev.atSerial <= currentSerial) this._fire(ev, ctx);
      } else {                                          // 条件触发：求值器判定
        const cond = CONDITIONS[ev.when?.kind];
        if (!cond) { ev.fired = true; console.warn(`[chapter] 未知条件 kind: ${ev.when?.kind}（事件 ${ev.id} 已跳过）`); continue; }
        if (cond(ev.when, this, ctx)) this._fire(ev, ctx);
      }
    }

    if (this.ch.endSerial !== null && currentSerial > this.ch.endSerial) {
      this.finished = true;
      for (const eff of this.ch.worldState.onExit) this._runEffect(eff, ctx);   // 章末世界状态迁移（结尾演出等）
      this.onChapterEnd?.();
    }
  }

  /* --- 只读状态 --- */

  /** MC-4c 存档：时间轴状态序列化（与 restore 对偶；Infinity 无，纯 JSON 可存） */
  serialize() {
    return {
      chapterId: this.ch.id,
      elapsed: this.elapsed,
      day: this.day,
      finished: this.finished,
      flags: [...this.flags],
      fired: this.ch.events.filter((e) => e.fired).map((e) => e.id),
      entered: this._entered,
    };
  }

  /**
   * MC-4c 存档：恢复时间轴（跨章/跨档 id 不匹配 → 拒绝并告警，返回 false）。
   * 已触发事件不重放；entered=true 时跳过 worldState.onEnter（开场演出不重播）。
   */
  restore(state) {
    if (!state || typeof state !== 'object') return false;
    if (state.chapterId != null && String(state.chapterId) !== String(this.ch.id)) {
      console.warn(`[chapter] 存档章节「${state.chapterId}」≠ 当前章节「${this.ch.id}」，章节进度不恢复`);
      return false;
    }
    this.elapsed = Math.max(0, Number(state.elapsed) || 0);
    this.day = Math.max(0, Math.floor(Number(state.day) || 0));
    this.finished = !!state.finished && this.ch.endSerial !== null;
    this.flags = new Set(Array.isArray(state.flags) ? state.flags.map(String) : []);
    const fired = new Set(Array.isArray(state.fired) ? state.fired.map(String) : []);
    for (const ev of this.ch.events) if (fired.has(ev.id)) ev.fired = true;
    this._entered = state.entered !== false;   // 缺省视为已入场（存档只在开卷后产生）
    this._seasonName = this._seasonOf(this.date.month).name;
    return true;
  }

  /** 当前游戏日 {year, month, day} */
  get date() { return serialToDate(this.ch.startSerial + this.day); }

  /** 当前季节 {name, label, params} */
  get season() { return this._seasonOf(this.date.month); }

  /** 概览（HUD/调试） */
  get info() {
    const d = this.date;
    return { chapterId: this.ch.id, title: this.ch.title, day: this.day, date: d, season: this.season, finished: this.finished };
  }

  formatDate() {
    const d = this.date;
    return `${d.year}年${d.month}月${d.day}日`;
  }

  /* --- 内部 --- */

  _seasonOf(month) {
    const name = this.ch.monthToSeason[month] ?? 'spring';
    const def = this.ch.seasons[name] ?? {};
    return { name, label: def.label ?? name, params: def.params ?? {} };
  }

  _fire(ev, ctx) {
    ev.fired = true;
    for (const eff of ev.effects) this._runEffect(eff, ctx);
    this.onEvent?.(ev, ctx);
  }

  _runEffect(eff, ctx) {
    if (!eff || typeof eff !== 'object') return;
    const fn = this._effectHandlers.get(eff.type);
    if (fn) fn(eff, ctx);
    else console.warn(`[chapter] 未注册的效果类型: ${eff.type}`);
  }
}
