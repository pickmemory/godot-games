// inventory.js — 生存行囊：9 个 hotbar 槽（MC-2b 最小集；背包扩容留给 MC-4 生计定居）
// 槽 = { id: 物品id, count: 数量 } | null。物品 id：方块=方块 id（<100），工具/材料 ≥100（items.js）
import { maxStackOf } from './items.js';

export class Inventory {
  /** @param {number} size 槽数（默认 9 = hotbar） */
  constructor(size = 9) {
    this.slots = new Array(size).fill(null);
    this.selected = 0;
    this._listeners = [];
  }

  onChange(fn) { this._listeners.push(fn); }
  _emit() { for (const fn of this._listeners) fn(); }

  /** 当前手持槽物品（{id,count} | null） */
  held() { return this.slots[this.selected] ?? null; }

  /** 当前手持物品 id（0=空手） */
  heldId() { return this.slots[this.selected]?.id ?? 0; }

  /** 入栈（先合并同类，再开新槽）。返回未装下的数量（0=全收） */
  add(id, n = 1) {
    let left = n;
    for (const s of this.slots) {
      if (left <= 0) break;
      if (s && s.id === id && s.count < maxStackOf(id)) {
        const take = Math.min(left, maxStackOf(id) - s.count);
        s.count += take; left -= take;
      }
    }
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(left, maxStackOf(id));
        this.slots[i] = { id, count: take };
        left -= take;
      }
    }
    if (left !== n) this._emit();
    return left;
  }

  /** 是否还能装入 n 个（不实际写入；合成产出前校验，防“合成即销毁”） */
  canFit(id, n = 1) {
    let cap = 0;
    for (const s of this.slots) {
      if (s && s.id === id) cap += maxStackOf(id) - s.count;
      else if (!s) cap += maxStackOf(id);
      if (cap >= n) return true;
    }
    return cap >= n;
  }

  countOf(id) {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.count;
    return n;
  }

  /** 从任意槽扣减 n 个（合成消耗）。不足则不动并返回 false */
  consume(id, n = 1) {
    if (this.countOf(id) < n) return false;
    let left = n;
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(left, s.count);
        s.count -= take; left -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this._emit();
    return true;
  }

  /** 从当前选中槽扣 1（放置方块）。空槽/数量 0 返回 false */
  takeFromSelected(n = 1) {
    const s = this.slots[this.selected];
    if (!s || s.count < n) return false;
    s.count -= n;
    if (s.count <= 0) this.slots[this.selected] = null;
    this._emit();
    return true;
  }

  select(i) {
    if (i < 0 || i >= this.slots.length) return;
    if (i !== this.selected) { this.selected = i; this._emit(); }
  }
}
