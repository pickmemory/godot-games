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
    this.heartsEl = document.getElementById('hearts');
    this.vignetteEl = document.getElementById('vignette');
    this.deathEl = document.getElementById('death');
    this._nameTimer = null;
    this._slots = [];
    this._heartFills = null;
    this._maxHp = 0;
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

  /* ---------- MC-2 生存：血量 / 受击 / 死亡 ---------- */

  /** 构建红心条（每颗心 = 2 点血） */
  buildHearts(maxHp) {
    this._maxHp = maxHp;
    this._heartFills = [];
    this.heartsEl.innerHTML = '';
    const n = Math.ceil(maxHp / 2);
    for (let i = 0; i < n; i++) {
      const h = document.createElement('div');
      h.className = 'heart';
      h.textContent = '♥';
      const fill = document.createElement('div');
      fill.className = 'fill';
      fill.textContent = '♥';
      h.appendChild(fill);
      this.heartsEl.appendChild(h);
      this._heartFills.push(fill);
    }
  }

  /** 更新红心（满/半/空）；hp ≤ 6 时挂低血量脉动 */
  setHealth(hp, maxHp) {
    if (!this._heartFills) return;
    for (let i = 0; i < this._heartFills.length; i++) {
      const v = hp - i * 2; // 该心剩余 (0/1/2)
      this._heartFills[i].style.width = v >= 2 ? '100%' : v === 1 ? '50%' : '0%';
    }
    this.vignetteEl.classList.toggle('low', hp > 0 && hp <= 6);
  }

  /** 受击红晕闪一下 */
  flashDamage() {
    const v = this.vignetteEl;
    v.style.transition = 'none';
    v.style.opacity = '0.85';
    void v.offsetWidth; // 强制 reflow，使下一次 transition 生效
    v.style.transition = 'opacity .7s';
    v.style.opacity = '';
  }

  showDeath() { this.deathEl.classList.remove('hidden'); }
  hideDeath() { this.deathEl.classList.add('hidden'); }
}
