// mesher.js — 面剔除网格化：只生成暴露面，合并为单个 BufferGeometry（每 chunk 一次 draw call）
import { BLOCK_DEFS, BLOCK, isOpaque } from './blocks.js';
import { BAND_TILES } from './textures.js';   // D-1 色彩带变体瓦片（追加瓦片，不动 blocks.js 注册表）

// 六面定义：dir 法线；corners 为块内 4 角（CCW，三角 0,1,2 / 2,1,3）；
// uv 为瓦片内局部坐标（v=1 是瓦片图像上缘）
const FACES = [
  { // -X 左（面在 x=0 平面）
    dir: [-1, 0, 0],
    corners: [
      { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [0, 0, 1], uv: [1, 0] },
    ],
  },
  { // +X 右（面在 x=1 平面）
    dir: [1, 0, 0],
    corners: [
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] },
      { pos: [1, 0, 0], uv: [1, 0] },
    ],
  },
  { // -Y 底
    dir: [0, -1, 0],
    corners: [
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] },
      { pos: [0, 0, 0], uv: [0, 1] },
    ],
  },
  { // +Y 顶
    dir: [0, 1, 0],
    corners: [
      { pos: [0, 1, 1], uv: [1, 1] },
      { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 0] },
    ],
  },
  { // -Z 后
    dir: [0, 0, -1],
    corners: [
      { pos: [1, 0, 0], uv: [0, 0] },
      { pos: [0, 0, 0], uv: [1, 0] },
      { pos: [1, 1, 0], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 1] },
    ],
  },
  { // +Z 前
    dir: [0, 0, 1],
    corners: [
      { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 1], uv: [1, 0] },
      { pos: [0, 1, 1], uv: [0, 1] },
      { pos: [1, 1, 1], uv: [1, 1] },
    ],
  },
];

const PAD = 1 / 512; // atlas 采样内缩，防边缘渗色

/**
 * 通用子盒体：在单元格内画一个任意尺寸盒（门板/楼梯/栅栏等细几何）。
 * 六面全出，但贴_cell 边界的面若邻块不透明则剔除（与整块面剔除同规则）；
 * 块内面子（如楼梯踏面）不剔除。每面 UV 用整瓦片（薄棱边呈压缩纹理，可接受）。
 * @param {number} x y z   chunk 内坐标
 * @param {[number,number,number]} min max 盒体两角（单元格内 0..1）
 */
function addBox(x, y, z, min, max, tile, tilesPerRow, world, ox, oz, positions, normals, uvs, indices) {
  const tc = tile % tilesPerRow;
  const tr = Math.floor(tile / tilesPerRow);
  const u0 = tc / tilesPerRow + PAD, u1 = (tc + 1) / tilesPerRow - PAD;
  const v1 = 1 - tr / tilesPerRow - PAD;
  const v0 = 1 - (tr + 1) / tilesPerRow + PAD;

  for (const face of FACES) {
    const [dx, dy, dz] = face.dir;
    // 面所在平面（盒内坐标）：负向面贴 min，正向面贴 max
    const plane = dx !== 0 ? (dx < 0 ? min[0] : max[0])
      : dy !== 0 ? (dy < 0 ? min[1] : max[1])
      : (dz < 0 ? min[2] : max[2]);
    // 贴单元格边界的面：邻块不透明则剔除（与整块同规则）
    if (plane === 0 || plane === 1) {
      const nb = world.getBlock(ox + x + dx, y + dy, oz + z + dz);
      if (nb !== 0 && isOpaque(nb)) continue;
    }
    const base = positions.length / 3;
    for (const c of face.corners) {
      positions.push(
        x + (c.pos[0] ? max[0] : min[0]),
        y + (c.pos[1] ? max[1] : min[1]),
        z + (c.pos[2] ? max[2] : min[2]),
      );
      normals.push(dx, dy, dz);
      uvs.push(u0 + c.uv[0] * (u1 - u0), v0 + c.uv[1] * (v1 - v0));
    }
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  }
}

/** 门板盒：合态横跨 axis 轴（厚 3/16 居中），开态转向铰链侧（axis 垂向的 0 端） */
function doorBox(def) {
  const T = 0.1875, C0 = 0.5 - T / 2, C1 = 0.5 + T / 2;
  if (def.door.axis === 'x') {
    return def.door.open ? [[0, 0, 0], [T, 1, 1]] : [[0, 0, C0], [1, 1, C1]];
  }
  return def.door.open ? [[0, 0, 0], [1, 1, T]] : [[C0, 0, 0], [C1, 1, 1]];
}

/** 栅栏：中柱 + 四向自动连横栏（邻栅栏或不透明实心块才连） */
function addFence(x, y, z, def, tilesPerRow, world, ox, oz, P, N, U, I) {
  const tile = def.tiles.side;
  const W0 = 0.375, W1 = 0.625;   // 中柱截面
  const R0 = 0.4375, R1 = 0.5625; // 横栏截面厚
  addBox(x, y, z, [W0, 0, W0], [W1, 1, W1], tile, tilesPerRow, world, ox, oz, P, N, U, I);
  const conn = (dx, dz) => {
    const nb = world.getBlock(ox + x + dx, y, oz + z + dz);
    if (nb === 0) return false;
    const d = BLOCK_DEFS[nb];
    return d.shape === 'fence' || (d.solid && !d.transparent);
  };
  for (const [ry0, ry1] of [[0.375, 0.5], [0.65625, 0.78125]]) {
    if (conn(1, 0))  addBox(x, y, z, [W1, ry0, R0], [1, ry1, R1], tile, tilesPerRow, world, ox, oz, P, N, U, I);
    if (conn(-1, 0)) addBox(x, y, z, [0, ry0, R0], [W0, ry1, R1], tile, tilesPerRow, world, ox, oz, P, N, U, I);
    if (conn(0, 1))  addBox(x, y, z, [R0, ry0, W1], [R1, ry1, 1], tile, tilesPerRow, world, ox, oz, P, N, U, I);
    if (conn(0, -1)) addBox(x, y, z, [R0, ry0, 0], [R1, ry1, W0], tile, tilesPerRow, world, ox, oz, P, N, U, I);
  }
}

/** 十字面片：两条对角竖面（内缩 0.15 格），各 emitted 正反两份；法线统一朝上保光照均匀 */
function addCross(x, y, z, tile, tilesPerRow, positions, normals, uvs, indices) {
  const lo = 0.15, hi = 0.85;
  const tc = tile % tilesPerRow;
  const tr = Math.floor(tile / tilesPerRow);
  const u0 = tc / tilesPerRow + PAD, u1 = (tc + 1) / tilesPerRow - PAD;
  const v1 = 1 - tr / tilesPerRow - PAD;
  const v0 = 1 - (tr + 1) / tilesPerRow + PAD;
  // 两面：A 从 (lo,lo)→(hi,hi)，B 从 (hi,lo)→(lo,hi)；每面四顶点，反向复用同一组顶点换绕序
  const planes = [
    [[lo, lo], [hi, hi]],
    [[hi, lo], [lo, hi]],
  ];
  for (const [[ax, az], [bx, bz]] of planes) {
    const base = positions.length / 3;
    // 顶点：底a、底b、顶a、顶b（uv：底=瓦片下缘，顶=瓦片上缘）
    positions.push(x + ax, y, z + az, x + bx, y, z + bz, x + ax, y + 1, z + az, x + bx, y + 1, z + bz);
    for (let i = 0; i < 4; i++) normals.push(0, 1, 0);
    uvs.push(u0, v0, u1, v0, u0, v1, u1, v1);
    indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);   // 正面
    indices.push(base, base + 2, base + 1, base + 2, base + 3, base + 1);   // 背面（反绕）
  }
}

/**
 * 构建一个 chunk 的几何。
 * @param {Uint8Array} data   列主序方块数据（idx = x + z*16 + y*256）
 * @param {WorldLike} world   只需 getBlock(gx,gy,gz) → number（世界坐标；未加载返回 AIR）
 * @param {number} cx cz      chunk 世界原点 = (cx*16, 0, cz*16)
 * @param {number} tilesPerRow atlas 每行瓦片数
 * @param {{grass: Uint8Array, leaves: Uint8Array}} [bands]
 *        D-1 色彩带列索引表（terrain.chunkColorBands 产出，world 每 chunk 缓存一份；
 *        缺省时回退基准瓦片，兼容旧调用）
 * @returns {{positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint32Array}}
 */
export function buildChunkGeometry(data, world, cx, cz, tilesPerRow, bands) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const ox = cx * 16, oz = cz * 16;

  const idx = (x, y, z) => x + z * 16 + y * 256;

  for (let y = 0; y < 64; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const id = data[idx(x, y, z)];
        if (id === 0) continue;
        const def = BLOCK_DEFS[id];

        // 十字面片（作物）：两条对角竖面 ×正反两次（单面材质，双面可见），不参与邻面剔除
        if (def.cross) {
          addCross(x, y, z, def.tiles.side, tilesPerRow, positions, normals, uvs, indices);
          continue;
        }

        // MC-4b 细几何（门/楼梯/栅栏）：子盒体拼接，仍并入同一 BufferGeometry（单 draw call/chunk 不变）
        if (def.shape === 'door') {
          const [min, max] = doorBox(def);
          addBox(x, y, z, min, max, def.tiles.side, tilesPerRow, world, ox, oz, positions, normals, uvs, indices);
          continue;
        }
        if (def.shape === 'stairs') {
          const [dx, dz] = def.stairs.dir;
          // 下半满板 + 上半靠升梯方向半板（dir=+Z → 高半在 z 0.5..1）
          addBox(x, y, z, [0, 0, 0], [1, 0.5, 1], def.tiles.side, tilesPerRow, world, ox, oz, positions, normals, uvs, indices);
          const hx0 = dx > 0 ? 0.5 : 0, hx1 = dx < 0 ? 0.5 : 1;
          const hz0 = dz > 0 ? 0.5 : 0, hz1 = dz < 0 ? 0.5 : 1;
          addBox(x, y, z, [hx0, 0.5, hz0], [hx1, 1, hz1], def.tiles.side, tilesPerRow, world, ox, oz, positions, normals, uvs, indices);
          continue;
        }
        if (def.shape === 'fence') {
          addFence(x, y, z, def, tilesPerRow, world, ox, oz, positions, normals, uvs, indices);
          continue;
        }
        // MC-5x 照明细几何：火把（立杆+火头盒）与篝火（三木交叉+火心盒）——不参与邻面剔除，全画
        if (def.shape === 'torch') {
          const C0 = 0.4375, C1 = 0.5625;   // 中柱�?2/16
          addBox(x, y, z, [C0, 0, C0], [C1, 0.62, C1], def.tiles.side, tilesPerRow, world, ox, oz, positions, normals, uvs, indices);
          addBox(x, y, z, [C0 - 0.0625, 0.62, C0 - 0.0625], [C1 + 0.0625, 0.78, C1 + 0.0625], def.tiles.top, tilesPerRow, world, ox, oz, positions, normals, uvs, indices);
          continue;
        }
        if (def.shape === 'campfire') {
          const T = 0.1875;                 // 圆木截面厚 3/16
          addBox(x, y, z, [0, 0.05, 0.5 - T / 2], [1, 0.3, 0.5 + T / 2], def.tiles.side, tilesPerRow, world, ox, oz, positions, normals, uvs, indices);
          addBox(x, y, z, [0.5 - T / 2, 0.05, 0], [0.5 + T / 2, 0.3, 1], def.tiles.side, tilesPerRow, world, ox, oz, positions, normals, uvs, indices);
          addBox(x, y, z, [0.14, 0.02, 0.14], [0.86, 0.24, 0.86], def.tiles.bottom, tilesPerRow, world, ox, oz, positions, normals, uvs, indices);
          addBox(x, y, z, [0.3, 0.24, 0.3], [0.7, 0.66, 0.7], def.tiles.top, tilesPerRow, world, ox, oz, positions, normals, uvs, indices);  // 火心（篝火瓦片）
          continue;
        }

        for (const face of FACES) {
          const nb = world.getBlock(ox + x + face.dir[0], y + face.dir[1], oz + z + face.dir[2]);
          // 可见：邻块为空气，或邻块透明且与本块不同类
          if (nb !== 0 && (isOpaque(nb) || nb === id)) continue;

          const isTop = face.dir[1] === 1, isSide = face.dir[1] === 0;
          let tile = isTop ? def.tiles.top
            : face.dir[1] === -1 ? def.tiles.bottom
            : def.tiles.side;
          // D-1 色彩带：草/叶按列带索引换变体瓦片（查表 O(1)，不重采样噪声；底面泥土不变色）
          if (bands) {
            const vi = x + z * 16;
            if (id === BLOCK.GRASS) {
              if (isTop) tile = BAND_TILES.GRASS_TOP[bands.grass[vi]];
              else if (isSide) tile = BAND_TILES.GRASS_SIDE[bands.grass[vi]];
            } else if (id === BLOCK.LEAVES) {
              tile = BAND_TILES.LEAVES[bands.leaves[vi]];
            }
          }
          const tc = tile % tilesPerRow;               // 瓦片列
          const tr = Math.floor(tile / tilesPerRow);   // 瓦片行
          const u0 = tc / tilesPerRow + PAD, u1 = (tc + 1) / tilesPerRow - PAD;
          const v1 = 1 - tr / tilesPerRow - PAD;       // 瓦片上缘（flipY 后）
          const v0 = 1 - (tr + 1) / tilesPerRow + PAD; // 瓦片下缘

          const base = positions.length / 3;
          for (const c of face.corners) {
            positions.push(x + c.pos[0], y + c.pos[1], z + c.pos[2]);
            normals.push(face.dir[0], face.dir[1], face.dir[2]);
            uvs.push(u0 + c.uv[0] * (u1 - u0), v0 + c.uv[1] * (v1 - v0));
          }
          indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
        }
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  };
}
