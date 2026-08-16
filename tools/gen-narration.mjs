#!/usr/bin/env node
// gen-narration.mjs — MC-6 D-4 历史事件旁白成批生成（mmx speech；audio-direction.md §5 / E-音频⑥）
//
// 原则：**章节 JSON 是文案唯一源**——本脚本扫描 web/data/chapters/*.json 的
//   worldState.onEnter/onExit 的 cutscene lines（逐行）与 events[].narration，
//   逐条生成 nar-*.mp3 并写清单 web/data/audio/narrations.json（music.js 读它做 文案→文件 映射）。
//   改了文案 → 重跑本脚本（hash 不一致的条目自动重生成；不手剪 mp3）。
//
// 用法：
//   node tools/gen-narration.mjs            # 增量：仅生成缺失/文案变了的条目
//   node tools/gen-narration.mjs --force    # 全部重生成
//   node tools/gen-narration.mjs --dry      # 只打印计划，不调 mmx、不写盘
//
// 音色定案（audio-direction.md §5.1）：主旁白 male-qn-qingse，speed 0.9（长卷画外音，克制不煽情）。
// mmx 不可用（未装/无 key）→ 退出码 2，降级路径见 sound-layer.md §6。

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname, '.');
const CHAPTERS_DIR = path.join(ROOT, 'web/data/chapters');
const AUDIO_DIR = path.join(ROOT, 'web/assets/audio');
const MANIFEST = path.join(ROOT, 'web/data/audio/narrations.json');
const VOICE = 'male-qn-qingse';
const SPEED = '0.9';

const force = process.argv.includes('--force');
const dry = process.argv.includes('--dry');

/* ---------- 1. 扫描章节 JSON（文案唯一源） ---------- */

function collectEntries() {
  const entries = [];
  for (const f of fs.readdirSync(CHAPTERS_DIR).filter((n) => n.endsWith('.json')).sort()) {
    let ch;
    try { ch = JSON.parse(fs.readFileSync(path.join(CHAPTERS_DIR, f), 'utf8')); }
    catch (e) { console.warn(`[gen-nar] 跳过非法 JSON：${f}（${e.message}）`); continue; }
    const cid = String(ch.id ?? path.basename(f, '.json'));
    for (const [slot, kind] of [['onEnter', 'open'], ['onExit', 'close']]) {
      for (const eff of ch.worldState?.[slot] ?? []) {
        if (eff?.type !== 'cutscene' || !Array.isArray(eff.lines)) continue;
        eff.lines.forEach((line, i) => {
          if (line) entries.push({ chapter: cid, kind, index: i + 1, id: null, text: String(line) });
        });
      }
    }
    for (const ev of ch.events ?? []) {
      if (ev.narration) entries.push({ chapter: cid, kind: 'event', index: 0, id: String(ev.id), text: String(ev.narration) });
    }
  }
  return entries;
}

/* ---------- 2. 计划：命名 + hash + 是否需重生成 ---------- */

function fileNameOf(e) {
  if (e.kind === 'event') return `nar-${e.chapter}-ev-${e.id}.mp3`;
  return `nar-${e.chapter}-${e.kind}-${e.index}.mp3`;
}

function buildPlan(entries, oldManifest) {
  const oldByFile = new Map((oldManifest?.entries ?? []).map((e) => [e.file, e]));
  return entries.map((e) => {
    const file = fileNameOf(e);
    const hash = createHash('md5').update(e.text).digest('hex').slice(0, 8);
    const abs = path.join(AUDIO_DIR, file);
    const hit = oldByFile.get(file);
    const stale = force || !hit || hit.hash !== hash || !fs.existsSync(abs) || fs.statSync(abs).size < 1024;
    return { ...e, file, hash, abs, stale };
  });
}

/* ---------- 3. 生成（mmx speech） ---------- */

function synthesize(entry) {
  execFileSync('mmx', [
    'speech', 'synthesize',
    '--text', entry.text,
    '--voice', VOICE,
    '--speed', SPEED,
    '--out', entry.abs,
  ], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
}

/* ---------- 主流程 ---------- */

let oldManifest = null;
try { oldManifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { /* 首跑/损坏 → 全量 */ }

const entries = collectEntries();
const plan = buildPlan(entries, oldManifest);
const todo = plan.filter((e) => e.stale);

console.log(`[gen-nar] 章节 JSON 共 ${entries.length} 条旁白：${plan.length - todo.length} 条缓存有效，${todo.length} 条待生成`);
if (dry) {
  for (const e of todo) console.log(`  ${e.file}  <-  ${e.text.slice(0, 24)}…`);
  process.exit(0);
}

let ok = 0, fail = 0;
for (const e of todo) {
  try {
    synthesize(e);
    const size = fs.existsSync(e.abs) ? fs.statSync(e.abs).size : 0;
    if (size < 1024) throw new Error(`输出过小（${size}B）`);
    ok++;
    console.log(`[gen-nar] ✓ ${e.file}（${(size / 1024).toFixed(0)}KB）`);
  } catch (err) {
    fail++;
    console.warn(`[gen-nar] ✗ ${e.file}：${err.message?.split('\n')[0] ?? err}`);
  }
}

if (fail > 0 && ok === 0) {
  console.error('[gen-nar] 全部失败：mmx 不可用或无 MINIMAX_API_KEY（降级路径见 docs/design/audio/sound-layer.md §6）');
  process.exit(2);
}

const manifest = {
  _comment: 'MC-6 D-4 旁白清单（tools/gen-narration.mjs 生成，勿手改）。文案源唯一：web/data/chapters/*.json；music.js 按 text 精确匹配 → assets/audio/<file>，文案改动未重生成时自动回落纯字幕。',
  voice: VOICE,
  speed: Number(SPEED),
  entries: plan.map(({ chapter, kind, index, id, text, hash, file }) => ({ chapter, kind, index, id, text, hash, file })),
};
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`[gen-nar] 完成：${ok} 生成 / ${fail} 失败，清单 → ${path.relative(ROOT, MANIFEST)}（共 ${plan.length} 条）`);
