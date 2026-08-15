// main.js — 装配：渲染器/场景/昼夜/输入/粒子/WebAudio 手感包/主循环
import * as THREE from 'three';
import { BLOCK, BLOCK_DEFS } from './blocks.js';
import { buildAtlas } from './textures.js';
import { World } from './world.js';
import { surfaceHeight } from './terrain.js';
import { Player } from './player.js';
import { Interaction } from './interaction.js';
import { UI, itemName, drawIcon } from './ui.js';
import { Health } from './health.js';
import { MobManager, FALLBACK_MOB_CONFIG } from './mob.js';
import { Inventory } from './inventory.js';
import { Crafting } from './crafting.js';
import { HeldItem } from './helditem.js';
import { FALLBACK_MINING, dropOf, toolDefOf } from './mining.js';
import { SFX } from './sfx.js';
import { DropManager } from './drops.js';
import { Farming } from './farming.js';
import { Building } from './building.js';
import { loadChapter, normalizeChapter, ChapterTimeline, FALLBACK_CHAPTER } from './chapter.js';
import { stampStructure } from './structure.js';
import { NPCManager, FALLBACK_NPC_DATA } from './npc.js';
import { DialogUI, FALLBACK_DIALOGS } from './dialog.js';
import { QuestSystem, FALLBACK_QUESTS } from './quests.js';
import { Cutscene } from './cutscene.js';
import { SaveSystem, LocalStorageSaveAdapter } from './save.js';

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
scene.add(ambient, sun, camera);   // camera 入场景：手持模型挂在 camera 上（helditem.js）

/* ---------- MC-4c 存档抽象层：ISaveAdapter → SaveSystem（发布期换 SteamCloudSaveAdapter 只改此处装配，业务码零改动） ---------- */
const saveAdapter = new LocalStorageSaveAdapter('sgsc-save-v1');
const saveSystem = new SaveSystem(saveAdapter, {
  interval: 30,   // 定时自动存档（秒）
  onWarn: (msg) => { console.warn('[save]', msg); ui.showPickup(msg); },
});
const urlParams = new URLSearchParams(location.search);
if (urlParams.has('new')) { saveAdapter.clear(); console.log('[save] ?new 开新档：旧档已清'); }
const snapshot = urlParams.has('new') ? null : saveSystem.loadSnapshot();

let SEED = Number(urlParams.get('seed')) || 1337;
if (snapshot) {
  // 差分相对「存档 seed 的地形生成」，故存档 seed 优先于 URL seed（换 seed 重放会得到错误世界）
  if (urlParams.get('seed')) console.warn('[save] URL seed 与存档并存：以存档 seed 为准');
  SEED = snapshot.seed;
}
let DAY_LEN = 180; // 秒/昼夜（章节数据 dayLengthSeconds 可覆盖，见 MC-3a）

/* ---------- 世界与玩家 ---------- */
const atlas = buildAtlas();
const world = new World(scene, atlas.texture, SEED);
saveSystem.attachWorld(world, snapshot);   // MC-4c：差分先挂上，warmup/后续生成时确定性重放
const SPAWN_X = 8, SPAWN_Z = 8;
const savedPlayer = snapshot?.player;
const hasSavedPos = Array.isArray(savedPlayer?.pos) && savedPlayer.pos.length === 3
  && savedPlayer.pos.every((v) => Number.isFinite(v));
const startPos = hasSavedPos ? savedPlayer.pos : [SPAWN_X, surfaceHeight(SPAWN_X, SPAWN_Z, SEED), SPAWN_Z];
world.warmup(startPos[0], startPos[2]);
const player = new Player(camera, world);
if (hasSavedPos) {
  // MC-4c：恢复精确存档位置/朝向（不走 spawn 的格心偏移；出生 chunk 已带差分预热）
  player.pos.set(startPos[0], startPos[1], startPos[2]);
  player.yaw = Number(savedPlayer.yaw) || 0;
  player.pitch = Number(savedPlayer.pitch) || 0;
  player.flying = !!savedPlayer.flying;
  player.vel.set(0, 0, 0);
  // 落点净化：存档脚下被差分填实（极端情况）→ 逐格上抬最多 6 格，防卡在方块里
  for (let lift = 0; lift < 6 && player._collides(player.pos.x, player.pos.y, player.pos.z); lift++) player.pos.y += 1;
  player._syncCamera();
} else {
  player.spawn(SPAWN_X, surfaceHeight(SPAWN_X, SPAWN_Z, SEED), SPAWN_Z);
}

const ui = new UI();
if (!saveAdapter.available) console.warn('[save] localStorage 不可用（隐私模式/被禁）：本会话改动不会持久化');
const cutscene = new Cutscene();   // MC-3d 章节开场/结尾演出层（数据驱动：章节 JSON 的 cutscene 效果）

/* ---------- MC-2b 工具天梯：生存行囊 + 挖掘公式 + 合成 + 手持模型 ---------- */
const inventory = new Inventory(9);              // 9 槽 = hotbar（最小集；背包扩容留 MC-4）
ui.buildHotbar();
ui.renderInventory(inventory);
inventory.onChange(() => ui.renderInventory(inventory));

let miningCfg = FALLBACK_MINING;                  // 公式参数：data/mining.json 缺失时同构兑底
try {
  const res = await fetch('data/mining.json');
  if (res.ok) miningCfg = await res.json();
} catch (e) { /* 离线/缺文件 → 兑底 */ }

let recipeData = null;                            // 配方：data/recipes.json 缺失时兑底
try {
  const res = await fetch('data/recipes.json');
  if (res.ok) recipeData = await res.json();
} catch (e) { /* 同上 */ }

/* ---------- MC-3a 章节时间轴：data/chapters/*.json（数据驱动编年；缺文件/离线→兜底章节） ----------
   MC-5b：?chapter=<章节 id> 选章（默认第一章；第二章：?chapter=190-dong-zhuo，建议配 &new 开新档） */
const CHAPTER_ID = urlParams.get('chapter') || '184-yellow-turban';
const chapterLoaded = await loadChapter(`data/chapters/${CHAPTER_ID}.json`);
const chapterResult = chapterLoaded.ok ? chapterLoaded : normalizeChapter(FALLBACK_CHAPTER);
if (!chapterLoaded.ok) console.warn('[chapter] 章节数据加载失败，用兜底：', chapterLoaded.warnings);
else if (chapterResult.warnings.length) console.warn('[chapter] 章节数据告警：', chapterResult.warnings);
if (chapterResult.chapter.dayLengthSeconds) DAY_LEN = chapterResult.chapter.dayLengthSeconds;

/* ---------- MC-2 生存：血量 + 夜间敌对生物（数值数据驱动 web/data/mobs.json） ---------- */
let mobConfig = FALLBACK_MOB_CONFIG;
try {
  const res = await fetch('data/mobs.json');
  if (res.ok) mobConfig = await res.json();
} catch (e) { /* 文件缺失/离线 → 用模块内同构兜底 */ }

/* ---------- MC-3b NPC/对话/任务数据（数据驱动；缺文件/离线 → 模块内同构兜底） ----------
   MC-5b：优先取章节专属名册 data/npc/<章节 id>/{npcs,dialogs}.json（第二章南市人物），
   缺失则兑底到第一章通用名册 data/npc/*.json，再兑底到模块内 FALLBACK */
async function fetchFirst(urls) {
  for (const u of urls) {
    try { const r = await fetch(u); if (r.ok) return await r.json(); } catch (e) { /* 试下一个 */ }
  }
  return null;
}

let npcData = await fetchFirst([`data/npc/${CHAPTER_ID}/npcs.json`, 'data/npc/npcs.json']);
if (!npcData) npcData = FALLBACK_NPC_DATA;

let dialogs = await fetchFirst([`data/npc/${CHAPTER_ID}/dialogs.json`, 'data/npc/dialogs.json']);
if (!dialogs) dialogs = FALLBACK_DIALOGS;

let questData = FALLBACK_QUESTS;
try {
  const res = await fetch('data/quests.json');
  if (res.ok) questData = await res.json();
} catch (e) { /* 同上 */ }

/* ---------- MC-4a 农耕数据（数据驱动；缺文件/离线 → farming.js 同构兑底） ---------- */
let farmingData = null;
try {
  const res = await fetch('data/farming.json');
  if (res.ok) farmingData = await res.json();
} catch (e) { /* 同上 */ }

/* ---------- MC-4b 建造数据（房屋判定阈值/入住流民模板；缺文件 → building.js 兑底） ---------- */
let buildingData = null;
try {
  const res = await fetch('data/building.json');
  if (res.ok) buildingData = await res.json();
} catch (e) { /* 同上 */ }

const PLAYER_MAX_HP = 20;
let dead = false;
let started = false;   // MC-3d：首次点击开卷（指针锁定）后才推进时间轴/昼夜——开场演出排在玩家点击之后
let deaths = 0;        // MC-3d：死亡计数（首次死亡特殊旁白，设计 C4）

/* 受击震屏（MC-2c）：受击时视角轻震，幅度随剩余时间衰减（与红晕/受击音联动） */
let shakeT = 0;
const SHAKE_DUR = 0.32;
function shake() { shakeT = SHAKE_DUR; }

const health = new Health(PLAYER_MAX_HP, {
  onChange: (hp, max) => ui.setHealth(hp, max),
  onDeath: () => die(),
}, { iframe: 0.6, regenDelay: 8, regenInterval: 4 });
ui.buildHearts(PLAYER_MAX_HP);
ui.setHealth(health.hp, PLAYER_MAX_HP);

const mobManager = new MobManager(scene, world, mobConfig, {
  onAttack(dmg, mobPos) {
    if (dead) return;
    const applied = health.damage(dmg, mobPos);
    if (!applied) return;
    sfx.hurt();
    sfx.groan(0.22);
    ui.flashDamage();
    shake();
    // 击退：推离伤害来源 + 小幅上抛
    const kx = player.pos.x - mobPos.x, kz = player.pos.z - mobPos.z;
    const kl = Math.hypot(kx, kz) || 1;
    player.vel.x = (kx / kl) * 7;
    player.vel.z = (kz / kl) * 7;
    player.vel.y = Math.max(player.vel.y, 4);
  },
});

/* ---------- WebAudio 合成音效（sfx.js 模块；零外部文件，MC-2c 全覆盖） ---------- */
const sfx = new SFX();
function ensureAudio() { sfx.ensure(); }

/* ---------- MC-3a 章节时间轴引擎装配：时间数学在 chapter.js，世界迁移处理器在此注册 ---------- */
const skyOverrides = {};   // sky 效果覆盖（雾距等；空值 = 不覆盖，见 updateDayNight）
const timeline = new ChapterTimeline(chapterResult.chapter, {
  dayLength: DAY_LEN,
  onEvent(ev) {
    console.log(`[chapter] ${timeline.formatDate()} 「${ev.title}」${ev.narration}`);
  },
  onDayChange() {
    ui.setDate(`${timeline.formatDate()} · ${timeline.season.label}`);
    // MC-3b 编年出场钩子：日翻页重判 NPC 在场性（appear/disappear 日期 → 序数日比较）
    npcManager.setChronicle(chapterResult.chapter.startSerial + timeline.day);
  },
  onSeasonChange(s) { console.log(`[chapter] 季节流转 → ${s.label}`); },
  onChapterEnd() {
    console.log('[chapter] 章末：越过章节 end 日期，等待下一章（MC-3c 充实迁移）');
    doSave('chapter-end');   // MC-4c：章节切换触发点
  },
});

timeline.registerEffect('notify', (eff) => { if (eff.text) ui.showPickup(eff.text); });
timeline.registerEffect('setFlag', (eff) => timeline.setFlag(eff.flag, eff.value !== false));
timeline.registerEffect('mobs', (eff) => {
  if (eff.spawn) Object.assign(mobManager.cfg.spawn, eff.spawn);
});
timeline.registerEffect('sky', (eff) => {
  if (eff.fogNear != null) skyOverrides.fogNear = eff.fogNear;
  if (eff.fogFar != null) skyOverrides.fogFar = eff.fogFar;
  // MC-5b：事件天空色覆盖（焚洛阳的橙灰/烟期）；null 可清除回季节默认
  if ('skyTint' in eff) skyOverrides.skyTint = eff.skyTint ?? null;
});
// MC-5b 结构落成：章节数据的 stampStructure 效果 → 模板 JSON 写入世界，锚点登记供 blockReplace 引用
//   幂等（同 id 已落成则跳过）；开卷即预落一次——读档时 onEnter 不重放，锚点登记表仍需重建
//   （结构本体在存档差分里，重写同值方块不产生新差分）
const structureAnchors = new Map();   // 结构 id → {x,y,z}（坊中心地表；center:"structure:<id>" 用）
const stampedSrcs = new Set();         // 已处理的模板 src（幂等判定；锚点表以模板内 id 为键）
async function stampStructureEffect(eff) {
  if (!eff.src) return;
  if (stampedSrcs.has(eff.src)) return;
  stampedSrcs.add(eff.src);
  try {
    const res = await fetch(eff.src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const anchor = stampStructure(world, await res.json());
    structureAnchors.set(anchor.id, anchor);
    console.log(`[chapter] 结构落成「${anchor.id}」于 (${anchor.x},${anchor.y},${anchor.z})，写入 ${anchor.placed} 格`);
  } catch (e) { console.warn('[chapter] 结构落成失败：', e); }
}
timeline.registerEffect('stampStructure', (eff) => { stampStructureEffect(eff); });
for (const eff of chapterResult.chapter.worldState.onEnter)
  if (eff?.type === 'stampStructure') stampStructureEffect(eff);   // 读档兑底：重建锚点登记表
// 方块替换（圆柱区域，玩家/指定坐标/已落成结构锚点为心）：dirty chunk 由 world.update 每帧限重建，自然分帧
timeline.registerEffect('blockReplace', (eff) => {
  const r = eff.radius ?? 16, [lo, hi] = eff.yRange ?? [-2, 1];
  let c;
  if (!eff.center || eff.center === 'player') {
    c = { x: Math.floor(player.pos.x), y: Math.floor(player.pos.y), z: Math.floor(player.pos.z) };
  } else if (typeof eff.center === 'string' && eff.center.startsWith('structure:')) {
    c = structureAnchors.get(eff.center.slice('structure:'.length));   // MC-5b：焚洛阳对坊区的确定性替换，与 seed 解耦
    if (!c) { console.warn(`[chapter] blockReplace 引用了未落成的结构: ${eff.center}`); return; }
  } else c = eff.center;
  let n = 0;
  for (let dy = lo; dy <= hi; dy++)
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz > r * r) continue;
        const x = c.x + dx, y = c.y + dy, z = c.z + dz;
        if (world.getBlock(x, y, z) === eff.from) { world.setBlock(x, y, z, eff.to); n++; }
      }
  console.log(`[chapter] blockReplace ${eff.from}→${eff.to}：${n} 格`);
});
// MC-3d 章节开场/结尾演出：冻结输入，演出自走（任意键可跳过）；结束后可弹尾声提示（epilogue）
async function playCutscene(eff) {
  if (cutscene.isActive) return;   // 不叠加：上一场未收则忽略
  digHeld = placeHeld = false;
  Object.keys(input).forEach((k) => (input[k] = false));
  await cutscene.play({
    title: eff.title ?? '',
    subtitle: eff.subtitle ?? '',
    lines: Array.isArray(eff.lines) ? eff.lines : [],
  });
  if (eff.epilogue) ui.showPickup(eff.epilogue);
}
timeline.registerEffect('cutscene', (eff) => { playCutscene(eff); });
// MC-3d：章节事件里也能开任务（first-night → 拾柴）与动态换对话树（war-begun → 陈叟战后树）
timeline.registerEffect('startQuest', (eff) => { if (eff.id) quests.begin(eff.id); });
timeline.registerEffect('setDialog', (eff) => { if (eff.npc && eff.dialog) npcManager.setDialog(eff.npc, eff.dialog); });
ui.setDate(`${timeline.formatDate()} · ${timeline.season.label}`);

/* ---------- MC-3b NPC 系统：任务 → 对话 → 编年出场（模块只经导出签名通信，效果路由在此汇流） ---------- */
const quests = new QuestSystem({
  onStart: (q) => ui.showPickup(`事起：《${q.title}》`),
  onComplete: (q) => ui.showPickup(`事了：《${q.title}》`),
});
quests.registerAll(questData.quests);

const dialogUI = new DialogUI({
  // 对话效果路由：与 chapter.js registerEffect 同一模式，具体执行方在此注册
  onEffect(eff) {
    if (!eff || typeof eff !== 'object') return;
    if (eff.type === 'startQuest') quests.begin(eff.id);
    else if (eff.type === 'setFlag') timeline.setFlag(eff.flag, eff.value !== false);
    else if (eff.type === 'notify') ui.showPickup(eff.text);
    else console.warn(`[dialog] 未知效果类型: ${eff.type}`);
  },
});

const npcManager = new NPCManager(scene, world, npcData);
npcManager.setChronicle(chapterResult.chapter.startSerial);   // 开卷即判（此后日翻页重判）

/* ---------- MC-4b 建造扩展：门开合 + 房屋判定（判定成功 → 流民入住 + 定居反馈） ---------- */
const building = new Building(world, {
  notify: (t) => ui.showPickup(t),
  sound: () => sfx.place(),
  // 门口占格检查：玩家 AABB 或任一在场 NPC 站在本格 → 拒绝关门（防夹进实心格）
  cellBlocked: (x, y, z) => {
    const a = player.aabb;
    if (x + 1 > a.x0 && x < a.x1 && y + 1 > a.y0 && y < a.y1 && z + 1 > a.z0 && z < a.z1) return true;
    for (const n of npcManager.npcs) {
      if (!n.active) continue;
      if (Math.abs(n.pos.x - (x + 0.5)) < 0.85 && Math.abs(n.pos.z - (z + 0.5)) < 0.85
        && n.pos.y + 1.9 > y && n.pos.y < y + 2) return true;
    }
    return false;
  },
  onHouse(house) {
    ui.showPickup(building.cfg.messages.settled);
    // 入住：动态 NPC（不占 npcs.json 编年位），锚点 = 内腔落脚地板格，户内小半径漫游
    const v = building.cfg.villager;
    npcManager.spawnDynamic({
      id: `settler-${house.door.join('-')}`,
      name: v.name,
      title: v.title,
      model: v.model,
      // anchor = 内腔落脚空气格；NPC spawn.y 语义 = 脚下实地格（故 -1）
      spawn: { x: house.anchor[0], y: house.anchor[1] - 1, z: house.anchor[2] },
      wander: { radius: house.radius, speed: v.wanderSpeed },
    });
    setTimeout(() => ui.showPickup(building.cfg.messages.villager), 1600);
  },
});
if (buildingData) building.setData(buildingData);

function openDialog(npc) {
  document.exitPointerLock();
  ui.setTalkHint('');
  dialogUI.open(dialogs?.[npc.dialogId] ?? null, npc);   // 树缺失 → DialogUI 兑底树
  quests.notify(`talk:${npc.id}`, 1);   // MC-3d：交谈即任务事件（share-the-loaf 等对话直接完成的任务）
}
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

/* ---------- 掉落物实体（MC-2c）：破坏后弹出小方块，靠近吸附拾取入行囊 ---------- */
const dropManager = new DropManager(scene, world, atlas);
function onDropPickup(itemId, count) {
  const left = inventory.add(itemId, count);
  const got = count - left;
  if (got > 0) {
    sfx.pickup();
    ui.showPickup(left > 0
      ? `行囊已满，捡回 ${got} 个${itemName(itemId)}`
      : `+${got} ${itemName(itemId)}`);
  }
  return got; // 0 = 一个都没收下（满），掉落物保留原地稍后再试
}

/* ---------- MC-4a 农耕系统：开垦/播种/生长/收获，季节联动 MC-3a 时间轴 ---------- */
const farming = new Farming(world, {
  dayLength: DAY_LEN,
  season: () => timeline.season.name,          // MC-3a：seasonGrowth 按 season.name 取系数
  elapsedDays: () => timeline.elapsed,          // 水分计时与开卷游戏日历同源
  notify: (t) => ui.showPickup(t),
  drop: (pos, id, n) => dropManager.spawn(id, pos, n),
  consumeHeld: () => inventory.takeFromSelected(1),
  eat: (crop, itemId) => {
    if (dead || health.dead) return false;
    if (health.hp >= health.maxHp) { ui.showPickup('血气充盈，吃不下了'); return false; }
    if (!inventory.takeFromSelected(1)) return false;
    health.heal(crop.foodHp);
    sfx.pickup();
    ui.showPickup(`吃下${itemName(itemId)}，缓过一口气（+${crop.foodHp}）`);
    return true;
  },
});
if (farmingData) farming.setData(farmingData);

/* ---------- 交互 ---------- */
let lastTickPct = 0;
let blocksPlaced = 0, blocksMined = 0;   // MC-3a：章节条件触发消费的玩家统计（ctx.stats）
const interaction = new Interaction(camera, world, scene, player, {
  onDigProgress(pct) {
    ui.setDigProgress(pct);
    // 分段轻响：与裂纹分段（interaction.js CRACK_STAGES=8）同步推进
    if (pct > 0 && Math.floor(pct * 8) > Math.floor(lastTickPct * 8)) sfx.digTick();
    lastTickPct = pct;
  },
  onDigComplete(blockId, pos) {
    blocksMined++;
    quests.notify('blocksMined', 1);   // MC-3b：玩家行为 → 任务事件（与 chapter ctx.stats 同名）
    sfx.blockBreak();
    spawnBurst(pos, BLOCK_DEFS[blockId].tiles.side);
    // MC-4a/MC-4b 掉落特判：门（整扇一件）/ 作物（成熟才有产出）优先，其余走 mining.js dropOf
    const drops = building.breakDrops(blockId) ?? farming.breakDrops(blockId);
    if (drops) {
      for (const d of drops) dropManager.spawn(d.id, pos, d.n);
    } else {
      // 掉落 → 掉落物实体（mining.js：drop 字段 + 掉落等级门槛；拾取在 drops.js/update）
      const drop = dropOf(BLOCK_DEFS[blockId], toolDefOf(inventory.heldId()), blockId);
      if (drop) {
        dropManager.spawn(drop, pos);
      } else if (BLOCK_DEFS[blockId].minDropTier) {
        ui.showPickup('镐的等级不够，什么也没挖下来…');
      }
    }
    farming.afterDig(pos, blockId);   // 耕地被挖 → 连带顶上作物弹出；作物被挖 → 清生长记录
    building.afterDig(pos, blockId);  // MC-4b：门被拆一半 → 另一半连带消失
  },
  onPlace(pos) {
    sfx.place();
    blocksPlaced++;
    quests.notify('blocksPlaced', 1);  // MC-3b：同上
    inventory.takeFromSelected(1);   // 生存模式：放置即消耗
    building.onPlaced(pos);          // MC-4b：新落一扇门 → 尝试房屋判定
  },
  // 右键物品用法：门开合（MC-4b）优先，再锄地/播种/收获/进食（MC-4a）；返回 true 则消费本次右键
  onUse: (hit, heldId) => building.useOn(hit) || farming.useOn(hit, heldId),
});
interaction.miningCfg = miningCfg;

const crafting = new Crafting(inventory, { nameOf: itemName, iconRenderer: drawIcon }, {
  onCrafted(r) { sfx.place(); ui.showPickup(`合成 ${itemName(r.out.id)} ×${r.out.n}`); },
});
if (recipeData?.recipes) crafting.setRecipes(recipeData.recipes);

const heldItem = new HeldItem(camera);

/** 站在已放置的工作台旁（半径 4 格，高差 3）才解锁锻镐配方 */
function nearCraftingTable() {
  const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
  for (let dy = -3; dy <= 3; dy++)
    for (let dz = -4; dz <= 4; dz++)
      for (let dx = -4; dx <= 4; dx++)
        if (world.getBlock(px + dx, py + dy, pz + dz) === BLOCK.CRAFT_TABLE) return true;
  return false;
}

function lockPointer() {
  canvas.requestPointerLock()?.catch?.(() => { /* 指针锁定被拒 → 点击画布可重试 */ });
}
function toggleCraft() {
  if (crafting.isOpen) {
    crafting.close();
    lockPointer();
  } else {
    crafting.nearStation = nearCraftingTable();
    crafting.open();
    document.exitPointerLock();
  }
}

/* ---------- 输入 ---------- */
const input = { forward: false, back: false, left: false, right: false, jump: false, down: false };
let digHeld = false, placeHeld = false, locked = false;

addEventListener('keydown', (e) => {
  if (cutscene.isActive) { cutscene.skip(); return; }   // MC-3d：演出中任意键跳过（不透传）
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
    case 'KeyE':
      if (dead) break;
      // 优先级：对话中关闭 > 附近 NPC 交谈 > 合成面板（对话/面板互斥，均需指针锁定态）
      if (dialogUI.isOpen) { dialogUI.close(); lockPointer(); break; }
      if (locked && !crafting.isOpen) {
        const near = npcManager.nearestTalkable(player.pos, 3.2);
        if (near) { openDialog(near); break; }
      }
      if (locked || crafting.isOpen) toggleCraft();
      break;
    case 'Escape':
      if (dialogUI.isOpen) { dialogUI.close(); lockPointer(); }
      else if (crafting.isOpen) { crafting.close(); lockPointer(); }
      break;
    default:
      if (e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5));
        if (n >= 1 && n <= 9) { inventory.select(n - 1); ui.select(inventory.selected); ui.showItemName(inventory.heldId()); }
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
  inventory.select((inventory.selected + (e.deltaY > 0 ? 1 : -1) + 9) % 9);
  ui.select(inventory.selected);
  ui.showItemName(inventory.heldId());
});
addEventListener('mousedown', (e) => {
  if (!locked || cutscene.isActive) return;
  if (e.button === 0) digHeld = true;
  if (e.button === 2) placeHeld = true;
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) digHeld = false;
  if (e.button === 2) placeHeld = false;
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (!locked || cutscene.isActive) return;   // 演出中冻结视角（镜头语言归演出层）
  player.addLook(e.movementX, e.movementY);
});

const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => {
  ensureAudio();
  lockPointer();
});
canvas.addEventListener('click', () => {
  // 面板/遮罩都没显示但指针未锁（如 ESC 后重进）→ 点画布重锁
  if (!locked && !dead && !crafting.isOpen && !dialogUI.isOpen) { ensureAudio(); lockPointer(); }
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) { started = true; ui.hideOverlay(); }   // 首次锁定 = 开卷：时间轴/昼夜自此推进
  else {
    digHeld = placeHeld = false;
    Object.keys(input).forEach((k) => (input[k] = false));
    if (!dead && !crafting.isOpen && !dialogUI.isOpen) ui.showOverlay(); // 死亡/合成/对话接管时由各自界面接管
  }
});

/* ---------- MC-2 死亡 / 重生 ---------- */
function die() {
  dead = true;
  deaths++;   // MC-3d：首次死亡特殊旁白（重生后弹，见下方重生点击处）
  digHeld = placeHeld = false;
  Object.keys(input).forEach((k) => (input[k] = false));
  sfx.groan(0.25);
  document.exitPointerLock();
  ui.showDeath();
  doSave('death');   // MC-4c：死亡触发点（行囊/世界/章节进度先落盘，刷新不丢）
}
document.getElementById('death').addEventListener('click', () => {
  if (!dead) return;
  health.respawn();
  player.spawn(SPAWN_X, surfaceHeight(SPAWN_X, SPAWN_Z, SEED), SPAWN_Z);
  mobManager.clearAll(); // 重生清场：行尸消散，还玩家一个喘息
  dead = false;
  ui.hideDeath();
  ui.renderInventory(inventory); // 死亡不掉行囊（最小集决定；掉落留 MC-4）
  dropManager.clearAll();        // 重生清场：散落掉落物一并消散
  doSave('respawn');             // MC-4c：重生触发点
  if (deaths === 1) ui.showPickup('乱世里没有人为你收尸。你在村口醒来，好像什么都没发生过——但你知道发生过。');
  ensureAudio();
  sfx.setNight(isNight);
  canvas.requestPointerLock()?.catch?.(() => { /* 同上：静默降级 */ });
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
const SUN_DAY = new THREE.Color(0xffffff);
const SUN_NIGHT = new THREE.Color(0x8a97c8);   // 月光冷蓝
const AMB_DAY = new THREE.Color(0xffffff);
const AMB_NIGHT = new THREE.Color(0x9aa8d0);
const FOG_DAY = { near: 40, far: 130 };
const FOG_NIGHT = { near: 12, far: 52 };        // 夜间浓雾压近：看得见的范围就是你的安全区
const _sky = new THREE.Color();
const _tint = new THREE.Color();   // MC-5b 章节氛围色（美术圣经 §2.4）
let dayTime = DAY_LEN * 0.15; // 从清晨开始
let isNight = false;

/** 推进昼夜；返回 nightK∈[0,1]（>0.9 为夜间生物窗口） */
function updateDayNight(dt) {
  dayTime = (dayTime + dt) % DAY_LEN;
  const c = dayTime / DAY_LEN;
  let sky, sunI, ambI, nightK;
  if (c < 0.42)       { sky = _sky.copy(SKY_DAY);    sunI = 0.9;  ambI = 0.55; nightK = 0; } // 白天
  else if (c < 0.5)   { const k = (c - 0.42) / 0.08; sky = _sky.lerpColors(SKY_DAY, SKY_SUNSET, k); sunI = 0.9 - 0.35 * k; ambI = 0.55 - 0.15 * k; nightK = 0.35 * k; } // 日落
  else if (c < 0.58)  { const k = (c - 0.5) / 0.08;  sky = _sky.lerpColors(SKY_SUNSET, SKY_NIGHT, k); sunI = 0.55 - 0.43 * k; ambI = 0.4 - 0.24 * k; nightK = 0.35 + 0.65 * k; } // 入夜
  else if (c < 0.92)  { sky = _sky.copy(SKY_NIGHT);  sunI = 0.12; ambI = 0.16; nightK = 1; } // 深夜
  else                { const k = (c - 0.92) / 0.08; sky = _sky.lerpColors(SKY_NIGHT, SKY_DAY, k); sunI = 0.12 + 0.78 * k; ambI = 0.16 + 0.39 * k; nightK = 1 - k; } // 破晓
  renderer.setClearColor(sky);
  scene.fog.color.copy(sky);
  // MC-5b 章节×情绪天空色：事件 sky 效果的 skyTint 覆盖 > 季节 params.skyTint（美术圣经 §2.4）
  //   混入比例随夜色衰减（白天 55%，深夜余 14% —— 焚城期的夜晚天际线留一线火光橙）
  const tintHex = skyOverrides.skyTint ?? timeline.season.params.skyTint;
  if (tintHex) {
    _tint.set(tintHex);
    sky.lerp(_tint, 0.55 * (1 - 0.75 * nightK));
    renderer.setClearColor(sky);
    scene.fog.color.copy(sky);
  }
  // MC-3a 雾距优先级：章节 sky 效果覆盖 > 季节参数（fogFar 作白日基准）> 默认昼夜雾
  const seasonFogFar = timeline.season.params.fogFar;
  const baseFar = seasonFogFar != null ? Math.min(seasonFogFar, FOG_DAY.far) : FOG_DAY.far;
  scene.fog.near = skyOverrides.fogNear ?? (FOG_DAY.near + (FOG_NIGHT.near - FOG_DAY.near) * nightK);
  scene.fog.far = skyOverrides.fogFar ?? (baseFar + (FOG_NIGHT.far - FOG_DAY.far) * nightK);
  sun.intensity = sunI;
  sun.color.copy(SUN_DAY).lerp(SUN_NIGHT, nightK);
  ambient.intensity = ambI;
  ambient.color.copy(AMB_DAY).lerp(AMB_NIGHT, nightK);

  const nowNight = nightK > 0.9;
  if (nowNight !== isNight) {
    isNight = nowNight;
    sfx.setNight(isNight);
  }
  return nightK;
}

/* ---------- 脚步音效（MC-2c）：按水平距离计步，音色看脚下方块材质 ---------- */
const STEP_LEN = 2.1; // 每步位移（格）
let stepAcc = 0;
const STEP_MAT = new Map([
  [BLOCK.GRASS, 'grass'], [BLOCK.DIRT, 'grass'],
  [BLOCK.STONE, 'stone'], [BLOCK.COBBLE, 'stone'],
  [BLOCK.COAL_ORE, 'stone'], [BLOCK.IRON_ORE, 'stone'],
  [BLOCK.SAND, 'sand'],
  [BLOCK.WOOD_LOG, 'wood'], [BLOCK.PLANK, 'wood'], [BLOCK.CRAFT_TABLE, 'wood'],
  [BLOCK.CHARRED_WOOD, 'wood'], [BLOCK.THATCH, 'grass'],   // MC-5b 新材质脚步
  [BLOCK.RAMMED_EARTH, 'grass'], [BLOCK.HAN_TILE, 'stone'], [BLOCK.ASH, 'sand'],
]);

/* ---------- MC-4c 存档：状态分节注册（capture/restore 闭包）+ 读档恢复 + 事件触发点 ---------- */
saveSystem.registerProvider('player', {
  capture: () => ({ pos: [player.pos.x, player.pos.y, player.pos.z], yaw: player.yaw, pitch: player.pitch, flying: player.flying }),
  // player 的恢复在 warmup 前已完成（见文件头 hasSavedPos 段），此处只管捕获
});
saveSystem.registerProvider('health', {
  capture: () => ({ hp: Math.max(1, health.hp) }),   // 死亡瞬间的档按 1 血恢复（死亡屏不持久化）
  restore: (d) => {
    if (!Number.isFinite(d?.hp)) return;
    health.hp = Math.min(PLAYER_MAX_HP, Math.max(1, Math.round(d.hp)));
    ui.setHealth(health.hp, PLAYER_MAX_HP);
  },
});
saveSystem.registerProvider('inventory', {
  capture: () => ({ selected: inventory.selected, slots: inventory.slots.map((s) => (s ? { id: s.id, count: s.count } : null)) }),
  restore: (d) => {
    if (!Array.isArray(d?.slots)) return;
    const size = inventory.slots.length;
    inventory.slots = d.slots.slice(0, size).map((s) =>
      s && Number.isFinite(s.id) && Number.isFinite(s.count) ? { id: s.id, count: Math.max(1, Math.round(s.count)) } : null);
    while (inventory.slots.length < size) inventory.slots.push(null);
    inventory.select(Number.isInteger(d.selected) ? Math.min(size - 1, Math.max(0, d.selected)) : 0);
    ui.renderInventory(inventory);
    ui.select(inventory.selected);
  },
});
saveSystem.registerProvider('chapter', {
  capture: () => timeline.serialize(),
  restore: (d) => {
    if (!timeline.restore(d)) return;
    ui.setDate(`${timeline.formatDate()} · ${timeline.season.label}`);
    // 恢复到当前游戏日 → 重判 NPC 编年在场性（否则全按开卷日算）
    npcManager.setChronicle(chapterResult.chapter.startSerial + timeline.day);
  },
});
saveSystem.registerProvider('quests', { capture: () => quests.serialize(), restore: (d) => quests.restore(d) });
saveSystem.registerProvider('farming', { capture: () => farming.serialize(), restore: (d) => farming.restore(d) });
saveSystem.registerProvider('building', {
  capture: () => building.serialize(),
  restore: (d) => {
    if (!building.restore(d)) return;
    // 已判定房屋 → 流民按册重新入住（spawnDynamic 同 id 幂等；门/墙本体在差分里）
    for (const h of building.houses.values()) {
      const v = building.cfg.villager;
      npcManager.spawnDynamic({
        id: `settler-${h.door.join('-')}`,
        name: v.name,
        title: v.title,
        model: v.model,
        spawn: { x: h.anchor[0], y: h.anchor[1] - 1, z: h.anchor[2] },
        wander: { radius: h.radius, speed: v.wanderSpeed },
      });
    }
  },
});
saveSystem.registerProvider('stats', {
  capture: () => ({ blocksPlaced, blocksMined, deaths, dayTime }),
  restore: (d) => {
    if (!d || typeof d !== 'object') return;
    blocksPlaced = Math.max(0, Math.round(Number(d.blocksPlaced) || 0));
    blocksMined = Math.max(0, Math.round(Number(d.blocksMined) || 0));
    deaths = Math.max(0, Math.round(Number(d.deaths) || 0));
    if (Number.isFinite(d.dayTime)) dayTime = ((d.dayTime % DAY_LEN) + DAY_LEN) % DAY_LEN;
  },
});

if (snapshot) {
  const restored = saveSystem.restoreProviders(snapshot);
  console.log(`[save] 读档恢复：seed=${SEED}，分节 [${restored.join(', ')}]，差分 ${saveSystem.diffCount} 格`);
}

/** 事件型存档触发（自动存档见主循环 saveSystem.update）；未开卷不落盘 */
function doSave(reason) {
  if (!started) return;
  const r = saveSystem.saveNow(reason);
  if (r.ok && !r.skipped) console.log(`[save] ${reason} 存档：${r.bytes}B（差分 ${r.diffCount} 格）`);
}
// 关页/切后台（含刷新）兑底一存；pagehide 覆盖 bfcache 场景，visibilitychange 覆盖切标签页
addEventListener('pagehide', () => doSave('pagehide'));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') doSave('hidden'); });

/* ---------- 主循环 ---------- */
let last = performance.now();
let frames = 0, fpsClock = 0;
let groanT = 5; // 行尸呻吟随机计时
let talkHintT = 0; // MC-3b：可交谈提示轮询计时（限频 0.15s）

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (locked && !dead && !cutscene.isActive) {   // MC-3d：演出中冻结玩家/AI/交互（世界渲染照常）
    player.update(dt, input);
    interaction.update(dt, digHeld, placeHeld, inventory.heldId());
    health.update(dt);
    mobManager.update(dt, player.pos, isNight);
    npcManager.update(dt, player.pos);   // MC-3b：NPC 漫游/接近/物理（AI 决策限频错峰）

    // 可交谈提示：靠近可交谈 NPC 时显示「按 E 交谈」（限频轮询，避免每帧扫企列表）
    talkHintT -= dt;
    if (talkHintT <= 0) {
      talkHintT = 0.15;
      const near = npcManager.nearestTalkable(player.pos, 3.2);
      ui.setTalkHint(near && !dialogUI.isOpen ? `按 E 与 ${near.name} 交谈` : '');
    }
    // 夜里有行尸在场 → 随机远处呻吟（恐惧氛围）
    if (isNight && mobManager.count > 0) {
      groanT -= dt;
      if (groanT <= 0) { groanT = 4 + Math.random() * 6; sfx.groan(0.08 + Math.random() * 0.08); }
    }

    // 脚步：在地面移动时按距离计步（飞行/悬空不计）
    if (!player.flying && player.onGround) {
      const hSpeed = Math.hypot(player.vel.x, player.vel.z);
      if (hSpeed > 0.5) {
        stepAcc += hSpeed * dt;
        if (stepAcc >= STEP_LEN) {
          stepAcc = 0;
          const bid = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.05), Math.floor(player.pos.z));
          sfx.step(STEP_MAT.get(bid) ?? 'grass');
        }
      } else {
        stepAcc = Math.min(stepAcc, STEP_LEN * 0.5); // 停走不积步
      }
    } else {
      stepAcc = 0;
    }

    // 受击震屏：叠加在玩家相机同步之后，幅度随剩余时间衰减
    if (shakeT > 0) {
      shakeT = Math.max(0, shakeT - dt);
      const k = shakeT / SHAKE_DUR;
      camera.position.x += (Math.random() - 0.5) * 0.14 * k;
      camera.position.y += (Math.random() - 0.5) * 0.14 * k;
      camera.rotation.z += (Math.random() - 0.5) * 0.025 * k;
    }
  }
  world.update(player.pos);
  updateBursts(dt);
  dropManager.update(dt, player.pos, locked && !dead && !cutscene.isActive, onDropPickup);
  // MC-3d：开卷（首次指针锁定）后才起表；演出中暂停（开场旁白不偷游戏日历）
  if (started && !cutscene.isActive) {
    updateDayNight(dt);
    timeline.update(dt, { isNight, playerPos: player.pos, stats: { blocksPlaced, blocksMined } });
    farming.update(dt);   // MC-4a：作物生长/水分与编年时间同源同门控（演出中不偷长）
  }

  // MC-4c：定时自动存档（未开卷/演出中冻结倒计时；写失败退避+告警，见 save.js）
  saveSystem.update(dt, started && !cutscene.isActive);

  // 第一人称手持模型（MC-2b）：随选中物品切换，挖掘挥动
  heldItem.setItem(inventory.heldId());
  heldItem.update(dt, {
    moving: input.forward || input.back || input.left || input.right,
    digging: digHeld && locked && !dead,
  });

  frames++; fpsClock += dt;
  if (fpsClock >= 0.5) {
    ui.setStats(Math.round(frames / fpsClock), world.chunks.size);
    frames = 0; fpsClock = 0;
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
