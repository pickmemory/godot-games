# P5-10 · 核心可玩美术资产 AI 生成规格（替换 greybox）

> 阶段：Phase 5 · 制作（P5-10）　|　执行角色：林绘澄（art-director）
> 文档版本：v0.1（首版，待主创/工程评审）　|　状态：可评审
> Issue：#22 `[P5] 核心可玩美术资产 AI 生成（玩家精灵 / 山贼敌人 / 赤壁村落 TileSet / 系统面板背景，替换 greybox）`
> 派单：主理人 游承峰 → 林绘澄（art-director）。

---

## 0. 任务状态与降级声明（必读）

**mmx 不可用 → 本交付降级为「逐资产规格 + 最终英文 prompt（含公共前缀）+ 命名 + 尺寸 + 接线计划」纯文档**，未臆造任何实际图像（守 issue 执行约束「mmx 未装/无 key 时降级纯文档，不臆造实际图像」+ AGENTS.md 红线「不臆造」）。

证据（CI 环境实测，2025-08-14）：

| 检查项 | 命令 | 结果 |
|---|---|---|
| mmx 二进制 | `command -v mmx mmx-cli` | 均不在 PATH |
| mmx 全局包 | `npm ls -g \| grep -i mmx` | 无 |
| 托管 node_modules | `ls /opt/.../node_modules \| grep -i mmx` | 无 |
| API Key | `$MINIMAX_API_KEY` / `$MMX_API_KEY` | 均空（EMPTY） |

**结论**：本 issue 要求的「mmx image 出真实占位图」**无法在本环境执行**。改为交付本规格文档——它**已把 asset-manifest.md（P4-2）的差异化 prompt 与 art-bible §1.6 公共前缀预先组合成「可直接喂 mmx 的最终英文 prompt」**，并附每资产的 mmx 命令、尺寸/比例、命名、与 greybox 的接线计划。mmx 可用后，工程/美术直接复制本文 §3–§6 的 prompt 与命令即可量产。

> ⚠️ 本文是 **asset-manifest.md（P4-2）的执行子集**，不重定义规范；凡引用写作 `art-bible §x` / `asset-manifest §x`，命名零偏离 `art-bible §9`。视觉纪律（双轨反差 / 色相法则 / 轨道归属）**逐资产复述 asset-manifest §2**，不新增。

---

## 1. 公共前缀（所有 prompt 复用，已预组合）

> 取自 asset-manifest §1.6。下文每条「最终 prompt」= `PREFIX` + 差异化描述 + 色相纪律后缀（按需）。直接整段复制即可。

### 1.1 世界轨前缀 `PREFIX_WORLD`（角色 / 敌人 / Tile / prop · 轨道 A）

```
top-down 3/4 isometric game asset (camera ~60-65°), hand-painted ink-wash style, restrained Chinese gongbi heavy-color, 2D sprite with transparent background, no text, no watermark, no UI chrome, clean alpha edges, consistent line weight within the same tileset, PNG export.
```

### 1.2 系统轨前缀 `PREFIX_UI`（ui_ · 轨道 B 冷光，asset-manifest §5 约束）

```
2D UI asset, hand-painted ink-wash meets holographic data-projection, transparent background, no text, no watermark, clean alpha edges, 9-slice safe (keep a 1px hard border, plain interior safe to stretch), PNG export.
```

### 1.3 色相纪律后缀（按资产轨道追加，art-bible §2.4 / asset-manifest §1.6）

| 后缀名 | 内容 | 用于 |
|---|---|---|
| `SUFFIX_SYS` | `cold cyan-teal geometric, hard-edged, low-saturation, scanline, holographic, NEVER warm red/orange.` | 所有 `ui_*`（轨道 B） |
| `SUFFIX_FOLK` | `vermilion-yellow ink bloom, talisman, folk-supernatural, understated, NEVER gold-buddha / sword-flying (no xianxia).` | 本土志怪 prop/vfx（诸葛亮坛等） |
| `SUFFIX_FIRE` | `vermilion fire with ink-black smoke, gongbi heavy-color, smoky.` | 战火（本 issue 不含） |

> 🔒 **轨道纪律（art-bible §0/§3.2 / asset-manifest §1.5/§2）**：`char_/npc_/tile_/prop_` 属轨道 A 暖墨彩，**不掺冷光**；`ui_` 属轨道 B 冷青蓝，**只允许出现在 L5_SystemCanvas / RewritePanel**。下文逐资产标注轨道，**冷光绝不污染世界本色**。

---

## 2. 降级产出汇总（覆盖 issue 四类）

| Issue 类别 | 本文档章节 | 资产数（MVP 倾向） | 命名空间 |
|---|---|---|---|
| ① 玩家精灵 | §3 | 3 张方向集占位（idle/walk/attack，皆 `_s` 先行） | `char_player_traveler` |
| ② 山贼敌人 | §4 | 2 张动作占位（idle/attack，`_s`） | `npc_folk_bandit`（见 §7 对齐决策） |
| ③ 赤壁村落 TileSet | §5 | 7 张 tile + 8 张 prop（含 v_wind/v_altar 变体） | `dyn_threekingdoms_chibi` |
| ④ 系统面板背景 + MVP UI 件 | §6 | 1 九宫格框 + 2 改写卡 + 2 Tab 图标 + 1 技能节点 | `ui_*` |
| **合计** | | **~26 张可量产占位规格** | — |

> 范围对齐 issue：TileSet 覆盖 `ground_dry/wetland/water_river/water_wave/shore_edge` 全 5 类 + 必要 `prop_*`（altar/reed/camp_tent_shu/flag_shu，皆 MVP 关键路径，asset-manifest §7.2）；UI 以 `ui_panel_frame_system`（系统面板背景）为核 + 改写面板卡 / Tab 图标 / 技能节点（issue §4「系统 Tab / 改写面板卡等 MVP UI 件」）。

---

## 3. 类别 ① · 玩家精灵（`char_player_traveler` · 轨道 A 主体 + B 暗纹）

> 规格 = asset-manifest §4.1。**辨识度第一**（art-bible §4.1）。目标绘制区 64×96（碰撞 ~24×40，art-bible §4.4）；单帧工程 ≤256×256（art-bible §8.2）。**至少 idle + 1 动作**（issue 要求）→ 本规格给 idle/walk/attack 三态占位，皆面向南 `_s`（主方向先行，余向镜像/补绘，art-bible §7.1）。

### 3.1 `char_player_traveler_idle_s`
- **用途**：玩家待机（combat FSM `idle`，player.gd）。替换 `game/scenes/actors/player.tscn` 的 `Sprite2D` 节点现用 `PlaceholderTexture2D(48×48)`。
- **轨道**：A 主体（暖墨彩）+ B 暗纹（极弱青蓝几何刺绣，仅施法浮现——idle 态**不显现**冷光，守 art-bible §4.1「暗藏系统身份」）。
- **尺寸 / 比例**：≤256×256 单帧；mmx `--aspect-ratio 1:1`，产出后裁/居中到 64×96 绘制区。
- **最终 prompt**：
```
top-down 3/4 isometric game asset (camera ~60-65°), hand-painted ink-wash style, restrained Chinese gongbi heavy-color, 2D sprite with transparent background, no text, no watermark, no UI chrome, clean alpha edges, consistent line weight within the same tileset, PNG export. Time-traveler protagonist sprite, late-Han wandering-scholar/warrior hybrid robe in muted warm earthy tones (NOT faction-colored, must not steal NPC focus), standing idle facing the camera (south), relaxed but alert posture, faint cold cyan geometric embroidery hidden on inner lining (subtle, NOT glowing in idle), strong silhouette contrast, cloak hem visible for readability, single frame.
```
- **mmx 命令**：`mmx image "<上方整段 prompt>" --aspect-ratio 1:1 --out-dir game/assets/sprites/`
- **接线**：见 §8.1（player.tscn 的 Sprite2D texture 替换 + texture import）。

### 3.2 `char_player_traveler_walk_s`
- **用途**：行走（combat FSM `move`/`walk`）；行走序列帧首帧占位（art-bible §7.3 行走 8–12fps）。
- **尺寸 / 比例 / mmx**：同 §3.1（`--aspect-ratio 1:1`，`--out-dir game/assets/sprites/`）。
- **最终 prompt**：
```
top-down 3/4 isometric game asset (camera ~60-65°), hand-painted ink-wash style, restrained Chinese gongbi heavy-color, 2D sprite with transparent background, no text, no watermark, no UI chrome, clean alpha edges, consistent line weight within the same tileset, PNG export. Time-traveler protagonist sprite, late-Han wandering-scholar/warrior hybrid robe in muted warm earthy tones, mid-stride walking facing the camera (south), cloak and robe hem trailing behind for line-of-action, weight on leading foot, strong silhouette contrast, single animation frame, dynamic but readable.
```

### 3.3 `char_player_traveler_attack_s`
- **用途**：普攻连段占位（combat §2.2 `attack` active 帧；art-bible §7.1 普攻 6–10 帧）。
- **尺寸 / 比例 / mmx**：同 §3.1。
- **最终 prompt**：
```
top-down 3/4 isometric game asset (camera ~60-65°), hand-painted ink-wash style, restrained Chinese gongbi heavy-color, 2D sprite with transparent background, no text, no watermark, no UI chrome, clean alpha edges, consistent line weight within the same tileset, PNG export. Time-traveler protagonist sprite, late-Han wandering-scholar/warrior hybrid robe in muted warm earthy tones, mid-swing melee attack facing the camera (south), weight shifted forward, weapon arm extended, cloak follow-through trailing, strong silhouette contrast, single animation frame, no blood no gore.
```

> 📌 **方向集扩展**（待主创冻结 3/4 角度后量产，asset-manifest §1.4 / art-bible §11③）：`_n/_e/_w` 由 `_s` 镜像/补绘；不足方向由插值补（art-bible §7.1）。MVP 先行 `_s`，符合 issue「至少 idle + 1 动作占位」。

---

## 4. 类别 ② · 山贼敌人（`npc_folk_bandit` · 轨道 A 暖墨彩）

> **对齐决策见 §7**：bandit = **凡人 folk 非正规敌人**（`data/enemies/npc_bandit_chibi.tres` `faction=folk` / `display_name="赤壁山贼"` / 凡人近战 `atk_bandit_cleave`），命名 `npc_folk_bandit`，**既非** `npc_<wei|shu|wu>_soldier`（正规军模板，asset-manifest §4.3），**也非** `npc_folk_omen`（超自然志怪墨晕形，asset-manifest §4.4）。凡人外观：暖墨彩 + 粗布短褐 + 劈砍钝刀，**无冷光、无朱黄墨晕**。

### 4.1 `npc_folk_bandit_idle_s`
- **用途**：山贼待机（enemy.gd FSM `patrol⇄chase⇄attack`，combat §2.8 / `npc_bandit_chibi.tres` `fsm_preset=patrol_chase_attack`）。替换 `game/scenes/enemies/bandit.tscn` 的 `Sprite2D` 节点现用 `PlaceholderTexture2D(48×48)` + `modulate=Color(0.8,0.32,0.32,1)`。
- **轨道**：A（暖墨彩，凡人）；**严禁冷光/朱黄墨晕**（凡人，非系统/非志怪）。
- **尺寸 / 比例**：≤256×256 单帧（普通敌 48×72 绘制区，art-bible §4.4，比将官小一档）；mmx `--aspect-ratio 1:1`。
- **最终 prompt**：
```
top-down 3/4 isometric game asset (camera ~60-65°), hand-painted ink-wash style, restrained Chinese gongbi heavy-color, 2D sprite with transparent background, no text, no watermark, no UI chrome, clean alpha edges, consistent line weight within the same tileset, PNG export. Mortal folk bandit enemy (a common Three-Kingdoms-era irregular brigand, NOT a uniformed faction soldier, NOT supernatural), ragged earthen-brown short tunic over patched Han-commoner clothes, crude leather arm wraps, unkempt hair, holding a worn heavy cleaver (dao), standing idle facing the camera (south), wary hunched posture, muted warm earthy palette (umber, ochre, grimy brown), recognizable by crude cleaver and ragged silhouette, single frame, NO cold cyan glow, NO vermilion-yellow supernatural ink-bloom.
```
- **mmx 命令**：`mmx image "<上方整段 prompt>" --aspect-ratio 1:1 --out-dir game/assets/sprites/`
- **接线**：见 §8.2（bandit.tscn 的 Sprite2D texture 替换 + 移除红色 modulate + sprite_ref 对齐）。

### 4.2 `npc_folk_bandit_attack_s`
- **用途**：山贼劈砍攻击（`atk_bandit_cleave`：windup 0.40 / active 0.12 / recover 0.35，`npc_bandit_chibi.tres`）。
- **尺寸 / 比例 / mmx**：同 §4.1。
- **最终 prompt**：
```
top-down 3/4 isometric game asset (camera ~60-65°), hand-painted ink-wash style, restrained Chinese gongbi heavy-color, 2D sprite with transparent background, no text, no watermark, no UI chrome, clean alpha edges, consistent line weight within the same tileset, PNG export. Mortal folk bandit enemy (NOT a uniformed soldier, NOT supernatural), ragged earthen-brown short tunic, mid-cleave overhead swing of a worn heavy cleaver (dao) facing the camera (south), weight forward, tattered cloth follow-through, muted warm earthy palette, single animation frame, no blood no gore, NO cold glow, NO supernatural ink-bloom.
```

> 📌 **变体扩展**（目标态，asset-manifest §4.3）：同模型可派生 `_elite`（加羽饰 + 更强轮廓对比）；多阵营山贼用同一凡人剪角换腰巾/旗号色（**多通道**，art-bible §2.3）。本 MVP 仅产 base `_s` idle+attack。

---

## 5. 类别 ③ · 赤壁村落 TileSet（`tile_` / `prop_` · 命名空间 `dyn_threekingdoms_chibi`）

> 规格 = asset-manifest §3。Tile **64×64px 倾向**（art-bible §8.1 / asset-manifest §1.4，待主创冻结 §art-bible §11④）。**无缝拼贴**（repeatable edges，拼接处禁穿帮，art-bible §8.1）。v_wind / v_altar 变体须与 `game/data` 字段一一对应（asset-manifest §8 映射表）。

### 5.1 地面层 `tile_*`（L1_Ground · 轨道 A）

每张 tile：64×64，`--aspect-ratio 1:1`，`--out-dir game/assets/tilesets/`。下表给差异化描述（最终 prompt = `PREFIX_WORLD` + 差异化）。

| 资产 ID | 差异化 prompt（接 PREFIX_WORLD） | 用途 / 接线 | MVP |
|---|---|---|---|
| `tile_dyn_threekingdoms_chibi_ground_dry` | `Dry earthen ground tile, seamless, earthy dark umber and ochre ink-wash texture, faint brush strokes, restrained, muted, traditional Chinese painting ground, repeatable edges.` | 旱地地表基底；L1 ground TileMapLayer。`test_tileset.tres` 现 PlaceholderTexture2D 替换目标之一。 | ✅ |
| `tile_dyn_threekingdoms_chibi_ground_wetland` | `Muddy wetland riverbank tile, seamless, dark umber mud with faint wet sheen and ink puddles, low-saturation, reedy shore, repeatable edges.` | 滩涂（combat §3.4 `on_wetland_mult:1.5` 噪声放大）；L1。 | ✅ |
| `tile_dyn_threekingdoms_chibi_water_river` | `Deep river water tile, seamless, muted ink-blue/dark-teal, ink-wash negative space, restrained, NO realistic ocean foam texture, faint current, repeatable edges.` | 墨青赤壁江水深部；L1。**禁写实海浪贴图**（art-bible §5.2）。 | ✅ |
| `tile_dyn_threekingdoms_chibi_water_wave_wind_se` | `Faint white rice-paper wave lines on transparent water overlay, ink-brush wave crests leaning toward southeast (calm southeast breeze), restrained, NO foam, repeatable.` | 浪纹叠层，**浪向 = v_wind**（`v_wind=southeast`，open-world §2.3）；半透叠于 `_water_river` 上。 | ✅ |
| `tile_..._water_wave_wind_none` | 同上，`...wave crests flat and still (no wind), calm water, restrained, NO foam, repeatable.` | `v_wind=none`。 | ✅ |
| `tile_..._water_wave_wind_nw` | 同上，`...wave crests leaning toward northwest (northwest wind), restrained, NO foam, repeatable.` | `v_wind=northwest`。 | ✅ |
| `tile_dyn_threekingdoms_chibi_shore_edge` | `Shore transition tile between dry ground and river water, soft ink-blended edge, mud-to-water gradient, repeatable edges.` | 水陆过渡边（Godot TileSet 自动拼接，asset-manifest §3.1 `[待程基岩确认]` terrain/peering）。 | ✅ |

> 📌 **浪纹三态**：构图相同，**仅浪向不同**；建议同种子批量出 3 张保证一致性。S5 据 `wind_visual_dir` 切换（architecture §8.2 `WindDirector`）。

### 5.2 地上层 `prop_*`（L2_Props · 轨道 A；altar 含本土奇幻朱黄）

每张 prop：见尺寸列，`--aspect-ratio 1:1`，`--out-dir game/assets/tilesets/`。

| 资产 ID | 尺寸 | 差异化 prompt（接 PREFIX_WORLD，altar 追加 SUFFIX_FOLK） | 用途 / v_i / 接线 | MVP |
|---|---|---|---|---|
| `prop_dyn_threekingdoms_chibi_altar_intact` | ≤256×256 | `Seven-stars ritual altar (qi-xing-tan), circular stone platform with faint geometric star array, gongbi ink-wash with restrained vermilion-yellow ink-bloom glow, top-down 3/4, folk-supernatural, understated, NO xianxia light pillars. vermilion-yellow ink bloom, talisman, folk-supernatural, understated, NEVER gold-buddha / sword-flying (no xianxia).` | N2 借东风核心改写场所（`v_altar=intact` 基准）；玩家可登坛。 | ✅ |
| `prop_..._altar_destroyed` | ≤256×256 | 同上构图，`...the same altar now cracked into rubble, vermilion-yellow ink-bloom dissipating into faint wisps, desolate. <SUFFIX_FOLK>` | `v_altar=destroyed`（rewrite-causality §3.1 `world_visual`）。 | ✅ |
| `prop_dyn_threekingdoms_chibi_reed_wind_se` | ≤64×96（半透） | `Reed marsh cluster, ink-brush tall reeds leaning toward northwest (southeast wind), semi-transparent, restrained earthy greens and ochre.` | 芦苇荡；**倾倒向 = v_wind**（`v_wind=southeast`）；潜行遮挡（combat §3.4 `reed_conceal_sight_mult:0.3`）。 | ✅ |
| `prop_..._reed_wind_none` | 同上 | `...reeds standing upright (no wind), semi-transparent...` | `v_wind=none`。 | ✅ |
| `prop_..._reed_wind_nw` | 同上 | `...reeds leaning toward southeast (northwest wind), semi-transparent...` | `v_wind=northwest`。 | ✅ |
| `prop_dyn_threekingdoms_chibi_camp_tent_shu` | ≤128×128 | `Military camp tent, gongbi ink-wash, top-down 3/4, vermilion-red cloth with warm-gold trim and a Han-dragon banner emblem on the tent ridge, sturdy silhouette, same tent shape as wei/wu variants (differ ONLY by color + emblem), restrained.` | 夏口(蜀)联军后方 checkpoint（open-world §2.1/§2.8）；阵营多通道辨识（art-bible §2.3）。 | ✅ |
| `prop_dyn_threekingdoms_chibi_flag_shu_wind_se` | ≤48×96 | `Vertical war banner on a pole, gongbi ink-wash, top-down 3/4, vermilion cloth with warm-gold trim and a Han-dragon emblem, flag blowing toward northwest (southeast wind), same flag silhouette as wei/wu (differ ONLY by color + emblem).` | 阵营旗号；**飘向 = v_wind**（`v_wind=southeast`）；阵营辨识多通道之一（art-bible §2.3/§4.3）。 | ✅ |
| `prop_..._flag_shu_wind_none` | ≤48×96 | 同上构图，`...the same vermilion Han-dragon banner hanging limp and still (no wind)...` | `v_wind=none`。 | ✅ |

> 📌 **prop 命名与 data 对应**（art-bible §9.5 / asset-manifest §8）：`prop_..._altar_*` ↔ `data/variables/v_altar.tres` `world_visual.{intact/destroyed}` + `data/world/scenes/scene_altar.tres` `v_i_visual_refs.v_altar`；`prop_..._reed_wind_*` / `tile_..._water_wave_wind_*` / `prop_..._flag_shu_wind_*` ↔ `data/world/environment/env_globals.tres` `wind_visual_map`（由 `v_wind` 映射，`WindDirector` 广播 `wind_visual_dir`）；`prop_..._camp_tent_shu` ↔ `data/npcs/*.tres` `faction` / 朝代包 `strongholds`。

---

## 6. 类别 ④ · 系统面板背景 + MVP UI 件（`ui_*` · 轨道 B 冷青蓝）

> 规格 = asset-manifest §5。**全部轨道 B**，**只允许出现在 L5_SystemCanvas / RewritePanel**（architecture §8.2/§8.3；art-bible §0/§3.2）。系统材质：半透明网格墨蓝底（10–20% 不透明）+ 系统青蓝硬边 + 数据投影失真边缘（art-bible §6.1）。**冷光绝不污染世界**。最终 prompt = `PREFIX_UI` + 差异化 + `SUFFIX_SYS`。

### 6.1 `ui_panel_frame_system`（系统面板背景九宫格 · 核心交付件）
- **用途**：所有系统界面共享的面板底框（偏差/技能树/兑换/情报/任务 Tab、改写面板、暂停菜单背景）。**即 issue §4「系统面板背景」**。
- **轨道**：B。规范 art-bible §6.1。
- **尺寸 / 比例**：九宫格切片 ≤512×512（可拉伸）；mmx `--aspect-ratio 1:1`，`--out-dir game/assets/ui/`。**九宫格安全**：1px 硬边框 + 纯色内部可拉伸区（PREFIX_UI 已含约束）。
- **最终 prompt**：
```
2D UI asset, hand-painted ink-wash meets holographic data-projection, transparent background, no text, no watermark, clean alpha edges, 9-slice safe (keep a 1px hard border, plain interior safe to stretch), PNG export. 9-slice UI panel frame, semi-transparent dark blue-grey grid background at about 15% opacity, cold cyan-teal hard-edged border with a faint scanline distortion only at the edges, holographic data-projection feel, geometric corner accents, NO warm colors, NO organic brush strokes. cold cyan-teal geometric, hard-edged, low-saturation, scanline, holographic, NEVER warm red/orange.
```
- **mmx 命令**：`mmx image "<上方整段 prompt>" --aspect-ratio 1:1 --out-dir game/assets/ui/`
- **接线**：见 §8.3（RewritePanel / 暂停菜单 TextureRect / NinePatchRect 用法，待程基岩）。

### 6.2 `ui_panel_rewrite_blueprint_card` / `ui_panel_rewrite_verb_card`（改写面板卡 · MVP）
- **用途**：改写面板的蓝图卡（`blueprint_id`/`target_vars`/`m_weights`）与动词卡（`verb_id`/`cost_RE`），ux-spec §6.3 / asset-manifest §5.3。**Loop A 核心动词操作台**（ux-spec §6.1 支柱①）。
- **轨道**：B。**选中态**冷光描边脉动；**锁定态**灰蒙（intel_cov 不足，ux-spec §6.6）。
- **尺寸 / 比例**：卡片九宫格 ≤256×128；mmx `--aspect-ratio 1:1`（产出后裁到 256×128 ≈ 2:1）。`--out-dir game/assets/ui/`。
- **最终 prompt（蓝图卡，可同构图换色块产动词卡）**：
```
2D UI asset, hand-painted ink-wash meets holographic data-projection, transparent background, no text, no watermark, clean alpha edges, 9-slice safe (keep a 1px hard border, plain interior safe to stretch), PNG export. Rewrite-panel card frame, cold cyan-teal geometric, 9-slice, a wide readout area for a target-variable blueprint (left detail well + right status strip), normal unselected state, faint scanline, holographic. cold cyan-teal geometric, hard-edged, low-saturation, scanline, holographic, NEVER warm red/orange.
```
- **verb 卡差异化**：把 `target-variable blueprint` 换 `verb cost readout (icon well + cost number strip)`。
- **接线**：见 §8.3。

### 6.3 `ui_panel_tab_icon_deviation` / `ui_panel_tab_icon_skill_tree`（5 Tab 之 MVP 2 枚 · MVP）
- **用途**：系统面板 Tab 图标，MVP 产 `deviation` + `skill_tree`（asset-manifest §5.3 / panel-progression §6.5 MVP 最小集：Δ + CP + 1 技能节点）。
- **轨道**：B。`_active` 实色青蓝 / `_inactive` 暗灰。
- **尺寸 / 比例**：≤64×64；`--aspect-ratio 1:1`，`--out-dir game/assets/ui/`。
- **最终 prompt（deviation，active 态）**：
```
2D UI asset, hand-painted ink-wash meets holographic data-projection, transparent background, no text, no watermark, clean alpha edges, PNG export. Single UI tab icon glyph, cold-light geometric, a tilde-over-delta-triangle symbol meaning "deviation", solid cyan-teal active state on transparent, holographic. cold cyan-teal geometric, hard-edged, low-saturation, scanline, holographic, NEVER warm red/orange.
```
- **skill_tree 差异化**：把符号换 `a small connected node-graph symbol meaning "skill tree"`。inactive 态：`...dim grey-blue inactive state on transparent...`（同构图换明度）。

### 6.4 `ui_skill_tree_node`（技能树节点 · MVP）
- **用途**：技能树节点图（三分支 efficiency/magic/cognition，panel-progression §2.2；**无最优路径高亮**，ux-spec §6.5）。MVP 至少 1 可解锁节点（art-bible §8.5）。
- **轨道**：B。三态：`_locked`（暗）/`_unlockable`（描边脉动）/`_unlocked`（亮）。本规格产 `_unlocked` 实态占位。
- **尺寸 / 比例**：≤64×64；`--aspect-ratio 1:1`，`--out-dir game/assets/ui/`。
- **最终 prompt**：
```
2D UI asset, hand-painted ink-wash meets holographic data-projection, transparent background, no text, no watermark, clean alpha edges, PNG export. Skill-tree node icon, cold cyan-teal hexagonal geometric node with short connecting line stubs on two sides, solid unlocked glow state, holographic, NO optimal-path highlight, neutral (no branch-color bias). cold cyan-teal geometric, hard-edged, low-saturation, scanline, holographic, NEVER warm red/orange.
```

---

## 7. 山贼命名对齐决策（issue 明确要求说明）

> issue §2「山贼敌人」：`与 asset-manifest 敌人谱系对齐（npc_<阵营|folk>_*，若 P5-1 的「山贼」语义偏 npc_folk_omen 志怪侧，请在 comment 里说明对齐决策）`。

**决策：山贼 = 凡人 folk 非正规敌人，命名 `npc_folk_bandit`；不并入 `npc_folk_omen`。**

| 判据 | `npc_folk_bandit`（本规格采用） | `npc_folk_omen`（asset-manifest §4.4，**不采用**） |
|---|---|---|
| 数据 `faction` | `folk`（`npc_bandit_chibi.tres`）✅ | `folk`（同 token，但语义不同） |
| 性质 | **凡人**（mortal）民间山贼 | **超自然**志怪兆头/术士 |
| 数据佐证 | `display_name="赤壁山贼"`；凡人近战 `atk_bandit_cleave`（windup/active/recover，无任何法术/manifest 字段）；`fsm_preset=patrol_chase_attack`（凡人巡逻战斗 AI） | asset-manifest §4.4 动作集 `idle/manifest(墨晕扩散)/dissipate`；克制冷峻形；禁金光大佛/御剑 |
| 视觉 | 暖墨彩 + 粗布短褐 + 劈砍钝刀（§4） | 朱黄墨晕扩散 + 符箓（art-bible §1.2/§2.4） |
| 轨道 | A 暖墨彩（**无冷光、无朱黄**，凡人） | A 奇幻子集（朱黄墨晕，超自然） |

**命名合规性**（art-bible §9.2/§9.3）：`npc_`（类别前缀）+ `folk`（来源/阵营 token，`faction=folk`）+ `bandit`（主体）= `npc_folk_bandit` ✅，严守 `npc_<阵营|folk>_*` 谱系。与 `npc_<wei|shu|wu>_soldier`（正规军）平级但异类（凡人非正规 vs 正规军）。

**与 data 的衔接**（art-bible §9.5 / asset-manifest §8）：`data/enemies/npc_bandit_chibi.tres` 现 `sprite_ref = &"npc_bandit_chibi"`（占位值，引用的是 enemy_id 而非 art-bible 资产名）。**建议程基岩将 `sprite_ref` 更新为 `&"npc_folk_bandit"`** 以对齐本资产 ID（enemy_id `npc_bandit_chibi` 可保留为数据标识符）。详见 §8.2 接线项。

> ⚠️ 此为 art-director 专业判断，非「需主创冻结」事项；已按 issue 要求同步到 issue comment（见 §11）。

---

## 8. 引擎接线计划（待程基岩 / engineering-lead · 纯美术任务不擅改代码）

> 本 issue 是纯美术任务，不写程序逻辑。以下为 mmx 产图后**需要 engineering-lead 协助的纹理导入接线项**，已同步 issue comment。

### 8.1 玩家精灵 → `game/scenes/actors/player.tscn`
- 现状：`Sprite2D` 节点 `texture = SubResource("PlaceholderTexture2D_1")`（48×48），无 modulate（player.tscn）。
- 接线：将 `PlaceholderTexture2D` sub_resource 替换为 `CompressedTexture2D`（`load("res://assets/sprites/char_player_traveler_idle_s.png")`）；Sprite2D 居中（`centered=true`），按 64×96 绘制区对齐到碰撞体（CollisionShape2D 24×40，已存在）。
- **texture import**（Godot 4.7 导入设置，待程基岩定 `.import`）：手绘风建议 `filter=true`（不强制 pixel-perfect，art-bible §8.1）；`compress/mode_lossless` 保边缘 alpha；`mipmaps=false`（2D 角色）。
- **方向集 / 多帧**：MVP 先行 `_s`；多方向/序列帧由 engineering-lead 用 `AnimatedSprite2D` + `SpriteFrames` 或图集 region 组织（architecture §13 K2/K3 待核 API）。

### 8.2 山贼敌人 → `game/scenes/enemies/bandit.tscn` + `data/enemies/npc_bandit_chibi.tres`
- 现状：`Sprite2D` 节点 `texture = SubResource("sprite_tex")`（PlaceholderTexture2D 48×48）+ `modulate = Color(0.8,0.32,0.32,1)`（红色 greybox 标识）。
- 接线：
  1. 将 `sprite_tex` 替换为 `load("res://assets/sprites/npc_folk_bandit_idle_s.png")`；
  2. **移除/置白 `modulate`**（真实资产已自带暖墨彩，红色 modulate 是 greybox 临时标识）；
  3. **对齐 `sprite_ref`**：`data/enemies/npc_bandit_chibi.tres` 的 `sprite_ref` 由 `&"npc_bandit_chibi"` → `&"npc_folk_bandit"`（enemy_data.gd:52 `# TODO(art): 接 art-bible §9.2 sprite 命名`，本次落地）；`anim_ref` 同理 → `&"anim_npc_folk_bandit"`。
  4. enemy.gd:295-297 对 `Sprite2D.modulate` 的运行时覆写（受伤灰化 0.5/0.5/0.5/0.6）**与资产无关**，保留不动。
- **texture import**：同 §8.1。

### 8.3 系统面板 UI → RewritePanel / 暂停菜单 / 改写面板
- `ui_panel_frame_system`：作为 RewritePanel / 暂停菜单 / 各 Tab 容器的**背景**。建议用 `NinePatchRect`（Godot 4.7，**九宫格安全拉伸**，对应 PREFIX_UI 的 1px 硬边 + 纯色内部约束），`axis_stretch_mode = AXIS_STRETCH_MODE_TILE` 或 `_STRETCH`；texture import `filter=true`。
- `ui_panel_rewrite_blueprint_card` / `_verb_card`：同 `NinePatchRect` 卡片背景；选中/锁定态由代码切 texture 或叠加冷光描边（asset-manifest §5.3 `_selected/_locked`，待程基岩）。
- `ui_panel_tab_icon_*` / `ui_skill_tree_node`：`TextureRect` 图标，active/inactive/locked 切 texture。
- **轨道纪律落地**（architecture §8.2/§8.3）：所有 `ui_*` 资产**只挂在 `L5_SystemCanvas` / `RewritePanel`（CanvasLayer）**，**不得**进 L1–L4 世界层；冷光不污染世界（art-bible §0/§3.2）。

### 8.4 赤壁 TileSet → `game/assets/tilesets/`（含 .tres 组织）
- 现状：`test_tileset.tres` 用 `PlaceholderTexture2D(64×64)` 单图块，`tile_size=Vector2i(64,64)` ✅（Tile 尺寸倾向已落地）。
- 接线：
  1. 将 7 张 `tile_*` 地面图与浪纹叠层组织进**一个 TileSet 资源**（建议 `tileset_dyn_threekingdoms_chibi_ground.tres`，命名待程基岩定）：`TileSetAtlasSource` 引用拼合图集（≤2048×2048，art-bible §8.2），`tile_size=64×64`。
  2. **浪纹叠层**（`water_wave_wind_*`）半透——architecture 待定：作独立 TileSet 图层叠于 `_water_river` 上，或作 L1 第二 TileMapLayer（**待程基岩确认 Godot 4.7 多 TileMapLayer 叠加用法**，architecture §13 K2）。
  3. **`shore_edge` 自动拼接**：美术仅提供「岸·角·边」最小图块集；Godot TileSet terrain/peering 拼接规则由 engineering-lead 配置（asset-manifest §3.1 `[待程基岩确认]` / architecture §13 K2）。
  4. **v_wind 切换**：S5 `WindDirector`（architecture §8.2）监听 C1 `variable_changed(v_wind)` → 广播 `wind_visual_dir` → TileMapLayer/prop 切换 `wind_se/_none/_nw` 图块（open-world §2.4/§4.4）。具体 TileSet API 待程基岩。
  5. `prop_*`（altar/reed/camp_tent）：作 L2_Props 层 Sprite 或独立图块集；`v_altar` 二态、`v_wind` 三态由代码切 texture（同上）。
- **texture import**：tile 图集 `filter=false` 倾向（保 64px 网格锐利，待程基岩与像素一致性核对，art-bible §8.1）；无 mipmap。

### 8.5 mmx 视觉核对（mmx 可用后）
- 每张产图用 `mmx vision <图>` 核对：双轨配色（暖 vs 冷不串味）、3/4 俯视、透明 alpha、命名合规、tile 无缝。art-director 复核通过再交付工程接线。

---

## 9. 待主创审批项（沿用 art-bible §11 / asset-manifest §9.1，本任务不擅自冻结）

| # | 项 | 倾向 | 影响本任务 |
|---|---|---|---|
| ③ | **俯视角度 3/4（60°–65°）** | 60°–65° | 决定全部角色/prop 精灵绘制角度；本规格以倾向值出 prompt |
| ④ | **Tile 尺寸 64px vs 32px** | 64px | 决定 TileSet 规模；本规格全以 64×64 出（`test_tileset.tres` 已 64×64） |
| ① | 系统人格语气（冷峻 vs 毒舌记录员） | 冷峻 + 极轻微失真 | 影响 `ui_panel_frame_system` 边缘抖动幅度 |
| ② | 本土奇幻上限（朱黄墨晕强度） | 「兆头/小术」级 | 影响 `prop_..._altar` 朱黄墨晕强度 |

> ③④ 越早冻结越省返工（最高优先级）；本规格已以倾向值先行，mmx 量产前请主创拍板。

---

## 10. 自验证（替代会审 · 纯文档任务走结构核对）

> 本任务无代码改动，issue 明确「不跑 Godot headless」。自验证 = 文档结构核对 + 命名规范合规 + 目标目录落位。

| 验收点（issue / team·art-director 输出规范） | 本规格处理 | 核对 |
|---|---|---|
| 四类资产至少各落 1 份逐资产规格 + prompt（mmx 不可用降级） | §3 玩家×3 / §4 山贼×2 / §5 tile×7+prop×8 / §6 ui×6；每条含最终 prompt（PREFIX 已预组合）+ mmx 命令 + 尺寸 + 接线 | ✅ |
| 美术圣经一致性（配色/风格/命名零偏离） | §1 公共前缀引 §1.6；逐资产标轨道 A/B；命名全引 §9；§7 山贼对齐决策 | ✅ |
| 轨道 A/B 配色不串味（暖墨彩 vs 冷青蓝） | §1.3 色相后缀；§3-§5 轨道 A 无冷光；§6 轨道 B 仅 L5；§4 山贼明确「无冷光无朱黄」 | ✅ |
| 资产 ID 与 `game/data` 字段一一可对应（art-bible §9.5） | §5.2 prop ↔ v_altar/v_wind 映射；§7 + §8.2 sprite_ref 对齐；§8 接线逐项 | ✅ |
| 命名 `snake_case` + 类别前缀 + 命名空间 + 变体后缀（art-bible §9.1-9.5） | 全部资产 ID 合规（§3-§6）；`dyn_threekingdoms_chibi` 命名空间固定 | ✅ |
| 尺寸预算（角色 ≤256×256 / Tile 图集 ≤2048×2048 / UI ≤2048×2048 / 源 .png 透明） | §3-§6 每条标注上限；mmx `--aspect-ratio 1:1` + 裁切目标 | ✅ |
| 视角 3/4 倾向（不擅自冻结） | §1.1 PREFIX 含 `~60-65°`；§9 待主创③ | ✅ |
| Tile 64×64 倾向（不擅自冻结） | §5 全 64×64；§9 待主创④ | ✅ |
| 接线计划（每图替换哪个 greybox + 待工程接线项入 comment） | §8.1-§8.5 逐项；§11 comment 汇总 | ✅ |
| 纯美术任务，不写程序逻辑 | 不碰 `game/scripts/`/`game/systems/`；接线全交程基岩（§8） | ✅ |
| mmx 不可用 → 降级纯文档，报告注明 | §0 降级声明 + 证据表；本任务未臆造图像 | ✅ |
| 目标目录落位（`game/assets/{sprites,tilesets,ui}/`） | `sprites/`、`tilesets/` 已存在；`ui/` 本次创建（README 指向本规格） | ✅ |

---

## 11. Issue Comment 同步（已按 issue 要求写入 GitHub issue #22）

按 issue「请在 comment 里说明对齐决策」「在 comment 列出待程基岩协助的纹理导入接线项」，已在 issue #22 发布一条汇总 comment，含：
1. mmx 不可用降级声明（证据）。
2. 山贼 folk 对齐决策（凡人 `npc_folk_bandit` ≠ 超自然 `npc_folk_omen`）。
3. 待程基岩/engineering-lead 接线项（§8 浓缩：sprite_ref 对齐 / NinePatchRect 九宫格 / TileSet terrain+peering / 多 TileMapLayer 浪纹叠层 / v_wind·v_altar 切图 API / texture import）。
4. 待主创拍板项（§9 ③④①②）。

---

## 12. 一致性自检（对齐 issue 验收要点）

| Issue 验收要点 | 本规格 |
|---|---|
| 四类至少各落 1 真实占位（mmx 可用）或 1 逐资产规格+prompt（不可用） | mmx 不可用 → §3-§6 逐资产规格+最终 prompt（mmx 可用即量产） ✅ |
| 命名严守 art-bible §9 | §3-§6 全合规；§7 山贼决策合规 ✅ |
| 轨道 A/B 配色不串味 | §1.3 + 逐资产轨道标注 ✅ |
| 复用 asset-manifest 已写差异化 prompt + 补 §1.6 公共前缀 | §1 预组合 PREFIX_WORLD/PREFIX_UI；§3-§6 直接复用 asset-manifest §3-§5 prompt ✅ |
| 接线计划：替换 greybox + 待工程项入 comment | §8 逐项 + §11 comment ✅ |
| 纯美术，不写程序逻辑 | 不碰 scripts/systems；接线交程基岩 ✅ |
| 自验证：mmx vision 核对（可用）+ `ls game/assets/{sprites,tilesets,ui}/` 落位+命名合规 | mmx 不可用未跑 vision；§10 已 `ls` 核对三目录落位 + 命名 grep 合规 ✅ |
| 不跑 Godot headless（无代码改动） | 本任务无代码改动，未跑 headless ✅ |

---

*—— 林绘澄（art-director）· Phase 5 制作（P5-10 核心可玩美术资产 AI 生成 · 降级纯文档）· 待主创/工程评审*
