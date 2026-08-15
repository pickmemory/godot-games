// dialog.js — MC-3b 对话系统：E 键触发、数据驱动对话树、立绘占位、效果路由
//
// 职责边界：
//   - DialogUI 只管「呈现 + 树遍历」：面板 DOM 在 index.html（#dialog），文案/选项全来自
//     web/data/npc/dialogs.json（schema 见 web/data/npc/README.md），代码零台词。
//   - 对话节点的 effects（startQuest/setFlag/notify…）不在本模块执行：经构造注入的
//     onEffect(effect) 回调路由给 main.js（与 chapter.js 的 registerEffect 同一模式），
//     为 MC-3d 历史人物台词/任务弧预留管线。
//   - 立绘为占位：canvas 画底色 + 名字首字（数据可配 portrait.bg/fg）；真立绘接入时
//     只改 drawPortrait 的实现与数据，不改树遍历逻辑。

/** 兜底对话树（dialogs.json 缺失/离线/引用错键时兜底，保持可交谈） */
export const FALLBACK_DIALOGS = {
  'elder-01': {
    start: 'a',
    nodes: {
      a: { text: '（他望着远处的烟，没有说话。）', choices: [{ text: '告辞', next: null }] },
    },
  },
};

/** 立绘占位：底色 + 名字首字（serif 大字），72×72 画进 #dPortrait */
function drawPortrait(cv, npc) {
  const ctx = cv.getContext('2d');
  const bg = npc?.portrait?.bg ?? '#3d3226';
  const fg = npc?.portrait?.fg ?? '#e8d9b0';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = 'rgba(232,217,176,.45)';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, cv.width - 4, cv.height - 4);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 40px "KaiTi", "STKaiti", "Microsoft YaHei", serif';
  ctx.fillText((npc?.name ?? '?').slice(0, 1), cv.width / 2, cv.height / 2 + 2);
}

export class DialogUI {
  /**
   * @param {{onEffect?:(effect:object)=>void}} opts
   *   onEffect —— 对话节点/选项 effects 的执行方（main.js 注册：startQuest→quests、setFlag→timeline…）
   */
  constructor(opts = {}) {
    this.onEffect = opts.onEffect ?? (() => {});
    this.rootEl = document.getElementById('dialog');
    this.nameEl = document.getElementById('dName');
    this.titleEl = document.getElementById('dTitle');
    this.portraitEl = document.getElementById('dPortrait');
    this.textEl = document.getElementById('dText');
    this.choicesEl = document.getElementById('dChoices');
    this.isOpen = false;
    this._tree = null;
    this._npc = null;
    this._current = null;
  }

  /**
   * 打开对话（main.js 在 E 键 + 附近有可交谈 NPC 时调用）
   * @param {object} tree dialogs.json 里的单棵树（{start, nodes}）
   * @param {object} npc npc 实体（名牌/立绘信息）
   */
  open(tree, npc) {
    this._tree = tree && tree.nodes ? tree : FALLBACK_DIALOGS['elder-01'];
    this._npc = npc ?? null;
    this.nameEl.textContent = npc?.name ?? '？？？';
    this.titleEl.textContent = npc?.title ?? '';
    drawPortrait(this.portraitEl, npc);
    this.rootEl.classList.remove('hidden');
    this.isOpen = true;
    this._showNode(this._tree.start);
  }

  close() {
    if (!this.isOpen) return;
    this.rootEl.classList.add('hidden');
    this.isOpen = false;
    this._tree = null;
    this._current = null;
    this._npc = null;
  }

  _showNode(id) {
    const node = this._tree.nodes[id];
    if (!node) {                       // 引用断链 → 静默收尾，不卡死对话
      console.warn(`[dialog] 节点缺失: ${id}，对话提前结束`);
      this.close();
      return;
    }
    this._current = id;
    // 节点进入时执行 effects（选项效果在选择时执行）
    for (const eff of node.effects ?? []) this.onEffect(eff);

    this.textEl.textContent = node.text ?? '……';

    // 选项：数据给了用数据的；没给则默认「告辞」收尾（叶子节点友好）
    const choices = Array.isArray(node.choices) && node.choices.length
      ? node.choices
      : [{ text: '告辞', next: null }];
    this.choicesEl.innerHTML = '';
    for (const c of choices) {
      const btn = document.createElement('button');
      btn.className = 'dChoice';
      btn.textContent = c.text ?? '……';
      btn.addEventListener('click', () => this._choose(c));
      this.choicesEl.appendChild(btn);
    }
  }

  _choose(choice) {
    for (const eff of choice.effects ?? []) this.onEffect(eff);
    if (choice.next) this._showNode(choice.next);
    else this.close();
  }

  /** E/ESC 关闭（main.js 调；关闭后重锁指针的编排也在 main.js） */
  handleKey(code) {
    if (!this.isOpen) return false;
    if (code === 'KeyE' || code === 'Escape') { this.close(); return true; }
    return true;   // 对话开着 → 消费按键，不透传给合成/挖掘
  }
}
