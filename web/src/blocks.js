// blocks.js — 方块注册表（数据驱动：新增方块只改这里）
// 瓦片索引对应 textures.js atlas 中的绘制顺序。

export const CHUNK_X = 16;
export const CHUNK_Y = 64;
export const CHUNK_Z = 16;
export const CHUNK_VOL = CHUNK_X * CHUNK_Y * CHUNK_Z;

// 瓦片表（atlas 内序号）
export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3,
  LOG_SIDE: 4, LOG_TOP: 5, LEAVES: 6, SAND: 7,
  PLANK: 8, COBBLE: 9,
};

export const BLOCK = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WOOD_LOG: 4,
  LEAVES: 5, SAND: 6, PLANK: 7, COBBLE: 8,
};

// 索引 = 方块 id。hardness: 基础挖掘秒数（徒手）。
export const BLOCK_DEFS = [
  { name: '空气',   solid: false, transparent: true,  hardness: 0,    tiles: null },
  { name: '草方块', solid: true,  transparent: false, hardness: 0.45, tiles: { top: TILE.GRASS_TOP, side: TILE.GRASS_SIDE, bottom: TILE.DIRT } },
  { name: '泥土',   solid: true,  transparent: false, hardness: 0.5,  tiles: { top: TILE.DIRT, side: TILE.DIRT, bottom: TILE.DIRT } },
  { name: '石头',   solid: true,  transparent: false, hardness: 1.5,  tiles: { top: TILE.STONE, side: TILE.STONE, bottom: TILE.STONE } },
  { name: '原木',   solid: true,  transparent: false, hardness: 1.0,  tiles: { top: TILE.LOG_TOP, side: TILE.LOG_SIDE, bottom: TILE.LOG_TOP } },
  { name: '树叶',   solid: true,  transparent: true,  hardness: 0.2,  tiles: { top: TILE.LEAVES, side: TILE.LEAVES, bottom: TILE.LEAVES } },
  { name: '沙子',   solid: true,  transparent: false, hardness: 0.4,  tiles: { top: TILE.SAND, side: TILE.SAND, bottom: TILE.SAND } },
  { name: '木板',   solid: true,  transparent: false, hardness: 1.0,  tiles: { top: TILE.PLANK, side: TILE.PLANK, bottom: TILE.PLANK } },
  { name: '圆石',   solid: true,  transparent: false, hardness: 1.6,  tiles: { top: TILE.COBBLE, side: TILE.COBBLE, bottom: TILE.COBBLE } },
];

// Hotbar 默认九宫（方块 id 序列）
export const HOTBAR = [BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.WOOD_LOG, BLOCK.LEAVES, BLOCK.PLANK, BLOCK.COBBLE, BLOCK.SAND, BLOCK.GRASS];

export function isSolid(id) { return id !== BLOCK.AIR && BLOCK_DEFS[id].solid; }
export function isOpaque(id) { return id !== BLOCK.AIR && !BLOCK_DEFS[id].transparent; }
