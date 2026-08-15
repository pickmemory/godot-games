// cutscene.js — MC-3d 章节开场/结尾演出层（C1）：全屏黑底 + 书法体题签 + 逐行淡入旁白
//
// 职责边界（模块间只经导出签名通信）：
//   - 只管「呈现与节奏」：DOM 容器在 index.html（#cutscene），文案/行数全由章节数据
//     （worldState.onEnter / onExit 的 {"type":"cutscene", title, subtitle, lines} 效果）驱动，代码零台词。
//   - 章节数据 schema 见 web/data/chapters/README.md；触发与效果路由在 main.js
//     （timeline.registerEffect('cutscene', ...) → Cutscene.play）。
//   - 纯 DOM/CSS 过渡（opacity/transform），不 import THREE；任何键可跳过（skip）。
//
// 演出期间 main.js 冻结玩家/AI/时间轴输入（cutscene.isActive 判定），演出自走：
//   黑屏淡入 → 题签/副题淡入 → 旁白逐行淡入 → 停顿 → 整层淡出 → Promise resolve。

export class Cutscene {
  constructor() {
    this.rootEl = document.getElementById('cutscene');
    this.titleEl = document.getElementById('csTitle');
    this.subEl = document.getElementById('csSub');
    this.linesEl = document.getElementById('csLines');
    this._active = false;
    this._skipped = false;
    this._wake = null; // 当前 sleep 的提前唤醒器（skip 用）
  }

  get isActive() { return this._active; }

  /** 可中断等待：skip 后立即返回（后续 sleep 同样直通，演出快进收尾） */
  _sleep(ms) {
    if (this._skipped) return Promise.resolve();
    return new Promise((resolve) => {
      const t = setTimeout(() => { this._wake = null; resolve(); }, ms);
      this._wake = () => { clearTimeout(t); this._wake = null; resolve(); };
    });
  }

  /**
   * 播放一场演出（正在播放时调用 → 立即 resolve，不叠加）。
   * @param {{title?:string, subtitle?:string, lines?:string[],
   *          lineMs?:number, tailMs?:number, fadeMs?:number}} cfg
   * @returns {Promise<void>} 演出结束（含跳过）后 resolve
   */
  async play(cfg = {}) {
    if (this._active) return;
    if (!this.rootEl) {           // DOM 缺失（异常环境）→ 静默直通，不阻塞章节流程
      console.warn('[cutscene] #cutscene 容器缺失，演出跳过');
      return;
    }
    const { title = '', subtitle = '', lines = [] } = cfg;
    const lineMs = Number(cfg.lineMs) > 0 ? Number(cfg.lineMs) : 2800;
    const tailMs = Number(cfg.tailMs) > 0 ? Number(cfg.tailMs) : 2200;
    const fadeMs = Number(cfg.fadeMs) > 0 ? Number(cfg.fadeMs) : 1000;

    this._active = true;
    this._skipped = false;

    // 重置并亮起
    this.titleEl.textContent = title;
    this.subEl.textContent = subtitle;
    this.subEl.style.display = subtitle ? '' : 'none';
    this.linesEl.innerHTML = '';
    this.titleEl.classList.remove('on');
    this.subEl.classList.remove('on');
    this.rootEl.classList.remove('hidden');
    void this.rootEl.offsetWidth;          // 强制 reflow，保证淡入过渡生效
    this.rootEl.classList.add('show');

    await this._sleep(Math.round(fadeMs * 0.6));
    this.titleEl.classList.add('on');
    if (subtitle) this.subEl.classList.add('on');
    await this._sleep(900);

    for (const line of lines) {
      const p = document.createElement('p');
      p.textContent = String(line);
      this.linesEl.appendChild(p);
      void p.offsetWidth;
      p.classList.add('on');
      await this._sleep(lineMs);
    }
    await this._sleep(tailMs);

    this.rootEl.classList.remove('show');  // 整层淡出
    await this._sleep(fadeMs);
    this.rootEl.classList.add('hidden');
    this._active = false;
  }

  /** 跳过：唤醒当前等待，标记跳过（后续步骤直通收尾） */
  skip() {
    if (!this._active) return;
    this._skipped = true;
    this._wake?.();
  }
}
