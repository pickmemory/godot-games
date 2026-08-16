// extract.mjs — .ai/code-facts/ 机械提取器（零依赖，node 直接跑）
// 产物：module-map.md（模块依赖/导出图）+ blocks.md（方块注册表，运行时导入保真）+ data-files.md（数据文件清单）
// 改 web/src 或 web/data 后跑 scripts/ai-context/refresh.sh 调用本脚本；产物勿手改。
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = join(import.meta.dirname, '..', '..');
const SRC = join(ROOT, 'web', 'src');
const DATA = join(ROOT, 'web', 'data');
const OUT = join(ROOT, '.ai', 'code-facts');

const files = (await readdir(SRC)).filter((f) => f.endsWith('.js')).sort();

/* ---------- 1. module-map.md ---------- */
const mods = {};
for (const f of files) {
  const src = await readFile(join(SRC, f), 'utf8');
  const lines = src.split('\n').length;
  const deps = [...new Set([...src.matchAll(/from\s+'(\.\/[a-z-]+\.js)'/g)].map((m) => m[1].slice(2)))];
  const exts = [...src.matchAll(/import\s+\*\s+as\s+\w+\s+from\s+'([a-z@][^']+)'/g)].map((m) => m[1]);
  const exports = [
    ...[...src.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([\w$]+)/gm)].map((m) => m[1]),
    ...[...src.matchAll(/^export\s*\{([^}]+)\}/gm)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)),
  ];
  mods[f.replace('.js', '')] = { lines, deps, exts: [...new Set(exts)], exports };
}
// 反向依赖
const rev = {};
for (const [name, m] of Object.entries(mods)) for (const d of m.deps) (rev[d.replace('.js', '')] ??= []).push(name);

let mm = `# 模块地图（web/src）\n\n> **自动提取**（scripts/ai-context/refresh.sh → extract.mjs）。改代码后重跑同步，勿手改。\n> 入口：web/index.html → src/main.js（装配根，全部系统在此汇流接线）。\n> 约定：模块间只经导出签名通信；main.js 是唯一允许知悉所有模块的地方。\n\n`;
mm += `| 模块 | 行数 | 本地依赖 | 被谁依赖 | 主要导出 |\n|---|---|---|---|---|\n`;
for (const [name, m] of Object.entries(mods)) {
  mm += `| ${name} | ${m.lines} | ${m.deps.map((d) => d.replace('.js', '')).join(' ') || '—'} | ${(rev[name] ?? []).join(' ') || '—'} | ${m.exports.slice(0, 6).join(', ')}${m.exports.length > 6 ? ` …(${m.exports.length})` : ''} |\n`;
}
mm += `\n外部依赖（importmap CDN）：${[...new Set(Object.values(mods).flatMap((m) => m.exts))].join(', ') || '—'}\n`;
await writeFile(join(OUT, 'module-map.md'), mm);

/* ---------- 2. blocks.md（运行时导入，枚举与注册表保真） ---------- */
const { BLOCK, TILE, BLOCK_DEFS } = await import(pathToFileURL(join(SRC, 'blocks.js')).href);
let bl = `# 方块注册表（blocks.js 运行时镜像）\n\n> **自动提取**（运行时 import web/src/blocks.js，与代码零漂移）。勿手改。\n> 改注册表后重跑 refresh.sh。挖掘公式见 .ai/systems/mining-tools.md。\n\n## BLOCK 枚举 → 定义摘要\n\n`;
bl += `| id | 枚举名 | 名称 | solid | transparent | hardness | tool/minTier | light | shape/cross | drop |\n|---|---|---|---|---|---|---|---|---|---|\n`;
for (const [k, id] of Object.entries(BLOCK)) {
  const d = BLOCK_DEFS[id];
  if (!d) continue;
  bl += `| ${id} | ${k} | ${d.name} | ${d.solid ? '✓' : ''} | ${d.transparent ? '✓' : ''} | ${d.hardness} | ${d.tool ?? ''}${d.minTier ? ` t${d.minTier}` : ''} | ${d.light ? `${d.light.dist}/${d.light.intensity}` : ''} | ${d.shape ?? ''}${d.cross ? 'cross' : ''} | ${d.drop !== undefined ? String(d.drop) : '自身'} |\n`;
}
bl += `\n## TILE 瓦片表（atlas 序号；绘制逻辑在 textures.js PAINTERS）\n\n| 枚举 | 序号 |\n|---|---|\n`;
for (const [k, v] of Object.entries(TILE)) bl += `| ${k} | ${v} |\n`;
await writeFile(join(OUT, 'blocks.md'), bl);

/* ---------- 3. data-files.md ---------- */
async function walk(dir, acc = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p, acc);
    else if (e.name.endsWith('.json')) acc.push(p);
  }
  return acc;
}
let df = `# 数据文件清单（web/data）\n\n> **自动提取**。schema 说明在各目录 README.md；数据驱动约定见 AGENTS.md。\n\n| 文件 | 顶层键 | 条目数（已知数组） |\n|---|---|---|\n`;
for (const p of (await walk(DATA)).sort()) {
  let j = null;
  try { j = JSON.parse(await readFile(p, 'utf8')); } catch { continue; }
  const keys = Object.keys(j).filter((k) => !k.startsWith('_'));
  const counts = [];
  for (const k of ['npcs', 'recipes', 'quests', 'events', 'mats']) if (Array.isArray(j[k])) counts.push(`${k}:${j[k].length}`);
  df += `| ${relative(DATA, p).replaceAll('\\\\', '/')} | ${keys.join(', ') || '—'} | ${counts.join(' ') || '—'} |\n`;
}
await writeFile(join(OUT, 'data-files.md'), df);

console.log('✓ module-map.md / blocks.md / data-files.md');
