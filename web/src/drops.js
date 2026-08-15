// drops.js — 掉落物实体：方块/物品破坏后弹出的小方块，落地弹跳 → 浮动旋转 → 靠近吸附拾取
// 模块边界：只依赖 blocks/items 注册表与 WorldLike.getBlock；拾取入包由回调（main.js）完成。
import * as THREE from 'three';
import { BLOCK_DEFS, isSolid } from './blocks.js';
import { ITEM } from './items.js';

const SIZE = 0.25;          // 掉落物边长（格）
const HALF = SIZE / 2;
const GRAVITY = 16;         // 比玩家轻，飘一点更好捡
const LIFETIME = 90;        // 存活秒数（超时消散）
const FADE_TAIL = 4;        // 最后几秒缩小淡出
const PICKUP_DELAY = 0.4;   // 弹出后短暂不可拾（防瞬间入包看不见）
const MAGNET_DIST = 2.2;    // 小于该距离开始被吸向玩家
const PICKUP_DIST = 1.1;    // 小于该距离尝试入包
const MAX_DROPS = 128;      // 上限（超出丢弃最旧的，防刷怪机式堆积）

/** 非方块物品的掉落物颜色（小方块占位；正式图标留给 MC-5a 美术接入） */
const ITEM_COLORS = {
  [ITEM.COAL]: 0x232323,
  [ITEM.STICK]: 0x8a6d3b,
};

export class DropManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./world.js').World} world   仅用 getBlock 做落地/贴墙判定
   * @param {{ texture: THREE.Texture, tilesPerRow: number }} atlas  buildAtlas() 结果
   */
  constructor(scene, world, atlas) {
    this.scene = scene;
    this.world = world;
    this.atlas = atlas;
    this.drops = [];
    this._geoCache = new Map();   // itemId → BoxGeometry（方块按 tiles 贴 UV）
    this._matCache = new Map();   // 颜色 → MeshLambertMaterial（非方块物品）
    this._blockMat = new THREE.MeshLambertMaterial({
      map: atlas.texture,
      alphaTest: 0.5,
    });
    this._time = 0;
  }

  /** 掉落物数量（UI/调试用） */
  get count() { return this.drops.length; }

  /** 方块掉落物几何：六面按 top/side/bottom 瓦片重映射 UV（atlas 采样内缩防渗色） */
  _blockGeometry(blockDef) {
    const tpr = this.atlas.tilesPerRow;
    const pad = 1 / 512;
    const geo = new THREE.BoxGeometry(SIZE, SIZE, SIZE);
    const uv = geo.attributes.uv;
    // BoxGeometry 面序：+x,-x,+y,-y,+z,-z；每面 4 顶点，默认 uv ∈ {0,1}
    for (let f = 0; f < 6; f++) {
      const tile = f === 2 ? blockDef.tiles.top : f === 3 ? blockDef.tiles.bottom : blockDef.tiles.side;
      const tc = tile % tpr, tr = Math.floor(tile / tpr);
      const u0 = tc / tpr + pad, u1 = (tc + 1) / tpr - pad;
      const v1 = 1 - tr / tpr - pad, v0 = 1 - (tr + 1) / tpr + pad;
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, u0 + uv.getX(k) * (u1 - u0), v0 + uv.getY(k) * (v1 - v0));
      }
    }
    return geo;
  }

  _geometryOf(itemId) {
    let geo = this._geoCache.get(itemId);
    if (!geo) {
      geo = itemId < 100
        ? this._blockGeometry(BLOCK_DEFS[itemId])
        : new THREE.BoxGeometry(SIZE, SIZE, SIZE); // 非方块：单色小方块
      this._geoCache.set(itemId, geo);
    }
    return geo;
  }

  _materialOf(itemId) {
    if (itemId < 100) return this._blockMat;
    let mat = this._matCache.get(itemId);
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({ color: ITEM_COLORS[itemId] ?? 0xcccccc });
      this._matCache.set(itemId, mat);
    }
    return mat;
  }

  /**
   * 生成一个掉落物。
   * @param {number} itemId 物品 id（方块 <100 / 物品 ≥100）
   * @param {[number,number,number]} pos 被破坏方块的世界坐标（格）
   * @param {number} count 数量（合并为一个实体）
   */
  spawn(itemId, pos, count = 1) {
    if (!itemId) return;
    if (this.drops.length >= MAX_DROPS) {
      const old = this.drops.shift();
      this.scene.remove(old.mesh);
    }
    const mesh = new THREE.Mesh(this._geometryOf(itemId), this._materialOf(itemId));
    mesh.scale.setScalar(1);
    this.scene.add(mesh);
    this.drops.push({
      itemId,
      count,
      mesh,
      // 从方块中心弹出，带随机水平初速
      pos: new THREE.Vector3(pos[0] + 0.5, pos[1] + 0.5, pos[2] + 0.5),
      vel: new THREE.Vector3((Math.random() - 0.5) * 2.2, 2.6 + Math.random(), (Math.random() - 0.5) * 2.2),
      resting: false,
      age: 0,
      phase: Math.random() * Math.PI * 2, // 浮动相位错开
      retryCd: 0,                          // 行囊满时重试冷却
    });
  }

  /**
   * 每帧推进物理/动画/拾取。
   * @param {number} dt
   * @param {THREE.Vector3} playerPos 玩家脚底中心
   * @param {boolean} canPickup 是否允许拾取（存活且指针锁定中）
   * @param {(itemId:number,count:number)=>number} onPickup 尝试入包，返回实际收下数量（0=满/未收）
   */
  update(dt, playerPos, canPickup, onPickup) {
    this._time += dt;
    const px = playerPos.x, py = playerPos.y + 0.9, pz = playerPos.z; // 玩家胸口

    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      d.retryCd = Math.max(0, d.retryCd - dt);

      if (d.age >= LIFETIME) {
        this.scene.remove(d.mesh);
        this.drops.splice(i, 1);
        continue;
      }

      // 拾取判定（延迟过后才可吸/可捡）
      if (canPickup && d.age > PICKUP_DELAY && d.retryCd === 0) {
        const dx = px - d.pos.x, dy = py - d.pos.y, dz = pz - d.pos.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist < MAGNET_DIST && dist > 0.001) {
          // 磁吸：朝玩家加速
          const pull = 14 * dt / dist;
          d.vel.x += dx * pull; d.vel.y += dy * pull; d.vel.z += dz * pull;
          d.resting = false;
          if (dist < PICKUP_DIST) {
            const taken = onPickup(d.itemId, d.count);
            if (taken >= d.count) {
              this.scene.remove(d.mesh);
              this.drops.splice(i, 1);
              continue;
            }
            if (taken > 0) d.count -= taken;
            d.retryCd = 1; // 没全收下（行囊满）→ 1 秒后再试
          }
        }
      }

      // 物理：重力 + 逐轴碰撞（中心±HALF 的占位体素判定）
      d.vel.y -= GRAVITY * dt;
      if (d.vel.y < -30) d.vel.y = -30;

      let nx = d.pos.x + d.vel.x * dt;
      if (!isSolid(this.world.getBlock(Math.floor(nx), Math.floor(d.pos.y - HALF + 0.05), Math.floor(d.pos.z)))) {
        d.pos.x = nx;
      } else d.vel.x = 0;

      let nz = d.pos.z + d.vel.z * dt;
      if (!isSolid(this.world.getBlock(Math.floor(d.pos.x), Math.floor(d.pos.y - HALF + 0.05), Math.floor(nz)))) {
        d.pos.z = nz;
      } else d.vel.z = 0;

      const ny = d.pos.y + d.vel.y * dt;
      if (d.vel.y < 0 && isSolid(this.world.getBlock(Math.floor(d.pos.x), Math.floor(ny - HALF), Math.floor(d.pos.z)))) {
        d.pos.y = Math.floor(ny - HALF) + 1 + HALF; // 落到方块顶面
        d.vel.y = 0;
        d.resting = true;
      } else {
        d.pos.y = ny;
        if (Math.abs(d.vel.y) > 0.05) d.resting = false;
      }

      // 落地后水平衰减（滑动几格停下）
      if (d.resting) {
        const k = Math.max(0, 1 - 6 * dt);
        d.vel.x *= k; d.vel.z *= k;
      }

      // 渲染：旋转 + 落地后上下浮动；临近消散时缩小
      d.mesh.position.copy(d.pos);
      if (d.resting) d.mesh.position.y += Math.sin(this._time * 2.2 + d.phase) * 0.04 + 0.04;
      d.mesh.rotation.y += dt * (d.resting ? 1.4 : 3);
      const left = LIFETIME - d.age;
      if (left < FADE_TAIL) d.mesh.scale.setScalar(Math.max(0.05, left / FADE_TAIL));
    }
  }

  /** 清场（重生/切章节用；几何与材质是共享缓存，只移出场景） */
  clearAll() {
    for (const d of this.drops) this.scene.remove(d.mesh);
    this.drops.length = 0;
  }
}
