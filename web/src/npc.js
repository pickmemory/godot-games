// npc.js — MC-3b NPC 系统：低模角色（程序化体素占位 / GLTF 适配）+ 漫游状态机 + 编年出场钩子
//
// 职责边界（模块间只经导出签名通信）：
//   - NPC 实体：位置/朝向/名字/头顶名牌/立绘占位参数；待机-漫游-接近 三态 AI（决策限频、错峰）。
//   - 物理：重力 + 逐轴 AABB 体素碰撞（与 player.js/mob.js 同一算法思路，按 NPC 自身宽高独立实现，
//     不 import player —— 三处共享的通用 voxelActor 抽象留待后续重构，见 docs/superpowers/plans）。
//   - 编年出场：NPC 数据声明 appear/disappear 日期，复用 MC-3a chapter.js 的 dateToSerial 折算序数日；
//     NPCManager.setChronicle(currentSerial) 由 main.js 在开卷与每个游戏日翻页时喂入。
//   - 模型：model.type === 'glb' 时异步加载 GLTF（three/addons GLTFLoader + AnimationMixer，
//     按 clip 名含 Idle/Walk 匹配动画）；加载失败/缺文件 → 程序化体素村民占位（Quaternius GLB
//     资产引入时只需落 web/assets/npc/ 并改数据，不改代码）。
//
// NPC 数据 schema 见 web/data/npc/README.md；示例见 web/data/npc/npcs.json。

import * as THREE from 'three';
import { isSolid, CHUNK_Y } from './blocks.js';
import { surfaceHeight } from './terrain.js';
import { dateToSerial } from './chapter.js';

const GRAVITY = 28;
const AI_INTERVAL = 0.35;   // AI 决策间隔（秒；个体间错峰，见 _aiClock 初相）

/** 兜底 NPC 数据（web/data/npc/npcs.json 缺失/离线时同构兑底，保持可跑） */
export const FALLBACK_NPC_DATA = {
  npcs: [
    {
      id: 'elder-chen',
      name: '陈叟',
      title: '里中老者',
      model: { type: 'procedural', robe: '#8a6f4d', skin: '#d9b38c', hat: true },
      portrait: { bg: '#3d3226', fg: '#e8d9b0' },
      spawn: { x: 14, z: 10 },
      wander: { radius: 9, speed: 1.4 },
      dialog: 'elder-01',
    },
  ],
};

/* ---------- 程序化体素村民（占位模型；GLB 未就绪时的兑底） ---------- */

function box(w, h, d, mat) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); }

/**
 * 搭一个「布衣村民」：短腿 + 长袍 + 垂手 + 头（可选斗笠/头巾）。
 * Group 原点 = 脚底中心，面朝 +Z（与 mob.js 约定一致）。
 * @returns {{group: THREE.Group, parts: {legL,legR,armL,armR}}}
 */
function buildVillager(model = {}) {
  const matRobe = new THREE.MeshLambertMaterial({ color: model.robe ?? '#8a6f4d' });
  const matSkin = new THREE.MeshLambertMaterial({ color: model.skin ?? '#d9b38c' });
  const matPants = new THREE.MeshLambertMaterial({ color: '#3a3a42' });

  const g = new THREE.Group();

  // 腿（枢轴在髋，短——长袍遮住大半）
  const legL = new THREE.Group(), legR = new THREE.Group();
  const legLm = box(0.2, 0.5, 0.2, matPants); legLm.position.y = -0.25;
  const legRm = box(0.2, 0.5, 0.2, matPants); legRm.position.y = -0.25;
  legL.add(legLm); legR.add(legRm);
  legL.position.set(-0.12, 0.5, 0);
  legR.position.set(0.12, 0.5, 0);

  // 长袍躯干（上窄下宽的近拟：两层盒）
  const robeLo = box(0.56, 0.6, 0.34, matRobe); robeLo.position.y = 0.5 + 0.3;
  const robeHi = box(0.5, 0.5, 0.3, matRobe);  robeHi.position.y = 1.4;

  // 手臂（垂在身侧，枢轴在肩）
  const armL = new THREE.Group(), armR = new THREE.Group();
  const armLm = box(0.16, 0.55, 0.16, matSkin); armLm.position.y = -0.275;
  const armRm = box(0.16, 0.55, 0.16, matSkin); armRm.position.y = -0.275;
  armL.add(armLm); armR.add(armRm);
  armL.position.set(-0.34, 1.6, 0);
  armR.position.set(0.34, 1.6, 0);

  // 头
  const head = box(0.44, 0.44, 0.44, matSkin);
  head.position.y = 1.65 + 0.22;

  g.add(legL, legR, robeLo, robeHi, armL, armR, head);

  if (model.hat) {
    // 斗笠：扁圆锥（CylinderGeometry topR≈0 即锥）
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.42, 0.16, 8),
      new THREE.MeshLambertMaterial({ color: '#b09455 }),
    );
    hat.position.y = 1.65 + 0.44 + 0.07;
    g.add(hat);
  } else if (model.headband) {
    const band = box(0.46, 0.08, 0.46, new THREE.MeshLambertMaterial({ color: model.headband }));
    band.position.y = 1.65 + 0.34;
    g.add(band);
  }

  return { group: g, parts: { legL, legR, armL, armR } };
}

/* ---------- 头顶名牌（Sprite + CanvasTexture；中文渲染） ---------- */

function buildNameLabel(name, title) {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 72;
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10,10,16,.55)';
  ctx.fillRect(28, 8, 200, 56);
  ctx.strokeStyle = 'rgba(232,217,176,.4)';
  ctx.strokeRect(28, 8, 200, 56);
  ctx.fillStyle = '#e8d9b0';
  ctx.font = '600 26px "Microsoft YaHei", sans-serif';
  ctx.fillText(name, 128, 36);
  if (title) {
    ctx.fillStyle = 'rgba(184,167,104,.9)';
    ctx.font = '16px "Microsoft YaHei", sans-serif';
    ctx.fillText(title, 128, 56);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(1.5, 0.42, 1);
  return sp;
}

/* ---------- GLTF 适配（Quaternius 等第三方 CC0 GLB 就绪后零代码接入） ---------- */

/**
 * 尝试异步加载 GLB。成功返回 {scene, animations}；任何失败（缺文件/网络/加载器不可用）返回 null。
 * 动态 import：不装 addons 依赖时不影响首屏；Three r160 GLTFLoader 走 importmap 的 three/addons/。
 * @param {string} url
 */
async function tryLoadGLTF(url) {
  try {
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().load(url, resolve, undefined, reject);
    });
    if (!gltf?.scene) return null;
    return { scene: gltf.scene, animations: Array.isArray(gltf.animations) ? gltf.animations : [] };
  } catch (e) {
    console.warn(`[npc] GLB 加载失败（${url}），用程序化占位：`, String(e));
    return null;
  }
}

/** 按 clip 名匹配 idle/walk 动画（Quaternius 命名惯例 "CharacterArmature|Idle" 等） */
function pickClips(animations) {
  let idle = null, walk = null;
  for (const c of animations) {
    const n = c.name.toLowerCase();
    if (n.includes('idle') && !idle) idle = c;
    else if ((n.includes('walk') || n.includes('run')) && !walk) walk = c;
  }
  return { idle, walk };
}

/* ---------- NPC 实体 ---------- */

class NPC {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./world.js').World} world
   * @param {object} def npcs.json 单条定义
   */
  constructor(scene, world, def) {
    this.scene = scene;
    this.world = world;
    this.def = def;

    this.id = String(def.id ?? 'npc');
    this.name = String(def.name ?? this.id);
    this.title = def.title ? String(def.title) : '';
    this.dialogId = def.dialog ? String(def.dialog) : null;
    this.portrait = def.portrait ?? null;
    this.anchorX = (def.spawn?.x ?? 8) + 0.5;
    this.anchorZ = (def.spawn?.z ?? 8) + 0.5;
    this.wanderRadius = Number(def.wander?.radius ?? 8);
    this.walkSpeed = Number(def.wander?.speed ?? 1.4);
    this.width = Number(def.model?.width ?? 0.5);
    this.height = Number(def.model?.height ?? 1.85);

    // 编年出场/离场（复用 MC-3a 日历数学；缺省 = 开卷在场 / 不离场）
    this.appearSerial = def.appear?.date ? dateToSerial(def.appear.date) : null;
    this.disappearSerial = def.disappear?.date ? dateToSerial(def.disappear.date) : null;

    // AI 三态：idle（原地待机）| wander（锚点附近游走）| approach（玩家靠近 → 走近到交谈距离外站定）
    this.state = 'idle';
    this.idleT = 1 + Math.random() * 3;         // 待机倒计时
    this.targetX = this.anchorX;
    this.targetZ = this.anchorZ;
    this._aiClock = Math.random() * AI_INTERVAL; // 个体错峰（决策不挤同帧）
    this._labelClock = Math.random() * 0.25;

    this.pos = new THREE.Vector3(this.anchorX, 0, this.anchorZ);
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.onGround = false;
    this.walkT = 0;
    this.speedH = 0;                             // 本帧水平速度（动画/名牌共享）
    this.active = false;                         // 在场与否（编年钩子控制）

    /* 模型：先上程序化占位，glb 异步就绪后换装 */
    const built = buildVillager(def.model ?? {});
    this.group = built.group;
    this._voxParts = built.parts;
    this._mixer = null;
    this._actions = null;
    this._glbRoot = null;
    if (def.model?.type === 'glb' && def.model.url) {
      tryLoadGLTF(def.model.url).then((res) => {
        if (!res) return;                       // 加载失败 → 保持程序化占位
        const root = res.scene;
        root.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = true; } });
        this.group.add(root);
        this._glbRoot = root;
        if (res.animations.length) {
          this._mixer = new THREE.AnimationMixer(root);
          const { idle, walk } = pickClips(res.animations);
          this._actions = {
            idle: idle ? this._mixer.clipAction(idle) : null,
            walk: walk ? this._mixer.clipAction(walk) : null,
          };
          this._actions.idle?.play();
          this._actions.walk?.play();
          this._actions.walk && (this._actions.walk.enabled = false);
        }
        // GLB 到场后藏起占位体（保留 Group 原点/名牌挂点）
        for (const m of Object.values(this._voxParts)) m.visible = false;
        this.group.children.forEach((c) => { if (c.isMesh) c.visible = false; });
      });
    }

    this.label = buildNameLabel(this.name, this.title);
    this.label.position.y = this.height + 0.45;
    this.group.add(this.label);
  }

  /** 运行期换对话树（章节事件效果 setDialog → main.js 调；旗标后台词切换用，免 disappear/reappear 闪场） */
  setDialog(dialogId) { this.dialogId = dialogId ? String(dialogId) : null; }

  /** AABB 是否与实心体素重叠（宽高按个体配置） */
  _collides(px, py, pz) {
    const HALF = this.width / 2;
    const y0 = Math.floor(py), y1 = Math.floor(py + this.height - 0.01);
    const x0 = Math.floor(px - HALF), x1 = Math.floor(px + HALF);
    const z0 = Math.floor(pz - HALF), z1 = Math.floor(pz + HALF);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++)
          if (isSolid(this.world.getBlock(x, y, z))) return true;
    return false;
  }

  /** 在场登场：落到锚点地表（chunk 未装载时由 Manager 延迟重试） */
  trySpawn() {
    const bx = Math.floor(this.anchorX), bz = Math.floor(this.anchorZ);
    if (!this.world.isChunkLoaded(Math.floor(bx / 16), Math.floor(bz / 16))) return false;
    const y = surfaceHeight(bx, bz, this.world.seed);
    if (y <= 2 || y >= CHUNK_Y - 4) return false;
    this.pos.set(this.anchorX, y + 1.01, this.anchorZ);
    this.vel.set(0, 0, 0);
    this.group.position.copy(this.pos);
    this.scene.add(this.group);
    this.active = true;
    return true;
  }

  /** 离场（编年时刻到 / Manager 清场） */
  despawn() {
    if (!this.active) return;
    this.scene.remove(this.group);
    this.active = false;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} playerPos 玩家脚底位置
   */
  update(dt, playerPos) {
    if (!this.active) return;
    // 所在 chunk 未装载 → 冻结（防掉入虚空）
    if (!this.world.isChunkLoaded(Math.floor(this.pos.x / 16), Math.floor(this.pos.z / 16))) return;

    /* ---------- AI（限频 0.35s + 个体错峰） ---------- */
    this._aiClock -= dt;
    if (this._aiClock <= 0) {
      this._aiClock = AI_INTERVAL;
      const dx = playerPos.x - this.pos.x, dz = playerPos.z - this.pos.z;
      const distH = Math.hypot(dx, dz);
      const APPROACH = 5.0, TALK = 2.2, GIVE_UP = 9.0;   // 格（水平）
      if (distH <= TALK) {
        this.state = 'talk';          // 交谈距离内：站定面向玩家
      } else if (distH < APPROACH || (this.state === 'approach' && distH < GIVE_UP)) {
        this.state = 'approach';
        this.targetX = playerPos.x; this.targetZ = playerPos.z;
      } else if (this.state === 'approach') {
        this.state = 'idle'; this.idleT = 0.5;
      }
      if (this.state === 'idle') {
        this.idleT -= AI_INTERVAL;
        if (this.idleT <= 0) {         // 待机到点 → 换个游走目标（锚点圆内随机点）
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * this.wanderRadius;
          this.targetX = this.anchorX + Math.cos(a) * r;
          this.targetZ = this.anchorZ + Math.sin(a) * r;
          this.state = 'wander';
        }
      }
    }

    /* ---------- 移动意图（wander/approach 向目标；talk/idle 停步） ---------- */
    const wantMove = this.state === 'wander' || this.state === 'approach';
    let dirX = 0, dirZ = 0, moving = false;
    if (wantMove) {
      const dx = this.targetX - this.pos.x, dz = this.targetZ - this.pos.z;
      const d = Math.hypot(dx, dz);
      const stopDist = this.state === 'approach' ? 1.8 : 0.4;
      if (d > stopDist) { dirX = dx / d; dirZ = dz / d; moving = true; }
      else if (this.state === 'wander') { this.state = 'idle'; this.idleT = 2 + Math.random() * 5; }
      else this.state = 'talk';
    }

    /* ---------- 物理：重力 + 逐轴 AABB 碰撞 + 撞墙小跳（上 1 格台阶） ---------- */
    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -50) this.vel.y = -50;

    const sp = this.walkSpeed;
    let blockedH = false;
    let nx = this.pos.x + (moving ? dirX * sp * dt : 0);
    if (!this._collides(nx, this.pos.y, this.pos.z)) this.pos.x = nx; else blockedH = true;
    let nz = this.pos.z + (moving ? dirZ * sp * dt : 0);
    if (!this._collides(this.pos.x, this.pos.y, nz)) this.pos.z = nz; else blockedH = true;
    if (blockedH && this.onGround) this.vel.y = 7.5;

    this.onGround = false;
    const ny = this.pos.y + this.vel.y * dt;
    if (!this._collides(this.pos.x, ny, this.pos.z)) {
      this.pos.y = ny;
    } else {
      if (this.vel.y < 0) this.onGround = true;
      this.vel.y = 0;
    }
    if (this.pos.y < -10) { this.pos.y = 60; this.vel.y = 0; }  // 兜底拉回

    this.speedH = moving ? sp : 0;

    /* ---------- 朝向（移动方向 / 交谈面向玩家；平滑转身） ---------- */
    let faceX = dirX, faceZ = dirZ;
    if (!moving) {
      if (this.state === 'talk') { faceX = playerPos.x - this.pos.x; faceZ = playerPos.z - this.pos.z; }
      else { faceX = Math.sin(this.yaw); faceZ = Math.cos(this.yaw); }
    }
    if (Math.hypot(faceX, faceZ) > 0.01) {
      const want = Math.atan2(faceX, faceZ);
      let diff = want - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 8);
    }

    /* ---------- 动画（体素摆肢 / GLTF mixer 二选一） ---------- */
    if (this._mixer) {
      this._mixer.update(dt);
      if (this._actions?.walk) {
        const k = Math.min(1, this.speedH / Math.max(0.001, this.walkSpeed));
        this._actions.walk.enabled = k > 0.05;
        this._actions.walk.setEffectiveWeight(k);
        if (this._actions.idle) this._actions.idle.setEffectiveWeight(1 - k);
      }
    } else {
      this.walkT += dt * (this.speedH > 0 ? 7 : 1.2);
      const sw = Math.sin(this.walkT) * (this.speedH > 0 ? 0.5 : 0.05);
      this._voxParts.legL.rotation.x = sw;
      this._voxParts.legR.rotation.x = -sw;
      this._voxParts.armL.rotation.x = -sw * 0.7;
      this._voxParts.armR.rotation.x = sw * 0.7;
    }

    /* ---------- 名牌随距离淡出（限频 0.25s） ---------- */
    this._labelClock -= dt;
    if (this._labelClock <= 0) {
      this._labelClock = 0.25;
      const d = this.pos.distanceTo(playerPos);
      this.label.material.opacity = d < 4 ? 1 : d < 14 ? 1 - (d - 4) / 10 : 0;
      this.label.material.depthWrite = false;
    }

    this.group.rotation.y = this.yaw;
    this.group.position.copy(this.pos);
  }

  dispose() {
    this.despawn();
    this.group.traverse((o) => {
      if (o.isMesh) o.geometry.dispose();
      if (o.isSprite) o.material.map.dispose();
    });
  }
}

/* ---------- Manager：编年出场判定 + 批量更新 + 交谈目标查询 ---------- */

export class NPCManager {
  /**
   * @param {THREE.Scene} scene
   * @param {import('./world.js').World} world
   * @param {object} data npcs.json 内容（{npcs:[...]}；缺文件时传 FALLBACK_NPC_DATA）
   */
  constructor(scene, world, data) {
    this.scene = scene;
    this.world = world;
    const defs = Array.isArray(data?.npcs) ? data.npcs : [];
    if (!defs.length) console.warn('[npc] 数据无 npcs 数组，用兜底 NPC');
    this.npcs = (defs.length ? defs : FALLBACK_NPC_DATA.npcs)
      .filter((d) => d && typeof d === 'object')
      .map((d) => new NPC(scene, world, d));
    this.wantsActive = new Map();   // npc.id → boolean（编年判定结果；chunk 未载时延迟生效）
  }

  get count() { return this.npcs.length; }
  get activeCount() { return this.npcs.reduce((n, x) => n + (x.active ? 1 : 0), 0); }

  /**
   * 编年钩子：main.js 在开卷与每个游戏日翻页时喂入当前序数日。
   * NPC 数据的 appear/disappear 日期在此判定 → 在场/离场。
   * @param {number} currentSerial 当前编年序数日（chapter.startSerial + timeline.day）
   */
  setChronicle(currentSerial) {
    for (const n of this.npcs) {
      const after = n.appearSerial === null || currentSerial >= n.appearSerial;
      const before = n.disappearSerial === null || currentSerial < n.disappearSerial;
      const should = after && before;
      this.wantsActive.set(n.id, should);
      if (should && !n.active) n.trySpawn();          // chunk 未载 → update 内重试
      else if (!should && n.active) n.despawn();
    }
  }

  /** @param {number} dt @param {THREE.Vector3} playerPos */
  update(dt, playerPos) {
    for (const n of this.npcs) {
      // 编年该在场但 chunk 未装载 → 每帧廉价重试登场
      if (!n.active && this.wantsActive.get(n.id)) n.trySpawn();
      n.update(dt, playerPos);
    }
  }

  /**
   * 最近的可交谈 NPC（水平距离 ≤ maxDist 且在场）
   * @returns {NPC|null}
   */
  nearestTalkable(playerPos, maxDist = 3.0) {
    let best = null, bestD = maxDist;
    for (const n of this.npcs) {
      if (!n.active || !n.dialogId) continue;
      const d = Math.hypot(playerPos.x - n.pos.x, playerPos.z - n.pos.z);
      if (d < bestD) { bestD = d; best = n; }
    }
    return best;
  }

  /** 按 id 取（调试/任务系统用） */
  get(id) { return this.npcs.find((n) => n.id === id) ?? null; }

  /** 运行期换对话树：npcManager.setDialog('elder-chen', 'elder-01-war')（正在对话中的树不换，下火开启生效） */
  setDialog(id, dialogId) {
    const n = this.get(id);
    if (!n) { console.warn(`[npc] setDialog: 未找到 NPC ${id}`); return; }
    n.setDialog(dialogId);
  }

  clearAll() { for (const n of this.npcs) n.despawn(); }

  dispose() { for (const n of this.npcs) n.dispose(); this.npcs.length = 0; }
}
