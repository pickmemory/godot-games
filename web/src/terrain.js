// terrain.js — 噪声地形 + 树生成（无外部依赖，内嵌 simplex 2D）
import { CHUNK_X, CHUNK_Y, CHUNK_Z, BLOCK } from './blocks.js';

/* ---------- Simplex 2D（Stefan Gustavson 公开域实现移植） ---------- */
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

function makeNoise2D(seed) {
  // 洗牌（mulberry32）
  let s = seed | 0;
  const rnd = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  return function noise2D(xin, yin) {
    const s2 = (xin + yin) * F2;
    const i = Math.floor(xin + s2), j = Math.floor(yin + s2);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = GRAD[perm[ii + perm[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * n; // ∈ 约 [-1,1]
  };
}

/* ---------- 地形参数 ---------- */
const BASE_H = 22;
const SAND_H = 15;       // 低于此高度表层为沙
const noiseCache = new Map();

function getNoise(seed) {
  let n = noiseCache.get(seed);
  if (!n) { n = makeNoise2D(seed); noiseCache.set(seed, n); }
  return n;
}

export function surfaceHeight(wx, wz, seed) {
  const n1 = getNoise(seed);
  const n2 = getNoise(seed + 777);
  const h = BASE_H
    + n1(wx * 0.012, wz * 0.012) * 10   // 大起伏
    + n2(wx * 0.05, wz * 0.05) * 3;     // 细节
  return Math.max(3, Math.min(CHUNK_Y - 8, Math.round(h)));
}

/**
 * 生成一个 chunk 的方块数据。
 * @returns {Uint8Array} 列主序 idx = x + z*16 + y*256
 */
export function generateChunk(cx, cz, seed) {
  const data = new Uint8Array(CHUNK_X * CHUNK_Y * CHUNK_Z);
  const idx = (x, y, z) => x + z * CHUNK_X + y * CHUNK_X * CHUNK_Z;

  for (let z = 0; z < CHUNK_Z; z++) {
    for (let x = 0; x < CHUNK_X; x++) {
      const wx = cx * CHUNK_X + x;
      const wz = cz * CHUNK_Z + z;
      const h = surfaceHeight(wx, wz, seed);
      const sandy = h <= SAND_H + 1;

      for (let y = 0; y <= h; y++) {
        let id;
        if (y < 2) id = BLOCK.STONE;                       // 基底
        else if (y === h) id = sandy ? BLOCK.SAND : BLOCK.GRASS;
        else if (y >= h - 3) id = sandy ? BLOCK.SAND : BLOCK.DIRT;
        else id = BLOCK.STONE;
        data[idx(x, y, z)] = id;
      }
    }
  }

  /* ---------- chunk 内确定性随机源（矿石 + 树共用） ---------- */
  let s = (seed ^ (cx * 374761393) ^ (cz * 668265263)) | 0;
  const rnd = () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* ---------- 矿石（MC-2b）：煤浅层 / 铁深层，随机游走小簇，只替换石头 ---------- */
  // 参数：[方块 id, 矿脉数, 每簇步数, yMin, yMax]（y 越界或非石头则跳过该步，保证“深层”语义）
  const ORE_RULES = [
    [BLOCK.COAL_ORE, 4, 8, 5, 30],   // 煤：浅层，量较多
    [BLOCK.IRON_ORE, 2, 6, 2, 13],   // 铁：深层稀少（需往下挖，配石镐门槛）
  ];
  for (const [oreId, veins, steps, yMin, yMax] of ORE_RULES) {
    for (let v = 0; v < veins; v++) {
      let x = Math.floor(rnd() * CHUNK_X);
      let z = Math.floor(rnd() * CHUNK_Z);
      let y = yMin + Math.floor(rnd() * (yMax - yMin + 1));
      for (let s = 0; s < steps; s++) {
        if (x >= 0 && x < CHUNK_X && z >= 0 && z < CHUNK_Z && y >= 0 && y < CHUNK_Y) {
          const i = idx(x, y, z);
          if (data[i] === BLOCK.STONE) data[i] = oreId;  // 只替换石头（不破坏表层/基底结构）
        }
        x += Math.floor(rnd() * 3) - 1;
        y += Math.floor(rnd() * 3) - 1;
        z += Math.floor(rnd() * 3) - 1;
      }
    }
  }

  /* ---------- 树（只在本 chunk 内，避免跨界写） ---------- */
  const treeCount = rnd() < 0.35 ? 0 : 1 + Math.floor(rnd() * 3); // 0~3 棵

  for (let t = 0; t < treeCount; t++) {
    const tx = 2 + Math.floor(rnd() * (CHUNK_X - 4));   // 2..13，叶团不出界
    const tz = 2 + Math.floor(rnd() * (CHUNK_Z - 4));
    const wx = cx * CHUNK_X + tx, wz = cz * CHUNK_Z + tz;
    const ground = surfaceHeight(wx, wz, seed);
    if (ground <= SAND_H + 1) continue;                  // 沙地不长树
    if (data[idx(tx, ground, tz)] !== BLOCK.GRASS) continue;

    const trunkH = 4 + Math.floor(rnd() * 3);            // 4~6
    const topY = ground + trunkH;
    if (topY + 2 >= CHUNK_Y) continue;

    // 叶团：顶两层 3×3，再上 1×1+十字
    for (let ly = topY - 1; ly <= topY + 1; ly++) {
      const r = ly === topY + 1 ? 1 : 1;
      for (let lx = tx - r; lx <= tx + r; lx++) {
        for (let lz = tz - r; lz <= tz + r; lz++) {
          if (ly === topY + 1 && Math.abs(lx - tx) + Math.abs(lz - tz) > 1) continue; // 顶十字
          const i = idx(lx, ly, lz);
          if (data[i] === BLOCK.AIR) data[i] = BLOCK.LEAVES;
        }
      }
    }
    // 树干（覆盖叶子）
    for (let y = ground + 1; y <= topY; y++) data[idx(tx, y, tz)] = BLOCK.WOOD_LOG;
  }

  return data;
}
