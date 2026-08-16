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
    this.talkHintEl = document.getElementById('talkHint');
    this.clockEl = document.getElementById('clock');
    this.keysEl = document.getElementById('keys');
    this.trackerEl = document.getElementById('questTrack');
    this.sundialEl = document.getElementById('sundial');
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

  /** MC-5x 时辰（太阳即时钟的文字面）：label 如「午时 · 日中」；night=true 用月符号 */
  setClock(label, night = false) {
    if (!this.clockEl) return;
    this.clockEl.textContent = label ?? '';
    this.clockEl.classList.toggle('night', night);
  }

  /**
   * MC-5x 日晷（右上角常亮时钟盘）：太阳/月亮双针绕盘一日，中心时辰名。
   * 常亮不随夜色变暗（系统提示性质）。盘面方位：上=卯（日出） 右=午 下=酉（日落） 左=子（夜半）。
   * @param {number} c dayTime/DAY_LEN（0..1） @param {{name:string}} sc shichen() 返回值（中心大字）
   */
  drawSundial(c, sc) {
    const el = this.sundialEl;
    if (!el) return;
    const ctx = el.getContext('2d');
    const W = el.width, R = W / 2;
    ctx.clearRect(0, 0, W, W);
    ctx.save();
    ctx.translate(R, R);

    // 盘底（毛玻璃上再叠深色圆，保持常亮对比）
    ctx.beginPath(); ctx.arc(0, 0, R - 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12,10,6,.5)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,215,106,.4)'; ctx.lineWidth = 1.5; ctx.stroke();

    // 四主刻度：卯（上）午（右）酉（下）子（左）
    ctx.font = '10px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const marks = [['卯', 0, -1], ['午', 1, 0], ['酉', 0, 1], ['子', -1, 0]];
    for (const [t, mx, mz] of marks) {
      ctx.fillStyle = 'rgba(232,217,176,.85)';
      ctx.fillText(t, mx * (R - 13), mz * (R - 13));
    }
    // 八细分刻度
    ctx.strokeStyle = 'rgba(255,215,106,.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * (R - 8), -Math.cos(a) * (R - 8));
      ctx.lineTo(Math.sin(a) * (R - 5), -Math.cos(a) * (R - 5));
      ctx.stroke();
    }

    // 太阳针：c=0 卯（上）→ 0.25 午（右）→ 0.5 酉（下）→ 0.75 子（左），顺时针
    const dial = (cc, r, color, size) => {
      const a = cc * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.sin(a) * r, -Math.cos(a) * r, size, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    };
    dial(c, R - 22, '#ffd76a', 5);                    // 太阳
    dial((c + 0.5) % 1, R - 22, '#cdd9ff', 4);        // 月亮（对跖）

    // 中心当前时辰大字（常亮）
    ctx.font = '600 20px "KaiTi", "Microsoft YaHei", serif';
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(sc.name, 0, 1);
    ctx.restore();
  }

  /** MC-5x 键位卡收起/展开（localStorage 记忆） */
  setKeysMin(min) {
    if (!this.keysEl) return;
    localStorage.setItem('sgsc.keys.min', min ? '1' : '0');
    this.keysEl.classList.toggle('min', min);
    this.keysEl.innerHTML = min
      ? '按 H 查看键位'
      : `<div class="ktitle">键 位（H 收起）</div>
<div><kbd>WASD</kbd>移动　<kbd>空格</kbd>跳跃</div>
<div><kbd>F</kbd>飞行　<kbd>Shift</kbd>飞行下降</div>
<div><kbd>左键</kbd>按住挖掘</div>
<div><kbd>右键</kbd>放置 / 使用</div>
<div><kbd>E</kbd>交谈（近 NPC）/ 合成</div>
<div><kbd>1-9</kbd><span style="margin-left:2px">滚轮</span>切换行囊</div>
<div><kbd>F8</kbd>诊断面板</div>`;
  }

  /**
   * MC-5x 任务追踪卡：玩家“下一步干什么/会发生什么”的常驻指引。
   * @param {{title:string, desc:string, progress?:number, count?:number}[]} quests 活动任务（空数组 → 调用方给引导文案）
   * @param {{cls?:string, text:string}} warn 日落/夜魇预警行（cls: ''|'warn'|'night'）
   */
  renderTracker(quests, warn) {
    if (!this.trackerEl) return;
    const q = quests[0] ?? { title: '—', desc: '' };
    const pct = q.count > 0 ? Math.min(100, Math.round((q.progress / q.count) * 100)) : 0;
    this.trackerEl.querySelector('.qt-title').textContent = q.title;
    this.trackerEl.querySelector('.qt-desc').textContent = q.desc;
    this.trackerEl.querySelector('.qt-bar i').style.width = pct + '%';
    this.trackerEl.querySelector('.qt-cnt').textContent = q.count > 0 ? `${q.progress ?? 0} / ${q.count}` : '';
    const warnEl = this.trackerEl.querySelector('#sunwarn');
    warnEl.textContent = warn?.text ?? '';
    warnEl.className = warn?.cls ?? '';
  }

  /** MC-3b 可交谈提示（靠近 NPC 时；空串隐藏） */
  setTalkHint(text) {
    if (!this.talkHintEl) return;
    this.talkHintEl.textContent = text ?? '';
    this.talkHintEl.style.opacity = text ? '1' : '0';
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
