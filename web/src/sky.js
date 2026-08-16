// sky.js — MC-5x 天体与时辰：太阳/月亮 canvas 程序化 sprite（东升西落，随玩家平移）+ 十二时辰换算
//
// 设计对齐（与 main.js 昼夜 5 阶段光照共用以 c = dayTime / DAY_LEN）：
//   c=0 卯时日出（太阳东方地平线）· c=0.25 午时天顶 · c=0.5 酉时日落（西方地平线）· c=0.75 子夜月悬中天
//   —— 太阳即时钟：抬头看太阳/月亮的位置，就知道现在是一天里的什么时候。
// 天体为占位美术（canvas 径向渐变）；Kenney 天空盒/日月贴图引入时只换贴图不改逻辑（登 CREDITS.md）。
import * as THREE from 'three';

/** 十二时辰：c=0 → 卯；索引 = floor(((c*24+6)+1)/2) % 12 */
const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const SHICHEN_ALIAS = ['夜半', '鸡鸣', '平旦', '日出', '食时', '隅中', '日中', '日昳', '晡时', '日落', '黄昏', '人定'];

/** @returns {{idx:number, name:string, alias:string, label:string}} 如 {name:'午', alias:'日中', label:'午时 · 日中'} */
export function shichen(c) {
  const hour = (c * 24 + 6) % 24;                 // c=0 → 06:00（卯，日出）
  const idx = Math.floor((hour + 1) / 2) % 12;
  return { idx, name: SHICHEN[idx], alias: SHICHEN_ALIAS[idx], label: `${SHICHEN[idx]}时 · ${SHICHEN_ALIAS[idx]}` };
}

/** 径向渐变天体贴图：实心核心 + 柔和光晕 */
function discTexture(core, halo, haloAlpha) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 96;
  const ctx = cv.getContext('2d');
  let g = ctx.createRadialGradient(48, 48, 6, 48, 48, 48);
  g.addColorStop(0, `rgba(${halo},${haloAlpha})`);
  g.addColorStop(1, `rgba(${halo},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 96, 96);
  g = ctx.createRadialGradient(48, 48, 2, 48, 48, 26);
  g.addColorStop(0, core);
  g.addColorStop(0.72, core);
  g.addColorStop(1, core + '00');   // 8 位 hex（#RRGGBB00）：核心色淡出（末两位 alpha）
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(48, 48, 27, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * 太阳 + 月亮：每帧 update(c, playerPos, nightK) 跟随玩家平移（天体“无限远”的近拟）。
 * fog:false + depthWrite:false + renderOrder:-10 —— 不被雾吞、不写深度，但正常被地形遮挡。
 */
export class CelestialBodies {
  constructor(scene) {
    this.R = 290;   // 天球半径（相机 far=400 内、雾距之外）

    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: discTexture('#fff6d8', '255,214,120', 0.85),
      transparent: true, fog: false, depthWrite: false,
    }));
    this.sun.scale.setScalar(38);
    this.sun.renderOrder = -10;

    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({
      map: discTexture('#e6efff', '190,205,255', 0.4),
      transparent: true, fog: false, depthWrite: false,
    }));
    this.moon.scale.setScalar(26);
    this.moon.renderOrder = -10;

    scene.add(this.sun, this.moon);
    this._gold = new THREE.Color('#fff2c0');
    this._ember = new THREE.Color('#ff8a3c');
  }

  /** @param {number} c dayTime/DAY_LEN @param {THREE.Vector3} p 玩家位置 @param {number} nightK 0..1 */
  update(c, p, nightK) {
    // 太阳：c=0 东(+X)地平线 → 0.25 天顶 → 0.5 西落；月亮 = 对跖（+0.5 相位）
    const place = (body, cc, sizeBoost) => {
      const ang = cc * Math.PI * 2;
      const x = Math.cos(ang), elev = Math.sin(ang);
      body.position.set(
        p.x + x * this.R,
        p.y + elev * this.R * 0.85,
        p.z - 42,                       // 弧线略偏北，正午不穿天顶
      );
      body.visible = elev > -0.12;      // 沉到地平线下即藏
      return elev;
    };
    place(this.sun, c);
    place(this.moon, (c + 0.5) % 1);
    // 日落时段（c 0.35→0.5）太阳由金白转橙红；夜色越深月亮微亮
    const duskK = Math.max(0, Math.min(1, (c - 0.35) / 0.15));
    this.sun.material.color.copy(this._gold).lerp(this._ember, c > 0.5 ? 1 : duskK * 0.9);
    this.moon.material.opacity = 0.75 + 0.25 * nightK;
  }
}
