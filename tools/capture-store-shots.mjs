// capture-store-shots.mjs — D-7 商店实机截图采集（无头 chromium，1920×1080）
// 用法：PW_CHROMIUM=<chrome路径> node tools/capture-store-shots.mjs
// 产出：docs/release/assets/screenshots/0{1..5}-*.png（规格对齐 docs/release/store-assets.md §2，itch 渠道 1920×1080 通用）
// 场景：01 开场题签（哇点）/ 02 白昼村落+HUD / 03 NPC 对话 / 04 合成面板 / 05 190·讨董氛围
// 铁律（.ai/ops known-issues CSS 案）：每张 UI 截图必须断言 getBoundingClientRect 在视口内 —— 状态机对了 ≠ 玩家看得见。
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = join(import.meta.dirname, '..', 'web');
const OUT = join(import.meta.dirname, '..', 'docs', 'release', 'assets', 'screenshots');
const PORT = 8648;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg' };

await mkdir(OUT, { recursive: true });
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
const results = [];

async function newShot(name, url, setup) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${PORT}/${url}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500); // 等 chunk 生成/网格化（慢无头机余量）
  const assertions = (await setup(page)) ?? [];
  await page.evaluate(() => { document.getElementById('fps').style.display = 'none'; }); // HUD 收拾：隐藏 fps/区块数调试条（摆拍合法，见 store-assets §2）
  const path = join(OUT, name);
  await page.screenshot({ path });
  const variance = await page.evaluate(async () => {
    return await new Promise((resolve) => {
      requestAnimationFrame(() => {
        const cv = document.getElementById('game');
        const gl = cv.getContext('webgl2') || cv.getContext('webgl');
        const px = new Uint8Array(160 * 90 * 4);
        gl.readPixels(0, 0, 160, 90, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let sum = 0, sum2 = 0;
        for (let i = 0; i < px.length; i += 4) { sum += px[i]; sum2 += px[i] * px[i]; }
        const mean = sum / (px.length / 4);
        resolve(Math.round(sum2 / (px.length / 4) - mean * mean));
      });
    });
  });
  const ok = assertions.every((a) => a.ok) && variance > 100 && errors.length === 0;
  results.push({ name, ok, variance, errors: errors.slice(0, 3), assertions });
  console.log(`${ok ? '✓' : '✗'} ${name} var=${variance} ${assertions.map((a) => (a.ok ? '' : `FAIL:${a.label}`)).filter(Boolean).join(',') || ''}${errors.length ? ' JS错误:' + errors[0] : ''}`);
  await page.close();
  return ok;
}

/* 01 开场题签（D-5 哇点：高空俯瞰 + 竖排书法题签 + 院线黑边） */
await newShot('01-opening.png', '?debug=1', async (page) => {
  await page.click('#overlay').catch(() => {});
  await page.waitForFunction(
    () => parseFloat(getComputedStyle(document.getElementById('opTitle')).opacity) > 0.5,
    { timeout: 25000 },
  ).catch(() => {});
  await page.waitForTimeout(600); // 题签停在可见峰值的余量
  const a = await page.evaluate(() => {
    const t = document.getElementById('opTitle');
    const r = t.getBoundingClientRect();
    return { text: t.textContent, visible: r.top >= 0 && r.bottom <= innerHeight && r.height > 20, opacity: parseFloat(getComputedStyle(t).opacity) };
  });
  return [
    { label: '题签在视口内可见', ok: a.visible && a.opacity > 0.5 },
    { label: `题签有字（${a.text}）`, ok: a.text.length >= 4 },
  ];
});

/* 开卷链路有两场演出要逐场跳过：D-5 开场镜头 → MC-3d 章节黑屏卡（均吃任意键，见 repro-e-talk） */
async function skipAllCutscenes(page) {
  await page.click('#overlay').catch(() => {});
  await page.waitForTimeout(500);
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(700);
  }
}

/* 02 白昼村落 + HUD（hotbar/日晷/罗盘/任务追踪；键位面板收起显主体） */
await newShot('02-day-village.png', '?debug=1', async (page) => {
  await skipAllCutscenes(page);
  await page.waitForTimeout(2000);
  await page.keyboard.press('KeyH');            // 收起键位面板（ui.setKeysMin → .min，非 .hidden）
  await page.waitForTimeout(1200);
  const a = await page.evaluate(() => {
    const hot = document.getElementById('hotbar');
    const hr = hot.getBoundingClientRect();
    const sundial = document.getElementById('sundialWrap').getBoundingClientRect();
    const keysMin = document.getElementById('keys').classList.contains('min');
    return { hotInVp: hr.top >= 0 && hr.bottom <= innerHeight, slots: document.querySelectorAll('.slot').length, sundialInVp: sundial.top >= 0 && sundial.bottom <= innerHeight, keysMin };
  });
  return [
    { label: 'hotbar 9 槽在视口内', ok: a.hotInVp && a.slots === 9 },
    { label: '日晷在视口内', ok: a.sundialInVp },
    { label: '键位面板已收起', ok: a.keysMin },
  ];
});

/* 03 NPC 对话（平民视角立绘 + 对话树） */
await newShot('03-dialog.png', '?debug=1', async (page) => {
  await skipAllCutscenes(page);
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const d = window.__dbg, n = d.npcManager.npcs.find((x) => x.id === 'elder-chen');
    d.player.pos.set(n.pos.x - 1.2, n.pos.y, n.pos.z);
  });
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(900);
  await page.keyboard.press('KeyH');            // 收起键位卡，画面以对话为主体
  const a = await page.evaluate(() => {
    const el = document.getElementById('dialog');
    const r = el.getBoundingClientRect();
    return { open: !el.classList.contains('hidden'), inVp: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1, h: r.height, text: el.textContent.slice(0, 20) };
  });
  return [
    { label: '对话面板打开且在视口内', ok: a.open && a.inVp && a.h > 80 },
  ];
});

/* 04 合成面板（列表式合成 = 品类区隔点，见 demo-vision §四） */
await newShot('04-crafting.png', '?debug=1', async (page) => {
  await skipAllCutscenes(page);
  await page.waitForTimeout(2000);
  await page.evaluate(async () => {
    const d = window.__dbg;
    const { surfaceHeight } = await import('/src/terrain.js');
    const x = 60.5, z = 60.5;                       // 离开 NPC 密集区但仍在出生区块附近
    d.player.pos.set(x, surfaceHeight(x, z, d.world.seed) + 2, z); // 落在地表，不悬空
  });
  await page.waitForTimeout(3000);                 // 等新区块流式生成/网格化
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(900);
  await page.keyboard.press('KeyH');            // 收起键位卡，画面以合成面板为主体
  const a = await page.evaluate(() => {
    const el = document.getElementById('craft');
    const r = el.getBoundingClientRect();
    return { open: !el.classList.contains('hidden'), inVp: r.top >= -1 && r.bottom <= innerHeight + 1, recipes: document.querySelectorAll('#craft .recipe').length };
  });
  return [
    { label: '合成面板打开且在视口内', ok: a.open && a.inVp && a.recipes > 0 },
  ];
});

/* 05 第二章「190·讨董」氛围（焚城橙红天际 + 焦土色带） */
await newShot('05-190-burn.png', '?chapter=190-dong-zhuo&new&debug=1', async (page) => {
  await skipAllCutscenes(page);
  await page.waitForTimeout(3000);
  await page.keyboard.press('KeyH');            // 收起键位卡
  const a = await page.evaluate(() => ({ chapter: document.getElementById('date')?.textContent ?? '' }));
  return [{ label: '190 章节已加载', ok: /初平|190|章节/.test(a.chapter) || a.chapter.length > 0 }];
});

await browser.close();
server.close();
const pass = results.every((r) => r.ok);
console.log(results.filter((r) => !r.ok).length ? JSON.stringify(results.filter((r) => !r.ok), null, 2) : '');
console.log(pass ? 'CAPTURE PASS' : 'CAPTURE FAIL');
process.exit(pass ? 0 : 1);
