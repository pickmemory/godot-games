// music.js — MC-6 D-4 声音层：BGM 四态状态机 + 环境音分层 + 历史事件旁白
//
// 职责边界（模块间只经导出签名通信；设计规范 docs/design/audio/audio-direction.md，实现规格 sound-layer.md）：
//   - 只管「听」：BGM 四态（explore/danger/settle/event）交叉淡化、环境背景层（昼/夜）与事件层开关、
//     旁白播放与 ducking。全部参数读表 web/data/audio/{bgm,ambient,narrations}.json，代码零数值。
//   - 与 sfx.js 共用 AudioContext（同一手势激活）；sfx 交互音经 setOutput 迁入 busSfx 总线（分层混音）。
//   - 流式播放用 HTMLAudioElement + MediaElementSource（长文件不整段解码入内存，预算见方向文档 §7）；
//     模块不 import THREE，不 import cutscene/chapter —— 状态判定所需上下文由 main.js 每帧递入 tick(ctx)。
//
// 信条（audio-direction.md §1/§3）：世界大部分时间没有音乐——音乐只在状态改变时短促进入；
// danger 为全局硬规则（夜或敌近，章节数据不可关闭）；event 态不循环、不驻场（历史碾过就走了）。

const STEP = 0.5;          // 状态判定节流（秒；audio-direction §8.1）
const AUDIO_DIR = 'assets/audio/';

/* ---------- 兜底数据表（data/audio/*.json 缺失/离线时同构兑底，与 JSON 文件同 schema） ---------- */

export const FALLBACK_BGM_CFG = {
  bus: { master: 0.9, bgm: 0.35, ambient: 0.25, sfx: 0.6, narration: 0.9 },   // §6.1 总线响度
  states: {
    explore: { file: 'bgm-explore.mp3', volume: 0.8, loop: true },
    danger: { file: 'bgm-danger.mp3', volume: 0.8, loop: true },
    settle: { file: 'bgm-settle.mp3', volume: 0.75, loop: true },
    event: { file: 'bgm-chapter-event.mp3', volume: 0.85, loop: false },       // 不循环：历史不驻场
  },
  machine: {
    enterHysteresis: 2,        // 进入迟滞（秒，§3.2 全态共用）
    dangerMobRadius: 20,       // 行尸逼近判定半径（格）
    dangerExitHysteresis: 8,   // 破晓/敌远退出迟滞（秒，防 nightK 抖动 E-音频③）
    settleRadius: 32,          // 定居点半径（格；settlePoints=房屋门坐标）
    settleExitHysteresis: 20,  // 离家退出迟滞（秒）
    settleStatBlocks: 40,      // 无房屋时的 blocksPlaced 粗代理阈值
  },
  fade: { toDanger: 1.5, fromDangerOut: 5, toEvent: 0.5, fromEventOut: 1.5, default: 3, first: 2 },   // §3.3
  duck: { bgm: 0.3, ambient: 0.3, sfx: 0.7, restoreSec: 1 },                                          // §5.4
};

export const FALLBACK_AMBIENT_CFG = {
  bed: {
    day: { file: 'amb-day.mp3', volume: 0.55 },        // 昼背景层（风+鸟雀+远村）
    night: { file: 'amb-night.mp3', volume: 0.7 },     // 夜背景层（虫鸣+远犬+草风）
    fadeSec: 5,
    seasonGain: { winter: 1.3 },                       // 冬季风 ×1.3（§4.2 对位美术圣经「世界更空」）
  },
  layers: {
    'distant-war': { file: 'amb-distant-war.mp3', volume: 0.6, loop: true },   // 事件层：战火远响
  },
};

export class MusicSystem {
  /**
   * @param {SFX} sfx 共用 AudioContext 的 SFX 实例（sfx.ensure() 后本模块 ensure() 才会成功）
   */
  constructor(sfx) {
    this.sfx = sfx;
    this.actx = null;
    this.cfg = { bgm: FALLBACK_BGM_CFG, ambient: FALLBACK_AMBIENT_CFG, narrations: { entries: [] } };
    this._ok = false;             // ensure() 成功（用户手势 + WebAudio 可用）后为 true
    this._narrMap = new Map();    // 旁白文案 → 文件 URL（章节 JSON 文案为唯一源，manifest 只做映射）
    this._narrationMode = 'on';   // 'on' | 'subtitle' | 'off'（§5.5 可访问性；默认开）

    // 总线
    this.master = null; this.busBgm = null; this.busAmbient = null; this.busSfx = null; this.busNarration = null;

    // BGM 四态流 {el, gain, ok, playing, stopT}
    this._streams = {};           // state id → stream
    this._state = null;           // 当前态（null = 未起播）
    this._firstStart = true;      // 首次起播 2s 低起（存档恢复/首手势延迟进入，E-音频①④）

    // 状态机计时（STEP 步进累积）
    this._onT = { danger: 0, settle: 0 };    // 条件连续成立秒数（进入迟滞 §3.2）
    this._offT = { danger: 0, settle: 0 };   // 条件连续不成立秒数（退出迟滞）
    this._eventHold = 0;                     // playBgm 强制 event 态剩余秒（cutscene 期间顺延，E-音频②）

    // 环境层
    this._beds = {};              // 'day'|'night' → stream
    this._bedNight = null;        // 当前背景层态
    this._bedSeason = '';         // 季节（冬季风 ×1.3，§4.2）
    this._layers = {};            // 层名 → stream（事件层，§4.1 同时 ≤1）
    this._activeLayer = null;

    // 旁白
    this._nar = null;             // {el, gain, src, done}
    this._duckN = 0;              // ducking 计数（并发 speak 收敛）

    this._pageMuted = false;      // 切后台静音（visibilitychange）
    this._acc = 0;                // tick 节流累积
  }

  /* ---------- 装配（main.js） ---------- */

  /** 注入数据表（fetch 失败时传 null → 模块内兜底；schema 见 docs/design/audio/sound-layer.md §4） */
  setData({ bgm, ambient, narrations } = {}) {
    if (bgm && typeof bgm === 'object') this.cfg.bgm = { ...FALLBACK_BGM_CFG, ...bgm };
    if (ambient && typeof ambient === 'object') this.cfg.ambient = { ...FALLBACK_AMBIENT_CFG, ...ambient };
    if (narrations && Array.isArray(narrations.entries)) {
      this.cfg.narrations = narrations;
      this._narrMap = new Map(narrations.entries.map((e) => [String(e.text), AUDIO_DIR + e.file]));
    }
  }

  /** 用户手势后激活：构建总线 + 全部流。返回是否成功（失败 = 全静默降级，字幕照常）。幂等。 */
  ensure() {
    if (this._ok) return true;
    const actx = this.sfx?.actx;
    if (!actx) return false;
    this.actx = actx;

    const bus = this.cfg.bgm.bus ?? { master: 0.9, bgm: 0.35, ambient: 0.25, sfx: 0.6, narration: 0.9 };
    this._busVol = { ...bus };
    this.master = actx.createGain(); this.master.gain.value = bus.master;
    this.master.connect(actx.destination);
    this.busBgm = actx.createGain(); this.busBgm.gain.value = bus.bgm;
    this.busAmbient = actx.createGain(); this.busAmbient.gain.value = bus.ambient;
    this.busSfx = actx.createGain(); this.busSfx.gain.value = bus.sfx;
    this.busNarration = actx.createGain(); this.busNarration.gain.value = bus.narration;
    for (const b of [this.busBgm, this.busAmbient, this.busSfx, this.busNarration]) b.connect(this.master);

    // sfx.js 交互音迁入总线（只改输出连接，不改音色；§6.1）
    this.sfx.setOutput?.(this.busSfx);

    // BGM 四态流（event 不循环：历史不驻场）
    for (const [id, def] of Object.entries(this.cfg.bgm.states ?? {})) {
      this._streams[id] = this._makeStream(def.file, def.bus ?? this.busBgm, { loop: def.loop !== false });
    }
    // 环境背景层（昼/夜）
    for (const [id, def] of Object.entries(this.cfg.ambient.bed ?? {})) {
      if (id === 'fadeSec' || id === 'seasonGain') continue;
      this._beds[id] = this._makeStream(def.file, this.busAmbient, { loop: true });
    }
    // 环境事件层
    for (const [id, def] of Object.entries(this.cfg.ambient.layers ?? {})) {
      this._layers[id] = this._makeStream(def.file, this.busAmbient, { loop: def.loop !== false });
    }

    this._ok = true;
    return true;
  }

  /* ---------- 主循环（main.js 每帧；演出中也照常推进——cutscene 隐含 event 态） ---------- */

  /**
   * @param {number} dt 秒
   * @param {{isNight:boolean, playerPos:{x,y,z}, stats:{blocksPlaced:number},
   *          mobs?:Array, cutsceneActive?:boolean, season?:string,
   *          settlePoints?:Array<[number,number,number]>}} ctx
   */
  tick(dt, ctx = {}) {
    if (!this._ok) return;
    // event 态 hold 倒计时（cutscene 期间顺延：演出免打扰，E-音频②）
    if (!ctx.cutsceneActive && this._eventHold > 0) this._eventHold = Math.max(0, this._eventHold - dt);

    this._acc += dt;
    if (this._acc < STEP) return;
    this._acc = 0;

    // --- 条件计时（进入/退出迟滞共用，§3.2） ---
    const m = this.cfg.bgm.machine ?? {};
    const near = this._nearestMobDist(ctx.mobs, ctx.playerPos);
    const dangerCond = !!ctx.isNight || (near != null && near < (m.dangerMobRadius ?? 20));
    const settleCond = !dangerCond && this._settleCond(ctx, m);
    for (const [s, on] of [['danger', dangerCond], ['settle', settleCond]]) {
      if (on) { this._onT[s] += STEP; this._offT[s] = 0; }
      else { this._offT[s] += STEP; this._onT[s] = 0; }
    }

    // --- 目标态判定（优先级 event > danger > settle > explore，§3.2） ---
    const enterHyst = m.enterHysteresis ?? 2;
    const eventActive = !!ctx.cutsceneActive || this._eventHold > 0;
    const dangerWant = this._onT.danger >= enterHyst
      || (this._state === 'danger' && this._offT.danger < (m.dangerExitHysteresis ?? 8));
    const settleWant = this._onT.settle >= enterHyst
      || (this._state === 'settle' && this._offT.settle < (m.settleExitHysteresis ?? 20));
    let want = 'explore';
    if (eventActive) want = 'event';
    else if (dangerWant) want = 'danger';
    else if (settleWant) want = 'settle';

    if (want !== this._state) this._switchState(want);

    // --- 环境背景层昼夜交叉淡化 + 季节增益 ---
    this._updateBed(ctx);
  }

  /** 当前 BGM 态（HUD/调试） */
  get state() { return this._state; }
  get ready() { return this._ok; }

  /* ---------- 章节效果入口（main.js registerEffect 路由） ---------- */

  /** playBgm 效果：强制 BGM 态 N 游戏秒（cutscene 期间顺延；event 态放完即静默等待，E-音频②） */
  setChapterOverride(state, holdSec = 0) {
    if (!this._ok) return;   // 手势前触发（理论窗口极小）：丢弃，状态机稍后自行判定
    if (!this._streams[state]) { console.warn(`[music] playBgm：未知状态 ${state}`); return; }
    if (Number.isFinite(holdSec) && holdSec > 0) this._eventHold = holdSec;
    if (state === 'event') {
      const el = this._streams.event.el;
      if (el.ended || el.currentTime > 0) { try { el.currentTime = 0; } catch (e) { /* 流未就绪 */ } }
      // 已在 event 态但轨已放完（hold 期间静默等待）→ 新触发从头起播
      if (this._state === 'event' && !this._streams.event.playing) {
        this._startStream(this._streams.event, this.cfg.bgm.states?.event?.volume ?? 0.85, this.cfg.bgm.fade?.toEvent ?? 0.5);
      }
    }
  }

  /** ambient 效果：事件层开关（on:false 关层；同时 ≤1 层，新层顶旧层，§4.1） */
  ambientLayer(name, on = true, fadeSec = 8) {
    if (!this._ok) return;
    const L = this._layers[name];
    if (!L) { console.warn(`[music] ambient：未知层 ${name}`); return; }
    if (on) {
      if (this._activeLayer && this._activeLayer !== name) {
        this._stopStream(this._layers[this._activeLayer], fadeSec);
      }
      this._activeLayer = name;
      this._startStream(L, this.cfg.ambient.layers[name].volume ?? 0.6, fadeSec);
    } else {
      if (this._activeLayer === name) this._activeLayer = null;
      this._stopStream(L, fadeSec);
    }
  }

  /* ---------- 旁白（文案源唯一：章节 JSON；manifest 只做 文案→文件 映射） ---------- */

  setNarrationMode(mode) {
    if (mode === 'on' || mode === 'subtitle' || mode === 'off') {
      this._narrationMode = mode;
      if (mode !== 'on') this.stopSpeak();
    }
  }

  /**
   * 播一段旁白（事件触发/cutscene 逐行）。发声期间 ducking（bgm/ambient ×0.3、sfx ×0.7，§5.4）。
   * @returns {Promise<boolean>} 是否真的发声（false = 无样音/无音频/模式关 → 调用方回落字幕或固定节奏）
   */
  speak(text) {
    if (!this._ok || this._narrationMode !== 'on' || text == null) return Promise.resolve(false);
    const url = this._narrMap.get(String(text));
    if (!url) return Promise.resolve(false);   // 文案与样音不一致（E-音频⑥）→ 静默，字幕照常
    this._stopNarration(0.25);                 // 长卷画外音只有一个人：新句顶旧句
    const actx = this.actx;
    const el = new Audio(url);
    el.preload = 'auto';
    const src = actx.createMediaElementSource(el);
    const g = actx.createGain();
    g.gain.value = 0;
    src.connect(g).connect(this.busNarration);
    const nar = this._nar = { el, gain: g, src, done: null };
    let settled = false;
    const finish = (played) => {
      if (settled) return; settled = true;
      try { src.disconnect(); } catch (e) { /* 已断 */ }
      this._duck(false);
      if (this._nar === nar) this._nar = null;
      resolve(played);
    };
    let resolve; // eslint-disable-line no-unused-vars
    const p = new Promise((res) => { resolve = res; });
    el.addEventListener('ended', () => finish(true), { once: true });
    el.addEventListener('error', () => finish(false), { once: true });
    nar.done = finish;
    this._duck(true);
    const t = actx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.15);
    el.play()?.catch(() => finish(false));     // 自动播放被拒等 → 降级字幕
    return p;
  }

  /** 立即收掉当前旁白（cutscene 开场清场 / skip 跳过用） */
  stopSpeak() { if (this._nar) this._stopNarration(0.2); }

  _stopNarration(fadeSec = 0.25) {
    const nar = this._nar;
    if (!nar || !this.actx) return;
    this._nar = null;
    const t = this.actx.currentTime;
    const g = nar.gain.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + fadeSec);
    setTimeout(() => { try { nar.el.pause(); } catch (e) { /* 已停 */ } }, fadeSec * 1000 + 120);
    nar.done?.(true);   // 视为已播（节奏交还调用方），并解除 ducking
  }

  /* ---------- 切后台静音（visibilitychange；恢复只续「应正在播」的流） ---------- */

  setPageMuted(hidden) {
    if (!this._ok || hidden === this._pageMuted) return;
    this._pageMuted = hidden;
    const t = this.actx.currentTime;
    const g = this.master.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(hidden ? 0 : this._busVol.master, t + 0.25);
    for (const s of this._allStreams()) {
      if (hidden) { s.playing = !s.el.paused; s.el.pause(); }
      else if (s.playing) s.el.play()?.catch(() => { s.playing = false; });
    }
    if (hidden) this.stopSpeak();
  }

  /* ---------- 内部：流与淡化 ---------- */

  _makeStream(file, bus, { loop }) {
    const el = new Audio(AUDIO_DIR + file);
    el.loop = !!loop;
    el.preload = 'auto';
    const stream = { el, ok: true, playing: false, stopT: null };
    el.addEventListener('error', () => { stream.ok = false; }, { once: true });
    if (!loop) el.addEventListener('ended', () => { stream.playing = false; }, { once: false });   // 单次轨放完：不再随切后台恢复重播
    const src = this.actx.createMediaElementSource(el);
    const gain = this.actx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(bus);
    stream.gain = gain;
    return stream;
  }

  _allStreams() {
    return [...Object.values(this._streams), ...Object.values(this._beds), ...Object.values(this._layers)];
  }

  _fade(stream, to, sec) {
    const t = this.actx.currentTime;
    const g = stream.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(Math.max(0.0001, g.value), t);
    g.linearRampToValueAtTime(Math.max(0.0001, to), t + Math.max(0.05, sec));
  }

  _startStream(stream, vol, fadeIn) {
    if (!stream || !stream.ok) return;
    if (stream.stopT) { clearTimeout(stream.stopT); stream.stopT = null; }
    this._fade(stream, vol, fadeIn);
    stream.playing = true;
    stream.el.play()?.catch(() => { stream.ok = false; stream.playing = false; });
  }

  _stopStream(stream, fadeOut) {
    if (!stream) return;
    this._fade(stream, 0, fadeOut);
    stream.playing = false;
    if (stream.stopT) clearTimeout(stream.stopT);
    stream.stopT = setTimeout(() => { stream.stopT = null; try { stream.el.pause(); } catch (e) { /* 已停 */ } },
      fadeOut * 1000 + 150);
  }

  /** 状态切换：双轨交叉淡化（禁止硬切；淡化表 §3.3） */
  _switchState(next) {
    const prev = this._state;
    this._state = next;
    const f = this.cfg.bgm.fade ?? {};
    const def = this.cfg.bgm.states?.[next] ?? {};
    let fadeIn, fadeOut;
    if (this._firstStart) { fadeIn = f.first ?? 2; fadeOut = 0; this._firstStart = false; }   // 低起 2s（E-音频①④）
    else {
      fadeIn = next === 'danger' ? (f.toDanger ?? 1.5) : next === 'event' ? (f.toEvent ?? 0.5) : (f.default ?? 3);
      fadeOut = prev === 'danger' ? (f.fromDangerOut ?? 5) : prev === 'event' ? (f.fromEventOut ?? 1.5) : (f.default ?? 3);
    }
    if (prev && this._streams[prev]) this._stopStream(this._streams[prev], fadeOut);
    const s = this._streams[next];
    if (s) {
      if (next === 'event' && s.el.ended) { try { s.el.currentTime = 0; } catch (e) { /* 流未就绪 */ } }
      this._startStream(s, def.volume ?? 0.8, fadeIn);
    }
    console.log(`[music] BGM ${prev ?? '—'} → ${next}`);
  }

  _updateBed(ctx) {
    const bed = this.cfg.ambient.bed ?? {};
    const fadeSec = bed.fadeSec ?? 5;
    const seasonGain = (bed.seasonGain ?? {})[ctx.season] ?? 1;
    const reseason = ctx.season !== this._bedSeason;
    const wantNight = !!ctx.isNight;
    if (wantNight !== this._bedNight || reseason) {
      const from = wantNight ? this._beds.day : this._beds.night;
      const to = wantNight ? this._beds.night : this._beds.day;
      const id = wantNight ? 'night' : 'day';
      if (from) this._stopStream(from, fadeSec);
      if (to) this._startStream(to, (bed[id]?.volume ?? 0.6) * seasonGain, fadeSec);
      this._bedNight = wantNight;
      this._bedSeason = ctx.season ?? '';
    }
  }

  _nearestMobDist(mobs, playerPos) {
    if (!Array.isArray(mobs) || !playerPos) return null;
    let best = null;
    for (const m of mobs) {
      if (!m || !m.pos || m.state === 'sinking') continue;
      const d = Math.hypot(m.pos.x - playerPos.x, m.pos.z - playerPos.z);
      if (best === null || d < best) best = d;
    }
    return best;
  }

  /** 定居判定（§3.2/§8.4）：优先房屋锚点半径（settlePoints=已判定房屋门坐标），无房屋时 blocksPlaced 粗代理 */
  _settleCond(ctx, m) {
    const pts = ctx.settlePoints;
    if (Array.isArray(pts) && pts.length) {
      const r = m.settleRadius ?? 32;
      const p = ctx.playerPos;
      if (!p) return false;
      return pts.some((pt) => Math.hypot(pt[0] - p.x, pt[2] - p.z) <= r);
    }
    return (ctx.stats?.blocksPlaced ?? 0) >= (m.settleStatBlocks ?? 40);
  }

  _duck(on) {
    if (!this._ok) return;
    this._duckN = Math.max(0, this._duckN + (on ? 1 : -1));
    const k = this._duckN > 0;
    const d = this.cfg.bgm.duck ?? { bgm: 0.3, ambient: 0.3, sfx: 0.7, restoreSec: 1 };
    const sec = k ? 0.3 : (d.restoreSec ?? 1);
    const t = this.actx.currentTime;
    const ramp = (node, base, mul) => {
      const g = node.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(base * (k ? mul : 1), t + sec);
    };
    ramp(this.busBgm, this._busVol.bgm, d.bgm);
    ramp(this.busAmbient, this._busVol.ambient, d.ambient);
    ramp(this.busSfx, this._busVol.sfx, d.sfx);
  }
}
