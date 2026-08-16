// 回归测试：E 键交谈交互（原 bug：交谈半径 3.2 过小 + fallback 错开合成台，见 git log）
// 断言：
//   R1 远处(~7格)按 E → 合成台不开 + 出现「再走近些」提示
//   R2 贴脸(≤4.5格) → 提示「按 E 交谈」出现 + 按 E 对话打开（陈叟/台词/选项）
//   R3 无 NPC 处按 E → 合成台正常打开（原 fallback 保留）
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = join(import.meta.dirname, '..', 'web');
const PORT = 8643;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
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
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const results = [];
const check = (name, ok, detail = '') => { results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

await page.goto(`http://127.0.0.1:${PORT}/?debug=1`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.click('#overlay').catch(() => {});
await page.waitForTimeout(600);
// 开卷链路有两场：先 D-5 开场镜头演出（MC-6），再章节开卷黑屏卡（MC-3d，~12s）——都吃按键，逐场跳过
await page.keyboard.press('Space');
await page.waitForTimeout(400);
await page.keyboard.press('Space');
await page.waitForTimeout(800);
const cs = await page.evaluate(() => ({
  hidden: document.getElementById('cutscene').classList.contains('hidden'),
  activeLeft: !!window.__dbg, // 钩子在
}));
check('前置: 开卷演出已跳过', cs.hidden);

// 等待 NPC 登场稳定
await page.waitForTimeout(500);
const hasNpc = await page.evaluate(() => window.__dbg?.npcManager.activeCount > 0);
check('前置: NPC 在场', hasNpc);

// R1: 传送到离陈叟 ~6.5 格（出生点默认距离约 7），按 E
await page.evaluate(() => {
  const d = window.__dbg, n = d.npcManager.npcs.find((x) => x.id === 'elder-chen');
  d.player.pos.set(n.pos.x - 6, n.pos.y, n.pos.z);
  d.player.vel.set(0, 0, 0);
});
await page.waitForTimeout(400);
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
let r1 = await page.evaluate(() => ({
  craftHidden: document.getElementById('craft').classList.contains('hidden'),
  dialogHidden: document.getElementById('dialog').classList.contains('hidden'),
  pickup: document.getElementById('pickup').textContent,
}));
check('R1 远处按 E 不开合成台', r1.craftHidden && r1.dialogHidden, JSON.stringify(r1));
check('R1 提示走近', /再走近些/.test(r1.pickup), r1.pickup);

// R2: 贴脸（~1.5 格）→ 提示 + E 开对话
await page.evaluate(() => {
  const d = window.__dbg, n = d.npcManager.npcs.find((x) => x.id === 'elder-chen');
  d.player.pos.set(n.pos.x + 1.2, n.pos.y, n.pos.z);
  d.player.vel.set(0, 0, 0);
});
await page.waitForTimeout(400);
const hint = await page.evaluate(() => document.getElementById('talkHint').textContent);
check('R2 贴脸出交谈提示', /按 E/.test(hint), hint);
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
const r2 = await page.evaluate(() => ({
  dialogHidden: document.getElementById('dialog').classList.contains('hidden'),
  name: document.getElementById('dName').textContent,
  choices: document.querySelectorAll('#dChoices button').length,
}));
check('R2 E 打开对话', !r2.dialogHidden && r2.name === '陈叟' && r2.choices >= 1, JSON.stringify(r2));
// 视觉断言（教训：CSS 被丢弃时状态机全对但面板渲染在视口外，用户看不见）
const vis = await page.evaluate(() => {
  const d = document.getElementById('dialog');
  const r = d.getBoundingClientRect();
  const cs = getComputedStyle(d);
  const panel = d.querySelector('.panel').getBoundingClientRect();
  const inside = panel.top >= 0 && panel.left >= 0 && panel.bottom <= innerHeight && panel.right <= innerWidth;
  return { display: cs.display, position: cs.position, zIndex: cs.zIndex, rect: [Math.round(r.top), Math.round(r.left)], panelInsideViewport: inside };
});
check('R2 对话面板在视口内（视觉可见）', vis.panelInsideViewport && vis.position === 'fixed' && vis.display === 'flex', JSON.stringify(vis));
// 关对话恢复
await page.keyboard.press('KeyE');
await page.waitForTimeout(300);

// R3: 远离一切 NPC（传送 -200,-200 无 NPC 区），按 E 应开合成台
await page.evaluate(() => {
  const d = window.__dbg;
  d.player.pos.set(-200.5, 40, -200.5);
  d.player.vel.set(0, 0, 0);
});
await page.waitForTimeout(1500);   // 等 chunk 加载落稳
await page.keyboard.press('KeyE');
await page.waitForTimeout(400);
const r3 = await page.evaluate(() => ({
  craftHidden: document.getElementById('craft').classList.contains('hidden'),
}));
check('R3 无 NPC 处 E 开合成台', !r3.craftHidden, JSON.stringify(r3));

console.log(results.join('\n'));
// 诊断日志持久化验证：诊断模块应在整个会话里记下完整事件链
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // 触发隐藏刷盘兑底
const diag = await page.evaluate(() => JSON.parse(localStorage.getItem('sgsc.diag.log') ?? '[]'));
const diagEvents = diag.map((l) => l.split(' ')[2] ?? l);
console.log(`diag 条数: ${diag.length} | 事件分布: ${JSON.stringify(diagEvents.reduce((m, e) => (m[e] = (m[e] ?? 0) + 1, m), {}))}`);
console.log('diag 是否含 BOOT 版本:', diag.some((l) => l.includes('diag-v1-e-talk')),
  '| 含 KeyE 分支:', diag.some((l) => l.includes('E:talk') || l.includes('E:craft') || l.includes('E:too-far')));
console.log('JS 错误:', errors.length ? errors.join(' | ') : '(无)');
await browser.close();
server.close();
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(failed === 0 ? 'E-TALK REGRESSION PASS' : `E-TALK REGRESSION FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
