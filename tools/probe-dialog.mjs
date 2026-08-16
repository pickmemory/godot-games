// 视觉探针：对话面板开了之后，究竟“看得见吗”
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
    res.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' }[extname(f)] ?? 'application/octet-stream' });
    res.end(d);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${PORT}/?debug=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2200);
await page.click('#overlay').catch(() => {});
await page.waitForTimeout(400);
await page.keyboard.press('Space');   // 跳 D-5 开场演出（MC-6）
await page.waitForTimeout(400);
await page.keyboard.press('Space');   // 跳章节开卷演出（MC-3d）
await page.waitForTimeout(700);
await page.evaluate(() => {
  const d = window.__dbg, n = d.npcManager.npcs.find((x) => x.id === 'elder-chen');
  d.player.pos.set(n.pos.x + 1, n.pos.y, n.pos.z); d.player.vel.set(0, 0, 0);
});
await page.waitForTimeout(400);
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);

const vis = await page.evaluate(() => {
  const pick = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    // 元素中心点的命中测试：返回最顶层覆盖它的元素 id/class
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    return {
      display: cs.display, opacity: cs.opacity, visibility: cs.visibility,
      zIndex: cs.zIndex, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      hit: top === el || el.contains(top) ? 'SELF' : (top?.id || top?.tagName + '.' + top?.className || 'unknown'),
    };
  };
  const dialog = document.getElementById('dialog');
  return {
    dialog: pick(dialog),
    panel: pick(dialog.querySelector('.panel')),
    name: pick(document.getElementById('dName')),
    text: pick(document.getElementById('dText')),
    choice: pick(document.querySelector('.dChoice')),
    dlgClass: dialog.className,
    textLen: document.getElementById('dText').textContent.length,
    viewport: [innerWidth, innerHeight],
  };
});
console.log(JSON.stringify(vis, null, 2));
await page.screenshot({ path: join(import.meta.dirname, 'probe-dialog.png') });
await browser.close();
server.close();
