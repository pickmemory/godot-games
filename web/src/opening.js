// opening.js — MC-6 D-5 开场「哇」点：俯瞰大地 → 俯冲落回出生点的镜头演出 + 氛围粒子 + 序幕字卡
//
// 职责边界（模块间只经导出签名通信）：
//   - 只管「镜头与呈现」：CatmullRom 相机曲线（控制点为相对出生点眼位的偏移，数据驱动
//     web/data/opening.json；演出相机直接摆 camera，不走玩家物理——cinematic 绕过 AABB）、
//     烽烟 + 飞鸟两组 THREE.Points 粒子（ShaderMaterial：逐粒 alpha/尺寸 + 手写雾，贴 184 乱世气质）、
//     #opening DOM 字卡（右侧竖排书法题签 + 下三分之一逐卡淡入，文案全来自 opening.json）。
//   - 触发/门控/跳过路由在 main.js：首次指针锁定（开卷）后 maybeStartOpening()；读档续玩不演；
//     任意键 / 点击 / 失锁（ESC）= skip()，同步收尾（粒子 dispose、DOM 淡出、相机由 main 复位）。
//   - 不 import world/player/chapter；依赖经 play(cfg) 注入（camera/scene/groundAt/pixelScale/voice）。
//
// 性能：两个 draw call（烟 ~72 粒 + 鸟 ~9 粒）；热路径零分配（typed array 就地写 + 模块级 scratch
//   Vector）；曲线/粒子对象在 play() 一次性建好，收尾 _teardown() 全量 dispose。演出期间 chunk
//   流式照常（main.js 传 camera.position 给 world.update），落地不穿帮。

import * as THREE from 'three';

/* ---------- 兜底配置（web/data/opening.json 缺失/离线时同构兑底，与 JSON 同 schema） ---------- */

export const FALLBACK_OPENING = {
  duration: 26,                          // 演出总时长（秒）
  camera: {
    // 相机控制点 / 视线点：相对出生点「眼位」的偏移（+x 东，-z 北，+y 上）。
    // 末点必须 [0,0,0] 且末视线正对 -Z —— 与玩家默认 yaw=0/pitch=0 无缝交接（玩家相机即 identity）。
    // 高度校准过雾距：全景高度 ≈60-72，地面斜距 ~72-95 落在 [highNear, highFar] 雾带内呈晨雾而非全雾。
    points: [[0, 72, 24], [-44, 62, -30], [28, 34, -52], [3, 11, 20], [0, 0, 0]],
    look: [[0, -6, -16], [0, -4, -2], [0, -2, -12], [0, 0, -20], [0, 0, -24]],
    // 时间→曲线参数的分段映射（各段内 smoothstep）：全景慢扫 → 俯冲快 → 落地缓
    phaseTime: [0, 0.52, 0.86, 1],
    phaseParam: [0, 0.44, 0.85, 1],
  },
  fov: { base: 72, dive: 82 },           // 俯冲段 FOV 推背（base 仅作校验参考，实际以进演出时相机为准）
  fog: { highNear: 50, highFar: 150 },    // 高空晨雾（比常规昼雾更远更案——高空看得远，兼遮流式边缘）；落地平滑回常规昼雾
  title: { text: '三国长卷', show: [0.03, 0.4] },   // 竖排题签窗口（归一化时刻）
  cards: [                               // 序幕字卡（at = 归一化时刻，升序；文案改动后重跑 tools/gen-narration.mjs）
    { at: 0.10, text: '天下大疫，烽烟四起。' },
    { at: 0.32, text: '青史不载无名之人——' },
    { at: 0.56, text: '而你，是这条长卷里的一个名字。' },
    { at: 0.87, text: '活下去。' },
  ],
  particles: {
    smoke: {                             // 烽烟/炊烟柱（基点相对出生点的水平偏移，落柱高由 groundAt 采样）
      columns: [[-42, -20], [36, -50], [-8, 56]],
      perColumn: 24, height: 24, spread: 3.2,
      size: [2.2, 6.5], alpha: 0.5, color: '#6f675c',
    },
    birds: {                             // 飞鸟剪影（盘旋鸟群中心相对出生点偏移）
      count: 9, center: [22, 30, -34], radius: 15, speed: 0.18, size: 2.6, color: '#26211a',
    },
  },
};

/* ---------- 小工具 ---------- */

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function smooth01(u) { u = clamp01(u); return u * u * (3 - 2 * u); }
/** 确定性伪随机（可复现，不依赖 Math.random 的种子顺序） */
function prand(i, k) { const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return s - Math.floor(s); }

/** 柔圆点 sprite（烟粒通用）：白核软边，颜色由材质 uColor 染 */
function softDiscTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,.85)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 飞鸟剪影（白色剪影，颜色由 uColor 染）：wingUp 两帧扇翅 */
function birdTexture(wingUp) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const ctx = cv.getContext('2d');
  const tipY = wingUp ? 16 : 34;   // 翼尖高度（两帧）
  const bellyY = wingUp ? 34 : 46;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(4, 36);
  ctx.quadraticCurveTo(20, tipY, 32, 28);
  ctx.quadraticCurveTo(44, tipY, 60, 36);
  ctx.quadraticCurveTo(46, bellyY, 32, 40);
  ctx.quadraticCurveTo(18, bellyY, 4, 36);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 粒子共用着色器材质：逐粒 alpha/尺寸 + 手写雾（与场景雾同步由 update 刷 uniform） */
function makePointsMaterial(tex, colorHex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: tex },
      uColor: { value: new THREE.Color(colorHex) },
      uFogColor: { value: new THREE.Color(0x87ceeb) },
      uFogNear: { value: 40 },
      uFogFar: { value: 130 },
      uScale: { value: 360 },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      varying float vAlpha;
      varying float vFog;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uScale;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = max(1.0, -mv.z);
        vFog = clamp((d - uFogNear) / max(1.0, uFogFar - uFogNear), 0.0, 1.0);
        gl_PointSize = aSize * (uScale / d);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform vec3 uFogColor;
      varying float vAlpha;
      varying float vFog;
      void main() {
        vec4 c = texture2D(uMap, gl_PointCoord);
        if (c.a < 0.02) discard;
        gl_FragColor = vec4(mix(uColor, uFogColor, vFog), c.a * vAlpha * (1.0 - vFog));
      }`,
    transparent: true,
    depthWrite: false,
  });
}

/* 模块级 scratch（热路径零分配） */
const _pos = new THREE.Vector3();
const _look = new THREE.Vector3();

export class Opening {
  constructor() {
    this.rootEl = document.getElementById('opening');
    this.titleEl = document.getElementById('opTitle');
    this.subEl = document.getElementById('opSub');
    this.cardEls = [document.getElementById('opCardA'), document.getElementById('opCardB')];
    this._active = false;
    this._played = false;
    this._skipped = false;
    this._resolve = null;
    this._hideTimer = null;
    this._t = 0;          // 归一化进度 0..1
    this._age = 0;        // 演出内绝对秒（粒子相位用）
    this._cardIdx = -1;
    this._cardSlot = 0;
    this._smoke = null;
    this._birds = null;
  }

  get isActive() { return this._active; }
  get hasPlayed() { return this._played; }
  get skipped() { return this._skipped; }
  /** 演出内经过的秒数（main 用于开场双倍流式窗口） */
  get age() { return this._age; }
  /** 在场粒子数（测试断言用；收尾未清净时会如实报数） */
  get particleCount() {
    return (this._smoke?.N ?? 0) + (this._birds?.N ?? 0);
  }

  /**
   * 播放开场演出（正在播放时调用 → 立即返回，不叠加）。
   * @param {{camera:THREE.PerspectiveCamera, scene:THREE.Scene, data?:object,
   *          title?:string, sub?:string,
   *          spawn:{x:number,y:number,z:number},           // 出生点「眼位」（相机末点与此重合）
   *          groundAt?:(x:number,z:number)=>number,        // 绝对坐标 → 地表高（烟柱落点）
   *          pixelScale?:()=>number,                       // 画布高（drawingBuffer）/2（点尺寸透视）
   *          extraSmoke?:Array<{x:number,y:number,z:number}>, // 附加烟柱绝对坐标（如烽燧顶）
   *          voice?:{speak(t:string):Promise<boolean>, stop():void}}} cfg
   * @returns {Promise<void>} 演出结束（含跳过）后 resolve
   */
  play(cfg = {}) {
    if (this._active) return Promise.resolve();
    if (!this.rootEl || !this.cardEls[0]) {
      console.warn('[opening] #opening 容器缺失，演出跳过');
      return Promise.resolve();
    }
    const d = cfg.data ?? FALLBACK_OPENING;
    this._camera = cfg.camera;
    this._scene = cfg.scene;
    this._voice = cfg.voice ?? null;
    this._pixelScale = typeof cfg.pixelScale === 'function' ? cfg.pixelScale : () => 360;
    const sp = cfg.spawn;
    this._spawn = { x: sp.x, y: sp.y, z: sp.z };

    // 曲线与分段节奏
    const cam = d.camera ?? FALLBACK_OPENING.camera;
    this._curve = this._buildCurve(cam.points, this._spawn);
    this._look = this._buildCurve(cam.look, this._spawn);
    this._phaseT = cam.phaseTime ?? [0, 0.52, 0.86, 1];
    this._phaseP = cam.phaseParam ?? [0, 0.44, 0.85, 1];
    this._dur = Number(d.duration) > 0 ? Number(d.duration) : 26;
    this._fov0 = this._camera.fov;                                  // 收尾精确复原
    this._fovDive = Number(d.fov?.dive) > 0 ? Number(d.fov.dive) : this._fov0;
    this._diveT0 = this._phaseT[1] ?? 0.52;                         // 俯冲 FOV 窗口 = 中段
    this._diveT1 = this._phaseT[2] ?? 0.86;

    // 雾：进场快照（收尾复原；期间每帧 updateDayNight 也会重写昼雾基准，双保险）+ 高空晨雾目标
    const fog = this._scene.fog;
    this._fog0 = { color: fog.color.clone(), near: fog.near, far: fog.far };
    this._fogHigh = {
      near: Number(d.fog?.highNear) > 0 ? Number(d.fog.highNear) : 34,
      far: Number(d.fog?.highFar) > 0 ? Number(d.fog.highFar) : 96,
    };

    // 字卡与题签
    this._cards = (Array.isArray(d.cards) ? d.cards : [])
      .filter((c) => c && c.text && Number.isFinite(c.at))
      .map((c) => ({ at: Math.max(0, Math.min(1, Number(c.at))), text: String(c.text) }))
      .sort((a, b) => a.at - b.at);
    this._titleWin = Array.isArray(d.title?.show) && d.title.show.length === 2 ? d.title.show : [0.03, 0.4];
    this.titleEl.textContent = cfg.title ?? d.title?.text ?? '';
    this.subEl.textContent = cfg.sub ?? d.sub ?? '';
    this.subEl.style.display = this.subEl.textContent ? '' : 'none';

    // DOM 复位并亮起（reflow 保证淡入过渡生效，同 cutscene.js 手法）
    clearTimeout(this._hideTimer);
    this.cardEls.forEach((el) => { el.classList.remove('on'); el.textContent = ''; });
    this.rootEl.classList.add('hidden');
    this.rootEl.classList.remove('done', 'show', 'titleOn');
    void this.rootEl.offsetWidth;
    this.rootEl.classList.remove('hidden');
    this.rootEl.classList.add('show');
    document.body.classList.add('opening');   // main.css：藏 HUD，还演出一个干净画面

    // 粒子（一次性建好，typed array 复用）
    this._smoke = this._buildSmoke(d.particles?.smoke, cfg.groundAt, cfg.extraSmoke);
    this._birds = this._buildBirds(d.particles?.birds);

    this._t = 0; this._age = 0;
    this._cardIdx = -1; this._cardSlot = 0;
    this._active = true;
    this._skipped = false;
    return new Promise((res) => { this._resolve = res; });
  }

  /** 主循环每帧驱动（inactive 时 no-op）；t 到 1 自然收卷 */
  update(dt) {
    if (!this._active) return;
    this._age += dt;
    this._t = Math.min(1, this._t + dt / this._dur);
    const t = this._t;

    // 镜头：分段时间 → 曲线参数（全景慢 / 俯冲快 / 落地缓），lookAt 视线曲线同步插值
    const u = this._remap(t);
    this._curve.getPoint(u, _pos);
    this._look.getPoint(u, _look);
    this._camera.position.copy(_pos);
    this._camera.lookAt(_look);

    // 俯冲段 FOV 推背感（正弦钟形，起落归零 → 收尾无跳变）
    const diveK = t <= this._diveT0 || t >= this._diveT1
      ? 0 : Math.sin(Math.PI * (t - this._diveT0) / (this._diveT1 - this._diveT0));
    const fov = this._fov0 + (this._fovDive - this._fov0) * diveK;
    if (Math.abs(fov - this._camera.fov) > 0.05) {
      this._camera.fov = fov;
      this._camera.updateProjectionMatrix();
    }

    // 高空晨雾：越高雾越近（兼遮流式边缘），随高度落回快照值
    const highK = clamp01((_pos.y - this._spawn.y - 6) / 55);
    const fog = this._scene.fog;
    fog.near = this._fogHigh.near + (this._fog0.near - this._fogHigh.near) * (1 - highK);
    fog.far = this._fogHigh.far + (this._fog0.far - this._fogHigh.far) * (1 - highK);

    // 粒子与着色器 uniforms（雾/透视尺度随当前相机）
    this._updateParticles(this._age);

    // 字卡/题签窗口
    this._updateCards(t);

    if (t >= 1) this._finish(false);
  }

  /** 跳过：同步收尾（状态即刻干净；视觉层 0.65s 淡出收场） */
  skip() { this._finish(true); }

  /* ---------- 内部 ---------- */

  _buildCurve(arr, spawn) {
    const pts = (arr ?? []).map((p) => new THREE.Vector3(spawn.x + p[0], spawn.y + p[1], spawn.z + p[2]));
    if (pts.length < 2) pts.push(new THREE.Vector3(spawn.x, spawn.y, spawn.z - 24));
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  }

  /** 时间 → 曲线参数的分段 smoothstep 映射（phaseTime/phaseParam 等长且首尾为 0/1） */
  _remap(t) {
    const T = this._phaseT, P = this._phaseP;
    const n = Math.min(T.length, P.length) - 1;
    for (let i = 0; i < n; i++) {
      if (t <= T[i + 1] || i === n - 1) {
        const span = Math.max(1e-6, T[i + 1] - T[i]);
        return P[i] + smooth01((t - T[i]) / span) * (P[i + 1] - P[i]);
      }
    }
    return 1;
  }

  _buildSmoke(cfg, groundAt, extra) {
    const c = cfg ?? FALLBACK_OPENING.particles.smoke;
    const sp = this._spawn;
    const cols = [];
    for (const col of Array.isArray(c.columns) ? c.columns : []) {
      const x = sp.x + col[0], z = sp.z + col[1];
      const g = typeof groundAt === 'function' ? groundAt(x, z) : sp.y - 1.6;
      cols.push({ x, z, y: g + 1.2 });
    }
    for (const e of Array.isArray(extra) ? extra : []) {
      if (Number.isFinite(e?.x) && Number.isFinite(e?.y) && Number.isFinite(e?.z)) cols.push({ x: e.x, z: e.z, y: e.y });
    }
    if (!cols.length) return null;

    const per = Math.max(4, Math.round(c.perColumn ?? 24));
    const N = cols.length * per;
    const positions = new Float32Array(N * 3);
    const aSize = new Float32Array(N);
    const aAlpha = new Float32Array(N);
    const phase = new Float32Array(N), speed = new Float32Array(N), sway = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      phase[i] = prand(i, 1);
      speed[i] = 0.10 + prand(i, 2) * 0.07;          // 柱内循环速率（life/秒）→ 烟高 ~height*speed
      sway[i] = 1.2 + prand(i, 3) * (c.spread ?? 3.2);
      positions[i * 3] = cols[(i / per) | 0].x;
      positions[i * 3 + 1] = cols[(i / per) | 0].y;
      positions[i * 3 + 2] = cols[(i / per) | 0].z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    const tex = softDiscTexture();
    const mat = makePointsMaterial(tex, c.color ?? '#6f675c');
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this._scene.add(points);
    const s = Array.isArray(c.size) ? c.size : [2.2, 6.5];
    return {
      kind: 'smoke', points, geo, mat, tex, N, per, cols,
      phase, speed, sway,
      height: c.height ?? 24,
      size0: s[0], size1: s[1] ?? s[0],
      alphaMax: c.alpha ?? 0.5,
    };
  }

  _buildBirds(cfg) {
    const c = cfg ?? FALLBACK_OPENING.particles.birds;
    const sp = this._spawn;
    const N = Math.max(0, Math.round(c.count ?? 9));
    if (!N) return null;
    const positions = new Float32Array(N * 3);
    const aSize = new Float32Array(N);
    const aAlpha = new Float32Array(N);
    const phase = new Float32Array(N), radius = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      phase[i] = prand(i, 7) * Math.PI * 2;
      radius[i] = (c.radius ?? 15) * (0.55 + prand(i, 8) * 0.6);
      aSize[i] = (c.size ?? 2.6) * (0.8 + prand(i, 9) * 0.45);
      aAlpha[i] = 0.85;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1));
    this._texWingA = birdTexture(true);
    this._texWingB = birdTexture(false);
    const mat = makePointsMaterial(this._texWingA, c.color ?? '#26211a');
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this._scene.add(points);
    return {
      kind: 'birds', points, geo, mat, tex: this._texWingA, N, phase, radius,
      cx: sp.x + (c.center?.[0] ?? 22), cy: sp.y + (c.center?.[1] ?? 30), cz: sp.z + (c.center?.[2] ?? -34),
      speed: c.speed ?? 0.18,
    };
  }

  /** 两组粒子共帧更新（就地写 typed array） + 着色器雾/尺度 uniforms */
  _updateParticles(time) {
    const fog = this._scene.fog;
    const fovRad = (this._camera.fov * Math.PI) / 180;
    const uScale = Math.max(1, this._pixelScale()) / Math.tan(fovRad / 2);

    const s = this._smoke;
    if (s) {
      const pos = s.geo.attributes.position.array;
      const sz = s.geo.attributes.aSize.array;
      const al = s.geo.attributes.aAlpha.array;
      for (let i = 0; i < s.N; i++) {
        const col = s.cols[(i / s.per) | 0];
        const life = (time * s.speed[i] + s.phase[i]) % 1;
        const amp = s.sway[i] * (0.35 + life);
        pos[i * 3] = col.x + Math.sin(time * 0.35 + s.phase[i] * 11.0) * amp;
        pos[i * 3 + 1] = col.y + life * s.height;
        pos[i * 3 + 2] = col.z + Math.cos(time * 0.27 + s.phase[i] * 7.3) * amp;
        al[i] = Math.min(life / 0.12, (1 - life) / 0.35, 1) * s.alphaMax;
        sz[i] = s.size0 + life * (s.size1 - s.size0);
      }
      s.geo.attributes.position.needsUpdate = true;
      s.geo.attributes.aSize.needsUpdate = true;
      s.geo.attributes.aAlpha.needsUpdate = true;
    }

    const b = this._birds;
    if (b) {
      const pos = b.geo.attributes.position.array;
      for (let i = 0; i < b.N; i++) {
        const ang = time * b.speed + b.phase[i];
        pos[i * 3] = b.cx + Math.cos(ang) * b.radius[i];
        pos[i * 3 + 1] = b.cy + Math.sin(time * 0.9 + b.phase[i] * 5.0) * 1.4;
        pos[i * 3 + 2] = b.cz + Math.sin(ang) * b.radius[i] * 0.72;
      }
      b.geo.attributes.position.needsUpdate = true;
      b.mat.uniforms.uMap.value = (Math.floor(time / 0.16) % 2 === 0) ? this._texWingA : this._texWingB;  // 同步扇翅
    }

    for (const p of [s, b]) {
      if (!p) continue;
      p.mat.uniforms.uFogColor.value.copy(fog.color);
      p.mat.uniforms.uFogNear.value = fog.near;
      p.mat.uniforms.uFogFar.value = fog.far;
      p.mat.uniforms.uScale.value = uScale;
    }
  }

  _updateCards(t) {
    let idx = -1;
    for (let i = 0; i < this._cards.length; i++) if (t >= this._cards[i].at) idx = i;
    if (idx !== this._cardIdx) {
      this._cardIdx = idx;
      this._cardSlot = 1 - this._cardSlot;
      const el = this.cardEls[this._cardSlot];
      const prev = this.cardEls[1 - this._cardSlot];
      prev.classList.remove('on');
      if (idx >= 0) {
        el.textContent = this._cards[idx].text;
        void el.offsetWidth;              // reflow：保证淡入过渡生效
        el.classList.add('on');
        this._voice?.speak?.(this._cards[idx].text);   // D-4 旁白映射（无样音自动回落纯字幕）
      }
    }
    const [t0, t1] = this._titleWin;
    this.rootEl.classList.toggle('titleOn', t >= t0 && t < t1);
  }

  /** 收尾（跳过/自然同路）：状态同步清干净，视觉层 CSS 淡出。清理异常不阻断状态复位。 */
  _finish(skipped) {
    if (!this._active) return;
    this._active = false;
    this._played = true;
    this._skipped = !!skipped;
    try { this._voice?.stop?.(); } catch (e) { /* 旁白收声失败不阻塞收尾 */ }
    try { this._teardown(); } catch (e) { console.warn('[opening] 收尾清理异常：', e); }
    const res = this._resolve;
    this._resolve = null;
    res?.();
  }

  _teardown() {
    // 先复位「必须成功」的状态（相机/雾/DOM/body 类），再回收 GPU 资源（各自防御式）
    if (this._camera) {
      this._camera.fov = this._fov0;
      this._camera.updateProjectionMatrix();
    }
    if (this._scene?.fog && this._fog0) {
      this._scene.fog.color.copy(this._fog0.color);
      this._scene.fog.near = this._fog0.near;
      this._scene.fog.far = this._fog0.far;
    }
    if (this.rootEl) {
      this.cardEls.forEach((el) => el?.classList.remove('on'));
      this.rootEl.classList.remove('show', 'titleOn');
      this.rootEl.classList.add('done');
      clearTimeout(this._hideTimer);
      this._hideTimer = setTimeout(() => {
        this.rootEl.classList.add('hidden');
        this.rootEl.classList.remove('done');
      }, 700);
    }
    document.body.classList.remove('opening');

    // 粒子全量回收（scene 移除 + geometry/material/texture dispose；防御式，任一失败不拖单后面的回收）
    for (const p of [this._smoke, this._birds]) {
      if (!p) continue;
      try {
        this._scene.remove(p.points);
        p.geo?.dispose();
        p.mat?.dispose();
        p.tex?.dispose();
      } catch (e) { console.warn('[opening] 粒子回收异常：', e); }
    }
    this._smoke = this._birds = null;
    try { this._texWingA?.dispose(); this._texWingB?.dispose(); } catch (e) { /* 同上 */ }
    this._texWingA = this._texWingB = null;
  }
}
