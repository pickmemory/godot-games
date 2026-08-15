// player.js — 第一人称玩家：WASD + 重力跳跃 + 飞行 + 逐轴 AABB 体素碰撞
import * as THREE from 'three';
import { collisionBoxes } from './blocks.js';

const WIDTH = 0.6;      // AABB x/z 宽
const HEIGHT = 1.8;     // AABB 高
const HALF = WIDTH / 2;
const EYE = 1.62;       // 眼高（脚原点起）
const GRAVITY = 28;
const JUMP_V = 9.2;
const WALK_SPEED = 5.6;
const FLY_SPEED = 11;

export class Player {
  /** @param {THREE.PerspectiveCamera} camera @param {import('./world.js').World} world */
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.pos = new THREE.Vector3(0.5, 40, 0.5); // 脚底中心
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    camera.rotation.order = 'YXZ';
  }

  /** 出生到世界坐标（自动抬高 1 格） */
  spawn(x, y, z) {
    this.pos.set(x + 0.5, y + 1.01, z + 0.5);
    this.vel.set(0, 0, 0);
  }

  addLook(dx, dy) {
    this.yaw -= dx * 0.0024;
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch - dy * 0.0024));
  }

  /** AABB 是否与方块碰撞盒重叠（MC-4b：楼梯/栅栏等细几何按注册表 collision 盒精确判定） */
  _collides(px, py, pz) {
    const y0 = Math.floor(py), y1 = Math.floor(py + HEIGHT - 0.01);
    const x0 = Math.floor(px - HALF), x1 = Math.floor(px + HALF);
    const z0 = Math.floor(pz - HALF), z1 = Math.floor(pz + HALF);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++)
          for (const b of collisionBoxes(this.world.getBlock(x, y, z))) {
            if (px - HALF < x + b[3] && px + HALF > x + b[0]
              && py < y + b[4] && py + HEIGHT > y + b[1]
              && pz - HALF < z + b[5] && pz + HALF > z + b[2]) return true;
          }
    return false;
  }

  /**
   * @param {number} dt
   * @param {{forward:boolean,back:boolean,left:boolean,right:boolean,
   *          jump:boolean,down:boolean}} input
   */
  update(dt, input) {
    // 所在 chunk 未装载时冻结物理（防掉入未生成地形）
    if (!this.world.isChunkLoaded(Math.floor(this.pos.x / 16), Math.floor(this.pos.z / 16))) {
      this._syncCamera();
      return;
    }

    // 期望水平方向（相机系）
    let fx = 0, fz = 0;
    if (input.forward) fz += 1;
    if (input.back) fz -= 1;
    if (input.left) fx -= 1;
    if (input.right) fx += 1;
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = (fx * cos - fz * sin);
    const wz = (fx * -sin - fz * cos);

    if (this.flying) {
      const sp = FLY_SPEED;
      this.vel.x = wx * sp;
      this.vel.z = wz * sp;
      this.vel.y = (input.jump ? sp : 0) + (input.down ? -sp : 0);
    } else {
      const sp = WALK_SPEED;
      this.vel.x = wx * sp;
      this.vel.z = wz * sp;
      this.vel.y -= GRAVITY * dt;
      if (this.vel.y < -50) this.vel.y = -50;
      if (input.jump && this.onGround) {
        this.vel.y = JUMP_V;
        this.onGround = false;
      }
    }

    // 逐轴移动 + 碰撞回退
    this.onGround = false;

    let nx = this.pos.x + this.vel.x * dt;
    if (!this._collides(nx, this.pos.y, this.pos.z)) this.pos.x = nx; else this.vel.x = 0;

    let nz = this.pos.z + this.vel.z * dt;
    if (!this._collides(this.pos.x, this.pos.y, nz)) this.pos.z = nz; else this.vel.z = 0;

    let ny = this.pos.y + this.vel.y * dt;
    if (!this._collides(this.pos.x, ny, this.pos.z)) {
      this.pos.y = ny;
    } else {
      if (this.vel.y < 0) this.onGround = true;  // 下落被挡 = 踩地
      this.vel.y = 0;
    }

    // 掉出世界底部 → 拉回地表
    if (this.pos.y < -10) {
      this.pos.y = 50;
      this.vel.y = 0;
    }

    this._syncCamera();
  }

  _syncCamera() {
    this.camera.position.set(this.pos.x, this.pos.y + EYE, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  /** 玩家 AABB（放置方块时做相交拒绝用） */
  get aabb() {
    return {
      x0: this.pos.x - HALF - 0.001, x1: this.pos.x + HALF + 0.001,
      y0: this.pos.y - 0.001, y1: this.pos.y + HEIGHT + 0.001,
      z0: this.pos.z - HALF - 0.001, z1: this.pos.z + HALF + 0.001,
    };
  }
}
