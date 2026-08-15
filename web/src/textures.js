// textures.js — 纹理 atlas：程序化 canvas 像素绘制（占位美术）。
// TODO(美术接入): Kenney Voxel Pack 贴图替换本函数绘制逻辑时，保持 TILE 序号与 atlas 布局不变。
import * as THREE from 'three';
import { TILE } from './blocks.js';

const TILE_PX = 16;          // 每瓦片像素
const TILES_PER_ROW = 4;     // atlas 一行 4 瓦片
const TILE_TOTAL = Math.max(...Object.values(TILE)) + 1;   // 瓦片总数（atlas 高度随之伸缩）
const ATLAS_ROWS = Math.ceil(TILE_TOTAL / TILES_PER_ROW);
const ATLAS_PX = TILE_PX * TILES_PER_ROW;
const ATLAS_H = TILE_PX * ATLAS_ROWS;

// 确定性伪随机（每次刷新纹理一致）
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex, amt) {
  // hex '#rrggbb'，amt ∈ [-1,1]
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt * 255));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt * 255));
  const b = Math.max(0, Math.min(255, (n & 255) + amt * 255));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// 每瓦片绘制器：在 (ox,oy) 起 16×16 区域画像素
const PAINTERS = {
  [TILE.GRASS_TOP]: (ctx, ox, oy, rnd) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      ctx.fillStyle = shade('#5d9c3f', (rnd() - 0.5) * 0.22);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  [TILE.GRASS_SIDE]: (ctx, ox, oy, rnd) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const grassDepth = 3 + ((x * 7 + 3) % 3); // 草皮锯齿深度 3~5
      const base = y < grassDepth ? '#5d9c3f' : '#7a5335';
      ctx.fillStyle = shade(base, (rnd() - 0.5) * 0.2);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  [TILE.DIRT]: (ctx, ox, oy, rnd) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      ctx.fillStyle = shade('#7a5335', (rnd() - 0.5) * 0.24);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  [TILE.STONE]: (ctx, ox, oy, rnd) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      ctx.fillStyle = shade('#8a8a8a', (rnd() - 0.5) * 0.18);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  [TILE.LOG_SIDE]: (ctx, ox, oy, rnd) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const stripe = ((x + 1) % 5 === 0) ? -0.16 : (rnd() - 0.5) * 0.14;
      ctx.fillStyle = shade('#6b4a2b', stripe);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  [TILE.LOG_TOP]: (ctx, ox, oy, rnd) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const ring = (Math.floor(d) % 2 === 0) ? 0.08 : -0.06;
      ctx.fillStyle = shade('#a37b4d', ring + (rnd() - 0.5) * 0.1);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  [TILE.LEAVES]: (ctx, ox, oy, rnd) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const hole = rnd() < 0.12;
      ctx.fillStyle = hole ? 'rgba(0,0,0,0)' : shade('#3e7a2e', (rnd() - 0.5) * 0.3);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  [TILE.SAND]: (ctx, ox, oy, rnd) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      ctx.fillStyle = shade('#d9c47f', (rnd() - 0.5) * 0.14);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  [TILE.PLANK]: (ctx, ox, oy, rnd) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const seam = (y % 5 === 4) ? -0.18 : ((x + y * 3) % 8 === 0 ? -0.08 : (rnd() - 0.5) * 0.1);
      ctx.fillStyle = shade('#b08a52', seam);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  [TILE.COBBLE]: (ctx, ox, oy, rnd) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      // 圆石块感：4×4 子块明暗错落 + 深缝
      const bx = Math.floor(x / 4), by = Math.floor(y / 4);
      const sub = ((bx * 3 + by * 5) % 4) * 0.05 - 0.08;
      const seam = (x % 4 === 0 || y % 4 === 0) ? -0.22 : (rnd() - 0.5) * 0.12;
      ctx.fillStyle = shade('#7d7d7d', sub + seam);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  [TILE.COAL_ORE]: (ctx, ox, oy, rnd) => {
    // 石底 + 黑煤斑团（2×2/3×2 簇，确定性伪随机保证同 seed 一致）
    const specks = [];
    for (let i = 0; i < 5; i++) {
      const sx = 1 + Math.floor(rnd() * 12), sy = 1 + Math.floor(rnd() * 12);
      const w = 2 + Math.floor(rnd() * 2), h = 2;
      specks.push([sx, sy, w, h]);
    }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      ctx.fillStyle = shade('#8a8a8a', (rnd() - 0.5) * 0.18);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
    for (const [sx, sy, w, h] of specks) {
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        ctx.fillStyle = shade('#232323', (rnd() - 0.5) * 0.2);
        ctx.fillRect(ox + Math.min(15, sx + dx), oy + Math.min(15, sy + dy), 1, 1);
      }
    }
  },
  [TILE.IRON_ORE]: (ctx, ox, oy, rnd) => {
    // 石底 + 锈铁矿斑（土黄颗粒簇）
    const specks = [];
    for (let i = 0; i < 5; i++) {
      const sx = 1 + Math.floor(rnd() * 12), sy = 1 + Math.floor(rnd() * 12);
      specks.push([sx, sy, 2 + Math.floor(rnd() * 2), 2]);
    }
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      ctx.fillStyle = shade('#8a8a8a', (rnd() - 0.5) * 0.18);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
    for (const [sx, sy, w, h] of specks) {
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        ctx.fillStyle = shade('#c99a68', (rnd() - 0.5) * 0.25);
        ctx.fillRect(ox + Math.min(15, sx + dx), oy + Math.min(15, sy + dy), 1, 1);
      }
    }
  },
  [TILE.TABLE_TOP]: (ctx, ox, oy, rnd) => {
    // 木板底 + 中央 2×2 工作格（十字缝）
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const seam = (y % 5 === 4) ? -0.18 : ((x + y * 3) % 8 === 0 ? -0.08 : (rnd() - 0.5) * 0.1);
      ctx.fillStyle = shade('#b08a52', seam);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
    for (let y = 3; y <= 12; y++) for (let x = 3; x <= 12; x++) {
      const grid = (x === 3 || x === 12 || y === 3 || y === 12 || x === 7 || x === 8 || y === 7 || y === 8) ? -0.3 : -0.05;
      ctx.fillStyle = shade('#8f6c3e', grid + (rnd() - 0.5) * 0.08);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  [TILE.TABLE_SIDE]: (ctx, ox, oy, rnd) => {
    // 木板底 + 台面横沿 + 挂着的锯/锯痕占位纹理
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let v = (y % 5 === 4) ? -0.18 : ((x + y * 3) % 8 === 0 ? -0.08 : (rnd() - 0.5) * 0.1);
      if (y < 3) v = -0.28;                       // 台面厚沿
      if (y >= 5 && y <= 11 && x >= 3 && x <= 12) v = ((x * 2 + y) % 5 === 0) ? -0.32 : -0.02; // 工具压痕
      ctx.fillStyle = shade('#b08a52', v);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  /* ---------- MC-4a 农耕瓦片 ---------- */
  [TILE.FARMLAND]: (ctx, ox, oy, rnd) => {
    // 泥土底 + 竖向犁沟（深色差沟垄）
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const furrow = (x % 4 === 1) ? -0.2 : (x % 4 === 3 ? 0.06 : 0);
      ctx.fillStyle = shade('#6e4a2e', furrow + (rnd() - 0.5) * 0.14);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  [TILE.FARMLAND_WET]: (ctx, ox, oy, rnd) => {
    // 同犁沟但整体深湿（近黑褐）
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const furrow = (x % 4 === 1) ? -0.18 : (x % 4 === 3 ? 0.05 : 0);
      ctx.fillStyle = shade('#4a3018', furrow + (rnd() - 0.5) * 0.12);
      ctx.fillRect(ox + x, oy + y, 1, 1);
    }
  },
  // 作物：透明底 + 植株像素（alphaTest 材质雔空）；阶段递进 = 变高变密，成熟换色
  [TILE.MILLET_0]: (ctx, ox, oy, rnd) => {   // 粟·发芽：两三撮小绿尖
    const sprouts = [[3, 12], [7, 11], [11, 12]];
    for (const [sx, sy] of sprouts) {
      ctx.fillStyle = shade('#6cbb52', (rnd() - 0.5) * 0.2);
      ctx.fillRect(ox + sx, oy + sy, 1, 1);
      ctx.fillRect(ox + sx + 1, oy + sy, 1, 1);
      ctx.fillStyle = '#4e9c3a';
      ctx.fillRect(ox + sx, oy + sy - 1, 1, 1);
    }
  },
  [TILE.MILLET_1]: (ctx, ox, oy, rnd) => {   // 粟·抽穗：细长绿叶丛
    const stalks = [[2, 8], [5, 7], [8, 8], [11, 7], [13, 9]];
    for (const [sx, sy] of stalks) {
      for (let y = sy; y < 15; y++) {
        ctx.fillStyle = shade((y - sy) % 3 === 0 ? '#6cbb52' : '#4e9c3a', (rnd() - 0.5) * 0.18);
        ctx.fillRect(ox + sx + (y % 2 === 0 ? 0 : 0), oy + y, 1, 1);
      }
    }
  },
  [TILE.MILLET_2]: (ctx, ox, oy, rnd) => {   // 粟·成熟：金黄穗头压弯
    const stalks = [[2, 7], [5, 6], [8, 7], [11, 6]];
    for (const [sx, sy] of stalks) {
      for (let y = sy; y < 15; y++) {
        ctx.fillStyle = shade('#8a8f3a', (rnd() - 0.5) * 0.15);  // 秆微黄
        ctx.fillRect(ox + sx, oy + y, 1, 1);
      }
      // 穗头：饱满下垂的金粒
      ctx.fillStyle = '#d8a835';
      ctx.fillRect(ox + sx, oy + sy, 2, 2);
      ctx.fillStyle = '#e8c454';
      ctx.fillRect(ox + sx + 1, oy + sy + 1, 2, 2);
      ctx.fillStyle = '#b8922a';
      ctx.fillRect(ox + sx, oy + sy + 2, 1, 1);
    }
  },
  [TILE.GREENS_0]: (ctx, ox, oy, rnd) => {   // 葵菜·发芽：两片子叶
    ctx.fillStyle = '#5cab45';
    ctx.fillRect(ox + 6, oy + 11, 1, 1); ctx.fillRect(ox + 9, oy + 11, 1, 1);
    ctx.fillStyle = '#4e9c3a';
    ctx.fillRect(ox + 7, oy + 12, 2, 1); ctx.fillRect(ox + 7, oy + 11, 2, 1);
  },
  [TILE.GREENS_1]: (ctx, ox, oy, rnd) => {   // 葵菜·展叶：莲座状圆叶
    for (let y = 8; y < 15; y++) for (let x = 3; x < 13; x++) {
      const dx = x - 7.5, dy = y - 12;
      const ring = Math.hypot(dx, dy * 1.4);
      if (ring < 4.4 && rnd() > 0.18) {
        ctx.fillStyle = shade(ring < 2 ? '#6cbb52' : '#4e9c3a', (rnd() - 0.5) * 0.2);
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  },
  [TILE.GREENS_2]: (ctx, ox, oy, rnd) => {   // 葵菜·成熟：大叶片 + 白梗
    for (let y = 6; y < 16; y++) for (let x = 2; x < 14; x++) {
      const dx = x - 7.5, dy = y - 13;
      const ring = Math.hypot(dx, dy * 1.15);
      if (ring < 5.6 && rnd() > 0.14) {
        ctx.fillStyle = shade(ring < 2.5 ? '#6cbb52' : '#3f8a30', (rnd() - 0.5) * 0.22);
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
    // 中心白梗（葵菜特征）
    ctx.fillStyle = '#cfe0c0';
    ctx.fillRect(ox + 7, oy + 12, 2, 4);
    ctx.fillRect(ox + 5, oy + 11, 2, 1); ctx.fillRect(ox + 9, oy + 11, 2, 1);
  },
};

let cached = null;

/**
 * 构建（并缓存）atlas 纹理与瓦片颜色表。
 * @returns {{ texture: THREE.CanvasTexture, tilesPerRow: number, tilePx: number,
 *             tileColors: string[] }}  tileColors[瓦片序号] = '#rrggbb' 平均色（粒子用）
 */
export function buildAtlas() {
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_PX; canvas.height = ATLAS_H;
  const ctx = canvas.getContext('2d');

  for (const [key, paint] of Object.entries(PAINTERS)) {
    const t = Number(key);
    const ox = (t % TILES_PER_ROW) * TILE_PX;
    const oy = Math.floor(t / TILES_PER_ROW) * TILE_PX;
    const rnd = mulberry32(9000 + t * 131);
    paint(ctx, ox, oy, rnd);
  }

  // 每瓦片平均色（供粒子/缩略图底色）
  const tileColors = [];
  for (let t = 0; t < TILE_TOTAL; t++) {
    const ox = (t % TILES_PER_ROW) * TILE_PX, oy = Math.floor(t / TILES_PER_ROW) * TILE_PX;
    const d = ctx.getImageData(ox, oy, TILE_PX, TILE_PX).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40) continue; // 跳过透明像素
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    n = Math.max(1, n);
    tileColors.push(`#${(r / n | 0).toString(16).padStart(2, '0')}${(g / n | 0).toString(16).padStart(2, '0')}${(b / n | 0).toString(16).padStart(2, '0')}`);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  cached = { texture, tilesPerRow: TILES_PER_ROW, tilePx: TILE_PX, tileColors, canvas };
  return cached;
}

/* ---------- 挖掘裂纹分段贴图（MC-2c 手感打磨） ---------- */

let crackCache = null;

/**
 * 构建（并缓存）挖掘裂纹分段贴图。
 * 阶段累积：第 s 段 = 前 s-1 段全部裂纹 + 新增裂纹（同一确定性随机序列的前缀），
 * 视觉上裂纹随挖掘进度逐段加深扩展。裂纹画在透明底上，由 interaction.js
 * 叠在被挖方块位置（略放大的盒体 + polygonOffset 防 z-fighting）。
 * @param {number} stageCount 分段数（默认 8）
 * @returns {THREE.CanvasTexture[]} 长度 stageCount，索引 = 已完成阶段-1
 */
export function buildCrackTextures(stageCount = 8) {
  if (crackCache && crackCache.length === stageCount) return crackCache;
  const textures = [];
  for (let s = 0; s < stageCount; s++) {
    const cv = document.createElement('canvas');
    cv.width = TILE_PX; cv.height = TILE_PX;
    const ctx = cv.getContext('2d');
    const rnd = mulberry32(20240829); // 各阶段同一随机序列 → 裂纹前缀累积
    const branches = 2 + Math.floor(s * 1.6); // 分支数随阶段增长
    ctx.strokeStyle = 'rgba(16,12,8,0.85)';
    ctx.lineWidth = 1;
    for (let b = 0; b < branches; b++) {
      let x = 2 + rnd() * 12, y = 2 + rnd() * 12;
      const segs = 2 + Math.floor(rnd() * 4);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y + 0.5);
      for (let i = 0; i < segs; i++) {
        x += (rnd() - 0.5) * 7; y += (rnd() - 0.5) * 7;
        ctx.lineTo(
          Math.max(0.5, Math.min(TILE_PX - 0.5, x + 0.5)),
          Math.max(0.5, Math.min(TILE_PX - 0.5, y + 0.5)),
        );
      }
      ctx.stroke();
    }
    const t = new THREE.CanvasTexture(cv);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    textures.push(t);
  }
  crackCache = textures;
  return textures;
}

/** 把某瓦片画到目标 2D canvas（hotbar 缩略图用） */
export function drawTileTo(ctx2d, tileIndex, dx, dy, dw, dh) {
  const { canvas } = buildAtlas();
  const ox = (tileIndex % TILES_PER_ROW) * TILE_PX;
  const oy = Math.floor(tileIndex / TILES_PER_ROW) * TILE_PX;
  ctx2d.imageSmoothingEnabled = false;
  ctx2d.drawImage(canvas, ox, oy, TILE_PX, TILE_PX, dx, dy, dw, dh);
}
