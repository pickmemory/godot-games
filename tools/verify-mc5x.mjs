// MC-5x 功能验证：日晷（常亮时钟）/ 键位卡 / 任务追踪 / 日落预警 / 天体 / 火把篝火点光
// 断言全部走真实渲染状态（computedStyle / canvas 像素 / 灯光强度），不做"状态机对了就算过"
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = join(import.meta.dirname, '..', 'web');
const PORT = 8650;
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
await page.goto(`http://127.0.0.1:${PORT}/?debug=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.click('#overlay').catch(() => {});
await page.waitForTimeout(500);
await page.keyboard.press('Space');   // 跳 D-5 开场演出（俯瞰→俯冲镜头，MC-6）
await page.waitForTimeout(400);
await page.keyboard.press('Space');   // 跳章节开卷黑屏卡（MC-3d）
await page.waitForTimeout(800);

const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

// D1 日晷：canvas 在视口内 + 真的画了东西（非全透明）+ 常亮（毛玻璃容器 opacity 1）
const sundial = await page.evaluate(() => {
  const el = document.getElementById('sundial');
  const r = el.getBoundingClientRect();
  const ctx = el.getContext('2d');
  const d = ctx.getImageData(0, 0, el.width, el.height).data;
  let painted = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
  const wrap = document.getElementById('sundialWrap');
  return { inside: r.top >= 0 && r.right <= innerWidth, painted, wrapOpacity: getComputedStyle(wrap).opacity };
});
check('D1 日晷在视口内且已绘制', sundial.inside && sundial.painted > 200, `painted=${sundial.painted}`);
check('D1 日晷常亮（opacity=1）', sundial.wrapOpacity === '1', `opacity=${sundial.wrapOpacity}`);

// D2 时钟文字 + 键位卡 + 追踪卡
const hud = await page.evaluate(() => ({
  clock: document.getElementById('clock')?.textContent ?? '',
  keysVisible: !document.getElementById('keys')?.classList.contains('min'),
  keysInViewport: (() => { const r = document.getElementById('keys').getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight; })(),
  trackerTitle: document.querySelector('#questTrack .qt-title')?.textContent ?? '',
  warn: document.getElementById('sunwarn')?.textContent ?? '',
}));
check('D2 时辰文字（xx时·别名）', /时\s*·/.test(hud.clock), hud.clock);
check('D2 键位卡可见且在视口内', hud.keysVisible && hud.keysInViewport);
check('D2 追踪卡有内容（任务或引导）', hud.trackerTitle.length > 1, hud.trackerTitle);
check('D2 日落预警行有内容', /(距日落|日落|夜|破晓)/.test(hud.warn), hud.warn);

// H 键收起/展开
await page.keyboard.press('KeyH');
await page.waitForTimeout(200);
const minState = await page.evaluate(() => document.getElementById('keys').classList.contains('min'));
await page.keyboard.press('KeyH');
check('D3 H 键切换键位卡', minState === true);

// L1 火把：世界放置 → lights 扫描（0.6s 节流）→ 池内灯亮（坐标存 window.__torchPos 供 L3 精确挖除）
const torch = await page.evaluate(async () => {
  const { world, player, lightsMgr } = window.__dbg;
  const x = Math.floor(player.pos.x) + 2, z = Math.floor(player.pos.z);
  let gy = Math.floor(player.pos.y) + 4;
  while (gy > 0 && world.getBlock(x, gy, z) === 0) gy--;
  const ok = world.setBlock(x, gy + 1, z, 39);   // TORCH
  window.__torchPos = [x, gy + 1, z];
  await new Promise((r) => setTimeout(r, 900));  // 等 rescan（0.6s 节流）
  const lit = lightsMgr.pool.filter((l) => l.intensity > 0).length;
  const src = lightsMgr.sources.size;
  return { placed: ok, src, lit };
});
check('L1 火把被扫描为光源', torch.placed && torch.src >= 1, `sources=${torch.src}`);
check('L1 点光池有点亮（火把照明生效）', torch.lit >= 1, `lit=${torch.lit}`);

// L2 篝火：更大光源
const camp = await page.evaluate(async () => {
  const { world, player, lightsMgr } = window.__dbg;
  const x = Math.floor(player.pos.x) - 2, z = Math.floor(player.pos.z);
  let gy = Math.floor(player.pos.y) + 4;
  while (gy > 0 && world.getBlock(x, gy, z) === 0) gy--;
  world.setBlock(x, gy + 1, z, 40);   // CAMPFIRE
  await new Promise((r) => setTimeout(r, 900));
  const big = lightsMgr.pool.find((l) => l.distance >= 14 && l.intensity > 0);
  return { found: !!big, intensity: big?.intensity ?? 0 };
});
check('L2 篝火点光（距离≥14 且亮）', camp.found, `intensity=${camp.intensity.toFixed(2)}`);

// L3 挖掉火把（精确坐标，L1 已存）→ 光源消失（只剩篝火）
const off = await page.evaluate(async () => {
  const { world, lightsMgr } = window.__dbg;
  const [x, y, z] = window.__torchPos;
  world.setBlock(x, y, z, 0);
  await new Promise((r) => setTimeout(r, 900));
  return { src: lightsMgr.sources.size, torchLit: lightsMgr.pool.filter((l) => l.intensity > 0 && l.distance < 14).length };
});
check('L3 挖掉火把后光源移除（仅剩篝火）', off.src === 1 && off.torchLit === 0, `sources=${off.src} torchLit=${off.torchLit}`);

console.log(results.join('\n'));
console.log('JS 错误:', errors.length ? errors.join(' | ') : '(无)');
await browser.close();
server.close();
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(failed === 0 ? 'MC-5X FEATURE PASS' : `MC-5X FEATURE FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
