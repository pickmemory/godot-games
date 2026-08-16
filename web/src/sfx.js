// sfx.js — WebAudio 合成音效全套（零外部音频文件；全程序合成，自研无需第三方登记）
// 覆盖：挖掘分段轻响 / 方块破碎 / 放置 / 拾取 / 受击 / 行尸呻吟 / 脚步（材质区分）/ 夜风氛围
// 用法：main.js 持有单例；首次用户手势（点击开卷）时 ensure() 激活 AudioContext。
export class SFX {
  constructor() {
    this.actx = null;
    this.out = null;          // D-4：输出节点（music.js 总线接管后指向 busSfx；null = 直连 destination）
    this.windEnabled = true;  // D-4：程序夜风开关（环境采样层 amb-night 接管后置 false，防双风叠加）
    this._wind = null;
  }

  /** 创建/恢复 AudioContext（浏览器自动播放策略要求用户手势后才能出声） */
  ensure() {
    if (!this.actx) {
      try { this.actx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { /* 无 WebAudio → 静默降级，游戏照常运行 */ }
    }
    if (this.actx && this.actx.state === 'suspended') this.actx.resume();
  }

  /** D-4：输出迁入 music.js 总线（只改连接，不改音色；audio-direction.md §6.1） */
  setOutput(node) { this.out = node; }

  /** 当前输出终点（未迁总线时直连 destination，保持独立可用） */
  _dest() { return this.out ?? this.actx.destination; }

  /* ---------- 基础合成单元 ---------- */

  /** 白噪声脉冲（低通滤波 + 可选频率下扫）：挖掘/破碎/放置/脚步的底料 */
  _noise(dur, freq, gain, sweep) {
    const actx = this.actx;
    if (!actx) return;
    const n = Math.max(1, Math.floor(actx.sampleRate * dur));
    const buf = actx.createBuffer(1, n, actx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = actx.createBufferSource();
    src.buffer = buf;
    const flt = actx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(freq, actx.currentTime);
    if (sweep) flt.frequency.exponentialRampToValueAtTime(Math.max(80, freq * sweep), actx.currentTime + dur);
    const g = actx.createGain();
    g.gain.value = gain;
    src.connect(flt).connect(g).connect(this._dest());
    src.start();
  }

  /** 单振荡器音符（起止包络）：拾取 pop / 受击下行音 */
  _tone(type, f0, f1, dur, vol) {
    const actx = this.actx;
    if (!actx) return;
    const t = actx.currentTime;
    const o = actx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this._dest());
    o.start(t); o.stop(t + dur + 0.03);
  }

  /* ---------- 挖掘 / 建造 ---------- */

  /** 挖掘分段轻响（裂纹每推进一段响一声，音量低于破碎避免疲劳） */
  digTick() { this._noise(0.05, 900, 0.1); }

  /** 方块破碎（噪声爆裂 + 频率下扫） */
  blockBreak() { this._noise(0.14, 1400, 0.3, 0.25); }

  /** 放置（短促高频"嗒"） */
  place() { this._noise(0.06, 2000, 0.2, 0.5); }

  /** 拾取掉落物（上滑双音 pop，MC 式"啾"） */
  pickup() {
    this._tone('sine', 520, 1040, 0.09, 0.12);
    setTimeout(() => this._tone('sine', 780, 1560, 0.08, 0.09), 55);
  }

  /* ---------- 生存 / 战斗 ---------- */

  /** 玩家受击（方波下行 + 低频噪声冲击） */
  hurt() {
    this._tone('square', 320, 110, 0.18, 0.14);
    this._noise(0.1, 500, 0.18, 0.4);
  }

  /** 行尸呻吟（锯齿低滑 + 低通，vol 0.04~0.25 按距离/场合调） */
  groan(vol = 0.14) {
    const actx = this.actx;
    if (!actx) return;
    const t = actx.currentTime;
    const o = actx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(85 + Math.random() * 45, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.9);
    const flt = actx.createBiquadFilter();
    flt.type = 'lowpass'; flt.frequency.value = 320;
    const g = actx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    o.connect(flt).connect(g).connect(this._dest());
    o.start(t); o.stop(t + 1.05);
  }

  /* ---------- 脚步（按脚下方块材质区分音色） ---------- */

  /** 脚步材质音色表：dur 秒 / freq 低通截止 / gain 音量 / sweep 下扫比 */
  static STEP_PROFILES = {
    grass: { dur: 0.09, freq: 750, gain: 0.05, sweep: 0.5 },  // 草地：软沙沙
    dirt:  { dur: 0.08, freq: 520, gain: 0.06, sweep: 0.55 }, // 泥土：闷实
    stone: { dur: 0.06, freq: 1900, gain: 0.06, sweep: 0.35 },// 石面：清脆硬点
    sand:  { dur: 0.12, freq: 420, gain: 0.05, sweep: 0.6 },  // 沙地：拖沓碎响
    wood:  { dur: 0.07, freq: 900, gain: 0.07, sweep: 0.45 }, // 木面：板振轻叩
  };

  /**
   * 走一步。material ∈ STEP_PROFILES 键（main 由脚下方块 id 映射）。
   */
  step(material = 'grass') {
    const p = SFX.STEP_PROFILES[material] ?? SFX.STEP_PROFILES.grass;
    this._noise(p.dur, p.freq, p.gain, p.sweep);
    if (material === 'wood') this._tone('triangle', 170, 120, 0.06, 0.05); // 木板余振
  }

  /* ---------- 夜风氛围（入夜淡入 / 破晓淡出） ---------- */

  setNight(isNight) { if (isNight) this._startWind(); else this._stopWind(); }

  _startWind() {
    const actx = this.actx;
    if (!actx || this._wind || !this.windEnabled) return;   // D-4：采样环境层接管时不再双风叠加
    const buf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    const src = actx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const flt = actx.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 380; flt.Q.value = 0.6;
    const g = actx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.12, actx.currentTime + 3);
    const lfo = actx.createOscillator();
    lfo.frequency.value = 0.13; // 风声呼吸
    const lfoGain = actx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(flt).connect(g).connect(this._dest());
    src.start(); lfo.start();
    this._wind = { src, g, lfo };
  }

  _stopWind() {
    const actx = this.actx;
    if (!this._wind || !actx) return;
    const { src, g, lfo } = this._wind;
    this._wind = null;
    const t = actx.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(Math.max(0.001, g.gain.value), t);
    g.gain.linearRampToValueAtTime(0, t + 2);
    setTimeout(() => { try { src.stop(); lfo.stop(); } catch (e) { /* 已停 */ } }, 2200);
  }
}
