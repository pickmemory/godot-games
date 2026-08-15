// items.js — 非方块物品注册表（数据驱动：工具/材料；方块物品沿用方块 id，<100）
// 本模块不依赖任何其他游戏模块（blocks.js 反向引用本文件的 ITEM 常量，避免环）。

/** 工具/材料物品 id（方块物品 id = 方块 id，从 1 起；此处从 100 起避免冲突） */
export const ITEM = {
  PICK_WOOD: 100,   // 木镐 tier 1
  PICK_STONE: 101,  // 石镐 tier 2
  PICK_IRON: 102,   // 铁镐 tier 3
  COAL: 103,        // 煤炭（挖煤矿石掉落；燃料用途留给后续熔炉）
  STICK: 104,       // 木棍
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
