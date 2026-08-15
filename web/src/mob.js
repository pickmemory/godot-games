// mob.js — 夜间敌对生物「流民行尸」：直线逼近 + 跳跃/侧移绕障的简化体素寻路，白天下沉消散
// 数值从 web/data/mobs.json 读入（fetch 失败用 FALLBACK_MOB_CONFIG 兜底）。
import * as THREE from 'three';
import { isSolid, CHUNK_Y } from './blocks.js';
import { surfaceHeight } from './terrain.js';

const GRAVITY = 28;

/** 兜底配置（与 web/data/mobs.json 同构） */
export const FALLBACK_MOB_CONFIG = {
  name: '流民行尸',
  maxHp: 10,
  speed: 2.7,          // 格/秒
  damage: 3,           // 点/次
  attackRange: 1.7,    // 格（水平）
  attackCooldown: 1.1, // 秒
  jumpVelocity: 8.6,   // 跳跃初速（米/秒）
  width: 0.6,
  height: 1.9,
  spawn: { maxCount: 4, interval: 7, minDist: 16, maxDist: 26 },
  despawnDist: 64,
};

/* 共享材质（全体个体复用；dispose 只清几何体） */
const MAT_SKIN = new THREE.MeshLambertMaterial({ color: 0x7f9a63 });
const MAT_CLOTH = new THREE.MeshLambertMaterial({ color: 0x4a4136 });
const MAT_PANTS = new THREE.MeshLambertMaterial({ color: 0x33393f });
const MAT_EYE = new THREE.MeshBasicMaterial({ color: 0xff4030 }); // 夜里两点红光

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

class Zombie {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./world.js').World} world
   * @param {object} cfg mobs.json 单条配置
   * @param {number} x 出生点（脚底中心，世界坐标）
   * @param {number} y
   * @param {number} z
   */
  constructor(scene, world, cfg, x, y, z) {
    this.scene = scene;
    this.world = world;
    this.cfg = cfg;
    this.pos = new THREE.Vector3(x, y, z); // 脚底中心
    this.vel = new THREE.Vector3();
    this.hp = cfg.maxHp;
    this.onGround = false;
    this.attackCd = 0;
    this.walkT = Math.random() * 10;
    this.state = 'chase'; // chase | sinking
    this.sinkT = 0;
    this._lungeT = 0;
    this._stuckT = 0;     // 卡住累计（触发侧移绕障）
    this._steerT = 0;     // 侧移剩余时间
    this._steerSign = 1;
    this._lastPos = this.pos.clone();

    /* ---------- 体素小人（Group 原点 = 脚底中心，面朝 +Z） ---------- */
    const g = this.group = new THREE.Group();

    // 腿（枢轴在髋）
    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    const legLm = box(0.24, 0.78, 0.24, MAT_PANTS); legLm.position.y = -0.39;
    const legRm = box(0.24, 0.78, 0.24, MAT_PANTS); legRm.position.y = -0.39;
    this.legL.add(legLm); this.legR.add(legRm);
    this.legL.position.set(-0.14, 0.78, 0);
    this.legR.position.set(0.14, 0.78, 0);

    // 躯干
    const torso = box(0.62, 0.72, 0.34, MAT_CLOTH);
    torso.position.y = 0.78 + 0.36;

    // 手臂（僵尸前伸，枢轴在肩）
    this.armL = new THREE.Group(); this.armR = new THREE.Group();
    const armLm = box(0.18, 0.62, 0.18, MAT_SKIN); armLm.position.y = -0.31;
    const armRm = box(0.18, 0.62, 0.18, MAT_SKIN); armRm.position.y = -0.31;
    this.armL.add(armLm); this.armR.add(armRm);
    this.armL.position.set(-0.4, 1.42, 0);
    this.armR.position.set(0.4, 1.42, 0);
    this.armL.rotation.x = -Math.PI / 2.2;
    this.armR.rotation.x = -Math.PI / 2.2;

    // 头 + 红眼
    const head = box(0.5, 0.5, 0.5, MAT_SKIN);
    head.position.y = 1.5 + 0.25;
    const eyeL = box(0.09, 0.07, 0.04, MAT_EYE); eyeL.position.set(-0.11, 1.66, 0.26);
    const eyeR = box(0.09, 0.07, 0.04, MAT_EYE); eyeR.position.set(0.11, 1.66, 0.26);

    g.add(this.legL, this.legR, torso, this.armL, this.armR, head, eyeL, eyeR);
    g.position.copy(this.pos);
    scene.add(g);
  }

  /** AABB 是否与实心体素重叠 */
  _collides(px, py, pz) {
    const HALF = this.cfg.width / 2;
    const y0 = Math.floor(py), y1 = Math.floor(py + this.cfg.height - 0.01);
    const x0 = Math.floor(px - HALF), x1 = Math.floor(px + HALF);
    const z0 = Math.floor(pz - HALF), z1 = Math.floor(pz + HALF);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++)
          if (isSolid(this.world.getBlock(x, y, z))) return true;
    return false;
  }

  /** 天亮 → 下沉消散 */
  sink() { if (this.state === 'chase') this.state = 'sinking'; }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} playerPos
   * @param {boolean} isNight
   * @param {{onAttack:(damage:number, mobPos:THREE.Vector3)=>void}} events
   * @returns {boolean} 仍在场则 true
   */
  update(dt, playerPos, isNight, events) {
    // 下沉消散阶段：不再交互，缓慢沉入地面后移除
    if (this.state === 'sinking') {
      this.sinkT += dt;
      this.group.position.y = this.pos.y - Math.min(this.sinkT * 0.9, 2.2);
      return this.sinkT < 1.8;
    }

    // 所在 chunk 未装载 → 冻结（防掉入虚空）
    if (!this.world.isChunkLoaded(Math.floor(this.pos.x / 16), Math.floor(this.pos.z / 16))) {
      return true;
    }

    this.attackCd = Math.max(0, this.attackCd - dt);

    /* ---------- 简化寻路：直线逼近 + 卡住侧移绕障 ---------- */
    const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z;
    const distH = Math.hypot(dx, dz);
    let dirX = 0, dirZ = 0;
    if (distH > 0.001) { dirX = dx / distH; dirZ = dz / distH; }

    // 卡住检测：该动而没动 → 累计，超阈值改走垂直方向 0.9 秒（绕障）
    const moved = this.pos.distanceTo(this._lastPos);
    const wantMove = distH > this.cfg.attackRange * 0.85;
    if (wantMove && moved < this.cfg.speed * dt * 0.25) this._stuckT += dt;
    else this._stuckT = 0;
    if (this._stuckT > 1.1) {
      this._steerT = 0.9;
      this._steerSign = Math.random() < 0.5 ? 1 : -1;
      this._stuckT = 0;
    }
    if (this._steerT > 0) {
      this._steerT -= dt;
      const px = -dirZ * this._steerSign, pz = dirX * this._steerSign;
      dirX = dirX * 0.35 + px;
      dirZ = dirZ * 0.35 + pz;
      const l = Math.hypot(dirX, dirZ) || 1;
      dirX /= l; dirZ /= l;
    }
    this._lastPos.copy(this.pos);

    /* ---------- 物理：重力 + 逐轴碰撞 + 撞墙跳 ---------- */
    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -50) this.vel.y = -50;

    let blockedH = false;
    const sp = this.cfg.speed;
    let nx = this.pos.x + (wantMove ? dirX * sp * dt : 0);
    if (!this._collides(nx, this.pos.y, this.pos.z)) this.pos.x = nx; else blockedH = true;
    let nz = this.pos.z + (wantMove ? dirZ * sp * dt : 0);
    if (!this._collides(this.pos.x, this.pos.y, nz)) this.pos.z = nz; else blockedH = true;

    if (blockedH && this.onGround) this.vel.y = this.cfg.jumpVelocity;

    this.onGround = false;
    let ny = this.pos.y + this.vel.y * dt;
    if (!this._collides(this.pos.x, ny, this.pos.z)) {
      this.pos.y = ny;
    } else {
      if (this.vel.y < 0) this.onGround = true;
      this.vel.y = 0;
    }

    // 掉出世界底部 → 直接移除
    if (this.pos.y < -10) return false;

    /* ---------- 近战 ---------- */
    const dy = Math.abs(playerPos.y - this.pos.y);
    if (distH < this.cfg.attackRange && dy < 2.2 && this.attackCd === 0) {
      this.attackCd = this.cfg.attackCooldown;
      this._lungeT = 0.3;
      events.onAttack(this.cfg.damage, this.pos);
    }

    /* ---------- 动画 ---------- */
    this.walkT += dt * (wantMove ? 6 : 1.5);
    const sw = Math.sin(this.walkT) * (wantMove ? 0.55 : 0.08);
    this.legL.rotation.x = sw;
    this.legR.rotation.x = -sw;
    if (this._lungeT > 0) {
      this._lungeT -= dt;
      this.armL.rotation.x = this.armR.rotation.x = -0.5; // 扑击：双臂下压
    } else {
      const bob = Math.sin(this.walkT * 0.7) * 0.08;
      this.armL.rotation.x = -Math.PI / 2.2 + bob;
      this.armR.rotation.x = -Math.PI / 2.2 - bob;
    }
    this.group.rotation.y = Math.atan2(dx, dz);
    this.group.position.copy(this.pos);
    return true;
  }

  dispose() {
    this.scene.remove(this.group);
    this.group.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  }
}

export class MobManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./world.js').World} world
   * @param {object} config mobs.json 内容（单生物种）
   * @param {{onAttack:(damage:number, mobPos:THREE.Vector3)=>void}} events
   */
  constructor(scene, world, config, events) {
    this.scene = scene;
    this.world = world;
    this.cfg = config;
    this.events = events;
    this.mobs = [];
    this._spawnT = 0;
  }

  get count() { return this.mobs.length; }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} playerPos
   * @param {boolean} isNight 夜间窗口内才生成/活动；白天现存个体下沉消散
   */
  update(dt, playerPos, isNight) {
    if (!isNight) for (const m of this.mobs) m.sink();

    // 夜间限量生成（间隔秒 + 场上上限）
    if (isNight && this.mobs.length < this.cfg.spawn.maxCount) {
      this._spawnT += dt;
      if (this._spawnT >= this.cfg.spawn.interval) {
        this._spawnT = 0;
        this._trySpawn(playerPos);
      }
    } else {
      this._spawnT = 0;
    }

    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const alive = m.update(dt, playerPos, isNight, this.events);
      const far = m.pos.distanceTo(playerPos) > this.cfg.despawnDist;
      if (!alive || far) {
        m.dispose();
        this.mobs.splice(i, 1);
      }
    }
  }

  /** 在玩家周围环形随机点生成（仅已装载 chunk、地表上方两格为空） */
  _trySpawn(playerPos) {
    const a = Math.random() * Math.PI * 2;
    const d = this.cfg.spawn.minDist + Math.random() * (this.cfg.spawn.maxDist - this.cfg.spawn.minDist);
    const bx = Math.floor(playerPos.x + Math.cos(a) * d);
    const bz = Math.floor(playerPos.z + Math.sin(a) * d);
    if (!this.world.isChunkLoaded(Math.floor(bx / 16), Math.floor(bz / 16))) return;
    const y = surfaceHeight(bx, bz, this.world.seed);
    if (y <= 2 || y >= CHUNK_Y - 4) return;
    if (isSolid(this.world.getBlock(bx, y + 1, bz)) || isSolid(this.world.getBlock(bx, y + 2, bz))) return;
    this.mobs.push(new Zombie(this.scene, this.world, this.cfg, bx + 0.5, y + 1, bz + 0.5));
  }

  /** 清除 pos 附近 dist 格内的个体（重生清场用） */
  clearNear(pos, dist) {
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      if (this.mobs[i].pos.distanceTo(pos) < dist) {
        this.mobs[i].dispose();
        this.mobs.splice(i, 1);
      }
    }
  }

  clearAll() {
    for (const m of this.mobs) m.dispose();
    this.mobs.length = 0;
  }
}
