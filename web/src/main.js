// main.js — 装配：渲染器/场景/昼夜/输入/粒子/WebAudio 手感包/主循环
import * as THREE from 'three';
import { HOTBAR, BLOCK_DEFS } from './blocks.js';
import { buildAtlas } from './textures.js';
import { World } from './world.js';
import { surfaceHeight } from './terrain.js';
import { Player } from './player.js';
import { Interaction } from './interaction.js';
import { UI } from './ui.js';

/* ---------- 启动 ---------- */
const canvas = document.getElementById('game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
} catch (e) {
  document.getElementById('overlay').innerHTML =
    '<h1 style="color:#e86">无法启动</h1><div class="hint">当前浏览器不支持 WebGL。<br>请换用 Chrome / Edge / Firefox 最新版。</div>';
  throw e;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 400);
scene.fog = new THREE.Fog(0x87ceeb, 40, 130);

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(60, 100, 35);
scene.add(ambient, sun);

const SEED = Number(new URLSearchParams(location.search).get('seed')) || 1337;
const DAY_LEN = 180; // 秒/昼夜

/* ---------- 世界与玩家 ---------- */
const atlas = buildAtlas();
const world = new World(scene, atlas.texture, SEED);
const SPAWN_X = 8, SPAWN_Z = 8;
world.warmup(SPAWN_X, SPAWN_Z);
const player = new Player(camera, world);
player.spawn(SPAWN_X, surfaceHeight(SPAWN_X, SPAWN_Z, SEED), SPAWN_Z);

const ui = new UI();
let hotbarIndex = 0;
ui.buildHotbar(HOTBAR);
ui.select(hotbarIndex);

/* ---------- WebAudio 合成音效（零外部文件） ---------- */
let actx = null;
function ensureAudio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* 静默降级 */ } }
  if (actx && actx.state === 'suspended') actx.resume();
}
function noiseBurst(dur, freq, gain, sweep) {
  if (!actx) return;
  const n = actx.sampleRate * dur;
  const buf = actx.createBuffer(1, n, actx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = actx.createBufferSource();
  src.buffer = buf;
  const flt = actx.createBiquadFilter();
  flt.type = 'lowpass';
  flt.frequency.setValueAtTime(freq, actx.currentTime);
  if (sweep) flt.frequency.exponentialRampToValueAtTime(Math.max(80, freq * sweep), actx.currentTime + dur);
  const g = actx.createGain();
  g.gain.value = gain;
  src.connect(flt).connect(g).connect(actx.destination);
  src.start();
}
const sfxDigTick = () => noiseBurst(0.05, 900, 0.12);
const sfxBreak = () => noiseBurst(0.14, 1400, 0.3, 0.25);
const sfxPlace = () => noiseBurst(0.06, 2000, 0.2, 0.5);

/* ---------- 挖掘粒子（手感包） ---------- */
const bursts = [];
function spawnBurst(pos, tileIndex) {
  const color = new THREE.Color(atlas.tileColors[tileIndex] ?? '#888888');
  const N = 16;
  const positions = new Float32Array(N * 3);
  const vels = [];
  for (let i = 0; i < N; i++) {
    positions[i * 3] = pos[0] + 0.5 + (Math.random() - 0.5) * 0.6;
    positions[i * 3 + 1] = pos[1] + 0.5 + (Math.random() - 0.5) * 0.6;
    positions[i * 3 + 2] = pos[2] + 0.5 + (Math.random() - 0.5) * 0.6;
    vels.push(new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3.5, (Math.random() - 0.5) * 3));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color, size: 0.14, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  bursts.push({ points, vels, life: 0.55, age: 0 });
}
function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.age += dt;
    if (b.age >= b.life) {
      scene.remove(b.points);
      b.points.geometry.dispose();
      b.points.material.dispose();
      bursts.splice(i, 1);
      continue;
    }
    const attr = b.points.geometry.attributes.position;
    for (let j = 0; j < b.vels.length; j++) {
      b.vels[j].y -= 12 * dt;
      attr.array[j * 3] += b.vels[j].x * dt;
      attr.array[j * 3 + 1] += b.vels[j].y * dt;
      attr.array[j * 3 + 2] += b.vels[j].z * dt;
    }
    attr.needsUpdate = true;
  }
}

/* ---------- 交互 ---------- */
let lastTickPct = 0;
const interaction = new Interaction(camera, world, scene, player, {
  onDigProgress(pct) {
    ui.setDigProgress(pct);
    if (pct > 0 && Math.floor(pct / 0.2) > Math.floor(lastTickPct / 0.2)) sfxDigTick();
    lastTickPct = pct;
  },
  onDigComplete(blockId, pos) {
    sfxBreak();
    spawnBurst(pos, BLOCK_DEFS[blockId].tiles.side);
  },
  onPlace() { sfxPlace(); },
});

/* ---------- 输入 ---------- */
const input = { forward: false, back: false, left: false, right: false, jump: false, down: false };
let digHeld = false, placeHeld = false, locked = false;

addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': input.forward = true; break;
    case 'KeyS': input.back = true; break;
    case 'KeyA': input.left = true; break;
    case 'KeyD': input.right = true; break;
    case 'Space': input.jump = true; e.preventDefault(); break;
    case 'ShiftLeft': case 'ShiftRight': input.down = true; break;
    case 'KeyF':
      player.flying = !player.flying;
      player.vel.y = 0;
      break;
    default:
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) { hotbarIndex = n - 1; ui.select(hotbarIndex); ui.showBlockName(HOTBAR[hotbarIndex]); }
      }
  }
});
addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': input.forward = false; break;
    case 'KeyS': input.back = false; break;
    case 'KeyA': input.left = false; break;
    case 'KeyD': input.right = false; break;
    case 'Space': input.jump = false; break;
    case 'ShiftLeft': case 'ShiftRight': input.down = false; break;
  }
});
addEventListener('wheel', (e) => {
  hotbarIndex = (hotbarIndex + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
  ui.select(hotbarIndex);
  ui.showBlockName(HOTBAR[hotbarIndex]);
});
addEventListener('mousedown', (e) => {
  if (!locked) return;
  if (e.button === 0) digHeld = true;
  if (e.button === 2) placeHeld = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) digHeld = false;
  if (e.button === 2) placeHeld = false;
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (!locked) return;
  player.addLook(e.movementX, e.movementY);
});

const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => {
  ensureAudio();
  canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { ui.hideOverlay(); }
  else {
    digHeld = placeHeld = false;
    Object.keys(input).forEach((k) => (input[k] = false));
    ui.showOverlay();
  }
});
addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ---------- 昼夜 ---------- */
const SKY_DAY = new THREE.Color(0x87ceeb);
const SKY_SUNSET = new THREE.Color(0xff9a5a);
const SKY_NIGHT = new THREE.Color(0x0b1026);
const _sky = new THREE.Color();
let dayTime = DAY_LEN * 0.15; // 从清晨开始

function updateDayNight(dt) {
  dayTime = (dayTime + dt) % DAY_LEN;
  const c = dayTime / DAY_LEN;
  let sky, sunI, ambI;
  if (c < 0.42)       { sky = _sky.copy(SKY_DAY);    sunI = 0.9;  ambI = 0.55; } // 白天
  else if (c < 0.5)   { const k = (c - 0.42) / 0.08; sky = _sky.lerpColors(SKY_DAY, SKY_SUNSET, k); sunI = 0.9 - 0.35 * k; ambI = 0.55 - 0.15 * k; } // 日落
  else if (c < 0.58)  { const k = (c - 0.5) / 0.08;  sky = _sky.lerpColors(SKY_SUNSET, SKY_NIGHT, k); sunI = 0.55 - 0.43 * k; ambI = 0.4 - 0.24 * k; } // 入夜
  else if (c < 0.92)  { sky = _sky.copy(SKY_NIGHT);  sunI = 0.12; ambI = 0.16; } // 深夜
  else                { const k = (c - 0.92) / 0.08; sky = _sky.lerpColors(SKY_NIGHT, SKY_DAY, k); sunI = 0.12 + 0.78 * k; ambI = 0.16 + 0.39 * k; } // 破晓
  renderer.setClearColor(sky);
  scene.fog.color.copy(sky);
  sun.intensity = sunI;
  ambient.intensity = ambI;
}

/* ---------- 主循环 ---------- */
let last = performance.now();
let frames = 0, fpsClock = 0;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (locked) {
    player.update(dt, input);
    interaction.update(dt, digHeld, placeHeld, HOTBAR[hotbarIndex]);
  }
  world.update(player.pos);
  updateBursts(dt);
  updateDayNight(dt);

  frames++; fpsClock += dt;
  if (fpsClock >= 0.5) {
    ui.setStats(Math.round(frames / fpsClock), world.chunks.size);
    frames = 0; fpsClock = 0;
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
