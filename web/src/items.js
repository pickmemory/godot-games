// items.js — 非方块物品注册表（数据驱动：工具/材料；方块物品沿用方块 id，<100）
// 本模块不依赖任何其他游戏模块（blocks.js 反向引用本文件的 ITEM 常量，避免环）。

/** 工具/材料物品 id（方块物品 id = 方块 id，从 1 起；此处从 100 起避免冲突） */
export const ITEM = {
  PICK_WOOD: 100,   // 木镐 tier 1
  PICK_STONE: 101,  // 石镐 tier 2
  PICK_IRON: 102,   // 铁镐 tier 3
  COAL: 103,        // 煤炭（挖煤矿石掉落；燃料用途留给后续熔炉）
  STICK: 104,       // 木棍
  // MC-4a 农耕：锄 + 作物产出/种子（生长/产出/回血数值在 web/data/farming.json）
  HOE_WOOD: 105,    // 木锄 tier 1（锄地）
  HOE_STONE: 106,   // 石锄 tier 2
  MILLET: 107,      // 粟米（可食用）
  MILLET_SEED: 108, // 粟种（可播种）
  GREENS: 109,      // 葵菜（可食用）
  GREENS_SEED: 110, // 葵菜种（可播种）
};

/**
 * 物品定义。索引 = 物品 id（>=100）。
 * - kind: 'tool' | 'material'
 * - tool: 适用工具类（与 BLOCK_DEFS.tool 匹配）
 * - tier: 工具等级（1木/2石/3铁），speed: 挖掘速度倍率（见 mining.js 公式）
 * - maxStack: 最大堆叠
 */
export const ITEM_DEFS = {
  [ITEM.PICK_WOOD]:  { name: '木镐', kind: 'tool', tool: 'pickaxe', tier: 1, speed: 2.0, maxStack: 1 },
  [ITEM.PICK_STONE]: { name: '石镐', kind: 'tool', tool: 'pickaxe', tier: 2, speed: 4.0, maxStack: 1 },
  [ITEM.PICK_IRON]:  { name: '铁镐', kind: 'tool', tool: 'pickaxe', tier: 3, speed: 6.0, maxStack: 1 },
  [ITEM.COAL]:       { name: '煤炭', kind: 'material', maxStack: 64 },
  [ITEM.STICK]:      { name: '木棍', kind: 'material', maxStack: 64 },
  // MC-4a：tool='hoe' 与 farming.json till.tool 匹配；food/seed 的数值清 farming.json
  [ITEM.HOE_WOOD]:   { name: '木锄', kind: 'tool', tool: 'hoe', tier: 1, speed: 2.0, maxStack: 1 },
  [ITEM.HOE_STONE]:  { name: '石锄', kind: 'tool', tool: 'hoe', tier: 2, speed: 4.0, maxStack: 1 },
  [ITEM.MILLET]:       { name: '粟米',   kind: 'food', maxStack: 64 },
  [ITEM.MILLET_SEED]:  { name: '粟种',   kind: 'seed', maxStack: 64 },
  [ITEM.GREENS]:       { name: '葵菜',   kind: 'food', maxStack: 64 },
  [ITEM.GREENS_SEED]:  { name: '葵菜种', kind: 'seed', maxStack: 64 },
};

export function isToolItem(id) { return id >= 100 && ITEM_DEFS[id]?.kind === 'tool'; }
export function maxStackOf(id) { return id >= 100 ? (ITEM_DEFS[id]?.maxStack ?? 64) : 64; }

/* ---------- 像素图标（hotbar/合成面板占位美术；Kenney 接入留给 MC-5a） ---------- */

function paintPick(ctx, ox, oy, px, headCol, stickCol, headDark) {
  const put = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x * px, oy + y * px, px, px); };
  // 镐头（弧形）
  for (let x = 3; x <= 8; x++) { put(x, 0, headCol); put(x, 1, x % 3 === 0 ? headDark : headCol); }
  put(2, 1, headCol); put(2, 2, headCol); put(9, 1, headCol); put(9, 2, headCol);
  put(1, 2, headCol); put(1, 3, headCol); put(1, 4, headCol);
  put(10, 2, headCol); put(10, 3, headCol); put(10, 4, headCol);
  put(0, 4, headDark); put(0, 5, headDark); put(0, 6, headDark);
  put(11, 4, headDark); put(11, 5, headDark); put(11, 6, headDark);
  // 柄（右上→左下斜线，2px 粗）
  for (let i = 0; i < 8; i++) {
    const x = 8 - i, y = 3 + i;
    put(x, y, stickCol); put(x + 1, y, stickCol);
  }
}

/** 锄：斜柄 + 底端横刃（与镐同柄色，刃色随等级） */
function paintHoe(ctx, ox, oy, px, bladeCol, stickCol) {
  const put = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x * px, oy + y * px, px, px); };
  for (let i = 0; i < 8; i++) {
    const x = 8 - i, y = 3 + i;
    put(x, y, stickCol); put(x + 1, y, stickCol);
  }
  // 刃：斜柄底端向右下的宽扁刃
  put(2, 10, bladeCol); put(3, 10, bladeCol); put(4, 10, bladeCol);
  put(3, 11, bladeCol); put(4, 11, bladeCol); put(5, 11, bladeCol);
  put(1, 9, bladeCol);
}

/** 穗/叶/种子像素图（透明底） */
function paintPixels(ctx, ox, oy, px, pixels) {
  for (const [x, y, c] of pixels) { ctx.fillStyle = c; ctx.fillRect(ox + x * px, oy + y * px, px, px); }
}

const ICON_PIXELS = {
  [ITEM.MILLET]: [ // 粟米：金色穗串
    [6, 2, '#e8c454'], [7, 2, '#e8c454'], [5, 3, '#e8c454'], [6, 3, '#d8a835'], [7, 3, '#e8c454'], [8, 3, '#e8c454'],
    [5, 4, '#d8a835'], [6, 4, '#d8a835'], [7, 4, '#e8c454'], [8, 4, '#d8a835'],
    [6, 5, '#d8a835'], [7, 5, '#d8a835'], [6, 6, '#b8922a'], [7, 6, '#d8a835'],
    [6, 7, '#8a6d3b'], [7, 7, '#8a6d3b'], [6, 8, '#8a6d3b'], [7, 8, '#8a6d3b'],
  ],
  [ITEM.MILLET_SEED]: [ // 粟种：散落的谷粒
    [4, 7, '#c9a24a'], [5, 7, '#c9a24a'], [7, 6, '#c9a24a'], [8, 6, '#c9a24a'],
    [5, 9, '#b59240'], [6, 9, '#b59240'], [7, 9, '#b59240'], [8, 9, '#c9a24a'],
  ],
  [ITEM.GREENS]: [ // 葵菜：绿叶 + 白梗
    [5, 3, '#4e9c3a'], [6, 3, '#5cab45'], [7, 3, '#4e9c3a'],
    [4, 4, '#5cab45'], [5, 4, '#4e9c3a'], [6, 4, '#6cbb52'], [7, 4, '#4e9c3a'], [8, 4, '#5cab45'],
    [4, 5, '#4e9c3a'], [5, 5, '#5cab45'], [7, 5, '#4e9c3a'], [8, 5, '#4e9c3a'],
    [6, 6, '#cfe0c0'], [6, 7, '#cfe0c0'], [5, 8, '#cfe0c0'], [7, 8, '#cfe0c0'],
    [5, 9, '#e8f0dc'], [6, 9, '#e8f0dc'], [7, 9, '#e8f0dc'],
  ],
  [ITEM.GREENS_SEED]: [ // 葵菜种：深色小粒
    [4, 7, '#6d8f3a'], [5, 7, '#6d8f3a'], [7, 6, '#5a7a30'], [8, 6, '#6d8f3a'],
    [5, 9, '#5a7a30'], [6, 9, '#6d8f3a'], [7, 9, '#5a7a30'], [8, 9, '#6d8f3a'],
  ],
};

/** 非方块物品图标绘制到 2D canvas（方块物品请用 textures.drawTileTo） */
export function drawItemIcon(ctx, itemId, dx, dy, dw, dh) {
  const px = dw / 12;
  const ox = dx, oy = dy;
  switch (itemId) {
    case ITEM.PICK_WOOD:
      paintPick(ctx, ox, oy, px, '#9a7b4f', '#6b4a2b', '#7d6240'); break;
    case ITEM.PICK_STONE:
      paintPick(ctx, ox, oy, px, '#8f8f8f', '#6b4a2b', '#6f6f6f'); break;
    case ITEM.PICK_IRON:
      paintPick(ctx, ox, oy, px, '#d9d9d9', '#6b4a2b', '#b0b0b0'); break;
    case ITEM.HOE_WOOD:
      paintHoe(ctx, ox, oy, px, '#9a7b4f', '#6b4a2b'); break;
    case ITEM.HOE_STONE:
      paintHoe(ctx, ox, oy, px, '#8f8f8f', '#6b4a2b'); break;
    case ITEM.MILLET: case ITEM.MILLET_SEED: case ITEM.GREENS: case ITEM.GREENS_SEED:
      paintPixels(ctx, ox, oy, px, ICON_PIXELS[itemId]); break;
    case ITEM.COAL: {
      const put = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x * px, oy + y * px, px, px); };
      const blob = [
        [4, 3], [5, 3], [6, 3], [7, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 5], [8, 5],
        [3, 5], [4, 5], [5, 5], [6, 5], [7, 6], [8, 6], [4, 6], [5, 6], [6, 6], [7, 7], [8, 7],
        [5, 7], [6, 7], [5, 8], [6, 8],
      ];
      blob.forEach(([x, y], i) => put(x, y, i % 5 === 0 ? '#3a3a3a' : '#1d1d1d'));
      break;
    }
    case ITEM.STICK: {
      const put = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x * px, oy + y * px, px, px); };
      for (let i = 0; i < 8; i++) {
        const x = 8 - i, y = 3 + i;
        put(x, y, '#8a6d3b'); put(x + 1, y, '#6b4a2b');
      }
      break;
    }
    default: {
      ctx.fillStyle = '#c33';
      ctx.fillRect(dx, dy, dw, dh);
    }
  }
}
