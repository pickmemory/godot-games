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
  // MC-4b 建造扩展：门（下/上格面板）+ 窗棂 + 栅栏（楼梯复用 PLANK）
  DOOR_LOWER: 22, DOOR_UPPER: 23, WINDOW: 24, FENCE: 25,
  // MC-5b 第二章「190·讨董」：汉代建材 + 焚洛阳世界状态残留（美术规范见 docs/design/art-bible.md §4）
  RAMMED_EARTH: 26, HAN_TILE: 27, THATCH: 28, CHARRED_WOOD: 29, ASH: 30,
  // MC-5x 照明：火把 / 篝火火焰头
  TORCH: 31, CAMPFIRE: 32,
  // MC-6 D-2 探索：汉代荒冢的陪葬陶片（十字面片；挖出可拾取收藏）
  POTTERY: 33,
};

export const BLOCK = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WOOD_LOG: 4,
  LEAVES: 5, SAND: 6, PLANK: 7, COBBLE: 8,
  COAL_ORE: 9, IRON_ORE: 10, CRAFT_TABLE: 11,
  // MC-4a 农耕（作物种类/生长时长/产出等数值在 web/data/farming.json，farming.js 消费）
  FARMLAND: 12, FARMLAND_WET: 13,
  MILLET_0: 14, MILLET_1: 15, MILLET_2: 16,       // 粟：发芽 → 抽穗 → 成熟
  GREENS_0: 17, GREENS_1: 18, GREENS_2: 19,       // 葵菜：发芽 → 展叶 → 成熟
  // MC-4b 建造扩展：门 8 态（下/上 × X/Z 朝向 × 开/合）+ 窗 + 栅栏 + 楼梯 4 朝向
  // 门 axis = 合上门板横跨的轴（X 轴门板挡 Z 向通行）；开态门板转向铰链侧（x/z=0 一侧）
  DOOR_X: 20, DOOR_X_OPEN: 21, DOOR_Z: 22, DOOR_Z_OPEN: 23,
  DOOR_X_TOP: 24, DOOR_X_TOP_OPEN: 25, DOOR_Z_TOP: 26, DOOR_Z_TOP_OPEN: 27,
  WINDOW: 28, FENCE: 29,
  STAIRS_PZ: 30, STAIRS_NZ: 31, STAIRS_PX: 32, STAIRS_NX: 33,   // 升梯方向：+Z/-Z/+X/-X
  // MC-5b 第二章方块（id 顺延；美术圣经 §4.2 变体表登记）
  RAMMED_EARTH: 34, HAN_TILE: 35, THATCH: 36, CHARRED_WOOD: 37, ASH: 38,
  // MC-5x 照明（solid=false 可穿行；shape 细几何；light 参数由 lights.js 消费为 PointLight）
  TORCH: 39, CAMPFIRE: 40,
  // MC-6 D-2 探索：陪葬陶片（荒冢封土里的汉代灰陶残片；挖出可拾取收藏，放置可陈列）
  POTTERY: 41,
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
  // MC-4b 门（双格方块）：下半/上半 × 合/开。合态全格碰撞（挡通行），开态无碰撞但 selectable（射线可选中才能关门）
  // 掉落走 building.breakDrops（拆任一半 = 整扇门一件），故 drop: 0 防 mining.js 通配双掉
  { name: '木门', solid: true,  transparent: true, hardness: 1.0, drop: 0, placeDoor: true,
    shape: 'door', door: { axis: 'x', open: false, top: false }, tiles: { top: TILE.DOOR_LOWER, side: TILE.DOOR_LOWER, bottom: TILE.DOOR_LOWER } },
  { name: '木门', solid: false, transparent: true, hardness: 1.0, drop: 0, selectable: true,
    shape: 'door', door: { axis: 'x', open: true,  top: false }, tiles: { top: TILE.DOOR_LOWER, side: TILE.DOOR_LOWER, bottom: TILE.DOOR_LOWER } },
  { name: '木门', solid: true,  transparent: true, hardness: 1.0, drop: 0, placeDoor: true,
    shape: 'door', door: { axis: 'z', open: false, top: false }, tiles: { top: TILE.DOOR_LOWER, side: TILE.DOOR_LOWER, bottom: TILE.DOOR_LOWER } },
  { name: '木门', solid: false, transparent: true, hardness: 1.0, drop: 0, selectable: true,
    shape: 'door', door: { axis: 'z', open: true,  top: false }, tiles: { top: TILE.DOOR_LOWER, side: TILE.DOOR_LOWER, bottom: TILE.DOOR_LOWER } },
  { name: '木门·上', solid: true,  transparent: true, hardness: 1.0, drop: 0,
    shape: 'door', door: { axis: 'x', open: false, top: true }, tiles: { top: TILE.DOOR_UPPER, side: TILE.DOOR_UPPER, bottom: TILE.DOOR_UPPER } },
  { name: '木门·上', solid: false, transparent: true, hardness: 1.0, drop: 0, selectable: true,
    shape: 'door', door: { axis: 'x', open: true,  top: true }, tiles: { top: TILE.DOOR_UPPER, side: TILE.DOOR_UPPER, bottom: TILE.DOOR_UPPER } },
  { name: '木门·上', solid: true,  transparent: true, hardness: 1.0, drop: 0,
    shape: 'door', door: { axis: 'z', open: false, top: true }, tiles: { top: TILE.DOOR_UPPER, side: TILE.DOOR_UPPER, bottom: TILE.DOOR_UPPER } },
  { name: '木门·上', solid: false, transparent: true, hardness: 1.0, drop: 0, selectable: true,
    shape: 'door', door: { axis: 'z', open: true,  top: true }, tiles: { top: TILE.DOOR_UPPER, side: TILE.DOOR_UPPER, bottom: TILE.DOOR_UPPER } },
  // 窗：木框棂格，棂间镂空（alphaTest 透光透视）；全格碰撞（MC 玻璃同款简化）
  { name: '木窗', solid: true, transparent: true, hardness: 0.5, tiles: { top: TILE.WINDOW, side: TILE.WINDOW, bottom: TILE.WINDOW } },
  // 栅栏：中柱细碰撞盒（1 格高简化，MC 的 1.5 格防跳留给后续）；mesher 自动连横栏
  { name: '栅栏', solid: true, transparent: true, hardness: 1.0, shape: 'fence',
    collision: [[0.375, 0, 0.375, 0.625, 1, 0.625]], tiles: { top: TILE.FENCE, side: TILE.FENCE, bottom: TILE.FENCE } },
  // 楼梯：下半满板 + 上半靠升梯方向半板；collision 双盒（player/npc 精确，mob/drop 按整格）
  { name: '木梯阶', solid: true, transparent: true, hardness: 1.0, placeStairs: true, shape: 'stairs', stairs: { dir: [0, 1] },
    collision: [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0.5, 1, 1, 1]], tiles: { top: TILE.PLANK, side: TILE.PLANK, bottom: TILE.PLANK } },
  { name: '木梯阶', solid: true, transparent: true, hardness: 1.0, drop: BLOCK.STAIRS_PZ, shape: 'stairs', stairs: { dir: [0, -1] },
    collision: [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 1, 1, 0.5]], tiles: { top: TILE.PLANK, side: TILE.PLANK, bottom: TILE.PLANK } },
  { name: '木梯阶', solid: true, transparent: true, hardness: 1.0, drop: BLOCK.STAIRS_PZ, shape: 'stairs', stairs: { dir: [1, 0] },
    collision: [[0, 0, 0, 1, 0.5, 1], [0.5, 0.5, 0, 1, 1, 1]], tiles: { top: TILE.PLANK, side: TILE.PLANK, bottom: TILE.PLANK } },
  { name: '木梯阶', solid: true, transparent: true, hardness: 1.0, drop: BLOCK.STAIRS_PZ, shape: 'stairs', stairs: { dir: [-1, 0] },
    collision: [[0, 0, 0, 1, 0.5, 1], [0, 0.5, 0, 0.5, 1, 1]], tiles: { top: TILE.PLANK, side: TILE.PLANK, bottom: TILE.PLANK } },
  // MC-5b 汉代建材（可焚性天梯：茅草 < 木板 < 夯土/汉瓦 —— 焚洛阳的生死由建材选择决定）
  { name: '夯土', solid: true, transparent: false, hardness: 0.9,
    tiles: { top: TILE.RAMMED_EARTH, side: TILE.RAMMED_EARTH, bottom: TILE.RAMMED_EARTH } },
  { name: '汉瓦', solid: true, transparent: false, hardness: 1.8, tool: 'pickaxe', minTier: 1,
    tiles: { top: TILE.HAN_TILE, side: TILE.HAN_TILE, bottom: TILE.PLANK } },
  { name: '茅草顶', solid: true, transparent: false, hardness: 0.4,
    tiles: { top: TILE.THATCH, side: TILE.THATCH, bottom: TILE.PLANK } },
  // 焚洛阳世界状态残留：焦木=烧过的木料（无掉落——烧掉的就是没了）；灰烬层=茅草/草木烧尽的地表覆盖
  { name: '焦木', solid: true, transparent: false, hardness: 0.7, drop: 0,
    tiles: { top: TILE.CHARRED_WOOD, side: TILE.CHARRED_WOOD, bottom: TILE.CHARRED_WOOD } },
  { name: '灰烬层', solid: true, transparent: false, hardness: 0.2,
    tiles: { top: TILE.ASH, side: TILE.ASH, bottom: TILE.ASH } },
  // MC-5x 照明：火把（立杆+火头，手持可照明）与篝火（三木交叉+火心，定点大光源）
  { name: '火把', solid: false, transparent: true, hardness: 0.05, selectable: true,
    shape: 'torch', light: { dist: 7.5, intensity: 1.25, color: '#ffb35c' },
    tiles: { top: TILE.TORCH, side: TILE.TORCH, bottom: TILE.TORCH } },
  { name: '篝火', solid: false, transparent: true, hardness: 0.4, selectable: true,
    shape: 'campfire', light: { dist: 15, intensity: 2.1, color: '#ff9a3c' },
    tiles: { top: TILE.CAMPFIRE, side: TILE.LOG_SIDE, bottom: TILE.LOG_SIDE } },
  // MC-6 D-2：荒冢陪葬陶片（十字面片；无工具门槛，掊土即得；掉自身=可拾取收藏）
  { name: '陪葬陶片', solid: false, transparent: true, cross: true, hardness: 0.15,
    tiles: { top: TILE.POTTERY, side: TILE.POTTERY, bottom: TILE.POTTERY } },
];

// 说明：hotbar 自 MC-2b 起由 inventory（生存行囊）驱动，不再提供创造模式固定九宫。

export function isSolid(id) { return id !== BLOCK.AIR && BLOCK_DEFS[id].solid; }
export function isOpaque(id) { return id !== BLOCK.AIR && !BLOCK_DEFS[id].transparent; }
/** 可被射线选中（实心方块 + 十字面片作物 + 开态门等细几何）：interaction.js 选块/放置防覆盖用 */
export function isInteractable(id) {
  if (id === BLOCK.AIR) return false;
  const def = BLOCK_DEFS[id];
  return def.solid || !!def.cross || !!def.selectable;
}

/* ---------- MC-4b 建造方块语义辅助（注册表派生，勿散落硬编码） ---------- */

/** 是否门方块（任一半/任一态） */
export function isDoor(id) { return id !== BLOCK.AIR && !!BLOCK_DEFS[id]?.door; }

let _doorToggleMap = null, _doorTopMap = null;
function buildDoorMaps() {
  _doorToggleMap = {}; _doorTopMap = {};
  for (const [idStr, def] of BLOCK_DEFS.entries()) {
    if (!def.door) continue;
    const id = Number(idStr);
    for (const [oidStr, odef] of BLOCK_DEFS.entries()) {
      if (!odef.door) continue;
      if (odef.door.axis === def.door.axis && odef.door.open === !def.door.open && odef.door.top === def.door.top)
        _doorToggleMap[id] = Number(oidStr);
      if (odef.door.axis === def.door.axis && odef.door.open === def.door.open && odef.door.top === !def.door.top)
        _doorTopMap[id] = Number(oidStr);
    }
  }
}

/** 开↔合同伴 id（开关门用） */
export function doorToggleId(id) {
  if (!_doorToggleMap) buildDoorMaps();
  return _doorToggleMap[id] ?? 0;
}

/** 上/下半同伴 id（放双格门用）；非门返回 0 */
export function doorTopId(id) {
  if (!_doorTopMap) buildDoorMaps();
  return _doorTopMap[id] ?? 0;
}

/** 放置朝向化 id：门按玩家视线定轴向，楼梯按视线定升梯向；普通方块原样返回 */
export function orientedPlaceId(baseId, dx, dz) {
  const def = BLOCK_DEFS[baseId];
  if (!def) return baseId;
  if (def.placeDoor) {
    // 面向墙放门：门板横跨轴 ⊥ 视线主轴（视线主 Z → 板跨 X，挡 Z 向通行）
    return Math.abs(dx) > Math.abs(dz) ? BLOCK.DOOR_Z : BLOCK.DOOR_X;
  }
  if (def.placeStairs) {
    if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? BLOCK.STAIRS_PX : BLOCK.STAIRS_NX;
    return dz > 0 ? BLOCK.STAIRS_PZ : BLOCK.STAIRS_NZ;
  }
  return baseId;
}

/** 方块碰撞盒列表（单元格内坐标 [x0,y0,z0,x1,y1,z1]）：细几何（楼梯/栅栏）精确碰撞用 */
const FULL_BOX = [[0, 0, 0, 1, 1, 1]];
const NO_BOX = [];
export function collisionBoxes(id) {
  if (id === BLOCK.AIR) return NO_BOX;
  const def = BLOCK_DEFS[id];
  if (Array.isArray(def.collision)) return def.collision;
  return def.solid ? FULL_BOX : NO_BOX;
}
