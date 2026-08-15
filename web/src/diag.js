// diag.js — 现场诊断日志（排查 E 交谈用，问题定位后可整体移除）
//
// 设计：
//   - dlog(event, data) → 环形缓冲（600 条）+ localStorage 持久化（防抖 0.4s，关页/切后台强刷）
//   - F8 打开查看面板（自动退出指针锁）：复制全部 / 下载 .txt / 清空
//   - 每次会话开屏记录 DIAG_VERSION + URL —— 若玩家日志里没有该版本号，说明浏览器跑的是旧缓存代码
//
// 埋点位置（main.js）：boot、每个数据 fetch 的命中/兜底、指针锁变化、开卷演出起止与跳过、
// 主循环 sim 开关、交谈提示出现/消失、每次 KeyE 的完整分支上下文（含全部 NPC 在场快照与距离）、
// 对话开/关、死亡。

export const DIAG_VERSION = 'diag-v1-e-talk';

const KEY = 'sgsc.diag.log';
const MAX_ENTRIES = 600;
const MAX_JSON = 400;

let buf = [];
try { buf = JSON.parse(localStorage.getItem(KEY) ?? '[]'); if (!Array.isArray(buf)) buf = []; } catch { buf = []; }

const session = new Date().toISOString().slice(11, 19);

function save() { try { localStorage.setItem(KEY, JSON.stringify(buf)); } catch { /* 满/隐私模式则丢弃 */ } }
let saveTimer = 0;
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }
addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

export function dlog(ev, data) {
  let d = '';
  try { d = JSON.stringify(data ?? {}); } catch { d = '"<unserializable>"'; }
  if (d.length > MAX_JSON) d = d.slice(0, MAX_JSON) + '…';
  buf.push(`[${session}] t=${(performance.now() / 1000).toFixed(1)}s ${ev} ${d}`);
  if (buf.length > MAX_ENTRIES) buf.splice(0, buf.length - MAX_ENTRIES);
  saveSoon();
}

dlog('BOOT', { ver: DIAG_VERSION, url: location.href, ua: navigator.userAgent.slice(0, 90) });

/* ---------- F8 查看面板 ---------- */
let panel = null;

function closePanel() { panel?.remove(); panel = null; }

function togglePanel() {
  if (panel) { closePanel(); return; }
  document.exitPointerLock?.();
  panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(8,10,8,.97);color:#9f9;display:flex;flex-direction:column;padding:16px;font:12px/1.6 Consolas,monospace;';

  const title = document.createElement('div');
  title.style.cssText = 'color:#cfc;margin-bottom:6px;';
  title.textContent = `诊断日志 ${DIAG_VERSION}（新→旧）。复现问题后点「复制全部」，把内容发回给排查者。`;

  const bar = document.createElement('div');
  bar.style.cssText = 'margin-bottom:8px;display:flex;gap:8px;';
  const mk = (text, fn) => { const b = document.createElement('button'); b.textContent = text; b.addEventListener('click', fn); return b; };

  const pre = document.createElement('pre');
  pre.style.cssText = 'flex:1;overflow:auto;margin:0;white-space:pre-wrap;word-break:break-all;';
  const render = () => { pre.textContent = buf.length ? buf.slice().reverse().join('\n') : '(空)'; };
  render();

  const copyBtn = mk('复制全部', async () => {
    try { await navigator.clipboard.writeText(buf.join('\n')); copyBtn.textContent = '已复制✓'; }
    catch { copyBtn.textContent = '复制失败，请手动全选'; pre.focus(); }
  });
  bar.append(
    copyBtn,
    mk('下载 .txt', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf.join('\n')], { type: 'text/plain' }));
      a.download = `sgsc-diag-${Date.now()}.txt`;
      a.click();
    }),
    mk('清空', () => { buf = []; save(); render(); }),
    mk('关闭 (F8)', closePanel),
  );

  panel.append(title, bar, pre);
  document.body.append(panel);
  dlog('panel-open', {});
}

export function installDiag() {
  addEventListener('keydown', (e) => {
    if (e.code === 'F8') { e.preventDefault(); togglePanel(); }
  });
}
