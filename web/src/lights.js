// lights.js — MC-5x 照明：火把/篝火 PointLight 池 + 手持火把
//
// 设计：
//   - 灯池固定 N 个 PointLight 常驻（intensity=0 关闭，用不灭灯数，避免灯数变化触发
//     Three 材质重编译卡顿）；世界光源按距玩家最近调度入池。
//   - 光源发现：限频 0.6s 扫玩家周围 loaded chunks 的 Uint8Array（每 chunk 16k 字节直读，
//     49 chunk 约 1ms），收集 BLOCK.TORCH / CAMPFIRE（BLOCK_DEFS[id].light 即灯参数）。
//   - 篝火 flicker：亮度随时间正弦+伪噪声抖动；火把轻微呼吸。
//   - 手持火把：inventory 手持 TORCH 时，一盏专用灯跟随玩家（y+1.3，稍向前偏）。
//   - 夜间效果最佳：白天点光被日光稀释属正常物理直觉，不做强制压暗。
import * as THREE from 'three';
import { BLOCK, BLOCK_DEFS } from './blocks.js';

const POOL_SIZE = 8;          // 世界光源池（不含手持灯）
const RESCAN_INTERVAL = 0.6;  // 扫描间隔（秒）
const SCAN_RADIUS = 2;        // 扫 chunk 半径（2 → 5×5 chunk = 80 格见方）

export class LightManager {
  /** @param {THREE.Scene} scene @param {import('./world.js').World} world */
  constructor(scene, world) {
    this.world = world;
    this._t = 0;               // flicker 时钟
    this._rescanT = 0;
    /** @type {Map<string, {x:number,y:number,z:number,cfg:object}>} 世界光源（key=坐标） */
    this.sources = new Map();

    // 固定灯池：暖色点光，初始 intensity=0
    this.pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const l = new THREE.PointLight(0xffb35c, 0, 7.5, 1.6);
      l.castShadow = false;
      scene.add(l);
      this.pool.push(l);
    }
    // 手持灯（比世界灯更亮一点，始终跟随）
    this.hand = new THREE.PointLight(0xffc06a, 0, 6.5, 1.6);
    scene.add(this.hand);
  }

  /** 扫描玩家周围 loaded chunks，重建光源表 */
  _rescan(px, pz) {
    this.sources.clear();
    const cx0 = Math.floor(px / 16), cz0 = Math.floor(pz / 16);
    for (let cz = cz0 - SCAN_RADIUS; cz <= cz0 + SCAN_RADIUS; cz++) {
      for (let cx = cx0 - SCAN_RADIUS; cx <= cx0 + SCAN_RADIUS; cx++) {
        const chunk = this.world.chunks.get(this.world.key(cx, cz));
        if (!chunk?.data) continue;
        const data = chunk.data;
        for (let i = 0; i < data.length; i++) {
          const id = data[i];
          if (id !== BLOCK.TORCH && id !== BLOCK.CAMPFIRE) continue;
          const cfg = BLOCK_DEFS[id].light;
          if (!cfg) continue;
          const y = (i / 256) | 0, rem = i % 256, z = (rem / 16) | 0, x = rem % 16;
          this.sources.set(`${cx},${cz},${i}`, {
            x: cx * 16 + x + 0.5, y: y + 0.8, z: cz * 16 + z + 0.5,
            campfire: id === BLOCK.CAMPFIRE,
            cfg,
          });
        }
      }
    }
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} playerPos 玩家脚底
   * @param {number|false} heldId 手持物品（TORCH 方块 id 时开手持灯；否则关）
   */
  update(dt, playerPos, heldId) {
    this._t += dt;
    this._rescanT -= dt;
    if (this._rescanT <= 0) {
      this._rescanT = RESCAN_INTERVAL;
      this._rescan(playerPos.x, playerPos.z);
    }

    // 世界光源按距离取最近 POOL_SIZE 个入池
    const arr = [...this.sources.values()];
    if (arr.length > POOL_SIZE) {
      arr.sort((a, b) =>
        ((a.x - playerPos.x) ** 2 + (a.z - playerPos.z) ** 2)
        - ((b.x - playerPos.x) ** 2 + (b.z - playerPos.z) ** 2));
      arr.length = POOL_SIZE;
    }
    for (let i = 0; i < POOL_SIZE; i++) {
      const l = this.pool[i];
      const s = arr[i];
      if (!s) { l.intensity = 0; continue; }
      l.position.set(s.x, s.y, s.z);
      l.distance = s.cfg.dist;
      l.color.set(s.cfg.color);
      // flicker：篝火大幅跳动，火把轻微呼吸
      const wob = s.campfire
        ? 0.82 + 0.13 * Math.sin(this._t * 9 + s.x * 3.1 + s.z * 1.7) + 0.05 * Math.sin(this._t * 23 + s.z * 5.3)
        : 0.94 + 0.06 * Math.sin(this._t * 5 + s.x);
      l.intensity = s.cfg.intensity * wob;
    }

    // 手持火把
    if (heldId === BLOCK.TORCH) {
      this.hand.position.set(playerPos.x, playerPos.y + 1.3, playerPos.z);
      this.hand.intensity = 1.1 * (0.92 + 0.08 * Math.sin(this._t * 6.5));
    } else {
      this.hand.intensity = 0;
    }
  }
}
