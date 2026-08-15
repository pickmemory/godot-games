// crafting.js — 合成最小集：列表式合成面板（配方数据驱动 web/data/recipes.json，缺文件用同构兜底）
// 纯逻辑方法（canCraft/craft）不碰 DOM；DOM 部分（buildPanel/refresh/open/close）负责 #craft 面板。
// 图标渲染通过注入的 iconRenderer(ctx, itemId, dx, dy, dw, dh)（main 装配，方块走 atlas 瓦片、物品走像素图标）。
import { BLOCK } from './blocks.js';
import { ITEM } from './items.js';

export const FALLBACK_RECIPES = [
  { id: 'plank',       out: { id: BLOCK.PLANK, n: 4 },       in: [{ id: BLOCK.WOOD_LOG, n: 1 }],                       station: false },
  { id: 'stick',       out: { id: ITEM.STICK, n: 4 },        in: [{ id: BLOCK.PLANK, n: 2 }],                          station: false },
  { id: 'craft_table', out: { id: BLOCK.CRAFT_TABLE, n: 1 }, in: [{ id: BLOCK.PLANK, n: 4 }],                          station: false },
  { id: 'pick_wood',   out: { id: ITEM.PICK_WOOD, n: 1 },    in: [{ id: BLOCK.PLANK, n: 3 }, { id: ITEM.STICK, n: 2 }], station: true },
  { id: 'pick_stone',  out: { id: ITEM.PICK_STONE, n: 1 },   in: [{ id: BLOCK.COBBLE, n: 3 }, { id: ITEM.STICK, n: 2 }], station: true },
  { id: 'pick_iron',   out: { id: ITEM.PICK_IRON, n: 1 },    in: [{ id: BLOCK.IRON_ORE, n: 3 }, { id: ITEM.STICK, n: 2 }], station: true },
];

export class Crafting {
  /**
   * @param {import('./inventory.js').Inventory} inventory
   * @param {{nameOf:(id:number)=>string, iconRenderer:Function}} view 名称与图标渲染注入
   * @param {{onCrafted?:(recipe:object)=>void}} [callbacks]
   */
  constructor(inventory, view, callbacks = {}) {
    this.inv = inventory;
    this.view = view;
    this.cb = callbacks;
    this.recipes = FALLBACK_RECIPES;
    this.nearStation = false;
    this.el = document.getElementById('craft');
    this.listEl = document.getElementById('recipeList');
  }

  /** 载入配方数据（main fetch 后注入；失败保持兜底） */
  setRecipes(recipes) { if (Array.isArray(recipes) && recipes.length) this.recipes = recipes; }

  /** 是否满足单条配方（材料够 + 产出装得下 + 工作台要求满足） */
  canCraft(r) {
    if (r.station && !this.nearStation) return false;
    if (!this.inv.canFit(r.out.id, r.out.n)) return false;
    return r.in.every((ing) => this.inv.countOf(ing.id) >= ing.n);
  }

  /** 执行合成：先扣材料再入产物（canCraft 已校验容量，不会半途失败） */
  craft(r) {
    if (!this.canCraft(r)) return false;
    for (const ing of r.in) this.inv.consume(ing.id, ing.n);
    this.inv.add(r.out.id, r.out.n);
    if (this.cb.onCrafted) this.cb.onCrafted(r);
    return true;
  }

  /* ---------- DOM 面板 ---------- */

  open() {
    this.el.classList.remove('hidden');
    this.refresh();
  }
  close() { this.el.classList.add('hidden'); }
  get isOpen() { return !this.el.classList.contains('hidden'); }

  /** 重绘配方列表（库存/工作台状态变化时调用） */
  refresh() {
    this.listEl.innerHTML = '';
    for (const r of this.recipes) {
      const ok = this.canCraft(r);
      const row = document.createElement('div');
      row.className = 'recipe' + (ok ? '' : ' locked');

      const cv = document.createElement('canvas');
      cv.width = 40; cv.height = 40;
      const ctx = cv.getContext('2d');
      this.view.iconRenderer(ctx, r.out.id, 0, 0, 40, 40);
      row.appendChild(cv);

      const mid = document.createElement('div');
      mid.className = 'mid';
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = `${this.view.nameOf(r.out.id)} ×${r.out.n}`;
      if (r.station) {
        const tag = document.createElement('span');
        tag.className = 'station ' + (this.nearStation ? 'ok' : 'no');
        tag.textContent = this.nearStation ? '工作台✓' : '需工作台';
        title.appendChild(tag);
      }
      mid.appendChild(title);
      const mats = document.createElement('div');
      mats.className = 'mats';
      r.in.forEach((ing, i) => {
        if (i > 0) mats.appendChild(document.createTextNode('　'));
        const sp = document.createElement('span');
        const have = this.inv.countOf(ing.id);
        sp.className = have >= ing.n ? 'enough' : 'lack';
        sp.textContent = `${ing.n}×${this.view.nameOf(ing.id)}（${have}）`;
        mats.appendChild(sp);
      });
      mid.appendChild(mats);
      row.appendChild(mid);

      const btn = document.createElement('button');
      btn.className = 'craftBtn';
      btn.textContent = '合成';
      btn.disabled = !ok;
      btn.addEventListener('click', () => { if (this.craft(r)) this.refresh(); });
      row.appendChild(btn);

      this.listEl.appendChild(row);
    }
  }
}
