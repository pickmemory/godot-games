// explore.js — MC-6 D-2 世界探索结构：残破烽燧 / 汉代荒冢 / 巨木 / 河滩卵石 + 罗盘目标查询
//
// 职责边界（模块间只经导出签名通信）：
//   - **纯函数模块**：不 import THREE、不碰 DOM（ExploredMemory 对 localStorage 做存在性降级），
//     因而在 Node 里可直接 import 做确定性无头验证（tools/verify-explore.mjs A 组）。
//   - 结构分布：每类结构按「region 网格 + 确定性哈希抖动」在世界锚定唯一落点（同 seed 可复现）；
//     锚点解析只依赖 terrain.surfaceHeight（与 chunk 生成同源噪声），不读 chunk 数据 →
//     罗盘无需加载 chunk 即可指向远方结构（O(region 数) 哈希，禁止全图扫描）。
//   - 落成方式：**烘焙进 chunk 基线**——world._generate 在 generateChunk 之后、存档差分重放之前
//     调用 stampExplore。与 structure.js 的 stampStructure（章节事件结构：模板 JSON，走
//     world.setBlock 落差分、开卷后数帧"长"出来）互补：世界分布结构随 chunk 流式即到即有、
//     不产生差分、不需重网格化，玩家改动经差分自然覆盖结构方块（save 兼容）。
//   - 烽燧顶部篝火 = 普通 CAMPFIRE 方块，lights.js 的 0.6s 光源扫描自动点亮（夜间远见火光）。
//
// 数据：web/data/structures/explore.json（schema 见同目录 README.md）；缺文件/离线 → FALLBACK_EXPLORE 同构兜底。

import { BLOCK, CHUNK_X, CHUNK_Y, CHUNK_Z } from './blocks.js';
import { surfaceHeight } from './terrain.js';

/* ---------- 兜底配置（与 web/data/structures/explore.json 同构；字段说明见 README.md） ---------- */
export const FALLBACK_EXPLORE = {
  keepout: { x: 8, z: 8, radius: 64 },          // 出生村禁建区（结构不与新手区/章节锚点打架）
  compass: { searchRadius: 384, markRadius: 14 }, // 罗盘搜索半径（格）/ 已探判定半径（格）
  types: [
    {
      id: 'beacon-tower', name: '残破烽燧', shape: 'beacon', region: 12, chance: 0.8,
      terrain: { minGround: 16, maxGround: 34, maxSlope: 4 },
      params: { minHeight: 3, maxHeight: 5, footprint: 2, speckle: 0.15, rubble: 0.12, ruinRate: 0.3 },
    },
    {
      id: 'han-mound', name: '汉代荒冢', shape: 'mound', region: 7, chance: 0.7,
      terrain: { minGround: 16, maxGround: 30, maxSlope: 3 },
      params: { minRadius: 4, maxRadius: 6, minHeight: 3, maxHeight: 5, shardsMin: 2, shardsMax: 4 },
    },
    {
      id: 'great-oak', name: '巨木', shape: 'greatree', region: 5, chance: 0.75,
      terrain: { minGround: 18, maxGround: 29, maxSlope: 3 },
      params: { minTrunk: 5, maxTrunk: 8, canopy: [2, 3, 4, 4, 3, 2] },
    },
    {
      id: 'river-pebbles', name: '河滩卵石', shape: 'pebbles',
      params: { chance: 0.55, cobbleRate: 0.32, raisedRate: 0.05 },
    },
  ],
};

/* ---------- 确定性哈希（与 terrain.colHash 同族：坐标 → [0,1)，纯函数） ---------- */
function hash2(a, b, seed) {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ (seed | 0);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 字符串 → 稳定盐（类型间哈希相位错开用） */
function saltOf(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193);
  return h >>> 0;
}

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const intIn = (v, lo, hi, d) => Math.max(lo, Math.min(hi, Math.round(num(v, d))));

/* ---------- 配置规整（幂等；WeakMap 按对象身份缓存，JSON 只规整一次） ---------- */
const _normCache = new WeakMap();

function normalizeExplore(raw) {
  if (!raw || typeof raw !== 'object') return null;
  let n = _normCache.get(raw);
  if (n) return n;

  const types = [];
  for (const t of Array.isArray(raw.types) ? raw.types : []) {
    if (!t || typeof t !== 'object' || !t.id || !t.shape) continue;
    types.push({
      id: String(t.id),
      name: String(t.name ?? t.id),
      shape: String(t.shape),
      region: intIn(t.region, 2, 64, 8),                    // region 边长（chunk 数）
      chance: Math.max(0, Math.min(1, num(t.chance, 0.7))), // region 占据率
      terrain: {
        minGround: intIn(t.terrain?.minGround, 1, CHUNK_Y - 10, 1),
        maxGround: intIn(t.terrain?.maxGround, 1, CHUNK_Y - 2, CHUNK_Y - 4),
        maxSlope: intIn(t.terrain?.maxSlope, 0, 16, 4),
      },
      params: (t.params && typeof t.params === 'object') ? t.params : {},
    });
  }

  const k = raw.keepout;
  n = {
    types,
    anchored: types.filter((t) => t.shape !== 'pebbles'),   // 有锚点、上罗盘的结构
    pebbles: types.find((t) => t.shape === 'pebbles') ?? null, // chunk 内饰面（无锚点，不上罗盘）
    keepout: (k && Number.isFinite(Number(k.x)) && Number.isFinite(Number(k.z)))
      ? { x: Math.round(Number(k.x)), z: Math.round(Number(k.z)), radius: Math.max(0, num(k.radius, 0)) }
      : null,
    compass: {
      searchRadius: Math.max(64, num(raw.compass?.searchRadius, 384)),
      markRadius: Math.max(2, num(raw.compass?.markRadius, 14)),
    },
  };
  _normCache.set(raw, n);
  return n;
}

/* ---------- 锚点解析（region 网格 + 抖动 + 地形校验；结果缓存） ---------- */
// 缓存键含 seed：Node 验证可能对多 seed 反复调用。
const _regionCache = new Map();   // `${seed}:${typeId}:${rx},${rz}` → instance|null

function buildInstance(type, cx, cz, lx, lz, seed, cfg) {
  const ax = cx * CHUNK_X + lx, az = cz * CHUNK_Z + lz;
  const g = surfaceHeight(ax, az, seed);

  // 出生村禁建区
  const ko = cfg.keepout;
  if (ko && (ax - ko.x) ** 2 + (az - ko.z) ** 2 < ko.radius * ko.radius) return null;
  // 地表高度带 + 坡度（±3 格采样，与 chunk 生成同源的确定性噪声）
  if (g < type.terrain.minGround || g > type.terrain.maxGround) return null;
  for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
    if (Math.abs(surfaceHeight(ax + dx, az + dz, seed) - g) > type.terrain.maxSlope) return null;
  }

  // 形状参数的确定性随机源（同 seed 同实例恒定）
  const s = saltOf(type.id);
  return {
    key: `${type.id}:${ax},${az}`,
    id: type.id, name: type.name, shape: type.shape,
    cx, cz, ax, az, ground: g,
    h: [
      hash2(ax, az, seed ^ s),
      hash2(ax + 101, az, seed ^ s),
      hash2(ax, az + 101, seed ^ s),
    ],
    cells: null,   // 惰性：首次落成/校验时生成
  };
}

/** region → 该 region 的结构实例（无则 null）；缓存（含 seed 键） */
function instanceFor(type, rx, rz, seed, cfg) {
  const key = `${seed}:${type.id}:${rx},${rz}`;
  if (_regionCache.has(key)) return _regionCache.get(key);

  let inst = null;
  const salt = saltOf(type.id) | 0;
  if (hash2(rx, rz, seed ^ 0x9e3779b9 ^ salt) < type.chance) {
    // region 内抖动选锚定 chunk（每 region 至多 1 个实例 → 结构间距有下限）
    const jx = Math.floor(hash2(rx * 3 + 11, rz, seed ^ salt ^ 0x1b873593) * type.region);
    const jz = Math.floor(hash2(rx, rz * 3 + 29, seed ^ salt ^ 0xcc9e2d51) * type.region);
    const cx = rx * type.region + jx, cz = rz * type.region + jz;
    // chunk 内锚点留边（3..12），保证跨界溢出 ≤ 1 chunk（stampExplore 邻域 ±1 覆盖）
    const lx = 3 + Math.floor(hash2(cx, cz, seed ^ salt ^ 0x51ab) * 10);
    const lz = 3 + Math.floor(hash2(cx + 7, cz + 13, seed ^ salt ^ 0x77aa) * 10);
    inst = buildInstance(type, cx, cz, lx, lz, seed, cfg);
  }
  if (_regionCache.size > 2048) _regionCache.clear();   // 实际常驻 ≤ 数十；防御性上限
  _regionCache.set(key, inst);
  return inst;
}

/**
 * chunk (cx,cz) 是否锚定了某类结构；是 → 返回实例（含世界锚点/名称），否 → null。
 * 纯哈希 + surfaceHeight，O(1)；供 stampExplore 与测试/罗盘共用。
 */
export function anchorAt(cfg, typeId, cx, cz, seed) {
  const c = normalizeExplore(cfg);
  const type = c?.anchored.find((t) => t.id === typeId);
  if (!type) return null;
  const rx = Math.floor(cx / type.region), rz = Math.floor(cz / type.region);
  const inst = instanceFor(type, rx, rz, seed, c);
  return inst && inst.cx === cx && inst.cz === cz ? inst : null;
}

/* ---------- 形状生成器：产世界坐标格列表 [wx, wy, wz, 方块id, hard]
 *   hard=true 无条件写（塔身/封土/树干——整平语义）；hard=false 只写进空气（篝火/碎石/树冠/露根）。 */

function genBeacon(inst, p, seed) {
  const R = intIn(p.footprint, 1, 3, 2);
  const minH = intIn(p.minHeight, 2, 8, 3), maxH = intIn(p.maxHeight, minH, 8, 5);
  const H = minH + Math.floor(inst.h[0] * (maxH - minH + 1));       // 3~5 格夯土塔
  const speckle = Math.max(0, Math.min(1, num(p.speckle, 0.15)));
  const rubble = Math.max(0, Math.min(1, num(p.rubble, 0.12)));
  const ruinRate = Math.max(0, Math.min(1, num(p.ruinRate, 0.3)));
  const cells = [];
  const { ax, az, ground } = inst;

  for (let dz = -R; dz <= R; dz++) {
    for (let dx = -R; dx <= R; dx++) {
      const cheb = Math.max(Math.abs(dx), Math.abs(dz));
      const gl = surfaceHeight(ax + dx, az + dz, seed);              // 逐列落地（坡地自然错层）
      // 残破：外圈列随机缺 1 格豁口（中心列保满高——火台要站得住）
      const ruin = cheb > 0 && hash2(ax + dx, az + dz, seed ^ 0x5151) < ruinRate ? 1 : 0;
      const edge = cheb === R ? 1 : 0;
      const colH = Math.max(1, H - edge - ruin);
      for (let y = 1; y <= colH; y++) {
        const id = hash2(ax + dx + y * 17, az + dz, seed ^ 0x71f1a) < speckle
          ? BLOCK.COBBLE : BLOCK.RAMMED_EARTH;                       // 风化斑驳
        cells.push([ax + dx, gl + y, az + dz, id, true]);
      }
    }
  }
  // 顶部火光：中心柱顶上的篝火（lights.js 光源扫描自动点亮，夜间远可见）
  cells.push([ax, ground + H + 1, az, BLOCK.CAMPFIRE, false]);
  // 塔基散落碎石（soft：不啃地形）
  for (let dz = -(R + 2); dz <= R + 2; dz++) {
    for (let dx = -(R + 2); dx <= R + 2; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) <= R) continue;
      if (hash2(ax + dx, az + dz, seed ^ 0x9911) >= rubble) continue;
      const gl = surfaceHeight(ax + dx, az + dz, seed);
      cells.push([ax + dx, gl + 1, az + dz, BLOCK.COBBLE, false]);
    }
  }
  return cells;
}

function genMound(inst, p, seed) {
  const minR = intIn(p.minRadius, 2, 8, 4), maxR = intIn(p.maxRadius, minR, 10, 6);
  const minH = intIn(p.minHeight, 1, 8, 3), maxH = intIn(p.maxHeight, minH, 10, 5);
  const r = minR + Math.floor(inst.h[0] * (maxR - minR + 1));
  const H = minH + Math.floor(inst.h[1] * (maxH - minH + 1));
  const shardsMin = intIn(p.shardsMin, 0, 8, 2), shardsMax = intIn(p.shardsMax, shardsMin, 12, 4);
  const cells = [];
  const { ax, az } = inst;
  const domeAt = (dx, dz) => Math.max(1, Math.round((1 - (dx * dx + dz * dz) / (r * r)) * H));

  // 封土堆：圆丘（表草内土；hard 整平语义——压过原生草皮）
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r) continue;
      const dh = domeAt(dx, dz);
      const gl = surfaceHeight(ax + dx, az + dz, seed);
      for (let i = 0; i < dh; i++) {
        cells.push([ax + dx, gl + i, az + dz, i === dh - 1 ? BLOCK.GRASS : BLOCK.DIRT, true]);
      }
    }
  }
  // 陪葬陶片：第 1 片嵌在封土表面（可望见的引子），其余埋在土里（挖开封土才见）
  const n = shardsMin + Math.floor(inst.h[2] * (shardsMax - shardsMin + 1));
  for (let i = 0; i < n; i++) {
    const ang = hash2(ax + i * 31, az, seed ^ 0x3333) * Math.PI * 2;
    const dist = Math.sqrt(hash2(ax, az + i * 47, seed ^ 0x4444)) * (r - 1.2);
    const sx = Math.round(Math.cos(ang) * dist), sz = Math.round(Math.sin(ang) * dist);
    if (sx * sx + sz * sz > r * r) continue;
    const dh = domeAt(sx, sz);
    const gl = surfaceHeight(ax + sx, az + sz, seed);
    cells.push([ax + sx, gl + (i === 0 ? dh - 1 : dh - 2), az + sz, BLOCK.POTTERY, true]);
  }
  return cells;
}

function genGreatree(inst, p, seed) {
  const minT = intIn(p.minTrunk, 3, 12, 5), maxT = intIn(p.maxTrunk, minT, 16, 8);
  const trunkH = minT + Math.floor(inst.h[0] * (maxT - minT + 1));  // 5~8 格巨木
  const canopy = (Array.isArray(p.canopy) && p.canopy.length)
    ? p.canopy.map((v) => intIn(v, 0, 5, 2)) : [2, 3, 4, 4, 3, 2];
  const cells = [];
  const { ax, az, ground } = inst;

  // 露根：主干四斜角偶发短木桩（soft，不啃地形）
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    if (hash2(ax + dx, az + dz, seed ^ 0x66cc) < 0.6) {
      cells.push([ax + dx, ground + 1, az + dz, BLOCK.WOOD_LOG, false]);
    }
  }
  // 树干（hard）
  for (let y = 1; y <= trunkH; y++) cells.push([ax, ground + y, az, BLOCK.WOOD_LOG, true]);
  // 大树冠：圆盘层叠（soft 只写空气 → 不啃山体/相邻结构）
  const cy = ground + trunkH;
  for (let i = 0; i < canopy.length; i++) {
    const ly = cy - 2 + i, rr = canopy[i];
    if (rr <= 0 || ly <= ground + 1) continue;
    for (let dz = -rr; dz <= rr; dz++) {
      for (let dx = -rr; dx <= rr; dx++) {
        if (dx * dx + dz * dz > rr * rr + 1) continue;               // 圆冠（角修剪）
        cells.push([ax + dx, ly, az + dz, BLOCK.LEAVES, false]);
      }
    }
  }
  return cells;
}

function genCells(inst, type, seed) {
  switch (type.shape) {
    case 'beacon': return genBeacon(inst, type.params, seed);
    case 'mound': return genMound(inst, type.params, seed);
    case 'greatree': return genGreatree(inst, type.params, seed);
    default: return [];
  }
}

/* ---------- chunk 烘焙入口（world._generate 在差分重放前调用） ---------- */
/**
 * 把探索结构写进 chunk 方块基线（列主序 idx = x + z·16 + y·256）。
 * 确定性：同 (cx,cz,seed,cfg) 产出恒定 → 存档差分重放语义稳定。
 * @param {Uint8Array} data generateChunk 的产出（会被原地修改）
 * @returns {number} 写入格数（诊断用）
 */
export function stampExplore(data, cx, cz, seed, cfg) {
  const c = normalizeExplore(cfg);
  if (!c) return 0;
  const ox = cx * CHUNK_X, oz = cz * CHUNK_Z;
  let written = 0;

  // 1) 河滩卵石：沿水位线的圆石/沙混合带（chunk 内饰面；地表是沙 = 在水位线带内，天然沿水线）
  if (c.pebbles) {
    const p = c.pebbles.params;
    const chance = Math.max(0, Math.min(1, num(p.chance, 0.55)));
    const cobbleRate = Math.max(0, Math.min(1, num(p.cobbleRate, 0.32)));
    const raisedRate = Math.max(0, Math.min(1, num(p.raisedRate, 0.05)));
    if (hash2(cx, cz, seed ^ 0x7717) < chance) {
      for (let z = 0; z < CHUNK_Z; z++) {
        for (let x = 0; x < CHUNK_X; x++) {
          const wx = ox + x, wz = oz + z;
          const h = surfaceHeight(wx, wz, seed);
          if (h < 1 || h >= CHUNK_Y - 2) continue;
          const i = x + z * CHUNK_X + h * CHUNK_X * CHUNK_Z;
          if (data[i] !== BLOCK.SAND) continue;                      // 只动水位线沙面
          if (hash2(wx, wz, seed ^ 0xbeac0) < cobbleRate) {
            data[i] = BLOCK.COBBLE; written++;
          } else if (hash2(wx, wz, seed ^ 0xfeed1) < raisedRate && data[i + CHUNK_X * CHUNK_Z] === BLOCK.AIR) {
            data[i + CHUNK_X * CHUNK_Z] = BLOCK.COBBLE; written++;   // 突起卵石
          }
        }
      }
    }
  }

  // 2) 锚定结构：扫描本 chunk ±1 邻域内锚定的实例，跨界部分落到本 chunk
  //    （锚点 chunk 内留边 3..12 + 最大半径 5 → 溢出 ≤ 1 chunk，邻域 ±1 恰好覆盖）
  for (const type of c.anchored) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const inst = anchorAt(c, type.id, cx + dx, cz + dz, seed);
        if (!inst) continue;
        if (!inst.cells) inst.cells = genCells(inst, type, seed);
        for (const [wx, wy, wz, id, hard] of inst.cells) {
          const lx = wx - ox, lz = wz - oz;
          if (lx < 0 || lx >= CHUNK_X || lz < 0 || lz >= CHUNK_Z) continue;
          if (wy < 1 || wy >= CHUNK_Y - 1) continue;
          const i = lx + lz * CHUNK_X + wy * CHUNK_X * CHUNK_Z;
          if (hard || data[i] === BLOCK.AIR) { data[i] = id; written++; }
        }
      }
    }
  }
  return written;
}

/* ---------- 罗盘 ---------- */

/** 玩家 → 目标的方位角（世界系；yaw 同 player.yaw 约定：0 = 朝 -Z，atan2(-dx,-dz)） */
export function bearingTo(px, pz, tx, tz) {
  return Math.atan2(-(tx - px), -(tz - pz));
}

/**
 * 最近未探索结构（罗盘目标）。region 窗口解析锚点，纯哈希 + 少量 surfaceHeight 采样，
 * 不读 chunk 数据、不全图扫描。
 * @param {(key:string)=>boolean} [isExplored] 已探过滤（main.js 传 ExploredMemory.has）
 * @returns {{key,id,name,x,z,ground}|null} x/z 为锚点格中心
 */
export function nearestTarget(cfg, px, pz, seed, isExplored) {
  const c = normalizeExplore(cfg);
  if (!c || !c.anchored.length) return null;
  const R = c.compass.searchRadius;
  let best = null, bestD2 = R * R;
  for (const type of c.anchored) {
    const rw = type.region * CHUNK_X;   // region 世界边长
    const rx0 = Math.floor((px - R) / rw), rx1 = Math.floor((px + R) / rw);
    const rz0 = Math.floor((pz - R) / rw), rz1 = Math.floor((pz + R) / rw);
    for (let rz = rz0; rz <= rz1; rz++) {
      for (let rx = rx0; rx <= rx1; rx++) {
        const inst = instanceFor(type, rx, rz, seed, c);
        if (!inst || (isExplored && isExplored(inst.key))) continue;
        const d2 = (inst.ax + 0.5 - px) ** 2 + (inst.az + 0.5 - pz) ** 2;
        if (d2 < bestD2) { bestD2 = d2; best = inst; }
      }
    }
  }
  if (!best) return null;
  return { key: best.key, id: best.id, name: best.name, x: best.ax + 0.5, z: best.az + 0.5, ground: best.ground };
}

/* ---------- 已探记忆（localStorage；Node/隐私模式降级内存） ---------- */
export class ExploredMemory {
  /** @param {string} storageKey 建议含 seed（不同世界各自成册） */
  constructor(storageKey) {
    this.key = storageKey;
    this.set = new Set();
    try {
      const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem(storageKey) : null;
      if (raw) for (const k of JSON.parse(raw)) if (typeof k === 'string') this.set.add(k);
    } catch { /* 坏 JSON/隐私模式 → 空册起 */ }
  }
  has(k) { return this.set.has(k); }
  /** @returns {boolean} 是否新标记（false = 已在册） */
  add(k) {
    if (this.set.has(k)) return false;
    this.set.add(k);
    this._flush();
    return true;
  }
  clear() { this.set.clear(); this._flush(); }
  _flush() {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(this.key, JSON.stringify([...this.set]));
    } catch { /* 配额满/不可用：记忆只在本次会话生效，不阻塞玩法 */ }
  }
}
