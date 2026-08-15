// ui.js — 十字准星已由 CSS 承担；本模块管 hotbar（生存行囊）/ 物品名提示 / FPS / 挖掘进度环 / 遮罩
import { BLOCK_DEFS } from './blocks.js';
import { ITEM_DEFS, drawItemIcon } from './items.js';
import { drawTileTo } from './textures.js';

/** 物品 id → 名称（方块 <100；工具/材料 ≥100） */
export function itemName(id) {
  if (!id) return '';
  return id >= 100 ? (ITEM_DEFS[id]?.name ?? '未知物品') : (BLOCK_DEFS[id]?.name ?? '未知方块');
}

/** 通用图标：方块画 atlas 瓦片，其余画物品像素图标 */
export function drawIcon(ctx, id, dx, dy, dw, dh) {
  if (id >= 100) drawItemIcon(ctx, id, dx, dy, dw, dh);
  else if (BLOCK_DEFS[id]?.tiles) drawTileTo(ctx, BLOCK_DEFS[id].tiles.side, dx, dy, dw, dh);
}

export class UI {
  constructor() {
    this.hotbarEl = document.getElementById('hotbar');
    this.nameEl = document.getElementById('blockName');
    this.pickupEl = document.getElementById('pickup');
    this.fpsEl = document.getElementById('fps');
    this.ringEl = document.getElementById('digRing');
    this.overlayEl = document.getElementById('overlay');
    this.heartsEl = document.getElementById('hearts');
    this.vignetteEl = document.getElementById('vignette');
    this.deathEl = document.getElementById('death');
    this.dateEl = document.getElementById('date');
    this._nameTimer = null;
    this._slots = [];
    this._heartFills = null;
    this._maxHp = 0;
  }

  /** 重建 hotbar 为生存行囊（inventory 驱动；槽 = {id,count}|null） */
  buildHotbar(_items) {
    this.hotbarEl.innerHTML = '';
    this._slots = [];
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(i + 1);
      const cv = document.createElement('canvas');
      cv.width = 36; cv.height = 36;
      const cnt = document.createElement('span');
      cnt.className = 'cnt';
      slot.appendChild(num);
      slot.appendChild(cv);
      slot.appendChild(cnt);
      this.hotbarEl.appendChild(slot);
      this._slots.push({ slot, cv, cnt });
    }
  }

  /** 按行囊内容重绘各槽（库存变化时调用） */
  renderInventory(inv) {
    for (let i = 0; i < this._slots.length; i++) {
      const { slot, cv, cnt } = this._slots[i];
      const s = inv.slots[i];
      const ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 36, 36);
      if (s) {
        drawIcon(ctx, s.id, 2, 2, 32, 32);
        cnt.textContent = s.count > 1 ? String(s.count) : '';
        slot.classList.remove('empty');
      } else {
        cnt.textContent = '';
        slot.classList.add('empty');
      }
      slot.classList.toggle('sel', i === inv.selected);
    }
  }

  /** 选中态（行囊驱动） */
  select(index) {
    this._slots.forEach((s, i) => s.slot.classList.toggle('sel', i === index));
  }

  /** 切换手持时显示物品名（自动淡出） */
  showItemName(id) {
    this.nameEl.textContent = itemName(id);
    if (!id) return;
    this.nameEl.style.opacity = '1';
    clearTimeout(this._nameTimer);
    this._nameTimer = setTimeout(() => { this.nameEl.style.opacity = '0'; }, 1200);
  }

  /** 拾取提示（hotbar 上方短提示；text='' 隐藏） */
  showPickup(text) {
    const el = this.pickupEl;
    if (!text) { el.style.opacity = '0'; return; }
    el.textContent = text;
    el.style.opacity = '1';
    clearTimeout(this._pickupTimer);
    this._pickupTimer = setTimeout(() => { el.style.opacity = '0'; }, 1400);
  }

  /** MC-3a 编年日期/季节 HUD（左上角；空串隐藏） */
  setDate(text) {
    if (this.dateEl) this.dateEl.textContent = text ?? '';
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
