// verify-itch-zip.mjs — D-7 自包含试玩包端到端验证（解压 zip → 本地静态服务 → 无头加载 → 断言零外联请求）
// 用法：node tools/verify-itch-zip.mjs [zip路径=tools/dist/itch/sgsc-itch-v0.1.0.zip] [port=8649]
// 验收对应（issue #48）：解压后 index.html 可直接运行 + 无 CDN 依赖（所有请求必须命中本地服务）
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { chromium } from 'playwright-core';

import { readdirSync } from 'node:fs';
const DIST = join(import.meta.dirname, 'dist', 'itch');
const defaultZip = (() => {
  try {
    const c = readdirSync(DIST).filter((f) => /^sgsc-itch-v.*\.zip$/.test(f)).sort();
    return c.length ? join(DIST, c[c.length - 1]) : join(DIST, 'sgsc-itch-v0.1.0.zip');
  } catch { return join(DIST, 'sgsc-itch-v0.1.0.zip'); }
})();
const ZIP = process.argv[2] || defaultZip;
const PORT = Number(process.argv[3] || 8649);
const ROOT = fs.mkdtempSync(join(os.tmpdir(), 'itch-verify-'));
execSync(`unzip -q "${ZIP}" -d "${ROOT}"`, { stdio: 'pipe' });
console.log(`unzip → ${ROOT}`);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg' };
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

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
const external = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource.*404/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });
page.on('request', (r) => {
  const u = new URL(r.url());
  if (u.host !== `127.0.0.1:${PORT}`) external.push(r.url());
});
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon') && !/\/data\/npc\/[^/]+\//.test(r.url())) errors.push(`HTTP ${r.status()} ${r.url()}`);
});

await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(4000);
await page.click('#overlay').catch(() => {});
await page.waitForTimeout(1500);

const state = await page.evaluate(async () => {
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
  return { slots: document.querySelectorAll('.slot').length, pixelVariance };
});
await page.screenshot({ path: join(import.meta.dirname, 'dist', 'itch', 'verify-zip.png') });

await browser.close(); server.close(); fs.rmSync(ROOT, { recursive: true, force: true });

const checks = [
  ['零 JS/HTTP 错误', errors.length === 0, errors.slice(0, 5).join(' | ') || '(none)'],
  ['零外部请求（自包含铁证）', external.length === 0, external.slice(0, 5).join(' | ') || '(none)'],
  ['hotbar 9 槽（游戏 UI 装配完整）', state.slots === 9, `slots=${state.slots}`],
  ['画面渲染（像素方差>100）', state.pixelVariance > 100, `var=${state.pixelVariance}`],
];
let pass = true;
for (const [name, ok, note] of checks) { console.log(`${ok ? '✓' : '✗'} ${name} — ${note}`); if (!ok) pass = false; }
console.log(pass ? 'ITCH ZIP VERIFY PASS' : 'ITCH ZIP VERIFY FAIL');
process.exit(pass ? 0 : 1);
