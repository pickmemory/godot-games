// building.js — MC-4b 建造扩展：门开合 + 「屋子」启发式判定（封闭空间 + 有门 + 内部尺寸下限）
//
// 职责边界（模块间只经导出签名通信）：
//   - 门开合：useOn 命中门 → 上下两半同步换开/合 id（blocks.js 注册表派生 doorToggleId）；
//     门口有人（玩家/NPC 占格）则拒绝关门，防夹进实心格。
//   - 掉落/善后：breakDrops（拆任一半 = 整扇门一件）、afterDig（拆一半 → 另一半连带消失）。
//   - 房屋判定（最小可行启发式）：以「门」为入口，向门板两侧泛洪（只走可通行格）——
//       * 两侧连通（同一片区域）→ 门在敞墙/空地上，不是屋子；
//       * 区域超限或头顶透天（整列无遮蔽）→ 是「室外」；
//       * 剩下有界封闭区域，且 内部格数 ≥ minInteriorCells、占地 ≥ minFootprint×minFootprint、
//         内高 ≥ minInteriorHeight → 判定为「屋子」，注册一次并触发 hooks.onHouse。
//     判定仅在关门/放门时触发（开门连通两侧必失败），一次性 ≤ maxFloodCells 格泛洪 + 逐格立柱
//     透天检查，开销可控（非每帧路径）。
//   - 数值数据驱动 web/data/building.json（缺文件/离线 → FALLBACK_BUILDING 同构兑底）。

import { BLOCK, BLOCK_DEFS, isDoor, isOpaque, doorToggleId, CHUNK_Y } from './blocks.js';

/** 兜底配置（与 web/data/building.json 同构） */
export const FALLBACK_BUILDING = {
  house: {
    maxFloodCells: 512,   // 泛洪上限（格）：超过视为室外
    minInteriorCells: 4,  // 内部可通行格数下限（≈2×2）
    minFootprint: 2,      // 占地边长下限（格）
    minInteriorHeight: 2, // 内高下限（格）
  },
  villager: {
    name: '投靠的流民',
    title: '新邻',
    model: { type: 'procedural', robe: '#7a6a52', skin: '#d9b38c', headband: '#5a4632' },
    wanderSpeed: 1.1,
    wanderRadiusMax: 3,
  },
  messages: {
    settled: '门户既成，风雨可蔽——这里算是个家了',
    villager: '有流民寻上门来，在你的屋檐下安了身',
  },
};

export class Building {
  /**
   * @param {import('./world.js').World} world  只用 getBlock/setBlock/isChunkLoaded
   * @param {object} hooks 装配方（main.js）注入：
   *   notify(text)        提示（main → ui.showPickup）
   *   sound()             门开合音（main → sfx.place）
   *   cellBlocked(x,y,z)  门口该格是否有玩家/NPC 占着（防关门夹人）；缺省恒 false
   *   onHouse(house)      判定成功一次性回调：{door:[x,y,z](下半), anchor:[x,y,z](落脚地板格),
   *                       radius:number(户内漫游半径)} —— main 在此安置村民 + 弹定居反馈
   */
  constructor(world, hooks = {}) {
    this.world = world;
    this.hooks = hooks;
    this.cfg = FALLBACK_BUILDING;
    this.houses = new Map();   // 门下半坐标 key → house 记录（同一门只触发一次）
  }

  /* ---------- 数据装载（main fetch 后注入；失败保持兜底） ---------- */

  setData(raw) {
    if (!raw || typeof raw !== 'object') { console.warn('[building] building.json 缺失/非法，用兜底配置'); return; }
    this.cfg = {
      house: { ...FALLBACK_BUILDING.house, ...(raw.house ?? {}) },
      villager: { ...FALLBACK_BUILDING.villager, ...(raw.villager ?? {}) },
      messages: { ...FALLBACK_BUILDING.messages, ...(raw.messages ?? {}) },
    };
  }

  get houseCount() { return this.houses.size; }

  /* ---------- 右键用法（main 路由在 farming 之前；返回 true = 已消费本次右键） ---------- */

  /**
   * @param {{pos:[number,number,number]}|null} hit
   */
  useOn(hit) {
    if (!hit) return false;
    const [x, y, z] = hit.pos;
    const id = this.world.getBlock(x, y, z);
    if (!isDoor(id)) return false;

    const def = BLOCK_DEFS[id].door;
    const toId = doorToggleId(id);
    if (!toId) return false;

    // 关门前查门口是否站着人（玩家/NPC 占本格 → 拒绝，防夹进实心格出不来）
    if (!BLOCK_DEFS[toId].door.open && this.hooks.cellBlocked?.(x, y, z)) {
      this.hooks.notify?.('门口站着人，门关不上');
      return true;
    }

    this.world.setBlock(x, y, z, toId);
    const my = def.top ? y - 1 : y + 1;
    const mate = this.world.getBlock(x, my, z);
    if (isDoor(mate)) this.world.setBlock(x, my, z, doorToggleId(mate));
    this.hooks.sound?.();

    // 关门时尝试房屋判定（开门连通两侧，必然非封闭）；判定以门下半为锚
    if (!BLOCK_DEFS[toId].door.open) {
      this._checkHouse(def.top ? [x, y - 1, z] : [x, y, z]);
    }
    return true;
  }

  /* ---------- 挖掘侧对接（main.js onDigComplete 调用） ---------- */

  /** 门方块破坏掉落（覆盖 mining.js dropOf 通配）：任一半 → 整扇门一件。非门返回 null */
  breakDrops(blockId) {
    if (!isDoor(blockId)) return null;
    return [{ id: BLOCK.DOOR_X, n: 1 }];
  }

  /** 挖掉的方块善后：门被拆一半 → 另一半连带消失（不再单独掉落，breakDrops 已整件计） */
  afterDig(pos, blockId) {
    if (!isDoor(blockId)) return;
    const def = BLOCK_DEFS[blockId].door;
    const my = def.top ? pos[1] - 1 : pos[1] + 1;
    if (isDoor(this.world.getBlock(pos[0], my, pos[2]))) this.world.setBlock(pos[0], my, pos[2], 0);
  }

  /** 放置侧钩子（main onPlace 调用）：新落一扇合态门 → 立即尝试判定 */
  onPlaced(pos) {
    const id = this.world.getBlock(pos[0], pos[1], pos[2]);
    if (isDoor(id) && !BLOCK_DEFS[id].door.open && !BLOCK_DEFS[id].door.top) this._checkHouse(pos);
  }

  /* ---------- 房屋判定 ---------- */

  /**
   * 以门下半为入口做两侧泛洪。成功注册并触发一次 onHouse；重复门/不成立静默返回。
   * @param {[number,number,number]} doorLower
   */
  _checkHouse(doorLower) {
    const [x, y, z] = doorLower;
    const id = this.world.getBlock(x, y, z);
    if (!isDoor(id)) return null;

    const axis = BLOCK_DEFS[id].door.axis;   // 门板横跨轴 → 通行方向在另一轴
    const starts = axis === 'x'
      ? [[x, y, z - 1], [x, y, z + 1]]
      : [[x - 1, y, z], [x + 1, y, z]];

    const visited = new Set();
    const regions = [];
    for (const s of starts) regions.push(this._flood(s, visited));

    // 取合格内腔中最小者（两间屋共一门时算小间；两侧都合格 → 第一间优先）
    let interior = null;
    for (const r of regions) {
      if (!r || !this._qualifies(r)) continue;
      if (!interior || r.cells.length < interior.cells.length) interior = r;
    }
    if (!interior) return null;

    const key = doorLower.join(',');
    if (this.houses.has(key)) return this.houses.get(key);

    const b = interior.bounds;
    const w = b.maxX - b.minX + 1, d = b.maxZ - b.minZ + 1;
    const house = {
      door: [...doorLower],
      anchor: this._pickAnchor(interior),
      radius: Math.max(0.8, Math.min(this.cfg.villager.wanderRadiusMax, Math.min(w, d) / 2 - 0.75)),
      bounds: b,
    };
    this.houses.set(key, house);
    this.hooks.onHouse?.(house);
    return house;
  }

  /** 单侧泛洪：可通行格 BFS；返回 {cells, bounds, enclosed}（起点即实心 → 空区域） */
  _flood(start, visited) {
    const key = (c) => c.join(',');
    visited.add(key(start));
    const h = this.cfg.house;
    const cells = [];
    const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
    let enclosed = true;
    if (!this._passable(start[0], start[1], start[2])) return { cells, bounds, enclosed };

    const queue = [start];
    while (queue.length) {
      const [x, y, z] = queue.shift();
      cells.push([x, y, z]);
      if (x < bounds.minX) bounds.minX = x; if (x > bounds.maxX) bounds.maxX = x;
      if (y < bounds.minY) bounds.minY = y; if (y > bounds.maxY) bounds.maxY = y;
      if (z < bounds.minZ) bounds.minZ = z; if (z > bounds.maxZ) bounds.maxZ = z;
      if (this._skyOpen(x, y, z)) enclosed = false;          // 头顶透天 → 室外
      if (cells.length > h.maxFloodCells) { enclosed = false; break; }  // 无界 → 室外

      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const nx = x + dx, ny = y + dy, nz = z + dz;
        if (ny < 0 || ny >= CHUNK_Y) continue;
        const nk = `${nx},${ny},${nz}`;
        if (visited.has(nk)) continue;
        visited.add(nk);
        if (!this._passable(nx, ny, nz)) continue;           // 墙/门/窗等实心 → 不入队
        queue.push([nx, ny, nz]);
      }
    }
    return { cells, bounds, enclosed };
  }

  /** 可通行（泛洪用）：空气或非实心（作物/开态门可穿过；窗/栅栏/楼梯算墙） */
  _passable(x, y, z) {
    if (y < 0 || y >= CHUNK_Y) return false;
    const id = this.world.getBlock(x, y, z);
    if (id === 0) return true;
    const def = BLOCK_DEFS[id];
    return !!def && !def.solid;
  }

  /** 头顶透天：从此格向上到顶全无遮蔽（全透明）→ 视为露天 */
  _skyOpen(x, y, z) {
    for (let yy = y + 1; yy < CHUNK_Y; yy++) if (isOpaque(this.world.getBlock(x, yy, z))) return false;
    return true;
  }

  /** 内腔是否够格成「屋子」：有界封闭 + 内部格数/占地/内高下限 */
  _qualifies(r) {
    const h = this.cfg.house;
    if (!r.enclosed || r.cells.length < h.minInteriorCells || r.cells.length > h.maxFloodCells) return false;
    const w = r.bounds.maxX - r.bounds.minX + 1;
    const d = r.bounds.maxZ - r.bounds.minZ + 1;
    const ht = r.bounds.maxY - r.bounds.minY + 1;
    return w >= h.minFootprint && d >= h.minFootprint && ht >= h.minInteriorHeight;
  }

  /** 挑落脚格：最低层、脚下实心地、最近区域中心的内格（村民 spawn 用） */
  _pickAnchor(r) {
    const cx = (r.bounds.minX + r.bounds.maxX) / 2;
    const cz = (r.bounds.minZ + r.bounds.maxZ) / 2;
    let best = r.cells[0], bestY = Infinity, bestD = Infinity;
    for (const [x, y, z] of r.cells) {
      const dd = (x - cx) ** 2 + (z - cz) ** 2;
      const floorOk = isOpaque(this.world.getBlock(x, y - 1, z));
      if (!floorOk) continue;
      if (y < bestY || (y === bestY && dd < bestD)) { best = [x, y, z]; bestY = y; bestD = dd; }
    }
    return best;
  }
}
