// 冒烟测试：无头 chromium 加载游戏 → 等渲染 → 截图 → 抓 JS 错误/关键状态
// 用法：node tools/smoke-web.mjs [port]
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = join(import.meta.dirname, '..', 'web');
const PORT = Number(process.argv[2] || 8642);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p === '/') p = '/index.html';
    const file = normalize(join(ROOT, p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('nf'); }
});

await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
console.log(`serving web/ at http://127.0.0.1:${PORT}`);

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM, // 可覆盖；默认让 playwright-core 自己找
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`HTTP ${r.status()} ${r.url()}`);
});

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000); // 等 chunk 生成/网格化几轮

// 模拟点击进入指针锁定（headless 下 pointerlock 可能被拒——仅验证 overlay 消失与否并容错）
await page.click('#overlay').catch(() => {});
await page.waitForTimeout(1500);

const state = await page.evaluate(async () => {
  const fpsEl = document.getElementById('fps');
  // WebGL 像素回读：颜色方差 > 0 说明地形真的画出来了（非纯色屏）
  // 必须在 rAF 内同步回读（preserveDrawingBuffer=false 帧外回读为空）
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
  return {
    hasWebGL: true,
    fpsText: fpsEl?.textContent ?? '',
    slots: document.querySelectorAll('.slot').length,
    overlayHidden: document.getElementById('overlay').classList.contains('hidden'),
    pixelVariance,
    canvasSize: (() => { const c = document.getElementById('game'); return [c.width, c.height]; })(),
  };
});

await page.screenshot({ path: join(import.meta.dirname, 'smoke-web.png') });
console.log('STATE:', JSON.stringify(state, null, 2));
console.log('ERRORS:', errors.length ? errors.slice(0, 10).join('\n') : '(none)');

await browser.close();
server.close();
const pass = errors.length === 0 && state.slots === 9 && state.pixelVariance > 100;
console.log(pass ? 'SMOKE PASS' : 'SMOKE FAIL');
process.exit(pass ? 0 : 1);
