// mining.js — 挖掘公式（硬度 × 工具等级/效率），参数数据驱动 web/data/mining.json（缺文件时用同构兜底）
// 公式：digSeconds = hardness × baseSeconds ÷ speed
//   speed = 工具匹配(blockDef.tool === toolDef.tool) ? toolDef.speed
//         : (blockDef.tool ? mismatchFactor : 1)          // 需镐无镐（或工具不对口）→ 手速惩罚
//   若 blockDef.minDropTier 存在且工具等级不足（含无镐）→ speed 再乘 tierPenalty
//   （minDropTier 才是硬门槛：铁矿；石头/煤矿徒手慢但仍可挖到，保证空手可起步）
// 掉落：dropOf() —— drop 字段见 blocks.js 注册表；minDropTier 不满足 → 无掉落（教玩家“先换镐”）
import { ITEM_DEFS } from './items.js';

export const FALLBACK_MINING = {
  baseSeconds: 1.5,    // 徒手基准系数（秒）：hardness=1 无惩罚时 1.5s，对齐 MC 手感
  mismatchFactor: 0.3, // 需工具但没拿对 → 速度坍缩到 0.3（石头徒手 ≈ 7.5s）
  tierPenalty: 0.25,   // 等级不足再 ×0.25（铁矿拿木镐 ≈ 9s 且无掉落，逼升石镐）
};

/** 当前工具是否匹配方块工具需求 */
function matchTool(blockDef, toolDef) {
  return !!(blockDef.tool && toolDef && toolDef.kind === 'tool' && toolDef.tool === blockDef.tool);
}

/** 挖掘耗时（秒）。blockDef ∈ BLOCK_DEFS；toolDef = 手持物品定义（工具）或 null（手/非工具） */
export function digTime(cfg, blockDef, toolDef) {
  if (!blockDef || blockDef.hardness <= 0) return 0.05;
  const c = cfg ?? FALLBACK_MINING;
  const matched = matchTool(blockDef, toolDef);
  let speed = matched ? toolDef.speed : (blockDef.tool ? c.mismatchFactor : 1);
  if (blockDef.minDropTier && (!matched || toolDef.tier < blockDef.minDropTier)) speed *= c.tierPenalty;
  return Math.max(0.05, (blockDef.hardness * c.baseSeconds) / speed);
}

/** 掉落物品 id（0=无）。blockId 用于缺省 drop=自身；工具等级不足 minDropTier → 0 */
export function dropOf(blockDef, toolDef, blockId) {
  if (!blockDef) return 0;
  const matched = matchTool(blockDef, toolDef);
  const tier = matched ? toolDef.tier : 0;
  if (blockDef.minDropTier && tier < blockDef.minDropTier) return 0;
  return blockDef.drop !== undefined ? blockDef.drop : blockId;
}

/** 手持物品 id → 工具定义（非工具/手 → null）。供 interaction/main 换算 */
export function toolDefOf(itemId) {
  if (itemId == null || itemId < 100) return null;
  const d = ITEM_DEFS[itemId];
  return d && d.kind === 'tool' ? d : null;
}
