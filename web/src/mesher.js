// mesher.js — 面剔除网格化：只生成暴露面，合并为单个 BufferGeometry（每 chunk 一次 draw call）
import { BLOCK_DEFS, isOpaque } from './blocks.js';

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
 * 构建一个 chunk 的几何。
 * @param {Uint8Array} data   列主序方块数据（idx = x + z*16 + y*256）
 * @param {WorldLike} world   只需 getBlock(gx,gy,gz) → number（世界坐标；未加载返回 AIR）
 * @param {number} cx cz      chunk 世界原点 = (cx*16, 0, cz*16)
 * @param {number} tilesPerRow atlas 每行瓦片数
 * @returns {{positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint32Array}}
 */
export function buildChunkGeometry(data, world, cx, cz, tilesPerRow) {
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

        for (const face of FACES) {
          const nb = world.getBlock(ox + x + face.dir[0], y + face.dir[1], oz + z + face.dir[2]);
          // 可见：邻块为空气，或邻块透明且与本块不同类
          if (nb !== 0 && (isOpaque(nb) || nb === id)) continue;

          const tile = face.dir[1] === 1 ? def.tiles.top
            : face.dir[1] === -1 ? def.tiles.bottom
            : def.tiles.side;
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
