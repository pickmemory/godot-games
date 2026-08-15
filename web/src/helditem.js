// helditem.js — 第一人称手持物品显示（MC-2b 程序化占位模型；Kenney 手臂/工具接入留给 MC-5a）
// 方块 → 贴 atlas 瓦片的小立方体；工具 → 盒件拼装的镐（头色随等级）；材料 → 小方锭。
// 附加在 camera 上（main 需 scene.add(camera)），带移动摆动 + 挖掘挥动动画。
import * as THREE from 'three';
import { ITEM } from './items.js';
import { drawTileTo } from './textures.js';
import { BLOCK_DEFS } from './blocks.js';

const HANDLE_COLOR = 0x6b4a2b;
const HEAD_COLORS = { [ITEM.PICK_WOOD]: 0x9a7b4f, [ITEM.PICK_STONE]: 0x8f8f8f, [ITEM.PICK_IRON]: 0xd9d9d9 };

export class HeldItem {
  /** @param {THREE.PerspectiveCamera} camera */
  constructor(camera) {
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.position.set(0.38, -0.34, -0.62);   // 右下角视线内
    this.root.rotation.set(0, 0.42, 0);
    camera.add(this.root);
    this._mesh = null;
    this._itemId = -1;
    this._t = 0;
    this._swing = 0;
  }

  /** 切换手持物品（id=0 空手隐藏）。仅在实际变化时重建网格 */
  setItem(itemId) {
    if (itemId === this._itemId) return;
    this._itemId = itemId;
    if (this._mesh) {
      this.root.remove(this._mesh);
      this._mesh.traverse((o) => {
        if (o.isMesh) { o.geometry.dispose(); if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose()); else o.material.dispose(); }
      });
      this._mesh = null;
    }
    if (!itemId) return;
    this._mesh = itemId < 100 ? this._buildBlock(itemId) : this._buildItem(itemId);
    if (this._mesh) this.root.add(this._mesh);
  }

  /** 方块：atlas 侧面瓦片贴图的小立方体 */
  _buildBlock(blockId) {
    const def = BLOCK_DEFS[blockId];
    if (!def || !def.tiles) return null;
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    drawTileTo(cv.getContext('2d'), def.tiles.side, 0, 0, 16, 16);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.3),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    mesh.rotation.y = 0.5;
    return mesh;
  }

  /** 工具/材料：盒件程序化拼装 */
  _buildItem(itemId) {
    const g = new THREE.Group();
    if (HEAD_COLORS[itemId] !== undefined) {
      // 镐：竖柄 + 顶部横头 + 两端下弯
      const wood = new THREE.MeshLambertMaterial({ color: HANDLE_COLOR });
      const head = new THREE.MeshLambertMaterial({ color: HEAD_COLORS[itemId] });
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.52, 0.055), wood);
      handle.position.y = -0.05;
      g.add(handle);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 0.07), head);
      bar.position.y = 0.23;
      g.add(bar);
      const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.06), head);
      tipL.position.set(-0.22, 0.19, 0); tipL.rotation.z = 0.65;
      g.add(tipL);
      const tipR = tipL.clone();
      tipR.position.x = 0.22; tipR.rotation.z = -0.65;
      g.add(tipR);
      g.rotation.z = -0.55;   // 手持斜握
    } else {
      // 材料：小方锭
      const colors = { [ITEM.COAL]: 0x2a2a2a, [ITEM.STICK]: 0x8a6d3b };
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.16),
        new THREE.MeshLambertMaterial({ color: colors[itemId] ?? 0xcccccc }),
      );
      mesh.rotation.y = 0.6;
      g.add(mesh);
    }
    return g;
  }

  /**
   * @param {number} dt
   * @param {{moving?:boolean, digging?:boolean}} st
   */
  update(dt, st = {}) {
    this._t += dt;
    if (this._itemId === 0) return;   // 空手不动画
    // 挥动：挖掘中连续摆劈
    if (st.digging) this._swing = Math.min(1, this._swing + dt * 8);
    else this._swing = Math.max(0, this._swing - dt * 6);
    const sw = Math.sin(this._t * 14) * this._swing;
    // 走路摆动
    const bob = st.moving ? Math.sin(this._t * 9) * 0.022 : 0;
    this.root.position.y = -0.34 + bob;
    this.root.rotation.x = -sw * 0.7;
    this.root.rotation.z = sw * 0.18;
  }
}
