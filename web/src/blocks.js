// blocks.js — 方块注册表（数据驱动：新增方块只改这里）
// 瓦片索引对应 textures.js atlas 中的绘制顺序。
// 挖掘字段（mining.js 公式消费）：
//   tool: 适用工具类（'pickaxe' | null=徒手即可）；minTier: 建议工具等级
//   drop: 掉落物品 id（数字；0=无掉落；缺省=掉自身）；minDropTier: 掉落所需最低工具等级
import { ITEM } from './items.js';

export const CHUNK_X = 16;
export const CHUNK_Y = 64;
export const CHUNK_Z = 16;
export const CHUNK_VOL = CHUNK_X * CHUNK_Y * CHUNK_Z;

// 瓦片表（atlas 内序号）
export const TILE = {
  GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3,
  LOG_SIDE: 4, LOG_TOP: 5, LEAVES: 6, SAND: 7,
  PLANK: 8, COBBLE: 9,
  COAL_ORE: 10, IRON_ORE: 11, TABLE_TOP: 12, TABLE_SIDE: 13,
  // MC-4a 农耕：耕地（干/湿）+ 作物三阶段（十字面片，透明底）
  FARMLAND: 14, FARMLAND_WET: 15,
  MILLET_0: 16, MILLET_1: 17, MILLET_2: 18,
  GREENS_0: 19, GREENS_1: 20, GREENS_2: 21,
};

export const BLOCK = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WOOD_LOG: 4,
  LEAVES: 5, SAND: 6, PLANK: 7, COBBLE: 8,
  COAL_ORE: 9, IRON_ORE: 10, CRAFT_TABLE: 11,
  // MC-4a 农耕（作物种类/生长时长/产出等数值在 web/data/farming.json，farming.js 消费）
  FARMLAND: 12, FARMLAND_WET: 13,
  MILLET_0: 14, MILLET_1: 15, MILLET_2: 16,       // 粟：发芽 → 抽穗 → 成熟
  GREENS_0: 17, GREENS_1: 18, GREENS_2: 19,       // 葵菜：发芽 → 展叶 → 成熟
};

// 索引 = 方块 id。hardness: 基础挖掘秒数（徒手）。
export const BLOCK_DEFS = [
  { name: '空气',   solid: false, transparent: true,  hardness: 0,    tiles: null },
  { name: '草方块', solid: true,  transparent: false, hardness: 0.45, drop: BLOCK.DIRT,   tiles: { top: TILE.GRASS_TOP, side: TILE.GRASS_SIDE, bottom: TILE.DIRT } },
  { name: '泥土',   solid: true,  transparent: false, hardness: 0.5,  tiles: { top: TILE.DIRT, side: TILE.DIRT, bottom: TILE.DIRT } },
  { name: '石头',   solid: true,  transparent: false, hardness: 1.5,  tool: 'pickaxe', minTier: 1, drop: BLOCK.COBBLE, tiles: { top: TILE.STONE, side: TILE.STONE, bottom: TILE.STONE } },
  { name: '原木',   solid: true,  transparent: false, hardness: 1.0,  tiles: { top: TILE.LOG_TOP, side: TILE.LOG_SIDE, bottom: TILE.LOG_TOP } },
  { name: '树叶',   solid: true,  transparent: true,  hardness: 0.2,  drop: 0, tiles: { top: TILE.LEAVES, side: TILE.LEAVES, bottom: TILE.LEAVES } },
  { name: '沙子',   solid: true,  transparent: false, hardness: 0.4,  tiles: { top: TILE.SAND, side: TILE.SAND, bottom: TILE.SAND } },
  { name: '木板',   solid: true,  transparent: false, hardness: 1.0,  tiles: { top: TILE.PLANK, side: TILE.PLANK, bottom: TILE.PLANK } },
  { name: '圆石',   solid: true,  transparent: false, hardness: 1.6,  tool: 'pickaxe', minTier: 1, tiles: { top: TILE.COBBLE, side: TILE.COBBLE, bottom: TILE.COBBLE } },
  { name: '煤矿石', solid: true,  transparent: false, hardness: 3.0,  tool: 'pickaxe', minTier: 1, drop: ITEM.COAL, tiles: { top: TILE.COAL_ORE, side: TILE.COAL_ORE, bottom: TILE.COAL_ORE } },
  { name: '铁矿石', solid: true,  transparent: false, hardness: 3.0,  tool: 'pickaxe', minTier: 2, minDropTier: 2, tiles: { top: TILE.IRON_ORE, side: TILE.IRON_ORE, bottom: TILE.IRON_ORE } },
  { name: '工作台', solid: true,  transparent: false, hardness: 1.2,  tiles: { top: TILE.TABLE_TOP, side: TILE.TABLE_SIDE, bottom: TILE.PLANK } },
  // MC-4a 耕地：锄头开垦（farming.js till）；挖掘掉泥土；湿/干由 farming.js 水分逻辑切换
  { name: '耕地',     solid: true, transparent: false, hardness: 0.5, drop: BLOCK.DIRT, tiles: { top: TILE.FARMLAND, side: TILE.DIRT, bottom: TILE.DIRT } },
  { name: '湿润耕地', solid: true, transparent: false, hardness: 0.5, drop: BLOCK.DIRT, tiles: { top: TILE.FARMLAND_WET, side: TILE.DIRT, bottom: TILE.DIRT } },
  // MC-4a 作物：cross=true → mesher 十字面片渲染；solid=false 可穿行；掉落由 farming.js 特判（成熟才有产出）
  { name: '粟·发芽', solid: false, transparent: true, cross: true, hardness: 0.05, drop: 0, tiles: { top: TILE.MILLET_0, side: TILE.MILLET_0, bottom: TILE.MILLET_0 } },
  { name: '粟·抽穗', solid: false, transparent: true, cross: true, hardness: 0.05, drop: 0, tiles: { top: TILE.MILLET_1, side: TILE.MILLET_1, bottom: TILE.MILLET_1 } },
  { name: '粟·成熟', solid: false, transparent: true, cross: true, hardness: 0.05, drop: 0, tiles: { top: TILE.MILLET_2, side: TILE.MILLET_2, bottom: TILE.MILLET_2 } },
  { name: '葵菜·发芽', solid: false, transparent: true, cross: true, hardness: 0.05, drop: 0, tiles: { top: TILE.GREENS_0, side: TILE.GREENS_0, bottom: TILE.GREENS_0 } },
  { name: '葵菜·展叶', solid: false, transparent: true, cross: true, hardness: 0.05, drop: 0, tiles: { top: TILE.GREENS_1, side: TILE.GREENS_1, bottom: TILE.GREENS_1 } },
  { name: '葵菜·成熟', solid: false, transparent: true, cross: true, hardness: 0.05, drop: 0, tiles: { top: TILE.GREENS_2, side: TILE.GREENS_2, bottom: TILE.GREENS_2 } },
];

// 说明：hotbar 自 MC-2b 起由 inventory（生存行囊）驱动，不再提供创造模式固定九宫。

export function isSolid(id) { return id !== BLOCK.AIR && BLOCK_DEFS[id].solid; }
export function isOpaque(id) { return id !== BLOCK.AIR && !BLOCK_DEFS[id].transparent; }
/** 可被射线选中（实心方块 + 十字面片作物）：interaction.js 选块/放置防覆盖用 */
export function isInteractable(id) { return id !== BLOCK.AIR && (BLOCK_DEFS[id].solid || !!BLOCK_DEFS[id].cross); }
