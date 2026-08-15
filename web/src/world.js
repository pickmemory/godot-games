// world.js — chunk 管理：按玩家位置装载/卸载，脏块分帧重建（每帧限 2 生成 + 2 重建）
import * as THREE from 'three';
import { CHUNK_X, CHUNK_Y, CHUNK_Z } from './blocks.js';
import { generateChunk } from './terrain.js';
import { buildChunkGeometry } from './mesher.js';

const VIEW_RADIUS = 4;      // 视距（chunk 切比雪夫半径）
const UNLOAD_RADIUS = 6;    // 超出即卸载
const GEN_PER_FRAME = 2;
const MESH_PER_FRAME = 2;

export class World {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Texture} atlasTexture
   * @param {number} seed
   */
  constructor(scene, atlasTexture, seed = 1337) {
    this.scene = scene;
    this.seed = seed;
    this.chunks = new Map();          // "cx,cz" → { cx, cz, data, mesh, dirty }
    this.material = new THREE.MeshLambertMaterial({
      map: atlasTexture,
      alphaTest: 0.5,                 // 树叶镂空与不透明块共用一材质
    });
    this.tilesPerRow = 4;
    this._genQueue = [];              // 待生成 chunk 坐标（近优先）
    this._lastPcx = null; this._lastPcz = null;
  }

  key(cx, cz) { return cx + ',' + cz; }

  /** 世界坐标取方块；越界 y 或未加载 chunk 返回 AIR(0) */
  getBlock(x, y, z) {
    if (y < 0 || y >= CHUNK_Y) return 0;
    const cx = Math.floor(x / CHUNK_X), cz = Math.floor(z / CHUNK_Z);
    const c = this.chunks.get(this.key(cx, cz));
    if (!c) return 0;
    return c.data[(x - cx * CHUNK_X) + (z - cz * CHUNK_Z) * CHUNK_X + y * CHUNK_X * CHUNK_Z];
  }

  isChunkLoaded(cx, cz) { return this.chunks.has(this.key(cx, cz)); }

  /** 写方块并标脏（含跨界邻块）；未加载返回 false */
  setBlock(x, y, z, id) {
    if (y < 0 || y >= CHUNK_Y) return false;
    const cx = Math.floor(x / CHUNK_X), cz = Math.floor(z / CHUNK_Z);
    const c = this.chunks.get(this.key(cx, cz));
    if (!c) return false;
    const lx = x - cx * CHUNK_X, lz = z - cz * CHUNK_Z;
    c.data[lx + lz * CHUNK_X + y * CHUNK_X * CHUNK_Z] = id;
    c.dirty = true;
    // 跨界 → 邻 chunk 面剔除需重算
    if (lx === 0) this._markDirty(cx - 1, cz);
    if (lx === CHUNK_X - 1) this._markDirty(cx + 1, cz);
    if (lz === 0) this._markDirty(cx, cz - 1);
    if (lz === CHUNK_Z - 1) this._markDirty(cx, cz + 1);
    return true;
  }

  _markDirty(cx, cz) {
    const c = this.chunks.get(this.key(cx, cz));
    if (c) c.dirty = true;
  }

  /** 同步预热玩家出生点周围 3×3（防落地穿界） */
  warmup(px, pz) {
    const pcx = Math.floor(px / CHUNK_X), pcz = Math.floor(pz / CHUNK_Z);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        this._generate(pcx + dx, pcz + dz);
  }

  _generate(cx, cz) {
    const k = this.key(cx, cz);
    if (this.chunks.has(k)) return;
    const data = generateChunk(cx, cz, this.seed);
    const rec = { cx, cz, data, mesh: null, dirty: true };
    this.chunks.set(k, rec);
  }

  _buildMesh(rec) {
    const g = buildChunkGeometry(rec.data, this, rec.cx, rec.cz, this.tilesPerRow);
    if (rec.mesh) {
      rec.mesh.geometry.dispose();
      rec.mesh.geometry = this._toGeometry(g);
    } else {
      const mesh = new THREE.Mesh(this._toGeometry(g), this.material);
      mesh.position.set(rec.cx * CHUNK_X, 0, rec.cz * CHUNK_Z);
      this.scene.add(mesh);
      rec.mesh = mesh;
    }
    rec.dirty = false;
  }

  _toGeometry(g) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(g.indices, 1));
    return geo;
  }

  _unload(rec) {
    if (rec.mesh) {
      this.scene.remove(rec.mesh);
      rec.mesh.geometry.dispose();
    }
    this.chunks.delete(this.key(rec.cx, rec.cz));
  }

  /** 每帧调用：按玩家位置维护装载集 + 限量生成/重建 */
  update(playerPos) {
    const pcx = Math.floor(playerPos.x / CHUNK_X);
    const pcz = Math.floor(playerPos.z / CHUNK_Z);

    // 玩家跨 chunk 才重排队列
    if (pcx !== this._lastPcx || pcz !== this._lastPcz) {
      this._lastPcx = pcx; this._lastPcz = pcz;
      this._genQueue.length = 0;
      for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++)
        for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++)
          this._genQueue.push([pcx + dx, pcz + dz, dx * dx + dz * dz]);
      this._genQueue.sort((a, b) => a[2] - b[2]);
    }

    // 限量生成
    let gen = GEN_PER_FRAME;
    while (gen > 0 && this._genQueue.length) {
      const [cx, cz] = this._genQueue.shift();
      if (this.chunks.has(this.key(cx, cz))) continue;
      this._generate(cx, cz);
      gen--;
    }

    // 限量重建脏块（含新生成）
    let meshed = MESH_PER_FRAME;
    for (const rec of this.chunks.values()) {
      if (meshed === 0) break;
      if (rec.dirty) { this._buildMesh(rec); meshed--; }
    }

    // 卸载远块
    for (const rec of this.chunks.values()) {
      if (Math.max(Math.abs(rec.cx - pcx), Math.abs(rec.cz - pcz)) > UNLOAD_RADIUS) {
        this._unload(rec);
      }
    }
  }
}
