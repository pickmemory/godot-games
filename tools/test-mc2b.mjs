// MC-2b 自验证脚本（node 直接跑；不涉及 THREE/DOM 的逻辑层）
import { BLOCK, BLOCK_DEFS, isSolid, isOpaque } from '../web/src/blocks.js';
import { ITEM, ITEM_DEFS, maxStackOf } from '../web/src/items.js';
import { digTime, dropOf, toolDefOf, FALLBACK_MINING } from '../web/src/mining.js';
import { Inventory } from '../web/src/inventory.js';
import { Crafting, FALLBACK_RECIPES } from '../web/src/crafting.js';
import { generateChunk } from '../web/src/terrain.js';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) fails++; };

/* 1. 注册表完整性 */
console.log('[1] 注册表');
ok(BLOCK_DEFS.length === 12, `BLOCK_DEFS 12 项（实际 ${BLOCK_DEFS.length}）`);
ok(BLOCK_DEFS[BLOCK.COAL_ORE].drop === ITEM.COAL, '煤矿石掉煤炭');
ok(BLOCK_DEFS[BLOCK.STONE].drop === BLOCK.COBBLE, '石头掉圆石');
ok(BLOCK_DEFS[BLOCK.IRON_ORE].minDropTier === 2, '铁矿石掉落需石镐(tier2)');
for (let i = 1; i < BLOCK_DEFS.length; i++) {
  const d = BLOCK_DEFS[i];
  if (!d.name || !d.tiles || !(d.hardness > 0)) { ok(false, `方块 ${i} 定义缺字段`); }
}
ok(true, '所有方块 name/tiles/hardness 齐全');
ok(isSolid(BLOCK.CRAFT_TABLE) && !isOpaque(BLOCK.LEAVES), 'solid/transparent 判定不受新字段影响');

/* 2. 挖掘天梯（手感递进可感知） */
console.log('[2] 挖掘天梯 digTime（秒）');
const hand = null;
const wood = toolDefOf(ITEM.PICK_WOOD), stone = toolDefOf(ITEM.PICK_STONE), iron = toolDefOf(ITEM.PICK_IRON);
const t = (b, tool) => digTime(FALLBACK_MINING, BLOCK_DEFS[b], tool);
const stoneHand = t(BLOCK.STONE, hand), stoneWood = t(BLOCK.STONE, wood);
const stoneStone = t(BLOCK.STONE, stone), stoneIron = t(BLOCK.STONE, iron);
console.log(`    石头: 手 ${stoneHand.toFixed(2)} / 木镐 ${stoneWood.toFixed(2)} / 石镐 ${stoneStone.toFixed(2)} / 铁镐 ${stoneIron.toFixed(2)}`);
ok(Math.abs(stoneHand - 7.5) < 0.01, '徒手挖石头 ≈ 7.5s（对齐 MC：痛但可起步）');
ok(stoneHand > 5, '徒手挖石头 > 5s（痛感）');
ok(stoneWood < stoneHand / 3, '木镐比手快 3× 以上（明显提速）');
ok(stoneStone < stoneWood && stoneIron < stoneStone, '石镐 < 木镐 < 铁镐耗时递减');
const ironWood = t(BLOCK.IRON_ORE, wood), ironStone = t(BLOCK.IRON_ORE, stone);
const ironHand = t(BLOCK.IRON_ORE, hand);
console.log(`    铁矿: 手 ${ironHand.toFixed(1)}s(无掉落) / 木镐 ${ironWood.toFixed(2)}s(无掉落) / 石镐 ${ironStone.toFixed(2)}s`);
ok(ironWood > ironStone * 4, '木镐挖铁矿极慢（逼升石镐）');

/* 3. 掉落门槛 */
console.log('[3] 掉落 dropOf');
ok(dropOf(BLOCK_DEFS[BLOCK.IRON_ORE], hand, BLOCK.IRON_ORE) === 0, '手挖铁矿无掉落');
ok(dropOf(BLOCK_DEFS[BLOCK.IRON_ORE], wood, BLOCK.IRON_ORE) === 0, '木镐挖铁矿无掉落');
ok(dropOf(BLOCK_DEFS[BLOCK.IRON_ORE], stone, BLOCK.IRON_ORE) === BLOCK.IRON_ORE, '石镐挖铁矿掉自身');
ok(dropOf(BLOCK_DEFS[BLOCK.COAL_ORE], hand, BLOCK.COAL_ORE) === ITEM.COAL, '手挖煤矿仍掉煤炭（宽容引导）');
ok(dropOf(BLOCK_DEFS[BLOCK.STONE], hand, BLOCK.STONE) === BLOCK.COBBLE, '手挖石头掉圆石（可起步）');
ok(dropOf(BLOCK_DEFS[BLOCK.LEAVES], hand, BLOCK.LEAVES) === 0, '树叶无掉落');
ok(toolDefOf(ITEM.COAL) === null && toolDefOf(0) === null, '非工具物品 toolDefOf → null');

/* 4. 行囊 */
console.log('[4] Inventory');
const inv = new Inventory(9);
ok(inv.add(BLOCK.WOOD_LOG, 70) === 0, '70 原木入包（跨两栈）');
ok(inv.slots[0].count === 64 && inv.slots[1].count === 6, '堆叠上限 64 正确拆栈');
ok(inv.countOf(BLOCK.WOOD_LOG) === 70, 'countOf=70');
ok(inv.consume(BLOCK.WOOD_LOG, 65) && inv.countOf(BLOCK.WOOD_LOG) === 5, 'consume 跨栈扣减');
inv.select(8);
ok(!inv.takeFromSelected(1), '空槽不可放置消耗');
ok(inv.add(ITEM.PICK_WOOD, 1) === 0 && inv.countOf(ITEM.PICK_WOOD) === 1, '工具入包（占一槽）');
ok(inv.add(ITEM.PICK_WOOD, 1) === 0 && inv.countOf(ITEM.PICK_WOOD) === 2
  && inv.slots.filter((s) => s && s.id === ITEM.PICK_WOOD).length === 2, 'maxStack=1：第二把占另一槽（不叠不丢）');

/* 5. 合成（含工作台门槛 + 产出容量校验） */
console.log('[5] Crafting');
const c = Object.create(Crafting.prototype);
c.inv = inv; c.recipes = FALLBACK_RECIPES; c.cb = {}; c.nearStation = false;
const R = (id) => FALLBACK_RECIPES.find((r) => r.id === id);
inv.consume(BLOCK.WOOD_LOG, 65);
inv.add(BLOCK.WOOD_LOG, 1);
ok(c.craft(R('plank')) && inv.countOf(BLOCK.PLANK) === 4, '1 原木→4 木板');
ok(inv.consume(BLOCK.PLANK, 4) && !c.canCraft(R('stick')), '木板不足 2 时不可合成木棍');
inv.add(BLOCK.PLANK, 4);
ok(c.craft(R('stick')) && inv.countOf(ITEM.STICK) === 4 && inv.countOf(BLOCK.PLANK) === 2, '2 木板→4 木棍');
ok(!c.canCraft(R('pick_wood')), '不在工作台旁 → 木镐配方锁定');
c.nearStation = true;
ok(!c.canCraft(R('pick_wood')), '在工作台旁但木板不足 3 → 仍不可合成');
inv.add(BLOCK.PLANK, 3);
ok(c.craft(R('pick_wood')) && inv.countOf(ITEM.PICK_WOOD) >= 1, '工作台旁 3 木板+2 木棍→木镐');
inv.add(BLOCK.COBBLE, 3);
ok(c.craft(R('pick_stone')), '3 圆石+2 木棍→石镐');
inv.add(BLOCK.IRON_ORE, 3);
inv.add(ITEM.STICK, 2);
ok(c.craft(R('pick_iron')), '3 铁矿石+2 木棍→铁镐');
// 容量校验：装满非目标物品时 canCraft=false 防止产物销毁
const inv2 = new Inventory(9);
for (let i = 0; i < 8; i++) inv2.add(BLOCK.DIRT, 64);
inv2.add(BLOCK.WOOD_LOG, 1);
const c2 = Object.create(Crafting.prototype);
c2.inv = inv2; c2.recipes = FALLBACK_RECIPES; c2.cb = {}; c2.nearStation = false;
ok(!c2.canCraft(R('plank')), '背包无空位时 canCraft=false（产物不会凭空销毁）');

/* 6. 矿石生成分布（煤浅层 / 铁深层；确定性） */
console.log('[6] terrain 矿脉');
let coalYs = [], ironYs = [];
for (let cz = 0; cz < 8; cz++) for (let cx = 0; cx < 8; cx++) {
  const data = generateChunk(cx, cz, 1337);
  for (let y = 0; y < 64; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const id = data[x + z * 16 + y * 256];
    if (id === BLOCK.COAL_ORE) coalYs.push(y);
    else if (id === BLOCK.IRON_ORE) ironYs.push(y);
  }
}
const avg = (a) => a.reduce((s, v) => s + v, 0) / a.length;
console.log(`    煤 ${coalYs.length} 块 均深 y=${avg(coalYs).toFixed(1)}；铁 ${ironYs.length} 块 均深 y=${avg(ironYs).toFixed(1)}`);
ok(coalYs.length > 200 && ironYs.length > 50, `8×8 chunk 矿量充足（煤 ${coalYs.length}/铁 ${ironYs.length}）`);
ok(avg(coalYs) > avg(ironYs) + 5, '煤平均埋深明显浅于铁（煤浅/铁深）');
ok(Math.max(...ironYs) <= 13 + 6, '铁不出现在浅层（游走幅度受限）');
const d1 = generateChunk(3, 3, 1337), d2 = generateChunk(3, 3, 1337);
ok(Buffer.from(d1).equals(Buffer.from(d2)), '同 seed 生成确定性一致');

console.log(fails === 0 ? '\nPASS：MC-2b 逻辑层自验证全部通过' : `\nFAIL：${fails} 项未过`);
process.exit(fails === 0 ? 0 : 1);
