// health.js — 玩家生存：血量 / 受击无敌帧 / 缓慢回复 / 死亡与重生
// 数值调优入口：main.js 构造时传 tuning（数据驱动数值后续可并入 web/data/）。

export class Health {
  /**
   * @param {number} maxHp
   * @param {{onChange?:(hp:number,maxHp:number)=>void, onDeath?:()=>void}} callbacks
   * @param {{iframe?:number, regenDelay?:number, regenInterval?:number}} [tuning]
   *   iframe: 受击无敌秒数；regenDelay: 脱战多少秒后开始回血；regenInterval: 每次回血间隔秒
   */
  constructor(maxHp = 20, callbacks = {}, tuning = {}) {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.cb = callbacks;
    this.iframe = tuning.iframe ?? 0.6;
    this.regenDelay = tuning.regenDelay ?? 8;
    this.regenInterval = tuning.regenInterval ?? 4;

    this.dead = false;
    this._iframeT = 0;   // 剩余无敌时间
    this._noDamageT = 0; // 距上次受击秒数
    this._regenT = 0;    // 回血累计计时
  }

  /**
   * 受击。无敌帧内或已死亡则忽略。
   * @param {number} amount 伤害点数（取整）
   * @param {*} [sourcePos] 预留：伤害来源位置（击退方向等，由 main.js 侧处理）
   * @returns {boolean} 是否实际生效
   */
  damage(amount, sourcePos = null) {
    if (this.dead || amount <= 0 || this._iframeT > 0) return false;
    this.hp = Math.max(0, this.hp - Math.round(amount));
    this._iframeT = this.iframe;
    this._noDamageT = 0;
    this._regenT = 0;
    this.cb.onChange?.(this.hp, this.maxHp);
    if (this.hp <= 0) {
      this.dead = true;
      this.cb.onDeath?.();
    }
    return true;
  }

  /** 每帧调用：无敌帧倒计时 + 脱战回血（1 点 / regenInterval 秒） */
  update(dt) {
    if (this.dead) return;
    this._iframeT = Math.max(0, this._iframeT - dt);
    this._noDamageT += dt;
    if (this._noDamageT >= this.regenDelay && this.hp < this.maxHp) {
      this._regenT += dt;
      if (this._regenT >= this.regenInterval) {
        this._regenT = 0;
        this.hp = Math.min(this.maxHp, this.hp + 1);
        this.cb.onChange?.(this.hp, this.maxHp);
      }
    }
  }

  /** 死亡后重生：回满血并清空计时 */
  respawn() {
    this.dead = false;
    this.hp = this.maxHp;
    this._iframeT = 0;
    this._noDamageT = 0;
    this._regenT = 0;
    this.cb.onChange?.(this.hp, this.maxHp);
  }
}
