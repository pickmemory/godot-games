// quests.js — MC-3b 最小任务系统：注册 / 开启 / 进度 / 完成回调（供 MC-3d 第一章事件弧调用）
//
// 职责边界：
//   - 只做「任务状态机」：locked → active → done；进度由外部事件推送（notify(event, n)），
//     不感知 NPC/对话/方块——main.js 把玩家行为（放置/挖掘…）翻译成事件名喂进来。
//   - 任务定义全部数据驱动（web/data/quests.json，schema 见 web/data/npc/README.md）；
//     本阶段只放占位定义验证管线，具体任务内容（黄巾第一章事件弧）由 MC-3d 充实。
//   - 存档持久化留给 MC-4 存档层（当前仅内存态）。

/** 兜底任务定义（quests.json 缺失/离线时同构兑底） */
export const FALLBACK_QUESTS = {
  quests: [
    { id: 'settle-down', title: '栖身之所（占位）', desc: '在乱世里垒起自己的墙。', objective: { event: 'blocksPlaced', count: 20 } },
  ],
};

export class QuestSystem {
  /**
   * @param {{onStart?:(q:object)=>void, onComplete?:(q:object)=>void}} hooks
   */
  constructor(hooks = {}) {
    this.defs = new Map();   // id → 定义
    this.state = new Map();  // id → {status:'locked'|'active'|'done', progress:number}
    this.onStart = hooks.onStart ?? null;
    this.onComplete = hooks.onComplete ?? null;
  }

  /**
   * 批量注册（main.js 装配时调用一次）
   * @param {object[]} list quests.json 的 quests 数组
   */
  registerAll(list) {
    for (const [i, q] of (Array.isArray(list) ? list : []).entries()) {
      if (!q || typeof q !== 'object' || !q.id) { console.warn(`[quests] quests[${i}] 缺 id，跳过`); continue; }
      if (!q.objective?.event || !(Number(q.objective.count) > 0)) {
        console.warn(`[quests] 任务 ${q.id} 的 objective 非法（需 event + count>0），跳过`);
        continue;
      }
      if (this.defs.has(String(q.id))) { console.warn(`[quests] 任务 ${q.id} 重复注册，后者覆盖`); }
      this.defs.set(String(q.id), {
        id: String(q.id),
        title: String(q.title ?? q.id),
        desc: String(q.desc ?? ''),
        objective: { event: String(q.objective.event), count: Number(q.objective.count) },
      });
      this.state.set(String(q.id), { status: 'locked', progress: 0 });
    }
  }

  /** 开启任务（对话效果 startQuest 调用）；已开启/已完成为幂等 no-op */
  begin(id) {
    const key = String(id);
    const def = this.defs.get(key);
    if (!def) { console.warn(`[quests] 未注册任务: ${key}`); return false; }
    const st = this.state.get(key);
    if (st.status !== 'locked') return false;
    st.status = 'active';
    st.progress = 0;
    this.onStart?.(def);
    return true;
  }

  /**
   * 推进所有 active 且 objective.event === event 的任务
   * @param {string} event 事件名（与 chapter.js ctx.stats 同名约定：blocksPlaced / blocksMined / talk:<npcId>…）
   * @param {number} [n=1] 增量
   */
  notify(event, n = 1) {
    for (const [id, def] of this.defs) {
      if (def.objective.event !== event) continue;
      const st = this.state.get(id);
      if (st.status !== 'active') continue;
      st.progress += n;
      if (st.progress >= def.objective.count) {
        st.status = 'done';
        st.progress = def.objective.count;
        this.onComplete?.(def);
      }
    }
  }

  /** 查询（HUD/对话条件用） */
  get(id) {
    const key = String(id);
    const def = this.defs.get(key);
    return def ? { ...def, ...this.state.get(key) } : null;
  }

  get activeList() { return [...this.defs.values()].filter((d) => this.state.get(d.id).status === 'active'); }
}
