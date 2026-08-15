// interaction.js — DDA 体素射线选块 + 线框高亮 + 按住挖掘进度 + 放置
import * as THREE from 'three';
import { isSolid, BLOCK_DEFS } from './blocks.js';
import { digTime, toolDefOf, FALLBACK_MINING } from './mining.js';

const REACH = 6;          // 交互距离（格）
const PLACE_CD = 0.22;    // 放置冷却（秒）

export class Interaction {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {import('./world.js').World} world
   * @param {THREE.Scene} scene
   * @param {import('./player.js').Player} player  放置时做 AABB 相交拒绝
   * @param {{onDigProgress:(pct:number)=>void,
   *          onDigComplete:(blockId:number,pos:[number,number,number])=>void,
   *          onPlace:(pos:[number,number,number])=>void}} callbacks
   */
  constructor(camera, world, scene, player, callbacks) {
    this.camera = camera;
    this.world = world;
    this.player = player;
    this.cb = callbacks;

    this.digKey = null;
    this.digProgress = 0;
    this._placeCd = 0;
    this.miningCfg = FALLBACK_MINING;   // main 在 fetch data/mining.json 后注入

    // 选块高亮线框（黑框，略大于 1 格防 z-fighting）
    const box = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: 0x101010, transparent: true, opacity: 0.85 }),
    );
    box.dispose();
    this.highlight.visible = false;
    scene.add(this.highlight);
  }

  /** Amanatides & Woo DDA。返回 {pos, normal} 或 null */
  raycast() {
    const ox = this.camera.position.x, oy = this.camera.position.y, oz = this.camera.position.z;
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);

    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = d.x > 0 ? 1 : -1, stepY = d.y > 0 ? 1 : -1, stepZ = d.z > 0 ? 1 : -1;
    const tDX = Math.abs(1 / (d.x || 1e-10)), tDY = Math.abs(1 / (d.y || 1e-10)), tDZ = Math.abs(1 / (d.z || 1e-10));
    let tMX = ((d.x > 0 ? x + 1 - ox : ox - x) || 1e-10) * tDX;
    let tMY = ((d.y > 0 ? y + 1 - oy : oy - y) || 1e-10) * tDY;
    let tMZ = ((d.z > 0 ? z + 1 - oz : oz - z) || 1e-10) * tDZ;

    let nx = 0, ny = 0, nz = 0;
    let t = 0;
    while (t <= REACH) {
      if (isSolid(this.world.getBlock(x, y, z))) {
        return { pos: [x, y, z], normal: [nx, ny, nz] };
      }
      if (tMX < tMY && tMX < tMZ) { x += stepX; t = tMX; tMX += tDX; nx = -stepX; ny = 0; nz = 0; }
      else if (tMY < tMZ)         { y += stepY; t = tMY; tMY += tDY; nx = 0; ny = -stepY; nz = 0; }
      else                        { z += stepZ; t = tMZ; tMZ += tDZ; nx = 0; ny = 0; nz = -stepZ; }
    }
    return null;
  }

  /**
   * @param {number} dt
   * @param {boolean} digHeld  左键按住
   * @param {boolean} placeHeld 右键按住/单击
   * @param {number} heldItemId 当前手持物品 id（0=空手；<100 方块可放置，>=100 工具/材料不可放置）
   */
  update(dt, digHeld, placeHeld, heldItemId) {
    this._placeCd = Math.max(0, this._placeCd - dt);
    const hit = this.raycast();

    if (!hit) {
      this.highlight.visible = false;
      this._resetDig();
      return;
    }

    // 高亮：随挖掘进度轻微收缩（手感反馈的一部分）
    const shrink = 1 - this.digProgress * 0.18;
    this.highlight.visible = true;
    this.highlight.scale.setScalar(shrink);
    this.highlight.position.set(hit.pos[0] + 0.5, hit.pos[1] + 0.5, hit.pos[2] + 0.5);

    // 挖掘（按住累计；耗时 = 硬度×工具效率，见 mining.js）
    if (digHeld) {
      const key = hit.pos.join(',');
      if (key !== this.digKey) { this.digKey = key; this.digProgress = 0; }
      const id = this.world.getBlock(hit.pos[0], hit.pos[1], hit.pos[2]);
      const def = BLOCK_DEFS[id];
      const seconds = digTime(this.miningCfg, def, toolDefOf(heldItemId));
      this.digProgress += dt / seconds;
      this.cb.onDigProgress(Math.min(1, this.digProgress));

      if (this.digProgress >= 1) {
        const removed = this.world.setBlock(hit.pos[0], hit.pos[1], hit.pos[2], 0);
        this._resetDig();
        if (removed) this.cb.onDigComplete(id, hit.pos);
      }
    } else {
      this._resetDig();
    }

    // 放置（仅手持方块物品；面邻接 + 冷却 + 不与玩家重叠 + 不覆盖实块）
    const placeId = heldItemId > 0 && heldItemId < 100 ? heldItemId : 0;
    if (placeHeld && placeId > 0 && this._placeCd === 0) {
      const tx = hit.pos[0] + hit.normal[0];
      const ty = hit.pos[1] + hit.normal[1];
      const tz = hit.pos[2] + hit.normal[2];
      if (ty >= 0 && ty < 64 && !isSolid(this.world.getBlock(tx, ty, tz))) {
        const a = this.player.aabb;
        const overlap = tx + 1 > a.x0 && tx < a.x1
          && ty + 1 > a.y0 && ty < a.y1
          && tz + 1 > a.z0 && tz < a.z1;
        if (!overlap && this.world.setBlock(tx, ty, tz, placeId)) {
          this.cb.onPlace([tx, ty, tz]);
          this._placeCd = PLACE_CD;
        }
      }
    }
  }

  _resetDig() {
    if (this.digKey !== null) this.cb.onDigProgress(0);
    this.digKey = null;
    this.digProgress = 0;
  }
}
