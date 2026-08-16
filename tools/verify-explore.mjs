// MC-6 D-2 功能验证：探索结构确定性 + 罗盘 HUD
// A 组（Node 纯函数，无需浏览器）：explore.js 直接 import ——
//    A1 同 seed 烘焙字节级确定；A2 采样区 ≥3 种锚定结构；A3 特征方块落成（烽燧火台/荒冢陶片/巨木干柱）；
//    A4 河滩卵石（沙→圆石净增 > 0）；A5 罗盘目标/方位；A6 已探过滤。
// B 组（无头浏览器）：罗盘元素存在且在视口内（getBoundingClientRect + 像素绘制）；
//    传送至目标 → 已探标记落 localStorage（轮询等待，规避慢无头环境游戏时间慢的问题，见 .ai/ops/known-issues.md P1）。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';
import {
  stampExplore, anchorAt, nearestTarget, bearingTo, ExploredMemory, FALLBACK_EXPLORE,
} from '../web/src/explore.js';
import { generateChunk, surfaceHeight } from '../web/src/terrain.js';
import { CHUNK_X, CHUNK_Y, CHUNK_Z, BLOCK } from '../web/src/blocks.js';

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

/* ================= A 组：Node 纯函数 ================= */
const SEED = 20260816;
const AREA = 40;                       // 采样区 40×40 chunk（以原点为中心）
const C0 = -Math.floor(AREA / 2);

// 区内某 chunk 的锚定实例（按类型收集）
const found = new Map();               // typeId → instance 列表
for (const t of FALLBACK_EXPLORE.types) {
  if (t.shape === 'pebbles') continue;
  for (let cz = C0; cz < C0 + AREA; cz++) {
    for (let cx = C0; cx < C0 + AREA; cx++) {
      const inst = anchorAt(FALLBACK_EXPLORE, t.id, cx, cz, SEED);
      if (inst) (found.get(t.id) ?? found.set(t.id, []).get(t.id)).push(inst);
    }
  }
}
const counts = [...found.entries()].map(([id, l]) => `${id}:${l.length}`).join(' ');
check('A2 采样区出现 ≥3 种锚定结构', found.size >= 3, `${found.size} 种 | ${counts}`);
check('A2 各类型均有实例（烽燧/荒冢/巨木）',
  found.has('beacon-tower') && found.has('han-mound') && found.has('great-oak'), counts);

// 烘焙一个 3×3 chunk 窗（绕锚点），返回跨窗口 getBlock
function bakeAround(cx, cz) {
  const chunks = new Map();
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const data = generateChunk(cx + dx, cz + dz, SEED);
    stampExplore(data, cx + dx, cz + dz, SEED, FALLBACK_EXPLORE);
    chunks.set(`${cx + dx},${cz + dz}`, data);
  }
  return (x, y, z) => {
    if (y < 0 || y >= CHUNK_Y) return 0;
    const k = `${Math.floor(x / CHUNK_X)},${Math.floor(z / CHUNK_Z)}`;
    const d = chunks.get(k);
    if (!d) return 0;
    const lx = x - Math.floor(x / CHUNK_X) * CHUNK_X, lz = z - Math.floor(z / CHUNK_Z) * CHUNK_Z;
    return d[lx + lz * CHUNK_X + y * CHUNK_X * CHUNK_Z];
  };
}

// A1 确定性 + A3 特征方块：对每类首个实例做双重烘焙对比 + 特征断言
let determinismOk = true;
let featureOk = { beacon: false, mound: false, greatree: false };
for (const [typeId, list] of found) {
  const inst = list[0];
  const gb = bakeAround(inst.cx, inst.cz);
  // 双重烘焙（独立重算）→ 逐字节一致
  const d1 = generateChunk(inst.cx, inst.cz, SEED); stampExplore(d1, inst.cx, inst.cz, SEED, FALLBACK_EXPLORE);
  const d2 = generateChunk(inst.cx, inst.cz, SEED); stampExplore(d2, inst.cx, inst.cz, SEED, FALLBACK_EXPLORE);
  for (let i = 0; i < d1.length; i++) if (d1[i] !== d2[i]) { determinismOk = false; break; }

  if (typeId === 'beacon-tower') {
    // 烽燧：锚点柱顶之上有篝火（火光），塔身有夯土
    let campfire = false, rammed = false;
    for (let y = 1; y < CHUNK_Y; y++) {
      if (gb(inst.ax, y, inst.az) === BLOCK.CAMPFIRE) campfire = true;
      if (gb(inst.ax, y, inst.az) === BLOCK.RAMMED_EARTH) rammed = true;
    }
    featureOk.beacon = campfire && rammed;
    check('A3 烽燧特征（夯土塔身 + 顶部篝火火光）', featureOk.beacon, `campfire=${campfire} rammed=${rammed}`);
  }
  if (typeId === 'han-mound') {
    // 荒冢：3×3 邻域内埋有陪葬陶片，且封土抬高了地表（锚点上方有泥土/草）
    let pottery = 0, dome = false;
    for (let dz = -8; dz <= 8; dz++) for (let dx = -8; dx <= 8; dx++) for (let y = 1; y < CHUNK_Y; y++) {
      const b = gb(inst.ax + dx, y, inst.az + dz);
      if (b === BLOCK.POTTERY) pottery++;
    }
    for (let y = 1; y < 8; y++) if ([BLOCK.DIRT, BLOCK.GRASS].includes(gb(inst.ax, inst.ground + y, inst.az))) dome = true;
    featureOk.mound = pottery > 0 && dome;
    check('A3 荒冢特征（封土圆丘 + 陪葬陶片）', featureOk.mound, `pottery=${pottery} dome=${dome}`);
  }
  if (typeId === 'great-oak') {
    // 巨木：锚点柱有 ≥5 连续原木，且上方有树叶（大冠）
    let logs = 0;
    for (let y = 1; y < CHUNK_Y; y++) { if (gb(inst.ax, inst.ground + y, inst.az) === BLOCK.WOOD_LOG) logs++; else break; }
    let leaves = 0;
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) for (let y = 1; y < CHUNK_Y; y++)
      if (gb(inst.ax + dx, y, inst.az + dz) === BLOCK.LEAVES) leaves++;
    featureOk.greatree = logs >= 5 && leaves >= 20;
    check('A3 巨木特征（≥5 连续干 + 大树冠）', featureOk.greatree, `logs=${logs} leaves=${leaves}`);
  }
}
check('A1 同 seed 烘焙字节级确定', determinismOk);

// A4 河滩卵石：采样区沙面→圆石净增 > 0（对照 raw generateChunk）
let pebbleSwaps = 0;
for (let cz = C0; cz < C0 + AREA && pebbleSwaps === 0; cz++) {
  for (let cx = C0; cx < C0 + AREA && pebbleSwaps === 0; cx++) {
    const raw = generateChunk(cx, cz, SEED);
    const baked = generateChunk(cx, cz, SEED);
    stampExplore(baked, cx, cz, SEED, FALLBACK_EXPLORE);
    for (let z = 0; z < CHUNK_Z; z++) for (let x = 0; x < CHUNK_X; x++) {
      const h = surfaceHeight(cx * CHUNK_X + x, cz * CHUNK_Z + z, SEED);
      const i = x + z * CHUNK_X + h * CHUNK_X * CHUNK_Z;
      if (raw[i] === BLOCK.SAND && baked[i] === BLOCK.COBBLE) pebbleSwaps++;
    }
  }
}
check('A4 河滩卵石（水位线沙→圆石混合带）', pebbleSwaps > 0, `swaps=${pebbleSwaps}（首块命中即停的窗口内）`);

// A5 罗盘：目标存在、距离正确、方位角同向为 0
const firstList = found.values().next().value;
const probe = found.get('han-mound')?.[0] ?? firstList?.[0] ?? null;
if (!probe) { console.log('EXPLORE FEATURE FAIL (A组采样为空)'); process.exit(1); }
const t1 = nearestTarget(FALLBACK_EXPLORE, probe.ax + 0.5, probe.az + 0.5, SEED, null);
check('A5 罗盘能给出目标（含 key/名/坐标）', !!t1 && !!t1.key && !!t1.name && Number.isFinite(t1.x), t1?.name ?? 'null');
if (t1) {
  const d = Math.hypot(t1.x - (probe.ax + 0.5), t1.z - (probe.az + 0.5));
  check('A5 罗盘目标即最近实例（自锚点探测距离≈0）', t1.key === probe.key && d < 0.01, `d=${d.toFixed(3)} key=${t1.key}`);
  const b0 = bearingTo(t1.x, t1.z, t1.x, t1.z - 10);   // 正北（-Z）
  check('A5 方位角约定（正北=0）', Math.abs(b0) < 1e-9, `bearing=${b0}`);
}
// A6 已探过滤：标记后不再指向同一目标
const t2 = nearestTarget(FALLBACK_EXPLORE, probe.ax + 0.5, probe.az + 0.5, SEED, (k) => k === probe.key);
check('A6 已探过滤（被标记者不再上针）', !t2 || t2.key !== probe.key, t2 ? `next=${t2.key}` : '无更近目标');
// A6b ExploredMemory：内存降级可用（Node 无 localStorage）
const mem = new ExploredMemory('node-test');
mem.add('x:1,2'); mem.add('x:1,2');
check('A6b 已探记忆去重', mem.has('x:1,2') && mem.set.size === 1);

console.log(results.join('\n'));
const aFail = results.filter((r) => r.startsWith('FAIL')).length;
if (aFail > 0) {
  console.log(`EXPLORE FEATURE FAIL (A组 ${aFail})`);
  process.exit(1);
}
const aCount = results.length;   // B 组只打印新增行

/* ================= B 组：无头浏览器 ================= */
const ROOT = join(import.meta.dirname, '..', 'web');
const PORT = 8651;
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const f = normalize(join(ROOT, p));
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const d = await readFile(f);
    res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' }[extname(f)] ?? 'application/octet-stream' });
    res.end(d);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon') && !/\/data\/npc\/[^/]+\//.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`);
});
await page.goto(`http://127.0.0.1:${PORT}/?debug=1&new`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.click('#overlay').catch(() => {});
await page.waitForTimeout(500);
await page.keyboard.press('Space');   // 跳开场演出
await page.waitForTimeout(800);

// B1 罗盘元素：存在、在视口内（视觉断言铁律）、canvas 真画了（非全透明）、配置已加载
const compass = await page.evaluate(() => {
  const el = document.getElementById('compass');
  if (!el) return { exists: false };
  const r = el.getBoundingClientRect();
  const d = el.getContext('2d').getImageData(0, 0, el.width, el.height).data;
  let painted = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
  const wrap = document.getElementById('compassWrap');
  return {
    exists: true,
    inside: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
    painted, info: document.getElementById('compassInfo')?.textContent ?? '',
    wrapOpacity: getComputedStyle(wrap).opacity,
    cfgLoaded: !!window.__dbg?.explore?.cfg?.types?.length,
  };
});
check('B1 罗盘元素在视口内且已绘制', compass.exists && compass.inside && compass.painted > 100,
  `painted=${compass.painted} info="${compass.info}"`);
check('B1 罗盘常亮（opacity=1）', compass.wrapOpacity === '1', `opacity=${compass.wrapOpacity}`);
check('B1 explore 配置已加载（__dbg.explore.cfg）', compass.cfgLoaded);

// B2 接近 → 已探标记：传送到最近目标 → 轮询 localStorage 出现该 key（慢无头环境用轮询，最多 12s）
const marked = await page.evaluate(async () => {
  const d = window.__dbg;
  const t = d.explore.nearest();
  if (!t) return { ok: false, why: 'no-target' };
  const gy = 45;   // 高空落点（player.update 会落到地表；chunk 未载时物理冻结但不影响标记判定）
  d.player.pos.set(t.x, gy, t.z);
  d.player.vel.set(0, 0, 0);
  const key = t.key, storageKey = `sgsc.explored.v1.${d.explore.seed}`;
  const t0 = performance.now();
  while (performance.now() - t0 < 12000) {
    await new Promise((r) => setTimeout(r, 400));
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && JSON.parse(raw).includes(key)) return { ok: true, key, name: t.name };
    } catch { /* 轮询继续 */ }
  }
  return { ok: false, why: 'timeout', key };
});
check('B2 接近即标记已探（localStorage 记忆）', marked.ok, JSON.stringify(marked));

// B3 标记后罗盘换目标（或无目标）：nearest 不再返回已探者
const next = await page.evaluate(() => {
  const d = window.__dbg;
  const t = d.explore.nearest();
  return t ? { key: t.key, name: t.name } : null;
});
check('B3 已探者不再上罗盘', !next || next.key !== marked.key, next ? `next=${next.name}` : '更远处无目标');

console.log(results.slice(aCount).join('\n'));
console.log('JS 错误:', errors.length ? errors.join(' | ') : '(无)');
await browser.close();
server.close();
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(failed === 0 ? 'EXPLORE FEATURE PASS' : `EXPLORE FEATURE FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
