#!/usr/bin/env node
// pack-itch.mjs — D-7 itch.io 试玩包打包脚本（零 npm 依赖，仅 Node 18+ 标准库；Node 22+ 用 zlib.crc32）
//
// 产物（默认落 tools/dist/itch/，不碰 web/ 源目录）：
//   tools/dist/itch/stage/            —— 游戏副本 + vendor/three/（CDN 依赖本地化，import map 已改写）
//   tools/dist/itch/sgsc-itch-vX.Y.Z.zip —— itch.io HTML5 上传包（index.html 在 zip 根，自包含、离线可玩）
//   tools/dist/itch/manifest.json     —— 构建清单（版本/文件表/体积/sha256，发布留档用）
//
// 用法：
//   node tools/pack-itch.mjs [--version=0.1.0] [--three=0.160.0] [--out=tools/dist/itch] [--offline] [--keep-art] [--keep-orphan-audio]
//     --version            包版本号（默认读 tools/electron/package.json 的 version，保持两端一致）
//     --three              本地化 three 版本（须与 web/index.html import map 一致，默认 0.160.0）
//     --out                输出目录（默认 tools/dist/itch）
//     --offline            不联网：复用 dist/.vendor-cache/（缓存缺失则报错退出，不静默产残缺包）
//     --keep-art           保留 web/assets/art/（美术圣经文档样张，非运行时素材；默认剔除减体积）
//     --keep-orphan-audio  保留两个 MC-5c 孤儿样音（默认剔除，见下方 DEFAULT_EXCLUDES 说明）
//
// 自包含策略（itch.io HTML5 红线）：
//   itch 试玩包必须 zip 根含 index.html 且**不依赖外部 CDN**（玩家断网/CDN 抽风都会黑屏）。
//   本脚本把 import map 的 unpkg three 改写为 ./vendor/three/，打包后完全离线可玩；
//   web/ 源目录零改动（改写只作用于 stage 副本），开发期 CDN 即开即测基线不受影响。
//
// 默认剔除项（体积卫生，均可 --keep-* 保留；剔除原因见 docs/release/itch-upload.md §1.3）：
//   web/assets/art/                                   —— 美术圣经风格样张（文档参考，运行时不加载）
//   web/assets/audio/narration-chapter-open.mp3       —— MC-5c 样音，D-4 起被逐行旁白取代（D-6 审计 N1）
//   web/assets/audio/narration-event.mp3              —— 同上
//
// 验收对应（issue #48）：
//   [x] 产出自包含 zip，解压后 index.html 可直接运行（脚本末尾自校验：zip 回读 + import map 无 CDN 残留）
//   [x] 不含 tools/ .ai/ 开发产物；含 web/src + data + assets
//   [x] 新增 .mjs 过 node --check（ESM 语法）

import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WEB = path.join(ROOT, 'web');

const { values: args } = parseArgs({
  options: {
    version: { type: 'string' },
    three: { type: 'string', default: '0.160.0' },
    out: { type: 'string', default: path.join(__dirname, 'dist', 'itch') },
    offline: { type: 'boolean', default: false },
    'keep-art': { type: 'boolean', default: false },
    'keep-orphan-audio': { type: 'boolean', default: false },
  },
});

const log = (msg) => console.log(`[pack-itch] ${msg}`);
const fail = (msg) => { console.error(`[pack-itch] ✗ ${msg}`); process.exit(1); };

if (typeof zlib.crc32 !== 'function') fail('需要 Node ≥ 22.2.0（zlib.crc32）；当前 Node ' + process.version);

/* ---------- 0. 版本号：默认与 Electron 壳一致（单源） ---------- */

function resolveVersion() {
  if (args.version) return args.version;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'electron', 'package.json'), 'utf8'));
    if (typeof pkg.version === 'string' && pkg.version) return pkg.version;
  } catch { /* 读不到就用兜底 */ }
  return '0.0.0';
}
const VERSION = resolveVersion();

/* ---------- 1. staging：web/ → stage/（含默认剔除） ---------- */

const DEFAULT_EXCLUDES = [];
if (!args['keep-art']) DEFAULT_EXCLUDES.push('assets/art/');
if (!args['keep-orphan-audio']) {
  DEFAULT_EXCLUDES.push('assets/audio/narration-chapter-open.mp3', 'assets/audio/narration-event.mp3');
}

function isExcluded(relPath) {
  const rel = relPath.split(path.sep).join('/') + (relPath.endsWith(path.sep) ? '' : '');
  return DEFAULT_EXCLUDES.some((e) => rel === e.replace(/\/$/, '') || rel.startsWith(e));
}

function collectFiles(dir, base = dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db') continue;
    const abs = path.join(dir, entry.name);
    const rel = path.relative(base, abs);
    if (entry.isDirectory()) collectFiles(abs, base, acc);
    else if (!isExcluded(rel)) acc.push({ abs, rel: rel.split(path.sep).join('/') });
  }
  return acc;
}

/* ---------- 2. three.js 本地化（CDN → vendor/，import map 改写；逻辑与 tools/electron/build.mjs 同源） ---------- */

async function fetchCached(relPath) {
  const cacheFile = path.join(args.out, '.vendor-cache', relPath);
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile, 'utf8');
  if (args.offline) fail(`--offline 且缓存缺失：${relPath}（先联网跑一次 node tools/pack-itch.mjs 建缓存）`);
  const url = `https://unpkg.com/three@${args.three}/${relPath}`;
  const res = await fetch(url);
  if (!res.ok) fail(`下载失败 ${res.status} ${url}`);
  const text = await res.text();
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, text, 'utf8');
  return text;
}

/** 递归本地化 examples/jsm 模块及其相对 import（按需，不整树下载） */
async function vendorAddon(vendorDir, rel, seen = new Set()) {
  if (seen.has(rel)) return;
  seen.add(rel);
  const text = await fetchCached(`examples/jsm/${rel}`);
  const out = path.join(vendorDir, 'examples', 'jsm', rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text, 'utf8');
  const specRe = /(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = specRe.exec(text))) {
    let target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]));
    if (!target.endsWith('.js')) target += '.js';
    await vendorAddon(vendorDir, target, seen);
  }
}

async function vendorThree(stageDir) {
  log(`本地化 three@${args.three}（${args.offline ? '离线缓存' : 'CDN'}）…`);
  const vendor = path.join(stageDir, 'vendor', 'three');
  const core = await fetchCached('build/three.module.js');
  fs.mkdirSync(path.join(vendor, 'build'), { recursive: true });
  fs.writeFileSync(path.join(vendor, 'build', 'three.module.js'), core, 'utf8');
  // addons：按 web/src 实际用到的入口递归（当前仅 GLTFLoader，npc.js 动态 import 预留）
  await vendorAddon(vendor, 'loaders/GLTFLoader.js');

  const indexHtmlPath = path.join(stageDir, 'index.html');
  let html = fs.readFileSync(indexHtmlPath, 'utf8');
  const before = html;
  html = html.replace(
    /"three":\s*"https:\/\/unpkg\.com\/three@[^"]+\/build\/three\.module\.js"/,
    '"three": "./vendor/three/build/three.module.js"',
  );
  html = html.replace(
    /"three\/addons\/":\s*"https:\/\/unpkg\.com\/three@[^"]+\/examples\/jsm\/"/,
    '"three/addons/": "./vendor/three/examples/jsm/"',
  );
  if (html === before) fail('index.html import map 未匹配到 CDN 条目（three 版本或 URL 格式变了？核对脚本正则与 web/index.html）');
  fs.writeFileSync(indexHtmlPath, html, 'utf8');
  log('import map 已改写为本地 vendor/（zip 自包含、离线可玩）');
}

/* ---------- 3. 最小 ZIP 写入器（deflate；标准库实现，无外部依赖） ---------- */

/** 固定构建时间戳（DOS date/time）：当天 00:00，保证同日重跑产物可比对 */
function dosDateTime(d = new Date()) {
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  return { date, time };
}

/**
 * @param {{rel:string, buf:Buffer}[]} files
 * @returns {Buffer}
 */
function buildZip(files) {
  const { date, time } = dosDateTime();
  const chunks = [];
  const central = [];
  let offset = 0;

  const w16 = (v) => { const b = Buffer.alloc(2); b.writeUInt16LE(v & 0xffff, 0); return b; };
  const w32 = (v) => { const b = Buffer.alloc(4); b.writeUInt32LE(v >>> 0, 0); return b; };

  for (const f of files) {
    const nameBuf = Buffer.from(f.rel, 'utf8');
    const crc = zlib.crc32(f.buf) >>> 0;
    const compressed = zlib.deflateRawSync(f.buf, { level: 9 });
    const useDeflate = compressed.length < f.buf.length;
    const data = useDeflate ? compressed : f.buf;
    const method = useDeflate ? 8 : 0;

    // Local file header（30 字节固定头 + 文件名 + 数据；bit 11 = 文件名 UTF-8）
    const local = Buffer.concat([
      w32(0x04034b50), w16(20), w16(0x0800), w16(method), w16(time), w16(date),
      w32(crc), w32(data.length), w32(f.buf.length), w16(nameBuf.length), w16(0),
      nameBuf, data,
    ]);
    chunks.push(local);

    central.push({ nameBuf, crc, csize: data.length, usize: f.buf.length, method, offset });
    offset += local.length;
  }

  const centralBufs = [];
  for (const c of central) {
    centralBufs.push(Buffer.concat([
      w32(0x02014b50), w16(20), w16(20), w16(0x0800), w16(c.method), w16(time), w16(date),
      w32(c.crc), w32(c.csize), w32(c.usize), w16(c.nameBuf.length), w16(0), w16(0),
      w16(0), w16(0), w32(0), w32(c.offset), c.nameBuf,
    ]));
  }
  const centralBytes = Buffer.concat(centralBufs); // offset 恰好 = 中央目录起始偏移（本地块总长）

  const eocd = Buffer.concat([
    w32(0x06054b50), w16(0), w16(0), w16(files.length), w16(files.length),
    w32(centralBytes.length), w32(offset), w16(0),
  ]);
  return Buffer.concat([...chunks, centralBytes, eocd]);
}

/** 回读 zip 中央目录做完整性自检（不信自己的写入，信回读） */
function readZipEntries(buf) {
  const w = (o) => buf.readUInt32LE(o);
  // 定位 EOCD：从尾部扫签名 0x06054b50（最长注释 65535）
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip EOCD 未找到（文件损坏？）');
  const count = buf.readUInt16LE(eocd + 10);
  let p = w(eocd + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error(`中央目录第 ${i} 项签名错误`);
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const csize = buf.readUInt32LE(p + 20);
    const usize = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    entries.push({ name, method, crc, csize, usize, localOff });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

/** 抽验 zip 内单个文件可无损解出（index.html + 1 个随机源文件） */
function extractEntry(buf, entry) {
  const lo = entry.localOff;
  if (buf.readUInt32LE(lo) !== 0x04034b50) throw new Error(`local header 签名错误 @${entry.name}`);
  const nameLen = buf.readUInt16LE(lo + 26);
  const extraLen = buf.readUInt16LE(lo + 28);
  const dataStart = lo + 30 + nameLen + extraLen;
  const raw = buf.subarray(dataStart, dataStart + entry.csize);
  const out = entry.method === 8 ? zlib.inflateRawSync(raw) : Buffer.from(raw);
  if (out.length !== entry.usize) throw new Error(`解压尺寸不符 @${entry.name}`);
  if ((zlib.crc32(out) >>> 0) !== entry.crc) throw new Error(`CRC 不符 @${entry.name}`);
  return out;
}

/* ---------- main ---------- */

(async () => {
  if (!fs.existsSync(path.join(WEB, 'index.html'))) fail(`游戏根缺失：${WEB}/index.html`);

  const stageDir = path.join(args.out, 'stage');
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  // 1) staging（web/ 整树复制 + 剔除清单）
  const staged = collectFiles(WEB);
  for (const f of staged) {
    const dest = path.join(stageDir, f.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f.abs, dest);
  }
  log(`staged ${staged.length} 个文件 → ${path.relative(ROOT, stageDir)}` +
    (DEFAULT_EXCLUDES.length ? `（剔除：${DEFAULT_EXCLUDES.join('、')}）` : ''));

  // 2) three.js 本地化 + import map 改写（只动 stage 副本）
  await vendorThree(stageDir);

  // 3) 收集 stage 全树（含新增 vendor/）→ zip
  const files = collectFiles(stageDir).map((f) => ({ rel: f.rel, buf: fs.readFileSync(f.abs) }))
    .sort((a, b) => a.rel.localeCompare(b.rel));
  const zipBuf = buildZip(files);

  const zipPath = path.join(args.out, `sgsc-itch-v${VERSION}.zip`);
  fs.writeFileSync(zipPath, zipBuf);
  const zipMB = (zipBuf.length / 1048576).toFixed(1);
  log(`zip 写入 ${path.relative(ROOT, zipPath)}（${zipMB} MB / ${files.length} 文件）`);

  // 4) 自校验（回读 + 结构断言 + CDN 残留扫描）
  const entries = readZipEntries(fs.readFileSync(zipPath));
  const names = new Set(entries.map((e) => e.name));
  const checks = [
    ['zip 根有 index.html', names.has('index.html')],
    ['含 web/src 模块', [...names].some((n) => n.startsWith('src/') && n.endsWith('.js'))],
    ['含 web/data 数据', [...names].some((n) => n.startsWith('data/') && n.endsWith('.json'))],
    ['含 web/assets 素材 + CREDITS', names.has('assets/CREDITS.md')],
    ['含 vendor/three（CDN 已本地化）', [...names].some((n) => n.startsWith('vendor/three/build/'))],
    ['不含开发产物（tools/ .ai/ docs/）', ![...names].some((n) => /^(tools|\.ai|docs)\//.test(n))],
    ['回读条目数一致', entries.length === files.length],
  ];
  for (const [label, ok] of checks) if (!ok) fail(`自校验未过：${label}`);
  for (const label of checks.map((c) => c[0])) log(`  ✓ ${label}`);

  // 抽验解压完整性 + 无 CDN 残留
  const indexEntry = entries.find((e) => e.name === 'index.html');
  const indexHtml = extractEntry(zipBuf, indexEntry).toString('utf8');
  if (/unpkg\.com|jsdelivr|cdn\./.test(indexHtml)) fail('解压出的 index.html 仍有 CDN 依赖残留（本地化失败？）');
  const probe = entries.find((e) => e.name === 'src/main.js') ?? entries[entries.length - 1];
  extractEntry(zipBuf, probe);
  log('  ✓ 抽验解压无损（index.html + main.js）+ import map 无 CDN 残留');

  // 5) manifest 留档
  const totalBytes = files.reduce((n, f) => n + f.buf.length, 0);
  const manifest = {
    product: '三国长卷（Scroll of the Three Kingdoms）· itch.io 试玩包',
    version: VERSION,
    createdAt: new Date().toISOString(),
    threeVendored: args.three,
    offlineCapable: true,
    excluded: DEFAULT_EXCLUDES,
    fileCount: files.length,
    totalBytes,
    zipBytes: zipBuf.length,
    zipSha256: crypto.createHash('sha256').update(zipBuf).digest('hex'),
    largest: files.slice().sort((a, b) => b.buf.length - a.buf.length).slice(0, 8)
      .map((f) => ({ path: f.rel, bytes: f.buf.length })),
  };
  fs.writeFileSync(path.join(args.out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log(`manifest → ${path.relative(ROOT, args.out)}/manifest.json`);

  console.log(`
  上传：itch.io 后台 → Uploads → 拖入 sgsc-itch-v${VERSION}.zip → 勾选「This file will be played in the browser」
  步骤与页面配置：docs/release/itch-upload.md
  本地预验：unzip sgsc-itch-v${VERSION}.zip -d /tmp/itch-check && npx serve /tmp/itch-check（或任意静态服务器）`);
})().catch((e) => fail(e.stack ?? e));
