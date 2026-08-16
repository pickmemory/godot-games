// MC-6 D-5 开场演出功能验证：俯瞰→俯冲镜头 + 氛围粒子 + 序幕字卡 + 跳过路径 + 存档续玩跳过
// 断言走真实渲染状态（getBoundingClientRect / computedStyle / WebGL 像素 / 场景对象），不做"状态机对了就算过"。
// 覆盖：
//   A 组：新档开卷 → 演出在场（#opening 可见且铺满视口、镜头高空、粒子 ≥2 组、HUD 隐藏、画布非黑屏）
//   B 组：任意键跳过 → 状态干净（isActive 复位、相机回眼位、粒子清空、FOV/雾复原、HUD 复位）
//   C 组：跳过后可达 gameplay（章节开卷演出跳过 → locked + 任务追踪卡有内容）
//   D 组：存档续玩不重复完整演出（pagehide 落盘 → reload → 开卷直接入局）
//   E 组：开场旁白清单（narrations.json 含 4 条 opening 条目，mp3 可取）
// 用法：PW_CHROMIUM=<chromium 路径> node tools/verify-opening.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = join(import.meta.dirname, '..', 'web');
const PORT = 8647;
const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const f = normalize(join(ROOT, p));
    if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const d = await readFile(f);
    res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg' }[extname(f)] ?? 'application/octet-stream' });
    res.end(d);
  } catch { res.writeHead(404); res.end('nf'); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon') && !/\/data\/npc\/[^/]+\//.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`);
});

const results = [];
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

await page.goto(`http://127.0.0.1:${PORT}/?debug=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// E 组：开场旁白清单（先查数据，不依赖演出时序）
const narr = await page.evaluate(async () => {
  const m = await fetch('data/audio/narrations.json').then((r) => r.json()).catch(() => null);
  const entries = (m?.entries ?? []).filter((e) => e.kind === 'opening');
  const filesOk = await Promise.all(entries.map((e) =>
    fetch('assets/audio/' + e.file, { method: 'HEAD' }).then((r) => r.status === 200).catch(() => false)));
  return { count: entries.length, filesOk: filesOk.every(Boolean), texts: entries.map((e) => e.text) };
});
check('E1 开场旁白清单 4 条且 mp3 可取', narr.count === 4 && narr.filesOk, `n=${narr.count}`);
check('E2 序幕文案过术语红线（无 MC 特有词）', narr.texts.length === 4
  && narr.texts.every((t) => !/附魔|红石|下界|末影|苦力怕|经验球|Creeper|Nether/i.test(t)), narr.texts.join(' / '));

// A 组：开卷 → 开场演出在场
const pre = await page.evaluate(() => ({
  openingHidden: document.getElementById('opening').classList.contains('hidden'),
  cutsceneHidden: document.getElementById('cutscene').classList.contains('hidden'),
}));
check('A0 开卷前无演出层残留', pre.openingHidden && pre.cutsceneHidden);

await page.click('#overlay').catch(() => {});
// 慢无头环境游戏时间 ≈ 墙钟×0.3（主循环 dt 钳制，见 .ai/ops/known-issues.md P1）：题签/字卡按游戏时刻出现，
// 测试轮询等条件而非固定等待（超时案老处理：交给断言利决）
await page.waitForFunction(
  () => parseFloat(getComputedStyle(document.getElementById('opTitle')).opacity) > 0.5,
  { timeout: 20000 },
).catch(() => {});
await page.waitForFunction(
  () => (document.querySelector('.op-card.on')?.textContent ?? '').length >= 4,
  { timeout: 30000 },
).catch(() => {});

const a = await page.evaluate(async () => {
  const el = document.getElementById('opening');
  const r = el.getBoundingClientRect();
  const bars = [...document.querySelectorAll('.op-bar')].map((b) => b.getBoundingClientRect());
  const hotbar = getComputedStyle(document.getElementById('hotbar'));
  const titleStyle = getComputedStyle(document.getElementById('opTitle'));
  const cardOn = document.querySelector('.op-card.on');
  // WebGL 僲素回读（rAF 内同步，防 preserveDrawingBuffer=false 全零）：演出相机高空必须仍是画了世界的
  const pixelVariance = await new Promise((resolve) => {
    requestAnimationFrame(() => {
      const cv = document.getElementById('game');
      const gl = cv.getContext('webgl2') || cv.getContext('webgl');
      const w = 160, h = 90;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let sum = 0, sum2 = 0;
      for (let i = 0; i < px.length; i += 4) { sum += px[i]; sum2 += px[i] * px[i]; }
      const mean = sum / (px.length / 4);
      resolve(Math.round(sum2 / (px.length / 4) - mean * mean));
    });
  });
  const d = window.__dbg;
  return {
    active: d.opening.isActive,
    shown: !el.classList.contains('hidden'),
    coversViewport: r.top === 0 && r.left === 0 && r.right === innerWidth && r.bottom === innerHeight,
    barsInViewport: bars.length === 2 && bars.every((b) => b.height > 20 && b.top >= -1 && b.bottom <= innerHeight + 1),
    titleText: document.getElementById('opTitle').textContent,
    titleOpacity: parseFloat(titleStyle.opacity),
    cardText: cardOn?.textContent ?? '',
    camAboveGround: d.player ? (d.player.camera.position.y - d.player.pos.y) : 0,
    particles: d.opening.particleCount,
    hudHidden: document.body.classList.contains('opening') && hotbar.opacity === '0',
    pixelVariance,
    locked: d.locked,
  };
});
check('A1 开场演出进行中（isActive）', a.active === true);
check('A2 演出层可见且铺满视口（视觉可见）', a.shown && a.coversViewport, JSON.stringify({ shown: a.shown, covers: a.coversViewport }));
check('A3 院线黑边在位', a.barsInViewport);
check('A4 题签有字且可见（书法风字卡，computed opacity）', a.titleText.length >= 4 && a.titleOpacity > 0.5,
  `${a.titleText} @${a.titleOpacity}`);
check('A4b 序幕字卡已现（首卡淡入可见）', a.cardText.length >= 4, a.cardText);
check('A5 镜头在高空（俯瞰视角）', a.camAboveGround > 40, `Δy=${a.camAboveGround.toFixed(0)}`);
check('A6 氛围粒子 ≥2 组（烽烟+飞鸟）', a.particles >= 70, `n=${a.particles}`);
check('A7 演出中 HUD 隐藏', a.hudHidden);
check('A8 演出中画布非黑屏（天空/雾照常刷）', a.pixelVariance > 100, `var=${a.pixelVariance}`);
await page.screenshot({ path: join(import.meta.dirname, 'verify-opening.png') });

// B 组：任意键跳过 → 状态干净
await page.keyboard.press('Space');
await page.waitForTimeout(1300);   // .done 淡出 0.65s + 余量
const b = await page.evaluate(() => {
  const d = window.__dbg;
  const cam = d.player.camera;
  const p = d.player.pos;
  return {
    active: d.opening.isActive,
    played: d.opening.hasPlayed,
    skipped: d.opening.skipped,
    hidden: document.getElementById('opening').classList.contains('hidden'),
    camDist: Math.hypot(cam.position.x - p.x, cam.position.y - (p.y + 1.62), cam.position.z - p.z),
    particles: d.opening.particleCount,
    bodyOpening: document.body.classList.contains('opening'),
    hotbarOpacity: getComputedStyle(document.getElementById('hotbar')).opacity,
    fov: cam.fov,
  };
});
check('B1 跳过即收（isActive=false / hasPlayed / skipped）', b.active === false && b.played === true && b.skipped === true);
check('B2 演出层已隐藏（淡出完毕）', b.hidden);
check('B3 相机精确回玩家眼位', b.camDist < 2.5, `d=${b.camDist.toFixed(2)}`);
check('B4 粒子清空（无残留）', b.particles === 0, `n=${b.particles}`);
check('B5 HUD 复位（body.opening 移除）', !b.bodyOpening && b.hotbarOpacity === '1', `opacity=${b.hotbarOpacity}`);
check('B6 FOV 复原 72', Math.abs(b.fov - 72) < 0.01, `fov=${b.fov}`);

// C 组：跳过后可达 gameplay（章节开卷演出 → 跳过 → locked + 追踪卡）
await page.keyboard.press('Space');   // 跳章节开卷黑屏卡
await page.waitForTimeout(900);
const c = await page.evaluate(() => ({
  cutsceneHidden: document.getElementById('cutscene').classList.contains('hidden'),
  locked: window.__dbg.locked,
  tracker: document.querySelector('#questTrack .qt-title')?.textContent ?? '',
  clock: document.getElementById('clock')?.textContent ?? '',
}));
check('C1 章节开卷演出已跳过收层', c.cutsceneHidden);
check('C2 gameplay 可达（locked + 追踪卡有内容）', c.locked && c.tracker.length > 1, `tracker=${c.tracker}`);

// D 组：存档续玩不重复完整演出
await page.evaluate(() => dispatchEvent(new Event('pagehide')));   // 触发落盘（doSave('pagehide')）
await page.waitForTimeout(400);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.click('#overlay').catch(() => {});
await page.waitForTimeout(1000);
const dState = await page.evaluate(() => {
  const d = window.__dbg;
  const cam = d.player.camera, p = d.player.pos;
  return {
    played: d.opening.hasPlayed,
    active: d.opening.isActive,
    openingHidden: document.getElementById('opening').classList.contains('hidden'),
    cutsceneHidden: document.getElementById('cutscene').classList.contains('hidden'),
    camDist: Math.hypot(cam.position.x - p.x, cam.position.y - (p.y + 1.62), cam.position.z - p.z),
    tracker: document.querySelector('#questTrack .qt-title')?.textContent ?? '',
  };
});
check('D1 存档续玩不演开场（hasPlayed=false 且未在演）', dState.played === false && dState.active === false);
check('D2 演出层/章节黑屏均未出现', dState.openingHidden && dState.cutsceneHidden);
check('D3 相机直接在眼位（无飞行残留）', dState.camDist < 2.5, `d=${dState.camDist.toFixed(2)}`);
check('D4 续玩直接入局（追踪卡有内容）', dState.tracker.length > 1, `tracker=${dState.tracker}`);

check('零 JS 错误', errors.length === 0, errors.slice(0, 6).join(' | '));

console.log(results.join('\n'));
await browser.close();
server.close();
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(failed === 0 ? 'OPENING PASS' : `OPENING FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
