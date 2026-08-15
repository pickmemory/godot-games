#!/usr/bin/env node
// build.mjs — MC-5e 打包/装配脚本（零 npm 依赖，仅 Node 18+ 标准库）
//
// 产物（全部落在 tools/electron/dist/，不碰 web/ 源目录）：
//   dist/stage/web/         —— 游戏副本 + three.js 本地化（vendor/）+ import map 改写（离线可玩）
//   dist/steamupload/       —— Steam 上传骨架：app_build.vdf 模板（@@APPID@@ 占位）+ content/ 说明
//   steam_appid.txt         —— 写到 tools/electron/（开发期 electron . 用；正式 App ID 待主理人配置）
//
// 用法：
//   node build.mjs [--appid=480] [--three=0.160.0] [--offline] [--keep]
//     --appid   Steam App ID（默认 480 = Spacewar，仅开发测试；发布必换正式 ID）
//     --three   本地化 three 版本（须与 web/index.html import map 一致，默认 0.160.0）
//     --offline 不联网：复用 .vendor-cache/ 缓存（缓存缺失则报错退出，不静默产残缺包）
//     --keep    不清空旧 dist/stage（默认每次重建）
//
// 验收要点对应：产出 Steam 上传目录结构（app/build 骨架）；浏览器直开的 web/ 不被改动。

import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const WEB = path.join(ROOT, 'web');
const DIST = path.join(__dirname, 'dist');
const STAGE = path.join(DIST, 'stage', 'web');
const VENDOR = path.join(STAGE, 'vendor', 'three');
const CACHE = path.join(DIST, '.vendor-cache');
const UPLOAD = path.join(DIST, 'steamupload');

const { values: args } = parseArgs({
  options: {
    appid: { type: 'string', default: '480' },
    three: { type: 'string', default: '0.160.0' },
    offline: { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false },
  },
});

const log = (msg) => console.log(`[build] ${msg}`);
const fail = (msg) => { console.error(`[build] ✗ ${msg}`); process.exit(1); };

/* ---------- 1. 递归复制 web/ → dist/stage/web ---------- */

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === 'Thumbs.db') continue;
    const s = path.join(src, entry.name), d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

/* ---------- 2. three.js 本地化（CDN → vendor/，import map 改写） ---------- */

async function fetchCached(relPath) {
  const cacheFile = path.join(CACHE, relPath);
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile, 'utf8');
  if (args.offline) fail(`--offline 且缓存缺失：${relPath}（先联网跑一次 node build.mjs 建缓存）`);
  const url = `https://unpkg.com/three@${args.three}/${relPath}`;
  const res = await fetch(url);
  if (!res.ok) fail(`下载失败 ${res.status} ${url}`);
  const text = await res.text();
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, text, 'utf8');
  return text;
}

/** 递归抓取 examples/jsm 模块及其相对 import（按需本地化，不整树下载）；rel 以 examples/jsm/ 为根 */
async function vendorAddon(rel) {
  const text = await fetchCached(`examples/jsm/${rel}`);
  const out = path.join(VENDOR, 'examples', 'jsm', rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text, 'utf8');
  // 扫描相对导入（from './x' / from '../x' / import('./x')），递归本地化（均相对 examples/jsm 根）
  const specRe = /(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = specRe.exec(text))) {
    let target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]));
    if (!target.endsWith('.js')) target += '.js';
    const abs = path.join(VENDOR, 'examples', 'jsm', target);
    if (!fs.existsSync(abs)) await vendorAddon(target);
  }
}

async function vendorThree() {
  log(`本地化 three@${args.three}（${args.offline ? '离线缓存' : 'CDN'}）…`);
  // 核心模块（import map 的 "three"）
  const core = await fetchCached('build/three.module.js');
  fs.mkdirSync(path.join(VENDOR, 'build'), { recursive: true });
  fs.writeFileSync(path.join(VENDOR, 'build', 'three.module.js'), core, 'utf8');
  // addons：按 web/src 实际用到的入口递归（当前仅 GLTFLoader，npc.js 动态 import）
  await vendorAddon('loaders/GLTFLoader.js');

  // 改写 staged index.html 的 import map（只动 dist 副本，源文件零改动）
  const indexHtmlPath = path.join(STAGE, 'index.html');
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
  if (html === before) fail('index.html import map 未匹配到 CDN 条目（three 版本或 URL 格式变了？请核对本脚本正则与 web/index.html）');
  fs.writeFileSync(indexHtmlPath, html, 'utf8');
  log('import map 已改写为本地 vendor/（离线可玩）');
}

/* ---------- 3. Steam 上传骨架 + steam_appid.txt ---------- */

function genSteamUploadSkeleton() {
  fs.mkdirSync(path.join(UPLOAD, 'content'), { recursive: true });
  const appid = args.appid;
  // app_build_<appid>.vdf：steamcmd 上传描述（@@ 占位符逐项核对后再用；正式 depot 布局待主理人在 Steamworks 后台确认）
  const vdf = `;; app_build —— Steam 上传描述模板（由 tools/electron/build.mjs 生成）
;; 用法：steamcmd +login <账号> run_app_build /?this app_build_${appid}.vdf（路径按机器改）
;; ⚠ 内容根指向 electron-builder 产物解开后的 win-unsigned/ 目录；发布前逐项核对。
"appbuild"
{
  "appid"    "${appid}"
  "desc"     "@@BUILD_DESC@@ 三国长卷 auto build" ;; 构建说明（变更日志入 docs/release/）

  ;; Depot 布局（默认提案： depot ${appid} = Windows 主程序；App ID+1 作惯例增量位，按后台实际配置改）
  "depots"
  {
    "${appid}"     "depot_${appid}.vdf"
    "${Number(appid) + 1}"  "depot_${Number(appid) + 1}.vdf"
  }
}
`;
  fs.writeFileSync(path.join(UPLOAD, `app_build_${appid}.vdf`), vdf, 'utf8');
  for (const d of [appid, String(Number(appid) + 1)]) {
    fs.writeFileSync(
      path.join(UPLOAD, `depot_${d}.vdf`),
      `;; depot_${d}.vdf（模板，ContentPath 指向 electron-builder 安装目录产物）
"DepotBuildConfig"
{
  "DepotID" "${d}"
  "ContentRoot" "../package/win-unpacked"
  "FileMapping"
  {
    "LocalPath" "*"
    "DepotPath" "."
    "recursive" "1"
  }
}
`,
      'utf8',
    );
  }
  fs.writeFileSync(
    path.join(UPLOAD, 'content', 'README.txt'),
    'Steam 上传内容根说明：electron-builder 产出的 win-unsigned 安装目录（三国长卷.exe + resources/web）\n应作为 depot 内容上传；本目录仅为占位骨架，实际内容路径以 depot_*.vdf 的 ContentRoot 为准。\n',
    'utf8',
  );
  // 开发期 steam_appid.txt（electron . 从 cwd 读；默认 480 Spacewar，仅本地测试成就/云）
  fs.writeFileSync(path.join(__dirname, 'steam_appid.txt'), `${appid}\n`, 'utf8');
  log(`Steam 上传骨架 → dist/steamupload/（appid=${appid}${appid === '480' ? ' Spacewar（开发默认，发布必换）' : ''}）`);
}

/* ---------- main ---------- */

(async () => {
  if (!fs.existsSync(path.join(WEB, 'index.html'))) fail(`游戏根缺失：${WEB}/index.html`);
  if (!args.keep) fs.rmSync(path.join(DIST, 'stage'), { recursive: true, force: true });
  log(`staging web/ → dist/stage/web/ …`);
  copyRecursive(WEB, STAGE);
  await vendorThree();
  genSteamUploadSkeleton();
  const files = fs.readdirSync(STAGE).length;
  log(`完成。staged ${files} 个顶层条目。下一步：`);
  console.log(`
  开发期试跑：   cd tools/electron && npm install && npm start
  打 Windows 包：cd tools/electron && npm run dist:win   （产出 dist/package/*.exe + resources/web）
  Steam 上传：   核对 dist/steamupload/*.vdf 占位符 → steamcmd +login <账号> run_app_build …
  详见：tools/electron/README.md`);
})();
