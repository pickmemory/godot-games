// farming.js — MC-4a 农耕系统：开垦（锄地）/ 播种 / 生长周期 / 收获，季节联动 MC-3a 章节时间轴
//
// 职责边界（模块间只经导出签名通信）：
//   - 本模块只做「农耕规则 + 生长推进」：右键用法（useOn）、耕地水分、作物按游戏日累积生长；
//     数值全部数据驱动 web/data/farming.json（缺文件/离线 → FALLBACK_FARMING 同构兑底）。
//   - 世界读写经 WorldLike.getBlock/setBlock；掉落/入包/进食/提示经构造注入的回调，main.js 装配。
//   - 季节由注入的 season() 读取（main 传 timeline.season.name，即 MC-3a 章节数据的季节表），
//     生长速率 = seasonGrowth[season] × 湿度系数；冬季系数极低（休眠）。
//
// 生长模型（单位：游戏日）：
//   growth += dt / dayLength × seasonGrowth[season] × moisture（湿=1，干=cfg.moisture.dryGrowth）
//   阶段序 = min(stages.length - 1, floor(growth / growDays × stages.length))，末段即成熟。
//
// 水分模型：开垦后耕地湿润 wetDaysAfterTill 个游戏日；期间每 refreshSeconds 秒扫描（限 scanBudget
// 个/轮，轮转指针分帧）——若邻水（wetBlockIds，水方块未引入前为空）则保持湿润，否则到期转干。

import { BLOCK, BLOCK_DEFS } from './blocks.js';
import { ITEM_DEFS } from './items.js';

/** 兜底配置（与 web/data/farming.json 同构；方块 id 见 blocks.js，物品 id 见 items.js） */
export const FALLBACK_FARMING = {
  seasonGrowth: { spring: 1.0, summer: 1.2, autumn: 0.5, winter: 0.05 },
  till: { tool: 'hoe', blocks: [BLOCK.GRASS, BLOCK.DIRT], farmland: BLOCK.FARMLAND, farmlandWet: BLOCK.FARMLAND_WET },
  moisture: { searchRadius: 3, refreshSeconds: 2, scanBudget: 16, wetDaysAfterTill: 0.5, dryGrowth: 0.6, wetBlockIds: [] },
  crops: [
    { id: 'millet', name: '粟',   stages: [BLOCK.MILLET_0, BLOCK.MILLET_1, BLOCK.MILLET_2], seed: 108, produce: 107, yield: 2, seedYield: 2, growDays: 4, foodHp: 3 },
    { id: 'greens', name: '葵菜', stages: [BLOCK.GREENS_0, BLOCK.GREENS_1, BLOCK.GREENS_2], seed: 110, produce: 109, yield: 2, seedYield: 2, growDays: 3, foodHp: 2 },
  ],
};

export class Farming {
  /**
   * @param {import('./world.js').World} world    只用 getBlock/setBlock
   * @param {object} hooks  装配方（main.js）注入：
   *   dayLength    现实秒/游戏日（数值；main 传 DAY_LEN）
   *   season()     → 'spring'|'summer'|'autumn'|'winter'（MC-3a 时间轴）
   *   elapsedDays() → 自开卷起经过的游戏日（小数；水分计时用）
   *   notify(text) 提示（main → ui.showPickup）
   *   drop(pos, itemId, n) 掉落物实体（main → dropManager.spawn）
   *   consumeHeld() → boolean 从当前手持槽扣 1（播种消耗种子；main → inventory）
   *   eat(crop, itemId) → boolean 进食（扣食物+回血由 main 决定；false = 不消费）
   */
  constructor(world, hooks = {}) {
    this.world = world;
    this.hooks = hooks;
    this.cfg = FALLBACK_FARMING;
    this.plots = new Map();   // "x,y,z"（耕地）→ { wetUntil: 游戏日（到期转干） }
    this.crops = new Map();   // "x,y,z"（作物）→ { cropId, growth: 游戏日 }
    this._moistT = 0;         // 水分扫描计时
    this._scanKeys = [];      // 扫描轮转数组（避免每轮重排 Map 迭代器）
    this._lookups = null;     // setData 产物
  }

  /* ---------- 数据装载（main fetch 后注入；失败保持兜底） ---------- */

  setData(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.crops) || !raw.crops.length) {
      console.warn('[farming] farming.json 缺失/非法，用兜底配置');
      return;
    }
    const warnings = [];
    const cfg = {
      seasonGrowth: raw.seasonGrowth && typeof raw.seasonGrowth === 'object' ? raw.seasonGrowth : FALLBACK_FARMING.seasonGrowth,
      till: { ...FALLBACK_FARMING.till, ...(raw.till ?? {}) },
      moisture: { ...FALLBACK_FARMING.moisture, ...(raw.moisture ?? {}) },
      crops: [],
    };
    const stageToCrop = new Map();   // 作物阶段方块 id → { crop, idx }
    const seedToCrop = new Map();    // 种子物品 id → crop
    const produceToCrop = new Map(); // 产出食物 id → crop（进食回血数值用）
    for (const [i, c] of raw.crops.entries()) {
      if (!c || !Array.isArray(c.stages) || c.stages.length < 2) { warnings.push(`crops[${i}] stages 缺失，跳过`); continue; }
      const stages = c.stages.map(Number);
      if (stages.some((b) => !BLOCK_DEFS[b]?.cross)) { warnings.push(`作物 ${c.id} 的 stages 含非作物方块，跳过`); continue; }
      const crop = {
        id: String(c.id ?? `crop-${i}`),
        name: String(c.name ?? c.id ?? '作物'),
        stages,
        seed: Number(c.seed) || 0,
        produce: Number(c.produce) || 0,
        yield: Math.max(1, Number(c.yield ?? 1)),
        seedYield: Math.max(0, Number(c.seedYield ?? 0)),
        growDays: Math.max(0.5, Number(c.growDays ?? 3)),
        foodHp: Math.max(1, Number(c.foodHp ?? 1)),
      };
      cfg.crops.push(crop);
      stages.forEach((b, idx) => {
        if (stageToCrop.has(b)) warnings.push(`方块 ${b} 被多个作物阶段复用，后者覆盖`);
        stageToCrop.set(b, { crop, idx });
      });
      if (crop.seed) seedToCrop.set(crop.seed, crop);
      if (crop.produce) produceToCrop.set(crop.produce, crop);
    }
    if (!cfg.crops.length) { console.warn('[farming] farming.json 无合法作物，用兜底配置'); return; }
    this.cfg = cfg;
    this._lookups = {
      stageToCrop,
      seedToCrop,
      produceToCrop,
      matureToCrop: new Map(cfg.crops.map((c) => [c.stages[c.stages.length - 1], c])),
      farmlandIds: new Set([cfg.till.farmland, cfg.till.farmlandWet]),
    };
    if (warnings.length) console.warn('[farming] 数据告警：', warnings);
  }

  get lookups() {
    // 未 setData（数据加载前）也保证可用：用兜底配置构建
    if (!this._lookups) this.setData(FALLBACK_FARMING);
    return this._lookups;
  }

  /* ---------- 右键用法（interaction.js onUse 路由；返回 true = 已消费本次右键） ---------- */

  /**
   * @param {{pos:[number,number,number],normal:[number,number,number]}|null} hit
   * @param {number} heldItemId 当前手持物品 id（0=空手）
   */
  useOn(hit, heldItemId) {
    const L = this.lookups;
    const hitBlock = hit ? this.world.getBlock(hit.pos[0], hit.pos[1], hit.pos[2]) : 0;

    // 1) 锄地：手持锄 + 准星指向草/泥土 → 耕地（新翻之土先湿润 wetDaysAfterTill 日；邻水久湿）
    const heldDef = heldItemId >= 100 ? ITEM_DEFS[heldItemId] : null;
    if (hit && heldDef?.kind === 'tool' && heldDef.tool === this.cfg.till.tool
      && this.cfg.till.blocks.includes(hitBlock)) {
      const nearWater = this._waterNearby(hit.pos);
      if (!this.world.setBlock(hit.pos[0], hit.pos[1], hit.pos[2], this.cfg.till.farmlandWet)) return false;
      this._trackPlot(hit.pos, nearWater);
      this.hooks.notify?.(nearWater ? '翻出一垄地，邻水久湿' : '翻出一垄湿润的耕地（几日内会干，宜尽快下种）');
      return true;
    }

    // 2) 播种：手持种子 + 准星指向耕地（上方为空）→ 种下第 0 阶段
    const crop = L.seedToCrop.get(heldItemId);
    if (hit && crop && L.farmlandIds.has(hitBlock)) {
      const ax = hit.pos[0], ay = hit.pos[1] + 1, az = hit.pos[2];
      if (this.world.getBlock(ax, ay, az) !== 0) return false;   // 上方被占（含已有作物）
      if (!this.hooks.consumeHeld?.()) return false;              // 没种子可扣
      if (!this.world.setBlock(ax, ay, az, crop.stages[0])) return false;
      this.crops.set(`${ax},${ay},${az}`, { cropId: crop.id, growth: 0 });
      this.hooks.notify?.(`播下${crop.name}种`);
      return true;
    }

    // 3) 收获：准星指向成熟作物 → 掉落产出 + 种子，作物消失（耕地保留）
    const mature = L.matureToCrop.get(hitBlock);
    if (hit && mature) {
      this._harvest(hit.pos, mature);
      return true;
    }

    // 4) 进食：手持食物（无论是否有准星目标）
    if (heldDef?.kind === 'food' && L.produceToCrop.has(heldItemId)) {
      return !!this.hooks.eat?.(L.produceToCrop.get(heldItemId), heldItemId);
    }
    return false;
  }

  /* ---------- 挖掘侧对接（main.js onDigComplete 调用） ---------- */

  /**
   * 作物方块的破坏掉落（覆盖 mining.js dropOf 的通配逻辑）。
   * @returns {{id:number,n:number}[] | null} null = 不是作物（走常规掉落）
   */
  breakDrops(blockId) {
    const info = this.lookups.stageToCrop.get(blockId);
    if (!info) return null;
    const c = info.crop;
    return info.idx === c.stages.length - 1
      ? [{ id: c.produce, n: c.yield }, { id: c.seed, n: c.seedYield }]  // 成熟：产出 + 种子（可续种/扩种）
      : [];                                                               // 未熟：颗粒无收（教人敬畏农时）
  }

  /** 挖掉的方块善后：耕地被挖 → 连带顶上作物弹出掉落；作物被挖 → 清生长记录 */
  afterDig(pos, blockId) {
    const L = this.lookups;
    if (L.farmlandIds.has(blockId)) {
      this.plots.delete(pos.join(','));
      const ax = pos[0], ay = pos[1] + 1, az = pos[2];
      const above = this.world.getBlock(ax, ay, az);
      const info = L.stageToCrop.get(above);
      if (info) {
        this.world.setBlock(ax, ay, az, 0);
        for (const d of this.breakDrops(above)) this.hooks.drop?.([ax, ay, az], d.id, d.n);
        this.crops.delete(`${ax},${ay},${az}`);
      }
      return;
    }
    if (L.stageToCrop.has(blockId)) this.crops.delete(pos.join(','));
  }

  /* ---------- 每帧推进（main 主循环；与 timeline.update 同门控） ---------- */

  update(dt) {
    // 水分：限频轮转扫描（分帧预算，防大田一次性全扫）
    this._moistT -= dt;
    if (this._moistT <= 0) {
      this._moistT = this.cfg.moisture.refreshSeconds;
      this._refreshMoisture();
    }

    // 生长：按游戏日累积 × 季节系数 × 湿度系数
    const L = this.lookups;
    const season = this.hooks.season?.() ?? 'spring';
    const rate = this.cfg.seasonGrowth[season] ?? 1;
    if (rate <= 0 || this.crops.size === 0) return;
    const dayLen = this.hooks.dayLength ?? 180;
    const dry = this.cfg.moisture.dryGrowth;
    for (const [key, st] of this.crops) {
      const [x, y, z] = key.split(',').map(Number);
      const block = this.world.getBlock(x, y, z);
      const info = L.stageToCrop.get(block);
      if (!info || info.crop.id !== st.cropId) { this.crops.delete(key); continue; }  // 方块已变（被挖/被换）
      const below = this.world.getBlock(x, y - 1, z);
      const moist = below === this.cfg.till.farmlandWet ? 1 : (below === this.cfg.till.farmland ? dry : 0.3);
      st.growth += (dt / dayLen) * rate * moist;
      const c = info.crop;
      const idx = Math.min(c.stages.length - 1, Math.floor((st.growth / c.growDays) * c.stages.length));
      if (idx !== info.idx) this.world.setBlock(x, y, z, c.stages[idx]);   // 仅阶段变更时写方块
    }
  }

  /* ---------- 内部 ---------- */

  _harvest(pos, crop) {
    this.world.setBlock(pos[0], pos[1], pos[2], 0);
    this.crops.delete(pos.join(','));
    this.hooks.drop?.(pos, crop.produce, crop.yield);
    if (crop.seedYield > 0) this.hooks.drop?.(pos, crop.seed, crop.seedYield);
    this.hooks.notify?.(`收得${crop.name} ×${crop.yield}、种 ×${crop.seedYield}`);
  }

  /** 耕地入册（开垦/播种时发现旧耕地也入册） */
  _trackPlot(pos, wet) {
    const key = pos.join(',');
    if (wet) this.plots.set(key, { wetUntil: Infinity });   // 邻水恒湿
    else if (!this.plots.has(key)) {
      this.plots.set(key, { wetUntil: (this.hooks.elapsedDays?.() ?? 0) + this.cfg.moisture.wetDaysAfterTill });
    }
    if (!this._scanKeys.includes(key)) this._scanKeys.push(key);
  }

  _refreshMoisture() {
    const cfg = this.cfg;
    const L = this.lookups;
    const now = this.hooks.elapsedDays?.() ?? 0;
    let budget = cfg.moisture.scanBudget;
    while (budget > 0 && this._scanKeys.length) {
      const key = this._scanKeys.shift();
      const [x, y, z] = key.split(',').map(Number);
      const block = this.world.getBlock(x, y, z);
      if (!L.farmlandIds.has(block)) { this.plots.delete(key); continue; }   // 已被挖/被替换 → 出册（不计预算）
      this._scanKeys.push(key);   // 轮转回队尾
      budget--;
      const rec = this.plots.get(key) ?? { wetUntil: 0 };
      const wet = this._waterNearby([x, y, z]) || now < rec.wetUntil;
      if (wet && block === cfg.till.farmland) {
        rec.wetUntil = this._waterNearby([x, y, z]) ? Infinity : rec.wetUntil;
        this.plots.set(key, rec);
        this.world.setBlock(x, y, z, cfg.till.farmlandWet);
      } else if (!wet && block === cfg.till.farmlandWet) {
        this.world.setBlock(x, y, z, cfg.till.farmland);
      }
    }
  }

  /** 邻水判定：半径 searchRadius、高差 ±1 内有 wetBlockIds 方块（水方块引入前恒 false，逻辑预留） */
  _waterNearby(pos) {
    const ids = this.cfg.moisture.wetBlockIds;
    if (!ids || !ids.length) return false;
    const r = this.cfg.moisture.searchRadius;
    const [x, y, z] = pos;
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++)
          if (ids.includes(this.world.getBlock(x + dx, y + dy, z + dz))) return true;
    return false;
  }

  /** 调试概览 */
  get info() {
    return { plots: this.plots.size, crops: this.crops.size, cfg: this.cfg.id ?? 'farming' };
  }
}
