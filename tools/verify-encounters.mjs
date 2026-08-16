// MC-6 D-3 功能验证：奇遇引擎（调度纯函数 + 页面装配）
// A 组（Node 纯函数，无需浏览器）：encounters.js 直接 import ——
//    A1 真数据规整（≥8 事件，字段齐全）；A2 统计模拟 80 游戏日（确定性种子）触发 ≥2 个不同事件；
//    A3 一次性（once 不重放）；A4 冷却（cooldownDays 内不再抽中）；A5 followUp 延迟效果（数日后传闻化）；
//    A6 编年日期门控（gate.from 前不触发）；A7 watch 接近反应 + 超时兜底；A8 serialize/restore 往返。
// B 组（无头浏览器）：奇遇引擎已装配（数据 ≥8 事件、效果已注册、ctx 就绪），强推一次抽签落弹无 JS 错。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { EncounterEngine, normalizeEncounters } from '../web/src/encounters.js';
import { dateToSerial } from '../web/src/chapter.js';

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

/* ================= A 组：Node 纯函数 ================= */

// A1 真数据规整
const raw = JSON.parse(await readFile(join(import.meta.dirname, '..', 'web', 'data', 'encounters.json'), 'utf8'));
const norm = normalizeEncounters(raw);
check('A1 encounters.json 规整成功', !!norm);
check('A1 事件表 ≥8 个', norm.events.length >= 8, `${norm.events.length} 个：${norm.events.map((e) => e.id).join(' ')}`);
check('A1 落地三事件在册（流民投宿/斥候快报/夜半鬼火）',
  ['night-refugee', 'scout-gallop', 'ghost-fire'].every((id) => norm.events.some((e) => e.id === id)));
const refugee = norm.events.find((e) => e.id === 'night-refugee');
check('A1 流民投宿内嵌对话树（含 giveFood 抉择）',
  !!refugee.fire.find((e) => e.type === 'spawnNpc')?.npc?.dialogTree?.nodes?.knock?.choices?.some((c) =>
    c.effects?.some((e) => e.type === 'giveFood')));

// 通用：记录效果的测试引擎工厂
function testEngine(data, rng) {
  const marks = [];
  const eng = new EncounterEngine(data, { rng });
  eng.registerEffect('mark', (eff) => marks.push(eff.tag));
  eng.registerEffect('notify', (eff) => marks.push(eff.text?.slice(0, 6) ?? ''));
  eng.registerEffect('setFlag', (eff) => marks.push(`${eff.flag}=${eff.value !== false}`));
  eng.registerEffect('place', (_eff, _ctx, inst) => { inst.placedBlocks.push({ x: 100, y: 20, z: 100, expect: 7 }); });
  eng.registerEffect('spawnNpc', (eff) => marks.push(`npc:${eff.npc?.id}`));
  // main 侧世界效果：Node 测试里兑底 no-op（调度正确性不依赖实现）
  for (const t of ['despawnNpc', 'placeGhostFire', 'undoBlocks', 'digMound', 'scarMark', 'dropLoot', 'giveFood'])
    eng.registerEffect(t, () => {});
  return { eng, marks };
}

// A2 统计模拟：mulberry32 确定性种子，80 游戏日昼夜翻转推进
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
{
  const S0 = dateToSerial({ year: 184, month: 2, day: 1 });
  const { eng, marks } = testEngine(raw, mulberry32(42));
  const fired = [];
  eng.onEvent = (ev) => fired.push(ev.id);
  const ctxBase = {
    playerPos: { x: 8, y: 30, z: 8 },
    hasFlag: () => false,
    stats: {},
    nearStructure: (type) => type === 'han-mound',   // 荒冢在近旁 → 鬼火可抽中
  };
  let night = false;
  for (let step = 0; step < 80 / 0.05; step++) {
    const serial = S0 + step * 0.05;
    night = (Math.abs(Math.floor(serial * 2)) % 2) === 1;   // 半日翻转昼夜（abs：序数日为负，JS 负模不回正）
    eng.update(0.05, { ...ctxBase, serial, isNight: night });
  }
  const distinct = new Set(fired);
  check('A2 模拟 80 游戏日触发 ≥2 个不同事件', distinct.size >= 2, `distinct=${distinct.size} 总数=${fired.length}：${[...distinct].join(' ')}`);
  check('A2 触发总数 ≥3（密度：编年之间的日子有事发生）', fired.length >= 3, `${fired.length} 次`);
}

// 精度组：合成数据（chance=1 / 无全局冷却 → 每个翻转沿必抽且可指名）
const SYN = {
  check: { nightChance: 1, dayChance: 1, globalCooldownDays: 0 },
  events: [
    { id: 'a', slot: 'day', weight: 1, cooldownDays: 5, gate: {}, fire: [{ type: 'mark', tag: 'a' }] },
    { id: 'b', slot: 'night', weight: 1, once: true, gate: {}, fire: [{ type: 'mark', tag: 'b' }] },
    {
      id: 'c', slot: 'night', weight: 1, cooldownDays: 0, gate: {}, fire: [],
      followUps: [{ inDays: 2, effects: [{ type: 'mark', tag: 'c-fu' }] }], resetFlags: ['enc-x'],
    },
    {
      id: 'w', slot: 'night', weight: 1, cooldownDays: 0, gate: {}, fire: [{ type: 'place' }],
      watch: { radius: 5, inDays: 1, effects: [{ type: 'mark', tag: 'w-near' }], timeoutEffects: [{ type: 'mark', tag: 'w-timeout' }] },
    },
  ],
};
const mkCtx = (serial, isNight, pos = { x: 0, y: 0, z: 0 }) => ({
  serial, isNight, playerPos: pos, hasFlag: () => false, stats: {}, nearStructure: () => false,
});
const queueRng = (q) => () => (q.length ? q.shift() : 0);
/** 素化后逃一个翻转沿（引擎首个 update 只记录不抽签——沿检测需要历史） */
const edge = (eng, serial, isNight, pos) => {
  eng._lastIsNight = !isNight;
  eng.update(0, pos ? mkCtx(serial, isNight, pos) : mkCtx(serial, isNight));
};

// A4 冷却：a 触发后 5 日内昼沿空抽，第 5 日后再中
{
  const { eng, marks } = testEngine(SYN, queueRng([]));
  edge(eng, 0, false);         // 破晓沿（isNight true→false → 昼检定）→ a
  edge(eng, 2, false);         // 再破晓：a 冷却中，无昼事件可抽
  check('A4 冷却期内不重抽（a@0 冷却 5 日）', marks.filter((m) => m === 'a').length === 1, marks.join(','));
  edge(eng, 5.5, false);       // 冷却期满 → a 再中
  check('A4 冷却期满可再抽', marks.filter((m) => m === 'a').length === 2, marks.join(','));
}

// A3 一次性：b 只触发一次
{
  const { eng, marks } = testEngine(SYN, queueRng([0, 0]));   // 命中+抽签皆 0 → 首个夜事件 b
  edge(eng, 0.5, true);
  edge(eng, 1.5, true);
  edge(eng, 2.5, true);
  check('A3 once 事件只触发一次（b）', marks.filter((m) => m === 'b').length === 1, marks.join(','));
}

// A5 followUp：c 触发后 2 日延迟效果落地 + resetFlags 收尾清理
{
  const { eng, marks } = testEngine(SYN, queueRng([0, 0.5]));  // 命中 0<1；抽签 0.5*2=1 → 落到 c
  edge(eng, 10, true);                                    // 入夜沿 → c
  check('A5 followUp 未到期不触发', !marks.includes('c-fu'), marks.join(','));
  eng.update(0, mkCtx(11.9, true));
  check('A5 followUp 未到期不触发（临期）', !marks.includes('c-fu'));
  eng.update(0, mkCtx(12.1, true));
  check('A5 followUp 到期触发（c-fu）', marks.includes('c-fu'), marks.join(','));
  check('A5 实例收尾清 resetFlags（enc-x=false）', marks.includes('enc-x=false'));
  check('A5 实例出列', !eng.activeIds.includes('c'), eng.activeIds.join(','));
}

// A7 watch：接近反应 + 超时兜底
{
  const { eng, marks } = testEngine(SYN, queueRng([0, 0.99, 0, 0.99])); // 两次命中+抽签均落到 w
  edge(eng, 20, true);                                    // 入夜沿 → w（place 已回填 placedBlocks）
  const near = { x: 100, y: 20, z: 100 };
  eng.update(0, mkCtx(20.5, true, { x: 0, y: 0, z: 0 }));  // 玩家远
  check('A7 watch 未接近不触发', !marks.includes('w-near') && !marks.includes('w-timeout'));
  eng.update(0, mkCtx(20.6, true, near));                  // 玩家贴脸
  check('A7 玩家接近触发 watch 效果', marks.includes('w-near'), marks.join(','));
  // 超时路径：再放一把火，玩家始终远离
  edge(eng, 30, true, { x: 0, y: 0, z: 0 });   // 再放一把火（抽签仍落到 w）
  eng.update(0, mkCtx(31.2, true, { x: 0, y: 0, z: 0 }));
  check('A7 超时兜底触发 timeoutEffects', marks.includes('w-timeout'), marks.join(','));
}

// A6 编年日期门控：夜叩门（gate.from 184-02-12）之前不触发；之后可触发且 spawnNpc 带内嵌树
{
  const { eng, marks } = testEngine(raw, queueRng([0]));    // chance 0 < 0.4；pick 0 → 权重序首个合格者
  const before = dateToSerial({ year: 184, month: 2, day: 5 });
  eng._lastIsNight = false;
  eng.update(0, { ...mkCtx(before, true), nearStructure: () => false });
  check('A6 gate.from 之前不触发（夜叩门）', !marks.some((m) => m.startsWith('npc:')), marks.join(','));
  const after = dateToSerial({ year: 184, month: 2, day: 20 });
  eng._lastIsNight = false;
  eng.update(0, { ...mkCtx(after, true), nearStructure: () => false });
  check('A6 gate.from 之后可触发（夜叩门 spawnNpc）', marks.some((m) => m === 'npc:refugee'), marks.join(','));
}

// A8 serialize/restore 往返
{
  const eng1 = new EncounterEngine(SYN, { rng: queueRng([0, 0, 0, 0]) });
  const marks2 = [];
  eng1.registerEffect('mark', () => {});
  eng1.registerEffect('setFlag', () => {});   // resetFlags 收尾走 setFlag 路由
  edge(eng1, 0.5, true);                                  // b 触发（once 入册）
  edge(eng1, 50, true);                                   // c 触发（followUp 挂起中）
  const snap = eng1.serialize();
  const eng2 = new EncounterEngine(SYN, { rng: queueRng([]) });
  eng2.registerEffect('mark', (eff) => marks2.push(eff.tag));
  eng2.registerEffect('setFlag', () => {});   // resetFlags 收尾走 setFlag 路由
  eng2.restore(snap);
  check('A8 恢复 once 册', eng2.firedOnceLog.includes('b'), eng2.firedOnceLog.join(','));
  check('A8 恢复进行中实例（c）', eng2.activeIds.includes('c'), eng2.activeIds.join(','));
  eng2.update(0, mkCtx(52.1, true));
  check('A8 恢复后 followUp 照常落地', marks2.includes('c-fu'), marks2.join(','));
}

console.log(results.join('\n'));
const aFail = results.filter((r) => r.startsWith('FAIL')).length;
if (aFail > 0) {
  console.log(`ENCOUNTERS FEATURE FAIL (A组 ${aFail})`);
  process.exit(1);
}
const aCount = results.length;

/* ================= B 组：无头浏览器 ================= */

const ROOT = join(import.meta.dirname, '..', 'web');
const PORT = 8653;
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

let browser = null, page = null;
const errors = [];
try {
  const { chromium } = await import('playwright-core');
  const exe = process.env.PW_CHROMIUM
    || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath: exe, headless: true });
} catch (e) {
  console.log(`B 组跳过（无头浏览器不可用：${String(e).split('\n')[0]}）——A 组 ${results.length} 项全 PASS 即底线（AGENTS：CI 无浏览器时 node --check + 结构检查为底线）`);
}

if (browser) {
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('favicon') && !/\/data\/npc\/[^/]+\//.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await page.goto(`http://127.0.0.1:${PORT}/?debug=1&new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.click('#overlay').catch(() => {});
  await page.waitForTimeout(500);
  await page.keyboard.press('Space');   // 跳 D-5 开场演出（MC-6）
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');   // 跳章节开卷演出（MC-3d）
  await page.waitForTimeout(800);

  // B1 装配：引擎在位、真数据加载（非兜底 1 事件）、效果已注册、ctx 就绪
  const b1 = await page.evaluate(() => {
    const e = window.__dbg?.encounters;
    if (!e) return { ok: false };
    const ctx = window.__dbg.encounterCtx();
    return {
      ok: true,
      events: e.cfg.events.length,
      handlers: ['notify', 'setFlag', 'spawnNpc', 'despawnNpc', 'placeGhostFire', 'undoBlocks', 'digMound', 'scarMark', 'dropLoot']
        .filter((t) => e._effectHandlers.has(t)).length,
      ctxOk: Number.isFinite(ctx.serial) && typeof ctx.isNight === 'boolean' && typeof ctx.hasFlag === 'function',
      ticking: e._lastIsNight !== null,
    };
  });
  check('B1 奇遇引擎已装配（真数据 ≥8 事件）', b1.ok && b1.events >= 8, `events=${b1.events}`);
  check('B1 效果路由已注册（9 类）', b1.ok && b1.handlers === 9, `handlers=${b1.handlers}`);
  check('B1 ctx 就绪（serial/isNight/hasFlag）', b1.ok && b1.ctxOk);
  check('B1 引擎随主循环推进（翻转沿已观测）', b1.ok && b1.ticking);

  // B2 强推一次抽签：翻转沿 + 高概率重试 → firedCount 增长（真实效果路由落弹）
  const b2 = await page.evaluate(() => {
    const eng = window.__dbg.encounters;
    const base = window.__dbg.encounterCtx();
    const before = eng.firedCount;
    for (let i = 0; i < 40 && eng.firedCount === before; i++) {
      eng._lastIsNight = false;   // 伪造翻转沿（引擎内部态；页面真实沿由主循环驱动，此处只为验证）
      eng.update(0.016, { ...base, isNight: true, nearStructure: () => true });
    }
    return { fired: eng.firedCount - before, active: eng.activeCount, ids: eng.activeIds.join(',') };
  });
  check('B2 强推抽签落弹（firedCount 增长）', b2.fired >= 1, `fired=+${b2.fired} active=${b2.active} [${b2.ids}]`);

  console.log(results.slice(aCount).join('\n'));
  console.log('JS 错误:', errors.length ? errors.join(' | ') : '(无)');
  await browser.close();
}
server.close();
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(failed === 0 ? 'ENCOUNTERS FEATURE PASS' : `ENCOUNTERS FEATURE FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
