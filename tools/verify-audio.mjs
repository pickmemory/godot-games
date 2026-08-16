// 音频层功能测试（MC-6 D-4）：无头 chromium 加载游戏 → 手势激活 → 断言声音层状态
// 覆盖：music.ensure 后 BGM 态起播（首态判定）、旁白清单加载与 speak 映射、cutscene 旁白降级路径、
//       sfx 总线迁移与夜风接管、切后台静音。听觉本身（音色/混音审美）仍走人工审听清单。
// 用法：PW_CHROMIUM=<chromium 路径> node tools/verify-audio.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = join(import.meta.dirname, '..', 'web');
const PORT = 8646;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg' };

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
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok, extra }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`); };

await page.goto(`http://127.0.0.1:${PORT}/?debug=1&new`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// 1) 手势前：声音层未激活（E-音频①：不发声）
const pre = await page.evaluate(() => ({ ready: window.__dbg.music.ready, state: window.__dbg.music.state }));
check('手势前不发声（ready=false, state=null）', pre.ready === false && pre.state === null, JSON.stringify(pre));

// 2) 模拟开卷手势
await page.click('#overlay').catch(() => {});
await page.waitForTimeout(2200);   // 首态判定（0.5s 节流）+ first fade 2s 进行中

const post = await page.evaluate(() => {
  const m = window.__dbg.music;
  const sfxOut = !!m.sfx.out;                    // 总线迁移（sfx.setOutput 已被调用）
  return {
    ready: m.ready,
    state: m.state,
    sfxOut,
    windEnabled: m.sfx.windEnabled,              // 环境层接管 → false
    narrCount: m._narrMap.size,                  // 旁白清单条目
    master: m.master ? m.master.gain.value : null,
    streams: Object.keys(m._streams),
  };
});
check('手势后激活 + BGM 首态起播', post.ready === true && typeof post.state === 'string', `state=${post.state}`);
check('四态流齐全', ['explore', 'danger', 'settle', 'event'].every((s) => post.streams.includes(s)), post.streams.join(','));
check('sfx 迁入总线 + 夜风被环境层接管', post.sfxOut === true && post.windEnabled === false);
check('旁白清单加载（46 条，含 D-5 开场字卡 4 条）', post.narrCount === 46, `n=${post.narrCount}`);
check('主总线在线（0.9）', post.master !== null && Math.abs(post.master - 0.9) < 0.05);

// 3) speak：真实文案 → 发声（HTMLAudio 在无头环境可播放，静音输出）；乱文案 → false 回落字幕
const speak = await page.evaluate(async () => {
  const m = window.__dbg.music;
  const good = await m.speak('天黑得比昨日快。陈叟说，日落之后，墙外的东西不是人。');
  const bad = await m.speak('这句文案不在章节 JSON 里（测试用）');
  return { good, bad };
});
check('事件旁白：真实文案发声 / 未知文案回落', speak.good === true && speak.bad === false, JSON.stringify(speak));

// 4) 章节效果路由：playBgm / ambient（on→顶层 / off）
const fx = await page.evaluate(() => {
  const m = window.__dbg.music;
  m.setChapterOverride('event', 3);
  m.ambientLayer('distant-war', true, 0.2);
  const s1 = m.state, l1 = m._activeLayer;
  m.ambientLayer('distant-war', false, 0.2);
  return { s1, l1, l2: m._activeLayer };
});
check('playBgm 效果 → event 态', fx.s1 === 'event', `state=${fx.s1}`);
check('ambient 效果开/关 distant-war 层', fx.l1 === 'distant-war' && fx.l2 === null, `${fx.l1} → ${fx.l2}`);

// 5) 切后台静音 / 恢复
const mute = await page.evaluate(async () => {
  const m = window.__dbg.music;
  const before = m.master.gain.value;
  m.setPageMuted(true);
  await new Promise((r) => setTimeout(r, 400));
  const hidden = m.master.gain.value;
  m.setPageMuted(false);
  await new Promise((r) => setTimeout(r, 400));
  return { before, hidden, restored: m.master.gain.value };
});
check('切后台主总线归零 / 恢复', mute.hidden === 0 && Math.abs(mute.restored - mute.before) < 0.05,
  `${mute.before.toFixed(2)} → ${mute.hidden.toFixed(2)} → ${mute.restored.toFixed(2)}`);

// 6) 旁白模式开关（可访问性 §5.5）
const mode = await page.evaluate(async () => {
  const m = window.__dbg.music;
  m.setNarrationMode('subtitle');
  const r = await m.speak('天黑得比昨日快。陈叟说，日落之后，墙外的东西不是人。');
  m.setNarrationMode('on');
  return r;
});
check('旁白模式 off → 不发声', mode === false);

check('零 JS 错误', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();
const fails = results.filter((r) => !r.ok).length;
console.log(fails === 0 ? `\nAUDIO PASS（${results.length}/${results.length}）` : `\nAUDIO FAIL（${fails} 项）`);
process.exit(fails === 0 ? 0 : 1);
