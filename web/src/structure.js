// structure.js — MC-5b 结构落成（数据驱动：结构模板 JSON → 世界方块批量写入）
//
// 职责边界（模块间只经导出签名通信）：
//   - 本模块只做「把模板写进世界」：读取章节数据的 stampStructure 效果指定的 JSON 模板，
//     整平地基（低于 base 填土 / 高于 base 削平）后逐层落方块。不 import THREE，纯方块操作。
//   - 模板 schema（见 web/data/chapters/190-dong-zhuo/luoyang-fang.json）：
//       { id, name, origin: {x, z}, palette: {字符→方块 id}, layers: [{y, rows: ["..."]}] }
//     y 相对 base（origin 处地表高，按 world.seed 确定性求出——换 seed 世界自动重落）；
//     rows[z][x] 为字符，'.' = 不写（保留整平后的地表/空气）。
//   - 装配在 main.js：timeline.registerEffect('stampStructure', ...) → 本模块 stampStructure；
//     返回锚点 {x, y, z} 由 main.js 登记进 structureAnchors，供 blockReplace 效果
//     的 center: "structure:<id>" 引用（焚洛阳事件对坊区做确定性批量替换，与 seed 解耦）。
//
// 性能：写入经 world.setBlock（含存档差分记录 + chunk 标脏），脏块由 world.update 每帧限量重建，
// 结构在开卷后数帧内逐块“长”出来（与 chunk 生成同观感，无需额外分帧）。

import { surfaceHeight } from './terrain.js';
import { BLOCK, CHUNK_X, CHUNK_Z } from './blocks.js';

/**
 * 把结构模板落进世界。
 * @param {import('./world.js').World} world
 * @param {object} def 模板 JSON（schema 见文件头）
 * @returns {{id: string, x: number, y: number, z: number, placed: number}} 锚点（坊中心地表）
 */
export function stampStructure(world, def) {
  const rows0 = def?.layers?.[0]?.rows;
  if (!Array.isArray(rows0) || !rows0.length) throw new Error('结构模板无 layers');

  const depth = rows0.length;
  const width = Math.max(...def.layers.map((l) => Math.max(...l.rows.map((r) => r.length))));
  const ox = Math.floor(def.origin?.x ?? 0), oz = Math.floor(def.origin?.z ?? 0);
  // base = 坊中心地表高（各列向此整平）
  const base = surfaceHeight(ox + (width >> 1), oz + (depth >> 1), world.seed);

  // 1) 装载保障：结构跨的 chunk 先同步生成（warmup 只覆盖出生点 3×3）
  for (let cz = Math.floor(oz / CHUNK_Z); cz <= Math.floor((oz + depth - 1) / CHUNK_Z); cz++)
    for (let cx = Math.floor(ox / CHUNK_X); cx <= Math.floor((ox + width - 1) / CHUNK_X); cx++)
      world.ensureChunk(cx, cz);

  let placed = 0;

  // 2) 地基整平：surf > base 削平（含树），surf < base 填土；整平后地表统一落在 base
  for (let z = 0; z < depth; z++) {
    for (let x = 0; x < width; x++) {
      const wx = ox + x, wz = oz + z;
      const surf = surfaceHeight(wx, wz, world.seed);
      if (surf > base) {
        for (let y = base + 1; y <= surf; y++) world.setBlock(wx, y, wz, BLOCK.AIR);
        world.setBlock(wx, base, wz, BLOCK.GRASS);
      } else if (surf < base) {
        for (let y = surf + 1; y <= base - 1; y++) world.setBlock(wx, y, wz, BLOCK.DIRT);
        world.setBlock(wx, base, wz, BLOCK.GRASS);
      }
    }
  }

  // 3) 逐层落方块（'.' 跳过）
  for (const layer of def.layers) {
    const y = base + Number(layer.y || 0);
    for (let z = 0; z < layer.rows.length; z++) {
      const row = layer.rows[z];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const id = def.palette?.[ch];
        if (!Number.isInteger(id) || id <= 0) continue;   // 未登记字符跳过（数据容错）
        world.setBlock(ox + x, y, oz + z, id);
        placed++;
      }
    }
  }

  return { id: String(def.id ?? 'structure'), x: ox + (width >> 1), y: base, z: oz + (depth >> 1), placed };
}
