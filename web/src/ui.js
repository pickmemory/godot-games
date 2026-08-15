// ui.js — 十字准星已由 CSS 承担；本模块管 hotbar / 方块名提示 / FPS / 挖掘进度环 / 遮罩
import { BLOCK_DEFS } from './blocks.js';
import { drawTileTo } from './textures.js';

export class UI {
  constructor() {
    this.hotbarEl = document.getElementById('hotbar');
    this.nameEl = document.getElementById('blockName');
    this.fpsEl = document.getElementById('fps');
    this.ringEl = document.getElementById('digRing');
    this.overlayEl = document.getElementById('overlay');
    this._nameTimer = null;
    this._slots = [];
  }

  /** 构建九宫 hotbar（items: 方块 id 数组） */
  buildHotbar(items) {
    this.hotbarEl.innerHTML = '';
    this._slots = [];
    items.forEach((id, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(i + 1);
      const cv = document.createElement('canvas');
      cv.width = 32; cv.height = 32;
      const ctx = cv.getContext('2d');
      drawTileTo(ctx, BLOCK_DEFS[id].tiles.side, 0, 0, 32, 32);
      slot.appendChild(num);
      slot.appendChild(cv);
      this.hotbarEl.appendChild(slot);
      this._slots.push(slot);
    });
  }

  /** 选中态 + 名称提示（自动淡出） */
  select(index) {
    this._slots.forEach((s, i) => s.classList.toggle('sel', i === index));
  }

  showBlockName(id) {
    this.nameEl.textContent = BLOCK_DEFS[id]?.name ?? '';
    this.nameEl.style.opacity = '1';
    clearTimeout(this._nameTimer);
    this._nameTimer = setTimeout(() => { this.nameEl.style.opacity = '0'; }, 1200);
  }

  setStats(fps, chunks) {
    this.fpsEl.innerHTML = `${fps} fps<br><span class="t">chunks ${chunks}</span>`;
  }

  /** pct ∈ (0,1]；0 隐藏 */
  setDigProgress(pct) {
    if (!pct || pct <= 0) { this.ringEl.style.display = 'none'; return; }
    const deg = Math.round(pct * 360);
    this.ringEl.style.display = 'block';
    this.ringEl.style.background =
      `conic-gradient(#ffd76a ${deg}deg, rgba(255,255,255,.25) ${deg}deg)`;
  }

  showOverlay() { this.overlayEl.classList.remove('hidden'); }
  hideOverlay() { this.overlayEl.classList.add('hidden'); }
}
