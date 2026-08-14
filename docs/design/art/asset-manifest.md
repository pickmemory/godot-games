# 垂直切片资产清单 + 规格 · asset-manifest.md

> 阶段：Phase 4 · 预制作（P4-2）　|　执行角色：林绘澄（art-director）
> 文档版本：v0.1（首版，待主创评审）　|　状态：可评审
> 基线锚点：`AGENTS.md`「设计基线」表（2D 俯视角开放世界 ARPG / 改写·因果心脏 / 三国·赤壁 / Godot 4.7.1 / GDScript / Loop A）。
> 本任务是 **P1-2 美术圣经（`art-bible.md`）的直接下游**：把圣经的「双轨反差 + 双轨配色 + 命名规范 + 预算表」**翻译成逐资产可执行规格 + AI 生成提示词**，覆盖垂直切片四类资产（赤壁 TileSet 占位 / 角色 / 系统面板 UI / VFX 占位）。
>
> **唯一视觉引用源**：`docs/design/art/art-bible.md`（§0 双轨总纲、§2 配色、§2.4 奇幻来源色相法则、§5.1 视觉 token、§8.5 预算表、§9 命名规范）。**凡引用写作 `art-bible §x`**。
> **范围/MVP 边界源**：`docs/design/gdd/game-concept.md` §7.1 MVP / §7.2 目标态 / §7.3 愿景外（X6 朝代热切换明确不做）。
> **UI 屏幕清单源**：`docs/design/gdd/ux-spec.md`（P4-1，已合入）：MM 主菜单 / HUD 核心 HUD / SP 系统面板（改写面板 + 5 Tab）/ PS 暂停菜单 / STG 历史线分叉演出。
> **视觉实体/状态变体源**：五系统 GDD 已合入——`rewrite-causality.md` §3.1 `world_visual` 契约（v_i 枚举与状态变体）、`open-world.md` §2.3 v_i 视觉映射表 / §2.4 风向环境表达、`combat.md` §3.2 能力执行数据 / §3.3 敌人定义、`panel-progression.md` §6.5 系统 Tab 清单。
> **性能预算源**：`docs/architecture/architecture.md` §11（已合入）——设计分辨率 1920×1080；Tile 64×64px 倾向；同屏高精敌人精灵 ≤30–50；同屏粒子 ≤200–400；同屏并发遭遇 1–2。精确阈值标「待 P3 核对」。
> **工程锚点**：`game/project.godot`（渲染 `gl_compatibility`、拉伸 `canvas_items`/`expand`、视口 1920×1080）；数据驱动 `game/data/*.tres`/`*.json`（AGENTS.md）。

---

## 0. 文档边界与使用方式

- **是**：垂直切片所需资产的**逐资产规格 + AI 生成提示词 + 命名/尺寸/格式/动画/状态变体**主清单，分四类（TileSet / 角色 / UI / VFX）。
- **不是**：不定义玩法数值（交文策渊）、不写程序逻辑（交程基岩）、不产实际像素美术（本清单是**给生产/AI 生成的规格书**，实际产出在 Phase 5 制作）。音频资产（`bgm_`/`sfx_`）归阮和鸣，本清单不越界定义，仅在跨引用处以 `[音频归阮和鸣]` 占位。
- **范围**：覆盖**垂直切片 = 1 朝代（赤壁）+ Loop A 闭环**所需资产；多朝代 / 在线服务明确不做（`game-concept §7.3/§7.4`）。
- **MVP / 目标态分层**：每条资产标 `MVP`（垂直切片最小集，对齐 `art-bible §8.5` + `game-concept §7.1`）/ `目标态`（垂直切片完整态，`game-concept §7.2`）/ `愿景外`（仅留命名不产）。MVP 边界以 **`game-concept §7.1`** 为准：**MVP = N2 借东风单节点闭环**（玩家 + 1 系统术法 `ability_system_magic_wind` + Δ/CP + 1 技能节点 + 1 处改写场所七星坛）。
- **自验证**：纯文档任务，走**结构核对**（清单完整性 / 命名规范合规 / 与 art-bible 引用一致性 / 状态变体与 v_i 枚举一一对应），**不跑 Godot headless**（无代码改动）。

---

## 1. 全局规范（命名 / 格式 / 尺寸预算 · 引 art-bible §8 §9）

> 本节是逐资产规格的**字段定义 + 公共规约**，避免每条重复声明。所有逐资产条目默认遵守本节，仅在偏离时单独标注。

### 1.1 逐资产规格字段（统一 schema）

| 字段 | 含义 | 来源 |
|---|---|---|
| **资产 ID** | 按 `art-bible §9.1`：`<类别前缀>_<命名空间>_<主体>_<状态/变体>`，小写蛇形 | art-bible §9 |
| **用途** | 资产在垂直切片中的作用 + 关联系统/场所/节点 | 各 GDD |
| **轨道** | A 历史世界（暖·墨彩）/ B 系统（冷·数据光）；决定是否进 L5 叠层 | art-bible §0 |
| **风格参照** | art-bible 视觉锚点 `VA-*` 或节号 | art-bible §1/§2/§5/§6 |
| **尺寸上限** | 单精灵/单图集工程上限 | art-bible §8.2 |
| **源格式 · 工程格式** | 源 `.aseprite`/`.psd` → 工程 `.png`（带透明） | art-bible §8.3 |
| **动画 · 方向** | 方向集 / 帧数 / 帧率 | art-bible §7.1/§7.3 |
| **状态变体** | 同实体多态，后缀 `_on/_off/_v<n>/_f<n>/_n_e_s_w` | art-bible §9.4 |
| **AI 生成提示词** | 给生产/AI 的英文提示词（含视角/色相/克制纪律） | art-bible §1.2 |
| **MVP / 目标态** | 是否垂直切片必需 | art-bible §8.5 + game-concept §7 |

### 1.2 命名总则（严守 art-bible §9.1–9.5，零偏离）

- 一律 `snake_case`，禁空格/中文/大写；结构 `<类别前缀>_<命名空间>_<主体>_<状态/变体>`。
- **朝代/舞台命名空间固定 `dyn_threekingdoms_chibi`**（与 art-bible §5.1 视觉 token 一致，多朝代扩展换命名空间，本切片不实现 X6）。
- **类别前缀**（art-bible §9.2）：`tile_`（图块）/ `prop_`（地上层建筑物件）/ `char_`（可玩·核心角色）/ `npc_`（通用 NPC·士卒·志怪）/ `vfx_`（特效）/ `ui_`（UI）/ `tex_`（通用贴图·立绘）/ `anim_`（动画资源）。
- **来源/阵营 token**（art-bible §9.3）：`wei`/`shu`/`wu`（阵营）/ `player`（玩家）/ `system`（系统术法·轨道 B 青蓝）/ `folk`（本土志怪·轨道 A 朱黄）。
- **状态/变体后缀**（art-bible §9.4）：`_n/_e/_s/_w`（四方向）/ `_f<n>`（动画帧）/ `_v<n>`（变体编号）/ `_on/_off`（开关态，连舟/单舟）/ `chain_off`/`chain_partial`/`chain_on`（v_boat 三态）/ `wind_se`/`wind_none`/`wind_nw`（v_wind 三态）/ `intact`/`destroyed`（v_altar 二态）。
- **数据驱动对接**：资产 ID 须与 `game/data/*.tres`/`*.json` 字段**一一可对应**（art-bible §9.5；详见本文件 §8 映射表）。

### 1.3 格式 / 尺寸预算（art-bible §8.2–8.3）

| 资产类别 | 单精灵/单图集尺寸上限 | 源格式 → 工程格式 |
|---|---|---|
| 角色精灵（单帧） | ≤ 256×256 px（玩家/名角目标绘制区 64×96，含特效余量） | `.aseprite`/`.psd` → `.png`（透明） |
| TileSet 单图（图块集） | ≤ 2048×2048 px | `.aseprite` → `.png` |
| VFX 精灵图集 | ≤ 1024×1024 px（冷光/墨晕共用图集，减少材质切换） | `.aseprite`/`.psd` → `.png`（加法混合适用） |
| UI 图集 | ≤ 2048×2048 px（系统材质九宫格 + 图标） | `.aseprite`/`.psd` → `.png` |
| 立绘/头像 | ≤ 1024×1024 px（工笔重彩头像） | `.psd` → `.png` |

### 1.4 视角与 Tile 尺寸（art-bible §1.3 / §8.1 / §11 待审批③④ · 全局影响）

> ⚠️ **以下两项待主创拍板，影响全部角色/建筑/Tile 资产的绘制角度与规模**，越早定越省返工。本清单**以倾向值先行**，不擅自冻结：

- **俯视角度**：倾向 **3/4 俯视角（60°–65°）**（art-bible §1.3），非纯正俯视（90°）。所有角色/建筑精灵按此角度绘制（可见正面 + 顶面），TileSet 墙面/物件用「立面贴片 + 顶面」伪 3/4 处理。**待主创拍板 §11③**。
- **Tile 尺寸**：倾向 **64×64 px**（art-bible §8.1，高细节 ARPG 俯视，兼顾角色辨识与世界密度），32×32 作远景/低密度备选。**待 P3-2 工程骨架测试图敲定（§11④）**。本清单所有 Tile 规格以 **64×64 px** 倾向值给出。

### 1.5 性能预算倾向（待程基岩 P3 核对 · art-bible §8.4 / architecture §11）

> ⚠️ **以下为美术侧倾向，精确阈值以 architecture §11 已合入值为准，但「P6 剖析冻结前不锁死」**（architecture §11 标「待 P3-2 + P6 剖析冻结」）：

- 设计分辨率 1920×1080（4K 经 `canvas_items` 拉伸，禁单资源超高分辨率拉大内存）。
- Tile 64×64px（§1.4）。
- **同屏高精敌人精灵 ≤ 30–50**；士卒用「色块 + 少数精英」压缩（art-bible §3.3）——> 同屏**高精 NPC 精灵**应控制在 ≤30–50，普通士卒优先用**降精模板 + 阵营色块**。
- **同屏粒子 ≤ 200–400**（architecture §11）——> VFX 优先 **Sprite 粒子 + 加法混合**（冷光）/ **墨晕 Sprite 序列**（志怪），禁过量真粒子。
- 同屏并发遭遇 1–2（待审批）——> VFX/敌人资产按**单遭遇**预算设计。
- 叠层：L0 视差 + L5 系统 CanvasLayer 计预算，禁四层全动态过绘。

### 1.6 AI 生成提示词公共前缀（所有英文 prompt 复用）

为统一气质（art-bible §1.2），所有 AI 生成提示词默认带以下公共约束，逐资产条目仅写**差异化部分**：

> `Public prefix: top-down 3/4 isometric game asset (camera ~60-65°), hand-painted ink-wash style, restrained Chinese gongbi heavy-color, 2D sprite with transparent background, no text, no watermark, no UI chrome, clean alpha edges, consistent line weight within the same tileset, PNG export.`

奇幻/系统资产追加**色相纪律**（art-bible §2.4）：
- 系统侧（轨道 B，青蓝）：`cold cyan-teal geometric, hard-edged, low-saturation, scanline, holographic, NEVER warm red/orange.`
- 本土志怪侧（轨道 A 奇幻，朱黄）：`vermilion-yellow ink bloom, talisman, folk-supernatural, understated, NEVER gold-buddha / sword-flying (no xianxia).`
- 战火（轨道 A 点睛，朱赤）：`vermilion fire with ink-black smoke, gongbi heavy-color, smoky.`

---

## 2. 视觉一致性纪律（逐资产对齐，偏离即标注）

> art-bible §0「双轨反差」是**风格签名**，所有资产须遵守，**违反即漂移红线**。本清单逐资产标注轨道归属，确保：

1. **冷光只在 L5**（art-bible §3.2/§0）：所有 `ui_`/`vfx_system_*`/`vfx_*glitch`/`vfx_cold_ring`/`vfx_deviation_lock` 属轨道 B，**只允许出现在 L5_SystemCanvas**（含少量穿透术法特效）；`tile_`/`prop_`/`char_`/`npc_`/`tex_portrait_*` 属轨道 A 暖色，**冷光不污染其本色**。
2. **双轨配色比例**（art-bible §2.1）：轨道 A 暖色按 60-30-10（墨/纸 : 赭青 : 朱金）；轨道 B 冷光只通过系统叠层出现。
3. **奇幻色相法则**（art-bible §2.4）：玩家系统术法（`vfx_system_*`）= **青蓝几何**；本土志怪（`vfx_folk_*`/诸葛亮术）= **朱黄墨晕**；**两套绝不混用**（同一场戏用色相区分功劳归属，呼应 game-concept §6.2 分支 C「玩家自借触发系统特殊旁白」）。
4. **阵营多通道辨识**（art-bible §2.3 可访问性红线）：魏/蜀/吴禁仅靠色相区分（红绿色盲不友好），须**色相 + 旗号纹样 + 盔甲形制 + 剪影**多通道。阵营色仅辅助：曹魏 玄黑+冷金 / 蜀汉 朱赤+暖金 / 孙吴 青碧+冷银。
5. **俯视角辨识度**（art-bible §4.2）：名角靠**剪角 + 标志物 + 阵营色**辨识，不靠正脸——每个名角须有「数像素外就能认出」的剪角标志物。

---

## 3. 类别 A · 赤壁 TileSet 占位（tile_ / prop_）

> 命名词根 `tile_dyn_threekingdoms_chibi_*` / `prop_dyn_threekingdoms_chibi_*`（art-bible §9.2 + issue 范围 1）。落地 architecture §8.2 `L1_Ground`/`L2_Props` TileMapLayer + `open-world §3.1` 朝代包 `tileset_refs`。

### 3.1 地面层（L1 ground · 轨道 A）

#### `tile_dyn_threekingdoms_chibi_ground_dry`
- **用途**：赤壁旱地地表图块（旱地/丘陵缓坡面），TileMapLayer `ground` 主基底。
- **轨道**：A（暖·焦墨大地）。配色 art-bible §2.1 主色 A「大地焦墨」+ 辅色 A「赭石」。
- **风格参照**：VA-1 水墨氚氲；art-bible §5.2 地形。
- **尺寸**：64×64 px 单图块（倾向，§1.4）；图块集 ≤2048×2048。
- **源·工程**：`.aseprite` → `.png`。
- **动画·方向**：静态图块，**无缝拼贴**（边缘可循环，拼接处禁穿帮，art-bible §8.1 像素一致性）。
- **状态变体**：≥3 自变体 `_v01/_v02/_v03`（破除网格重复感）；无功能态。
- **AI 提示词**：`Dry earthen ground tile, seamless, earthy dark umber and ochre ink-wash texture, faint brush strokes, restrained, muted, traditional Chinese painting ground, top-down 3/4 tile, repeatable edges.` + 公共前缀。
- **MVP/目标态**：**MVP**（赤壁小区域旱地基底）。

#### `tile_dyn_threekingdoms_chibi_ground_wetland`
- **用途**：滩涂湿地地表（江岸泥滩），**影响潜行/战斗可读性**（art-bible §5.2；`combat §3.4` `on_wetland_mult: 1.5` 噪声放大）。
- **轨道**：A。配色：焦墨 + 赭石湿地低饱和质感，区分旱地（明度略低、带水渍反光）。
- **风格参照**：VA-1；art-bible §5.2 滩涂/江岸。
- **尺寸/格式/源**：同 `_ground_dry`（64×64，.aseprite→.png）。
- **动画·方向**：静态无缝；需 ≥3 自变体。
- **状态变体**：无功能态；可加 `_wet` 高反光变体（雨后/潮涨）作目标态。
- **AI 提示词**：`Muddy wetland riverbank tile, seamless, dark umber mud with faint wet sheen and ink puddles, low-saturation, reedy shore, top-down 3/4 tile, repeatable edges.` + 公共前缀。
- **MVP/目标态**：**MVP**（N2 七星坛近江岸，潜行相关）。

#### `tile_dyn_threekingdoms_chibi_water_river`
- **用途**：墨青赤壁江水深部图块（水面基底），TileMapLayer `ground`。
- **轨道**：A。配色 art-bible §2.2「江水青墨 × 战火朱赤」主调；辅色 A'「墨青/黛蓝」。
- **风格参照**：VA-1；art-bible §5.2 赤壁江「墨青深水」。
- **尺寸/格式/源**：64×64，.aseprite→.png。
- **动画·方向**：静态基底（浪纹另见 `_water_wave`）；**禁止写实海浪贴图**（art-bible §5.2），用留白 + 几笔浪纹。
- **状态变体**：无；夜态可加 `_night`（墨青加深 + 冷金营火反光，目标态时辰系统 open-world §2.4）。
- **AI 提示词**：`Deep river water tile, seamless, muted ink-blue/dark-teal, ink-wash negative space, restrained, NO realistic ocean foam texture, faint current, top-down 3/4 tile, repeatable edges.` + 公共前缀。
- **MVP/目标态**：**MVP**。

#### `tile_dyn_threekingdoms_chibi_water_wave`
- **用途**：宣纸白浪纹叠加层（叠于 `_water_river` 之上表达水流），**浪纹走向由关键变量 `v_wind` 驱动**（art-bible §5.5；`open-world §2.3/§4.4` `wind_visual_dir`）。
- **轨道**：A（宣纸黄/数据白倾向）。配色 art-bible §2.1 主色 A'「宣纸黄」作浪纹。
- **风格参照**：VA-1；art-bible §5.2「宣纸白浪纹」。
- **尺寸/格式/源**：64×64，.aseprite→.png（半透叠加）。
- **动画·方向**：静态或 2–4 帧轻流动画（倾向静态，流向靠切换变体而非逐帧动画，省性能）。
- **状态变体**：**三方向态**（关键，对应 v_wind，`open-world §2.3`）：`_wind_se`（东南浪）/ `_wind_none`（静水）/ `_wind_nw`（西北浪）。S5 据 S1 `variable_changed(v_wind)` 切换（architecture §8.2 `WindDirector`）。
- **AI 提示词**：`Faint white paper-rice-paper wave lines on transparent water overlay, ink-brush wave crests leaning southeast, restrained, NO foam, top-down 3/4 tile, repeatable.` —— 另出 `_wind_none`（平静）、`_wind_nw`（浪向西北）同构图换向。+ 公共前缀。
- **MVP/目标态**：**MVP**（v_wind 是 N2 核心可玩变量，须视觉化）。

#### `tile_dyn_threekingdoms_chibi_shore_edge`
- **用途**：水陆过渡边（旱地↔湿地↔水面的自动拼接边角图块），消除水陆硬边穿帮。
- **轨道**：A。
- **风格参照**：VA-1；art-bible §5.2。
- **尺寸/格式/源**：64×64，.aseprite→.png。
- **动画·方向**：静态；Godot TileSet 自动拼接（`[待程基岩确认]` TileSet terrain/peering 用法，architecture §13 K2）。
- **状态变体**：四角/四边变体（交由 Godot TileSet 自动拼接生成；美术提供 ≥「岸·角·边」最小集）。
- **AI 提示词**：`Shore transition tile between dry ground and river water, soft ink-blended edge, mud-to-water gradient, top-down 3/4 tile, repeatable.` + 公共前缀。
- **MVP/目标态**：**MVP**（小区域也需干净水陆边）。

#### `tile_dyn_threekingdoms_chibi_road_dirt`（`目标态`）
- **用途**：土路/营寨间路径。
- **轨道·风格参照·尺寸·源**：A / VA-1 · §5.2 / 64×64 / .aseprite→.png。
- **动画·方向**：静态无缝，≥3 自变体。
- **状态变体**：无。
- **AI 提示词**：`Dirt footpath tile, seamless, ochre and umber worn-earth trail, faint wheel ruts, restrained, top-down 3/4 tile, repeatable edges.` + 公共前缀。
- **MVP/目标态**：**目标态**（MVP 小区域用旱地即可）。

#### `tile_dyn_threekingdoms_chibi_rock_hill`（`目标态`）
- **用途**：工笔山石/丘陵近景图块（art-bible §5.2 丘陵/山道）。
- **轨道·风格参照**：A / VA-1 + VA-3 工笔重彩 / art-bible §5.2。
- **尺寸·源**：64×64（可 2×2 组合表达大石），.aseprite→.png。
- **动画·方向**：静态；远景淡墨晕染（L0）与近景重墨（L2）区分。
- **状态变体**：≥3 自变体（石形）。
- **AI 提示词**：`Gongbi ink-wash rock formation, top-down 3/4, dark ink outlines with ochre and ink-blue shading, mineral-pigment feel, restrained, repeatable.` + 公共前缀。
- **MVP/目标态**：**目标态**。

### 3.2 地上层 · 建筑与场所（L2 props · 轨道 A）

> 关键建筑的形制为「**东汉末参考方向，待历史顾问确认**」（art-bible §5.4/§12 风险①），美术以民间志怪架空为盾，不臆造精确考据。

#### `prop_dyn_threekingdoms_chibi_ship_tower`（楼船战船 · 含 v_boat 三态）
- **用途**：连环计核心战船（N1）；`v_boat` 视觉化身（art-bible §5.4 / `rewrite-causality §3.1` `world_visual`）。**火攻对象**（N2 火攻威力 `g(v_wind, v_boat)`）。
- **轨道**：A。配色 art-bible §2.2「铁索冷灰」+ 木质赭石。
- **风格参照**：VA-3 工笔重彩；art-bible §5.4 楼船/连舟。
- **尺寸·源**：单精灵 ≤256×256（楼船体量大，可跨多 Tile；碰撞另定）。.aseprite→.png。
- **动画·方向**：静态（船体）；旗帜/索具可独立 `_flag_*` 动（随风）。
- **状态变体**（**关键，对应 v_boat，`open-world §2.3`**）：
  - `prop_..._ship_tower_chain_on`（`v_boat=full_chain` 全连，**史实基准**）：多船以**冷灰铁索**相连（铁索 = `v_boat` 视觉化身，art-bible §2.2）。
  - `prop_..._ship_tower_chain_partial`（`v_boat=half_chain` 半连/有破绽）：铁索部分断裂/松脱。
  - `prop_..._ship_tower_chain_off`（`v_boat=unchained` 未连）：单舟散布，无铁索。
- **AI 提示词**：`Three Kingdoms tower-warship (lou-chuan), gongbi ink-wash, ochre wood hull with dark tiled tower, top-down 3/4, multiple ships lashed by cold-grey iron chains — variant "chains connected fully".` —— 另出 `chain_partial`（chains half-broken）、`chain_off`（single ships, no chains）同构图换索态。+ 公共前缀。
- **MVP/目标态**：**目标态**（N1 连环计属目标态 `game-concept §7.2`；MVP 仅 N2，但 v_boat 经因果链影响 N2 火攻威力，故资产应**预产 chain_on 基准态**供 N2 火攻演出）。

#### `prop_dyn_threekingdoms_chibi_altar`（七星坛 · 含 v_altar 二态）
- **用途**：N2 借东风核心改写场所（`scene_altar`，`open-world §2.1`）；玩家可登坛。`v_altar` 视觉化身。
- **轨道**：A。**本土奇幻边界**：坛上朱黄墨晕（诸葛亮借风属本土术士侧，art-bible §2.4/§4.2）。
- **风格参照**：VA-2 志怪木刻 + VA-3 工笔重彩；art-bible §5.4 七星坛「朱黄墨晕 + 阵坛几何」。
- **尺寸·源**：单精灵 ≤256×256（含阵坛几何外环）。.aseprite→.png。
- **动画·方向**：静态主体；朱黄墨晕光效另入 `vfx_folk_ink_bloom`。
- **状态变体**（**对应 v_altar，`open-world §2.3`**）：
  - `prop_..._altar_intact`（`v_altar=intact` 完好，基准）。
  - `prop_..._altar_destroyed`（`v_altar=destroyed` 碎裂，朱黄墨晕消散）。
- **AI 提示词**：`Seven-stars ritual altar (qi-xing-tan), circular stone platform with faint geometric star array, gongbi ink-wash with restrained vermilion-yellow ink-bloom glow, top-down 3/4, folk-supernatural, understated, NO xianxia light pillars.` —— 另出 `_destroyed`（cracked rubble, ink-bloom dissipating）。+ 公共前缀 + 朱黄奇幻前缀。
- **MVP/目标态**：**MVP**（N2 核心改写场所）。

#### `prop_dyn_threekingdoms_chibi_camp_tent_wei` / `_shu` / `_wu`（营寨帐篷 · 阵营三态）
- **用途**：阵营据点营寨（art-bible §5.4）；据点 = 夏口(蜀/孙刘后方)·乌林(曹魏)·赤壁·华容道（`open-world §2.1`）。checkpoint/休整点（`open-world §2.8`）。
- **轨道**：A。配色 art-bible §2.3 阵营色（**多通道**：色相 + 旗号 + 帐形）：魏 玄黑+冷金 / 蜀 朱赤+暖金 / 吴 青碧+冷银。
- **风格参照**：VA-3 工笔重彩；art-bible §5.4 营寨 + §2.3 阵营色。
- **尺寸·源**：单精灵 ≤128×128（可多顶组合成营地）。.aseprite→.png。
- **动画·方向**：静态主体；旗号独立动（`prop_..._flag_*`）。
- **状态变体**：阵营三态（`_wei`/`_shu`/`_wu`，**靠帐顶旗号纹样 + 主色区分**，非纯色相）。
- **AI 提示词**：`Military camp tent, gongbi ink-wash, top-down 3/4. Variant wei: black-and-cold-gold tent with square rigid banner pattern. ` （另 `_shu`: vermilion-red with warm-gold and Han-banner；`_wu`: teal-blue with cold-silver and wave-banner）。强调「same tent silhouette, differ ONLY by color + banner pattern」（守多通道辨识）。+ 公共前缀。
- **MVP/目标态**：**MVP 仅产 `_shu`**（夏口联军后方 checkpoint，`open-world §2.1`）；`_wei`/`_wu` 目标态。

#### `prop_dyn_threekingdoms_chibi_pass_huarong`（华容道险道 · 目标态）
- **用途**：N3 华容道败走之路（`scene_huarong_pass`，`open-world §2.1`）。**存在性依赖 N2**（仅 N2 火攻成功曹操大败才出现，`rewrite-causality §3.4`）。
- **轨道·风格参照**：A / VA-1 + art-bible §5.4 华容道「焦墨险道、肃杀、留白多」。
- **尺寸·源**：64×64 图块集（险道路面 + 两侧绝壁贴片）。.aseprite→.png。
- **动画·方向**：静态；多自变体（路面裂痕/落石）。
- **状态变体**：无功能态。
- **AI 提示词**：`Treacherous mountain pass tileset, narrow dirt path flanked by dark ink-cliffs, desolate, heavy negative space, somber ink-wash, top-down 3/4, repeatable.` + 公共前缀。
- **MVP/目标态**：**目标态**（N3 属目标态）。

#### `prop_dyn_threekingdoms_chibi_campfire`（冷金营火 · 暖光锚点）
- **用途**：夜间营寨/楼船的暖光锚点，与朱赤战火区分（art-bible §2.2「火=高饱和危险；营火=低饱和暖光安全」）。
- **轨道·风格参照**：A 点睛 A'「冷金」；VA-3；art-bible §2.2 冷金营火。
- **尺寸·源**：单精灵 ≤64×64（小火堆）；.aseprite→.png（加法混合倾向）。
- **动画·方向**：4–6 帧轻摇曳（art-bible §7.3 帧率倾向）。
- **状态变体**：`_lit`/`_extinguished`（点/灭，目标态潜行可吹灭）。
- **AI 提示词**：`Small campfire, low-saturation warm dim-gold flame (NOT bright red danger fire), ink-wash embers, gentle flicker sprite frames, top-down 3/4.` + 公共前缀。
- **MVP/目标态**：**目标态**（MVP 固定 `day/clear`，`open-world §3.5`）。

### 3.3 植被层（L2/L4 · 轨道 A）

#### `prop_dyn_threekingdoms_chibi_reed`（芦苇荡 · 含 v_wind 三态）
- **用途**：赤壁江岸标志植被；**芦苇倾倒方向 = 风向**，是 N2 借东风的环境信息源（art-bible §5.3/§5.5）；**芦苇荡提供潜行遮挡**（`combat §3.4` `reed_conceal_sight_mult: 0.3`，`open-world §3.5`）。
- **轨道·风格参照**：A / VA-1 + art-bible §5.3 芦苇荡。
- **尺寸·源**：单簇精灵 ≤64×96（半透，玩家经过可压低）；.aseprite→.png。
- **动画·方向**：可 2–3 帧轻摆（倾向静态 + 切变体，省性能）。
- **状态变体**（**对应 v_wind，`open-world §2.3`**）：`_wind_se`（向西北倾，东南风）/ `_wind_none`（直立）/ `_wind_nw`（向东南倾）。S5 据 `wind_visual_dir` 切换。
- **AI 提示词**：`Reed marsh cluster, ink-brush tall reeds leaning northwest (southeast wind), semi-transparent, top-down 3/4, restrained earthy greens and ochre.` —— 另出 `_wind_none`（upright）、`_wind_nw`（reeds leaning southeast）同构图换向。+ 公共前缀。
- **MVP/目标态**：**MVP**（v_wind 可视化 + 潜行遮挡，N2 关键环境）。

#### `prop_dyn_threekingdoms_chibi_tree_pine`（松柏/林木 · 前景遮挡）
- **用途**：前景树冠（L4_Foreground），玩家经过时半透遮挡增纵深（art-bible §3.2/§5.3）。
- **轨道·风格参照**：A / VA-1 工笔线 + 墨色；art-bible §5.3 松柏。
- **尺寸·源**：单冠精灵 ≤128×128；.aseprite→.png（半透边缘）。
- **动画·方向**：静态或极弱摆动（目标态随风）。
- **状态变体**：≥3 自变体（树形）；无功能态。
- **AI 提示词**：`Pine/cypress tree canopy seen from top-down 3/4, ink-brush branches with ink-blue shadow and ochre trunk, semi-transparent edges, restrained gongbi, NOT realistic foliage.` + 公共前缀。
- **MVP/目标态**：**目标态**（MVP 小区域可省；N2 七星坛场景可选 1–2 棵点缀）。

#### `prop_dyn_threekingdoms_chibi_flag_<faction>_<wind>`（阵营旗号 · 阵营 × 风向）
- **用途**：阵营辨识多通道之一（art-bible §2.3/§4.3）；**旗号飘向 = 风向**（art-bible §5.5）。
- **轨道·风格参照**：A 点睛 / VA-3 / art-bible §2.3 阵营色 + §4.3 旗号纹样。
- **尺寸·源**：单旗 ≤48×96；.aseprite→.png。
- **动画·方向**：4–6 帧飘动（或切 `_wind_*` 静态变体）。
- **状态变体**：阵营 × 风向 = 3×3 = 9 组合（`_wei_wind_se` 等）；MVP 仅产 `_shu_wind_se/_shu_wind_none`。
- **AI 提示词**：`Vertical war banner on pole, gongbi ink-wash, top-down 3/4. Faction shu: vermilion cloth with warm-gold trim and Han-dragon pattern, flag blowing toward northwest (southeast wind).` （`_wei`: black/cold-gold square rigid pattern；`_wu`: teal/cold-silver wave pattern；风向换 `_wind_none`/`_wind_nw`）。强调「same flag silhouette, differ by color + emblem」。+ 公共前缀。
- **MVP/目标态**：**MVP 仅 `_shu` 两风向**；余目标态。

---

## 4. 类别 B · 角色（char_ / npc_）

> 命名词根 `char_player_*` / `char_<名角>` / `npc_<阵营|folk>_*`（art-bible §9.2/§9.3 + issue 范围 2）。落地 architecture §8.2 `L3_Characters` (YSort)。

### 4.1 玩家（穿越者 · 双轨反差的人格化身）

#### `char_player_traveler`（玩家穿越者 · MVP）
- **用途**：玩家可控角色，Loop A/Loop B 主角；「双轨反差」活体——外观融入三国（暖），暗藏系统身份（冷光线索，art-bible §4.1）。**辨识度第一**：剪角在所有 NPC 中对比度最高。
- **轨道**：A 主体（暖色基底）+ B 暗纹（极弱青蓝几何刺绣，施法/改写时浮现）。§2 双轨纪律：冷光**仅施法态浮现**，不污染日常外观。
- **风格参照**：VA-1/VA-3 + art-bible §4.1；尺寸 art-bible §4.4 玩家 64×96（碰撞 ~24×40）。
- **尺寸·源**：单帧 ≤256×256（含特效余量）；.aseprite→.png（精灵图集）。
- **动画·方向（art-bible §7.1）**：**4 向基础**（`_n/_e/_s/_w`，不足方向镜像/插值）；**核心动作集**：`idle`/`walk`/`sprint`/`attack_n`(3 段连段)/`cast`(施法姿态)/`interact`/`hit`/`downed`。MVP 启用：`idle/walk/attack(3段)/cast/interact/hit/downed`（**不含** `dodge`/`stagger`，`combat §2.2` 完整集）。行走/奔跑 8–12fps；普攻 6–10 帧；施法 8–14 帧（art-bible §7.3）。
- **状态变体**：方向 × 动作；施法态叠加冷光纹层（`_cast_glow` 叠加帧，可独立图集）。
- **AI 提示词**：`Time-traveler protagonist sprite, late-Han wandering-scholar/warrior hybrid robe in muted warm earthy tones (NOT faction-colored, to not steal NPC focus), faint cold cyan geometric embroidery hidden on inner lining (only visible when casting), strong silhouette contrast, top-down 3/4, ink-wash + gongbi.` + 公共前缀。**方向集单独生成 `_s`(south, primary) 先行，余向镜像/补绘。**
- **MVP/目标态**：**MVP**（垂直切片主角）。

### 4.2 三国名角（剪角 + 标志物优先 · art-bible §4.2）

> 形制为「东汉末参考方向，待历史顾问确认」（art-bible §4.2/§12 风险①）。每个名角须有「数像素外就能认出」的剪角标志物。名角 NPC 64×96，碰撞 ~24×40（art-bible §4.4）。

#### `char_zhuge_liang`（诸葛亮 · MVP）
- **用途**：N2 改写目标 NPC（`open-world §3.4` 示例）；本土术士侧（朱黄墨晕，art-bible §2.4）。
- **轨道**：A（蜀阵营朱赤+暖金）+ 本土奇幻朱黄（借风时）。
- **风格参照**：VA-2 志怪木刻 + art-bible §4.2；标志物：**鹤氅 + 羽扇**。
- **尺寸·源**：单帧 ≤256×256；.aseprite→.png。
- **动画·方向**：4 向，动作集 `idle/walk/cast_folk`(借风施法朱黄墨晕)/`talk`/`hit/downed`。朱黄术法特效入 `vfx_folk_ink_bloom`。
- **状态变体**：方向 × 动作；**节点激活时获冷光描边**（art-bible §3.3，L5 叠加，非本体）。
- **AI 提示词**：`Zhuge Liang sprite, calm strategist in crane-feather cloak holding a feather fan, vermilion-warm-gold Shu palette, faint immortal restraint, top-down 3/4, ink-wash + gongbi, recognizable by FEATHER FAN + CRANE CLOAK silhouette.` + 公共前缀。
- **MVP/目标态**：**MVP**（N2 目标 NPC）。

#### `char_cao_cao`（曹操 · 目标态）
- **用途**：N1（多疑前倾）/ N3（败走/义释）改写目标；魏阵营（`char_cao_cao` ↔ `verb_kill_cao`，`combat §2.9`）。
- **轨道·风格参照**：A 玄黑+冷金 / art-bible §4.2；标志物：**短须 + 玄色大氅 + 多疑前倾身姿**。
- **动画·方向**：4 向，`idle/walk/laugh_suspicious/talk/hit/downed`。
- **AI 提示词**：`Cao Cao sprite, warlord in black cloak with cold-gold trim, short beard, suspicious forward-leaning posture, oppressive, top-down 3/4, ink-wash + gongbi, recognizable by BLACK CLOAK + FORWARD LEAN silhouette.` + 公共前缀。
- **MVP/目标态**：**目标态**（N1/N3 属目标态）。

#### `char_zhou_yu`（周瑜 · 目标态）
- **用途**：N2 联军主帅（孙吴水师）；目标态 NPC（`game-concept §7.2` 4 核心名角）。
- **轨道·风格参照**：A 青碧+冷银 / art-bible §4.2；标志物：**英气青年 + 青碧水师甲 + 佩剑**。
- **动画·方向**：4 向，`idle/walk/draw_sword/talk/hit/downed`。
- **AI 提示词**：`Zhou Yu sprite, dashing young Wu fleet commander in teal-blue naval armor with cold-silver trim, sword at hip, sharp heroic posture, top-down 3/4, ink-wash + gongbi, recognizable by TEAL ARMOR + SWORD silhouette.` + 公共前缀。
- **MVP/目标态**：**目标态**。

#### `char_guan_yu`（关羽 · 目标态）
- **用途**：N3 华容道埋伏/义释核心（`verb_...` 改写目标）；蜀阵营。
- **轨道·风格参照**：A 朱赤+暖金 / art-bible §4.2；标志物：**长须 + 青龙偃月刀（巨大剪角辨识）+ 赤马**。
- **动画·方向**：4 向，`idle/walk/glaive_slash/talk/hit/downed`；**重量感**：帧节奏更慢更重（art-bible §7.1）。
- **AI 提示词**：`Guan Yu sprite, towering warrior with long flowing beard, wielding enormous Green Dragon crescent-blade (guan-dao), vermilion-warm-gold Shu palette, imposing righteous weight, top-down 3/4, ink-wash + gongbi, recognizable by LONG BEARD + HUGE GLAIVE silhouette.` + 公共前缀。
- **MVP/目标态**：**目标态**。

### 4.3 阵营通用士卒模板（批量辨识 · art-bible §4.3）

> 士卒用**阵营色 + 旗号纹样 + 盔甲形制**三通道统一（art-bible §2.3 可访问性红线）。普通士卒 48×72，碰撞 ~20×36（art-bible §4.4，比将官小一档烘托精英）。**同屏高精士卒 ≤30–50**（architecture §11），故普通兵优先**降精模板**，精英再加轮廓对比。

#### `npc_wei_soldier` / `npc_shu_soldier` / `npc_wu_soldier`（阵营士卒 base + elite）
- **用途**：遭遇表敌人（`combat §3.3` 示例 `npc_wei_soldier_elite`）/ 战场色块压缩单位（art-bible §3.3）。
- **轨道·风格参照**：A 阵营色 / art-bible §4.3 阵营模板。
- **尺寸·源**：单帧 ≤128×192（48×72 绘制区，含特效余量）；.aseprite→.png。
- **动画·方向（art-bible §7.1 + combat §2.8 FSM）**：4 向，`patrol/chase/attack_melee`(含前摇预备帧)/`hit/downed`。MVP 可简化三态 `patrol⇄chase⇄attack`（`combat §2.8`）。
- **状态变体**：
  - 阵营：`_wei`(玄甲+方正旗号+规整阵列) / `_shu`(朱甲+汉旗+朴厚) / `_wu`(青甲+水纹旗+轻灵水师)。
  - 精锐：`_elite`（加标志物 + 更强轮廓对比，`combat §3.3`/`combat §2.8` 精英将官）。
- **AI 提示词**：`Common infantry soldier sprite, top-down 3/4, ink-wash + gongbi. Variant wei: black-lacquered plate armor, square rigid banner emblem, rigid formation posture. ` （`_shu`: vermilion armor + Han banner + sturdy；`_wu`: teal armor + wave banner + light naval kit）。强调「same body silhouette, differ by color + banner emblem + armor shape」。`_elite`: add taller plume + heavier silhouette。+ 公共前缀。
- **MVP/目标态**：**MVP 产 `npc_wei_soldier`(base) + `npc_shu_soldier`(base)**（曹营敌人 + 联军友军）；`_elite` 与 `_wu` 目标态。

### 4.4 志怪克制形（本土奇幻 · 轨道 A 朱黄）

#### `npc_folk_omen`（志怪兆头/术士 · 目标态）
- **用途**：民间志怪奇遇（基线「民间志怪式奇幻，非纯修仙」）；Discovery 美学载体（`game-concept §3.3`）。**克制形**——多为墨晕形，禁金光大佛/御剑（art-bible §1.2/§2.4）。
- **轨道·风格参照**：A 朱黄墨晕 / VA-2 志怪木刻；art-bible §1.2 志怪层。
- **尺寸·源**：案例定（art-bible §4.4），单帧 ≤256×256；.aseprite→.png。
- **动画·方向**：`idle/manifest`(墨晕扩散浮现)/`dissipate`；慢、暖、氚氲、克制。
- **状态变体**：`_v01`(墨晕狐影)/`_v02`(符箓兆头) 等克制片段（不量产，按目标态奇遇设计）。
- **AI 提示词**：`Folk-supernatural omen creature, amorphous ink-bloom silhouette with vermilion-yellow talisman glow, restrained, eerie but understated, NEVER gold-buddha or flying-sword, top-down 3/4, ink-wash.` + 公共前缀 + 朱黄奇幻前缀。
- **MVP/目标态**：**目标态**（MVP 不含志怪奇遇；`game-concept §7.1` 收窄）。

### 4.5 头像立绘（tex_portrait_ · 对话演出用）

> 俯视角面部难辨，对话演出用「头像立绘」补情绪（art-bible §4.5 工笔重彩头像）。尺寸 ≤1024×1024（art-bible §8.2）。

- **`tex_portrait_zhuge_liang`**（**MVP**）：工笔重彩半身像，鹤氅羽扇，从容仙风（克制）。AI：`Gongbi heavy-color half-body portrait of Zhuge Liang, crane cloak and feather fan, calm restrained immortal air, ink-wash background, NO xianxia halo.`
- **`tex_portrait_cao_cao`**（目标态）：多疑枭雄，玄色大氅冷金饰。AI：`...Cao Cao, black cloak cold-gold trim, suspicious warlord, oppressive...`
- **`tex_portrait_zhou_yu`**（目标态）：英气青年青碧甲。AI：`...Zhou Yu, teal naval armor, dashing young commander...`
- **`tex_portrait_guan_yu`**（目标态）：长须青龙刀。AI：`...Guan Yu, long beard, imposing righteous warrior...`
- **通用规格**：尺寸 1024×1024 / 源 `.psd`→`.png`（透明背景）/ 无方向无帧（静态立绘）/ 状态变体：`_neutral`/`_angry`/`_pleased` 等表情（目标态）。+ 公共前缀（去除 tile 约束）。

---

## 5. 类别 C · 系统面板 UI（ui_ / tex_ · 轨道 B 冷光材质）

> 命名词根 `ui_*` / `tex_*`（art-bible §9.2 + issue 范围 3）。**全部属轨道 B 系统材质**（art-bible §6.1），**只允许出现在 L5_SystemCanvas / RewritePanel**（architecture §8.2/§8.3；art-bible §0/§3.2）。屏幕清单源 `ux-spec.md`（已合入）：MM 主菜单 / HUD / SP 系统面板（改写面板 + 5 Tab）/ PS 暂停 / STG 历史线演出。

### 5.1 系统材质公共件（所有界面共享 · art-bible §6.1）

#### `ui_panel_frame_system`（系统材质面板九宫格框 · MVP）
- **用途**：所有系统界面共享的面板底框（偏差/技能树/兑换/情报/任务 Tab、改写面板、暂停菜单）。
- **轨道**：B。规范 art-bible §6.1：面板底=半透明网格墨蓝（10–20% 不透明）；边框=系统青蓝硬边 + 「数据投影失真」边缘。
- **风格参照**：VA-4 冷光几何；art-bible §6.1。
- **尺寸·源**：九宫格切片 ≤512×512（可拉伸）；.aseprite→.png。
- **动画·方向**：开合「冷光扫描展开」200–350ms（art-bible §7.3）；失真边缘轻微抖动（待审批①系统人格语气）。
- **状态变体**：`_normal`/`_modal`(遮罩加深，确认弹窗用)。
- **AI 提示词**：`9-slice UI panel frame, semi-transparent dark blue-grey grid background (~15% opacity), cold cyan-teal hard-edged border with faint scanline distortion at edges, holographic data-projection feel, geometric, NO warm colors, NO organic brush strokes.` + 公共前缀。
- **MVP/目标态**：**MVP**。

#### `ui_button_cold`（冷光按钮 · 含焦点框 · MVP）
- **用途**：所有系统界面按钮（主菜单条目/Tab/确认/兑换等）；**焦点框可见**（`ux-spec §2` 焦点链 + `control-manifest`，手柄无鼠标）。
- **轨道·风格参照**：B / VA-4 / art-bible §6.1。
- **尺寸·源**：九宫格 ≤256×128；.aseprite→.png。
- **动画·方向**：开合扫描；悬停冷光脉动。
- **状态变体**：`_normal`/`_hover`/`_pressed`/`_disabled`/`_focused`(焦点冷光环描边，手柄导航核心)。
- **AI 提示词**：`Cold-light UI button, 9-slice, cyan-teal hard-edged frame, faint scanline, states: normal/hover glow/pressed/disabled dim/focused with bright cyan focus ring, geometric, data-white label area.` + 公共前缀。
- **MVP/目标态**：**MVP**。

#### `ui_focus_ring_cold`（焦点环 · MVP）
- **用途**：手柄/方向键导航焦点框（独立可叠加），`ux-spec §2` 焦点链完整要求。
- **轨道·风格参照·尺寸·源**：B / VA-4 / ≤128×128 九宫格 / .aseprite→.png。
- **动画·方向**：冷光脉动（轻微）。
- **AI 提示词**：`Cold cyan-teal focus ring, dashed geometric rectangle with scanline pulse, holographic, transparent center, for gamepad UI focus.` + 公共前缀。
- **MVP/目标态**：**MVP**。

#### `ui_scanline_overlay` / `ui_grid_overlay`（扫描线/网格装饰层 · MVP）
- **用途**：系统材质装饰线（art-bible §6.1 扫描线/坐标网格/十字准星/冷光粒子）。
- **轨道·风格参照·尺寸·源**：B / VA-4 / 平铺 ≤256×256（无缝）/ .aseprite→.png（加法混合）。
- **动画·方向**：缓慢扫描漂移。
- **AI 提示词**：`Seamless scanline + coordinate grid overlay texture, cold cyan-teal thin lines on transparent, faint holographic noise, additive blend friendly.` + 公共前缀。
- **MVP/目标态**：**MVP**（系统材质基础件）。

### 5.2 核心 HUD（战斗态常驻 · ux-spec §5）

> HUD 极简贴边，世界优先（art-bible §6.2）；**核心资源条恒定 ≤5 信息单元**（HP/BF/CP/节点名+Δ/RE，`ux-spec §5.2`/`panel-progression §2.1`）。

#### `ui_hud_bar_frame`（资源条框 · MVP）
- **用途**：HUD 左下核心资源条容器（HP/BF/CP/RE 条共用框）。
- **轨道·风格参照·尺寸·源**：B / art-bible §6.2 / 九宫格 ≤256×128 / .aseprite→.png。
- **AI 提示词**：`Minimal HUD resource bar frame, edge-hugging, cold cyan-teal thin frame on semi-transparent dark blue, geometric, data-white tick marks, does NOT block world view.` + 公共前缀。
- **MVP/目标态**：**MVP**。

#### `ui_hud_bar_fill_hp` / `_bf` / `_re` / `_delta`（资源条填充 · MVP）
- **用途**：HP(`hp_changed`)/BF(`bf_changed`)/RE(`re`)/Δ(`deviation_recomputed`) 条填充（`ux-spec §5.4`）。
- **轨道·风格参照**：B；HP/BF/RE 用系统青蓝系（轨道 B），**Δ 条用警示橙红渐变**（高 Δ 警示，art-bible §2.1 点睛 B「警示橙红」+ §2.5 高 Δ 视觉）。
- **尺寸·源**：单条 ≤256×32（可拉伸）；.aseprite→.png。
- **动画·方向**：数值跳动「打字机/滚动」即时（art-bible §7.3，litRPG 爽感）；Δ 预览态 `is_preview` 即时跳动（`ux-spec §5.4`）。
- **状态变体**：`_normal`/`_draining`(减少闪)/`_full`；Δ：`_low`(<20 中性)/`_mid`(20–80 橙)/`_critical`(≥80 橙红+glitch)。
- **AI 提示词**：`HUD bar fill, horizontal, cold cyan-teal gradient (HP/BF/RE variant), top-down 2D, data-projection glow at edges.` —— `_delta` 变体：`horizontal deviation bar fill, gradient from neutral cyan (low) to warning orange (mid) to alarm orange-red with glitch edge (high), holographic.` + 公共前缀。
- **MVP/目标态**：**MVP**（HP/BF/CP/RE/Δ 五单元全产）。

#### `ui_icon_cp` / `ui_icon_re` / `ui_icon_delta` / `ui_icon_bf` / `ui_icon_hp`（资源图标 · MVP）
- **用途**：资源条/面板前的图标（CP 因果点 / RE 改写能量 / Δ 偏差 / BF 战意 / HP 生命）。
- **轨道·风格参照·尺寸·源**：B / VA-4 / 单图标 ≤64×64 / .aseprite→.png。
- **AI 提示词**：`Cold-light geometric UI icon set, cyan-teal hard-edged glyphs on transparent: a small coin-like glyph (CP), an energy-battery glyph (RE), a tilde/delta-triangle glyph (Δ), a sword-focus glyph (BF), a heart-pulse glyph (HP), holographic, data-white.` + 公共前缀。
- **MVP/目标态**：**MVP**。

#### `ui_hud_alert_indicator`（警戒指示 · 目标态倾向，MVP 可极简）
- **用途**：警戒档位指示（`alert_level` {0,1,2,3}，`combat §2.7`；仅 ≥2 显示，`ux-spec §5.4`）。
- **轨道·风格参照·尺寸·源**：B / art-bible §2.1 警示橙红 / ≤96×96 / .aseprite→.png。
- **动画·方向**：进入 `发现/交战` 时冷光闪现 + 橙红。
- **状态变体**：`_lv0/_lv1/_lv2/_lv3`（4 档）。
- **AI 提示词**：`Alert indicator icon, cold-light eye/cone glyph, neutral cyan at low levels, warning orange-red glow at detected/engaged, geometric.` + 公共前缀。
- **MVP/目标态**：**MVP 极简（仅 lv2/lv3 两态）**；完整 4 档目标态。

#### `ui_hud_ability_slot`（术法快捷栏槽 · MVP）
- **用途**：术法快捷栏（`ability_id` + `bf_cost` + cooldown 蒙层，`ux-spec §5.4`；MVP 1 格 `ability_system_magic_wind`，`combat §6.6`）。
- **轨道·风格参照·尺寸·源**：B / VA-4 / ≤96×96 / .aseprite→.png。
- **动画·方向**：cooldown 灰蒙层逐帧扫过；可用时冷光环。
- **状态变体**：`_ready`/`_cooling`/`_locked`(未解锁)。
- **AI 提示词**：`Ability quick-slot frame, cold cyan-teal geometric, with cooldown grey-sweep overlay state and locked dim state, holographic icon well.` + 公共前缀。
- **MVP/目标态**：**MVP**（1 格）。

#### `ui_hud_minimap`（小地图框 · MVP 可收起）
- **用途**：右上角小地图（据点 + 活跃场所冷光环 + v_i 摘要，`ux-spec §5.2`）；可一键收起。
- **轨道·风格参照·尺寸·源**：B / VA-4 / ≤256×256 / .aseprite→.png。
- **动画·方向**：场所冷光环脉动；揭示淡入。
- **状态变体**：`_expanded`/`_collapsed`。
- **AI 提示词**：`Minimal minimap frame, cold cyan-teal circular/geometric border, semi-transparent grid, faint pings for active nodes, holographic.` + 公共前缀。
- **MVP/目标态**：**MVP（可收起默认展开）**。

#### `ui_hud_banner`（系统横幅背景 · MVP）
- **用途**：顶部居中短时横幅（派单/完成/消失/情报/技能解锁，`ux-spec §5.6`）；冷光扫描展开，3–4s 消退。
- **轨道·风格参照·尺寸·源**：B / art-bible §6.1 / 九宫格 ≤512×128 / .aseprite→.png。
- **动画·方向**：开合 200–350ms 扫描；消退淡出。
- **AI 提示词**：`System notification banner background, cold cyan-teal hard edges, scanline sweep, semi-transparent, holographic, data-white text area.` + 公共前缀。
- **MVP/目标态**：**MVP**。

#### `ui_arrow_offscreen`（屏缘方位冷光箭头 · MVP）
- **用途**：目标场所 off-screen 指引箭头（`ux-spec §5.5`，满足 issue「方位」需求，不计入 ≤5 单元）。
- **轨道·风格参照·尺寸·源**：B / art-bible §3.3 冷光环 / ≤64×64 / .aseprite→.png。
- **动画·方向**：随玩家朝向旋转（`[待程基岩确认]` 旋转实现）；接近场所淡出。
- **AI 提示词**：`Off-screen objective arrow, cold cyan-teal geometric chevron, holographic glow, transparent, points toward target scene.` + 公共前缀。
- **MVP/目标态**：**MVP**。

### 5.3 系统面板（SP · 改写面板 + 5 Tab · ux-spec §6）

#### `ui_panel_rewrite_blueprint_card` / `ui_panel_rewrite_verb_card`（改写面板卡 · MVP）
- **用途**：改写面板的蓝图卡（`blueprint_id`/`target_vars`/`m_weights`/`unlock_intel_cov`/`special_flags`）与动词卡（`verb_id`/`cost_RE`/`requires.ability`），`ux-spec §6.3`。
- **轨道·风格参照·尺寸·源**：B / VA-4 / 卡片九宫格 ≤256×128 / .aseprite→.png。
- **动画·方向**：选中冷光描边脉动；锁定态灰蒙层（intel_cov 不足，`ux-spec §6.6`）。
- **状态变体**：`_selected`/`_locked`(灰蒙)/`_normal`。
- **AI 提示词**：`Rewrite-panel card frames, cold cyan-teal geometric, blueprint card (with target-variable readout area) and verb card (with cost readout area), selected state with bright focus ring, locked state with grey haze, holographic.` + 公共前缀。
- **MVP/目标态**：**MVP**（改写面板 = Loop A 核心动词操作台，`ux-spec §6.1` 支柱①）。

#### `ui_panel_tab_icon_deviation` / `_skill_tree` / `_exchange` / `_intel` / `_quest`（5 Tab 图标 · MVP）
- **用途**：系统面板 5 Tab 图标（偏差/技能树/兑换/情报/任务，`panel-progression §6.5`/`ux-spec §6.5`）。
- **轨道·风格参照·尺寸·源**：B / VA-4 / ≤64×64 / .aseprite→.png。
- **状态变体**：`_active`/`_inactive`。
- **AI 提示词**：`Cold-light geometric UI tab icons: deviation (tilde/triangle), skill-tree (node graph), exchange (arrows/swap), intel (eye/scroll), quest (banner/flag), cyan-teal active vs dim inactive, holographic.` + 公共前缀。
- **MVP/目标态**：**MVP 产 `_deviation` + `_skill_tree`（MVP 面板最小集：Δ + CP + 1 技能节点，`art-bible §8.5`）**；`_exchange`/`_intel`/`_quest` 目标态。

#### `ui_skill_tree_node`（技能树节点 · MVP）
- **用途**：技能树节点图（三分支 efficiency/magic/cognition，`panel-progression §2.2`；杜绝主导策略，无最优路径高亮，`ux-spec §6.5`）。
- **轨道·风格参照·尺寸·源**：B / VA-4 / ≤64×64 / .aseprite→.png。
- **动画·方向**：可解锁态描边脉动；解锁瞬冷光展开。
- **状态变体**：`_locked`(暗)/`_unlockable`(描边脉动)/`_unlocked`(亮)。
- **AI 提示词**：`Skill-tree node icons, cold cyan-teal hexagonal/geometric nodes with connecting line stubs, three states: locked (dim), unlockable (pulsing focus ring), unlocked (solid glow), holographic, NO optimal-path highlight.` + 公共前缀。
- **MVP/目标态**：**MVP**（至少 1 个可解锁节点）。

#### `ui_timeline_stage_bg`（历史线分叉演出背景 · 目标态倾向）
- **用途**：STG 历史线演出背景（横向卷轴：墨色历史线 + 冷光偏差节点 + 分叉，`ux-spec §6.4`/art-bible §6.2）；**双轨同框，情感峰值**。
- **轨道·风格参照·尺寸·源**：A+B 双轨 / VA-1 + VA-4 / 1920×1080 全屏 / .psd→.png。
- **动画·方向**：分叉冷光展开（notable ≤3s / critical 4–6s + glitch，`ux-spec §6.4`）。
- **状态变体**：`_minor`(无演出，仅 HUD 跳动)/`_notable`(短卷轴)/`_critical`(长演出 + glitch 边缘撕裂 + 橙红警示，art-bible §2.5)。
- **AI 提示词**：`Horizontal scroll timeline background, LEFT half muted ink-wash history line (warm track A), RIGHT cold cyan-teal deviation nodes branching with scanline (cold track B), faint glitch/tear at edges for critical variant, NO mixing of warm into cold nodes.` + 公共前缀。
- **MVP/目标态**：**目标态**（历史线演出 = `feedback_tier` notable/critical，MVP 仅 N2 可能触发 notable；倾向 MVP 至少产 `_notable` 态）。

### 5.4 主菜单 key art（MM · ux-spec §4）

#### `ui_main_menu_keyart`（水墨开场卷轴 key art · MVP）
- **用途**：主菜单背景（轨道 A 水墨开篇卷轴 + 轨道 B 冷光标题叠加，**反差即风格签名**，art-bible §6.2/§6.4；`ux-spec §4.3`）。**唯一允许轨道 A 卷轴并存轨道 B 冷光的例外**（非混用，分层叠加）。
- **轨道**：A 主（卷轴）+ B 叠（冷光标题/数据条）。
- **风格参照**：VA-1 宋元水墨山水 + art-bible §6.4 主菜单。
- **尺寸·源**：**1920×1080 全幅**（唯一允许超高分辨率的 key art，art-bible §8.4；4K 靠引擎缩放，本资产按设计分辨率绘）；.psd→.png（卷轴层）+ `.png`（冷光叠加层分离，便于动效）。
- **动画·方向**：墨晕缓慢晕染（静态 base + 2–3 帧晕染循环）；冷光标题扫描浮现。
- **状态变体**：`_base`(卷轴静态) / `_title_overlay`(冷光标题层，独立) / `_data_strip`(底部冷光数据条，独立)。
- **AI 提示词**：`1920x1080 main-menu key art, traditional Song-Yuan ink-wash landscape of the Yangtze river at the Battle of Red Cliffs, vast negative space, misty melancholic grandeur, restrained earthy palette (umber, ochre, ink-blue water, faint vermilion war fires in far distance), NO text, hand-painted.` —— 冷光叠加层另产：`cold cyan-teal holographic title overlay layer on transparent, scanline, geometric, for the game title, separate layer.` + 公共前缀（卷轴层去除 tile/camera 约束）。
- **MVP/目标态**：**MVP**（垂直切片第一印象）。

#### `ui_title_logo`（冷光标题文字 · MVP）
- **用途**：游戏标题字（冷光系统侧），叠加于 key art 之上。
- **轨道·风格参照·尺寸·源**：B / VA-4 / ≤1024×256 / .aseprite→.png（或矢量字体 + 着色器，`[待程基岩确认]`）。
- **动画·方向**：扫描浮现；轻微失真抖动（待审批①系统人格）。
- **AI 提示词**：`Game title logo in cold cyan-teal holographic geometric lettering, scanline glitch edge, data-projection feel, on transparent, NO warm colors.` + 公共前缀。
- **MVP/目标态**：**MVP**。

#### `ui_pause_menu_bg`（暂停菜单遮罩 · MVP）
- **用途**：暂停菜单背景（世界静止 + 半透网格墨蓝遮罩 40%，冷光不污染世界，`ux-spec §7.3`）。
- **轨道·风格参照·尺寸·源**：B / art-bible §6.1 / 1920×1080 全屏遮罩 / .aseprite→.png。
- **动画·方向**：淡入。
- **AI 提示词**：`Pause menu full-screen overlay, semi-transparent dark blue-grey grid at 40% opacity, cold cyan-teal faint border, world visible behind but dimmed, holographic.` + 公共前缀。
- **MVP/目标态**：**MVP**。

---

## 6. 类别 D · VFX 占位（vfx_）

> 命名词根 `vfx_<来源>_*`（art-bible §9.2/§9.3 + issue 范围 4）。**色相纪律严守 art-bible §2.4**：系统术法 = 青蓝几何；本土志怪 = 朱黄墨晕；火攻 = 朱赤墨烟——**三套绝不混用**。VFX 图集 ≤1024×1024（art-bible §8.2），同屏粒子 ≤200–400（architecture §11），优先 Sprite 粒子 + 加法混合。

### 6.1 玩家系统术法（轨道 B 青蓝）

#### `vfx_system_magic_wind_burst`（玩家自借东风 · MVP 唯一系统术法）
- **用途**：`ability_system_magic_wind`（`kind: rewrite_proxy`，`combat §3.2` 示例二）释放特效；**MVP 唯一系统术法**（`game-concept §7.1`）。释放即触发 `verb_self_borrow_wind` → S1 改 `v_wind`（`combat §2.6`）。
- **轨道**：B（青蓝几何）。**与诸葛亮朱黄墨晕严格区分**（art-bible §2.4：同场戏用色相区分功劳归属，呼应 game-concept §6.2 分支 C）。
- **风格参照**：VA-4；art-bible §7.2「玩家系统术法：几何粒子、网格展开、扫描锁定、快、脆、低饱和、硬边」。
- **尺寸·源**：图集 ≤1024×1024（序列帧）；.aseprite→.png（加法混合）。
- **动画·方向**：8–14 帧（art-bible §7.3）；几何风环展开 + 扫描锁定 + 命中数据解构碎裂。
- **状态变体**：`_cast`(前摇)/`_release`(释放)/`_impact`(命中)。
- **AI 提示词**：`Player system-magic wind burst VFX sprite sheet, cold cyan-teal geometric wind rings expanding with grid-scan lock-on, fast/crisp/low-saturation/hard-edged, data-deconstruction shatter on impact, additive blend, top-down 3/4, NEVER warm red/orange.` + 公共前缀 + 系统侧色相前缀。
- **MVP/目标态**：**MVP**（核心）。

#### `vfx_system_magic_burst`（青蓝爆发 AoE · 目标态）
- **用途**：`ability_system_combat_burst`（`kind: attack`，`combat §3.2` 示例一）AoE 攻击术法；目标态战斗术法（MVP `mvp_available: false`）。
- **轨道·风格参照·尺寸·源**：B 青蓝 / VA-4 / 图集 ≤1024×1024 / .aseprite→.png（加法混合）。
- **动画·方向**：6–10 帧；几何爆裂 + 扫描波。
- **AI 提示词**：`System-magic AoE burst VFX, cold cyan-teal geometric shockwave ring, grid shards, fast/crisp/hard-edged, additive blend, top-down 3/4, NEVER warm.` + 公共前缀 + 系统侧前缀。
- **MVP/目标态**：**目标态**。

### 6.2 本土志怪 / 术士（轨道 A 朱黄墨晕）

#### `vfx_folk_ink_bloom`（朱黄墨晕 · 目标态）
- **用途**：诸葛亮借风（本土术士）/ 志怪奇遇特效（art-bible §2.4）；**慢、暖、氚氲、克制**（art-bible §7.2）。
- **轨道·风格参照·尺寸·源**：A 朱黄 / VA-2 志怪木刻 / 图集 ≤1024×1024 / .aseprite→.png。
- **动画·方向**：8–14 帧墨晕扩散 + 符箓燃烬；禁爆发式光柱（art-bible §2.4/§7.2）。
- **状态变体**：`_wind`(借风朱黄)/`_omen`(志怪兆头)。
- **AI 提示词**：`Folk-supernatural ink-bloom VFX sprite sheet, vermilion-yellow ink slowly blooming outward with talisman glow, slow/warm/atmospheric/understated, NEVER gold-buddha or flying-sword, top-down 3/4.` + 公共前缀 + 朱黄奇幻前缀。
- **MVP/目标态**：**目标态**（MVP 诸葛亮借风可极简或借用此资产单帧；`game-concept §7.1` 收窄）。

### 6.3 火攻 / 战火（轨道 A 点睛 朱赤 + 墨烟）

#### `vfx_fire_attack`（火攻战火 · MVP 倾向）
- **用途**：N2 火攻演出（朱赤火 + 墨色烟，art-bible §2.2/§7.2）；**烟雾飘散受 `v_wind` 联动**（art-bible §5.5；`open-world §2.4` `wind_visual_dir`）。
- **轨道·风格参照·尺寸·源**：A 点睛 A「朱砂赤」+ 墨烟 / VA-3 工笔重彩 / 图集 ≤1024×1024 / .aseprite→.png。
- **动画·方向**：8–14 帧；工笔重彩火焰 + 墨色烟（非写实粒子火）；烟向随 `wind_visual_dir`。
- **状态变体**：`_wind_se`(烟向西北)/`_wind_none`(直上)/`_wind_nw`(烟向东南)；`_small`/`_large`(规模)。
- **AI 提示词**：`Battle-fire VFX sprite sheet, vermilion gongbi heavy-color flames with ink-black smoke (NOT realistic particle fire), smoke drifting northwest (southeast wind variant), top-down 3/4.` —— 另出 `_wind_none`/`_wind_nw` 换烟向。+ 公共前缀 + 战火前缀。
- **MVP/目标态**：**MVP**（N2 火攻是 MVP 节点的史实结果，演出需火；但完整火攻连舟焚毁属目标态——MVP 产 `_small` 单点火）。

### 6.4 改写 / 偏差反馈（轨道 B 冷光 · L5 叠层）

#### `vfx_deviation_lock`（改写瞬间锁定 · MVP）
- **用途**：改写瞬间「扫描/锁定目标变量 → 冷光描边浮现 `v_i` 浮标 → 世界微震」（art-bible §7.2；落地支柱①）。**改写反馈核心视觉**。
- **轨道·风格参照·尺寸·源**：B 青蓝 / VA-4 / 图集 ≤1024×1024 / .aseprite→.png。
- **动画·方向**：6–10 帧；冷光描边沿目标勾勒 + 数据浮标 `v_i` 浮现 + 微震。
- **状态变体**：`_scan`(扫描)/`_lock`(锁定描边)/`_label`(浮标浮现)。
- **AI 提示词**：`Rewrite-lock VFX, cold cyan-teal scan-line sweeping over a target then locking into a hard-edged wireframe outline with floating data labels (variable names), holographic, top-down 3/4, NEVER warm.` + 公共前缀 + 系统侧前缀。
- **MVP/目标态**：**MVP**（改写反馈核心）。

#### `vfx_cold_ring`（改写场所冷光环 · MVP）
- **用途**：活跃改写节点场所的冷光环提示（L5，`art-bible §3.3`/`ux-spec §5.5`；落地 `open-world §2.1` 场所冷光环，G6 触发器）。
- **轨道·风格参照·尺寸·源**：B / art-bible §3.3 / ≤256×256（地面环，可拉伸）/ .aseprite→.png（加法混合）。
- **动画·方向**：冷光环缓慢旋转/脉动；玩家接近增强。
- **AI 提示词**：`Ground cold-light ring marking an active rewrite scene, cyan-teal geometric circle with scanline rotation and gentle pulse, holographic, additive blend, top-down 3/4, transparent center.` + 公共前缀。
- **MVP/目标态**：**MVP**（N2 七星坛场所提示）。

#### `vfx_critical_glitch`（重大偏差世界线震荡 · 目标态倾向）
- **用途**：高 Δ（≥ `Δ_critical`）触发「画面边缘 glitch 撕裂 + 橙红警示 + 冷光侵入扩散」（art-bible §2.5/§7.2；`game-concept §6.3`）。
- **轨道·风格参照·尺寸·源**：B 警示橙红 + 冷光 / art-bible §2.5 / 全屏遮罩 1920×1080 / .aseprite→.png。
- **动画·方向**：4–8 帧边缘撕裂 + 扫描故障；橙红警示闪。
- **AI 提示词**：`Full-screen critical-deviation glitch overlay, screen-edge tear/scanline-fault with alarm orange-red warning flashes and cold cyan-teal invasive bleed, holographic, top-down.` + 公共前缀 + 系统侧前缀。
- **MVP/目标态**：**目标态倾向**（MVP N2 罕见触发 critical；可先产单帧占位）。

### 6.5 战斗反馈 VFX（多通道 · art-bible §2.3 可访问性）

#### `vfx_hit_impact_physical`（受击命中反馈 · MVP）
- **用途**：普攻/受击命中反馈（红光 + 震屏 + 墨点迸溅，多通道非仅色相，art-bible §2.3/§12）。
- **轨道·风格参照·尺寸·源**：A 墨点 + 朱赤 / VA-3 / 图集 ≤512×512 / .aseprite→.png。
- **动画·方向**：3–5 帧；墨点迸溅 + 轻震屏（震屏目标态可关，X5 减少动效）。
- **AI 提示词**：`Hit-impact VFX, ink-splash spatter with brief vermilion flash, top-down 3/4, fast/crisp, restrained.` + 公共前缀。
- **MVP/目标态**：**MVP**（普攻命中反馈，Loop B 可读性）。

#### `vfx_footstep_dust`（脚步尘墨粒子 · 目标态）
- **用途**：俯视角角色脚步接地感（地面尘墨粒子，轨道 A，art-bible §7.1）。
- **轨道·风格参照·尺寸·源**：A 墨 / VA-1 / ≤64×64 / .aseprite→.png。
- **动画·方向**：2–3 帧淡出；湿地态加大（`on_wetland_mult`，art-bible §5.2）。
- **AI 提示词**：`Footstep ink-dust particle, small puff of umber ink-wash dust fading out, top-down 3/4, restrained.` + 公共前缀。
- **MVP/目标态**：**目标态**（MVP 可省，接地感非必需）。

---

## 7. 主清单汇总（计数 / MVP·目标态分层）

> 对齐 art-bible §8.5 预算表 MVP/目标态列 + game-concept §7.1/§7.2。

### 7.1 按类别计数（资产条目，非精灵帧）

| 类别 | MVP 条目数 | 目标态新增 | 合计（含愿景外预留） |
|---|---|---|---|
| A · TileSet 地面（tile_） | 5（dry/wetland/water_river/water_wave/shore_edge） | +2（road_dirt/rock_hill） | 7 |
| A · TileSet 地上（prop_） | 5（altar×2态/camp_tent_shu/ship_tower_chain_on/reed×3风/flag_shu×2风） | +6（ship_tower_partial+off/camp_tent_wei+wu/pass_huarong/campfire/tree_pine/flag_wei+wu全风） | ~11 |
| B · 角色（char_/npc_） | 4（player/zhuge_liang/npc_wei_soldier/npc_shu_soldier） | +5（cao_cao/zhou_yu/guan_yu/npc_wu_soldier + elites/npc_folk_omen） | ~9 |
| B · 头像（tex_portrait_） | 1（zhuge_liang） | +4（cao_cao/zhou_yu/guan_yu/player） | 5 |
| C · UI 公共件 | 4（panel_frame/button/focus_ring/scanline_grid） | — | 4 |
| C · HUD | 9（bar_frame/4×fill/5×icon/alert/ability_slot/minimap/banner/arrow） | +1（alert 完整 4 档） | ~10 |
| C · 系统面板 | 4（rewrite_card×2/tab_icon_deviation+skill_tree/skill_node） | +5（tab_icon exchange/intel/quest + timeline_stage_bg） | ~9 |
| C · 主菜单 | 3（keyart/title_logo/pause_bg） | — | 3 |
| D · VFX | 5（magic_wind_burst/fire_attack_small/deviation_lock/cold_ring/hit_impact） | +5（magic_burst/folk_ink_bloom/critical_glitch/footstep_dust/fire_attack_large） | ~10 |
| **合计** | **~40 条 MVP** | **~28 条目标态新增** | **~68 条** |

> 📌 **MVP 边界对齐核对**：art-bible §8.5「TileSet MVP=1 套赤壁小区域 ✅ / 角色 MVP=玩家+≤5 NPC ✅(player+zhuge+2 士卒=4) / VFX MVP=1 系统术法+火 ✅(magic_wind+fire_small) / UI 面板 MVP=Δ+CP+1 技能节点 ✅(deviation+skill_tree+1 node)」。MVP 计数严守 `game-concept §7.1` 收窄，不摊薄焦点。

### 7.2 MVP 关键路径资产（垂直切片「能跑通 Loop A」的最低集）

按 `game-concept §7.1` MVP（N2 借东风单节点闭环）回推，**垂直切片必须先产**：
1. **世界**：`ground_dry` + `ground_wetland` + `water_river` + `water_wave`(×3 风) + `shore_edge` + `altar_intact`/`altar_destroyed` + `reed`(×3 风) + `camp_tent_shu` + `flag_shu_wind_se`/`_none`。
2. **角色**：`char_player_traveler`(核心动作集 4 向) + `char_zhuge_liang` + `npc_wei_soldier`(base) + `npc_shu_soldier`(base)。
3. **UI**：`panel_frame_system` + `button_cold` + `focus_ring_cold` + HUD 五单元（`bar_frame`/`fill_hp/bf/re/delta`/`icon_*`）+ `ability_slot` + `minimap` + `banner` + `arrow_offscreen` + 改写面板卡（`blueprint_card`/`verb_card`）+ `tab_icon_deviation`/`_skill_tree` + `skill_tree_node` + `main_menu_keyart` + `title_logo` + `pause_menu_bg`。
4. **VFX**：`system_magic_wind_burst` + `deviation_lock` + `cold_ring` + `fire_attack_small` + `hit_impact_physical`。

---

## 8. 资产 ↔ 数据驱动映射（命名与 `game/data` 字段一一对应）

> 落地 art-bible §9.5「命名须与 `game/data/*.tres`/`*.json` 字段一一可对应」+ architecture §6.2 数据落点。本表是**给程基岩 P5 的引用契约**，证明清单命名数据驱动可读、避免硬编码漂移。

| 资产 ID（变体） | 数据文件 / 字段 | GDD 来源 |
|---|---|---|
| `prop_..._ship_tower_chain_on/_partial/_off` | `data/variables/v_boat.tres` → `world_visual.{full_chain/half_chain/unchained}` | rewrite-causality §3.1 |
| `prop_..._altar_intact/_destroyed` | `data/variables/v_altar.tres` → `world_visual.{intact/destroyed}`；`data/world/scenes/scene_altar.tres` → `v_i_visual_refs.v_altar` | rewrite §3.1 / open-world §3.5 |
| `tile_..._water_wave_wind_se/_none/_nw`、`prop_..._reed_wind_*`、`prop_..._flag_*_wind_*` | `data/world/environment/env_globals.tres` → `wind_visual_map.{southeast→se,...}`（由 `v_wind` 映射）；architecture §8.2 `WindDirector` 广播 `wind_visual_dir` | open-world §2.3/§4.4 |
| `prop_..._camp_tent_wei/_shu/_wu`、`npc_wei/_shu/_wu_soldier` | `data/npcs/<npc_id>.tres` → `faction`；`data/encounters/<encounter_id>.tres` → `enemies[].enemy_id`；`data/world/dynasties/dyn_threekingdoms_chibi.tres` → `strongholds`/`scenes` | open-world §3.3/§3.4 |
| `char_player_traveler` | `data/combat/player_combat.tres` → `entity_id` | combat §3.1 |
| `char_zhuge_liang` 等 | `data/npcs/<npc_id>.tres` → `sprite_ref`/`anim_ref`/`is_rewrite_target`/`core_character` | open-world §3.4 |
| `vfx_system_magic_wind_burst` | `data/skills/ability_system_magic_wind.tres` → `vfx_ref`/`rewrite_proxy_verb` | combat §3.2 |
| `vfx_system_magic_burst` | `data/skills/ability_system_combat_burst.tres` → `vfx_ref` | combat §3.2 |
| `ui_hud_bar_fill_*`、`ui_icon_*` | 订阅 EventBus（architecture §7）：`hp_changed`/`bf_changed`/`cp_balance_changed`/`deviation_recomputed`/`re` | ux-spec §5.4 |
| `ui_panel_tab_icon_*` | `panel-progression §6.5` 系统 Tab 清单（5 Tab） | panel §6.5 / ux-spec §6.5 |
| `ui_skill_tree_node` | `data/progression/skills/<skill_id>.tres` 解锁态 → `_locked/_unlockable/_unlocked` | panel §3.1 |
| `ui_main_menu_keyart` / `ui_title_logo` | MM 场景背景 + 标题叠加层（`scenes/ui/main_menu.tscn`，ux-spec §3.1 待 P5 建） | ux-spec §4 |
| `vfx_cold_ring` | `data/world/scenes/<scene_id>.tres` → `is_rewrite_scene`；G6 触发器（architecture §3.3） | open-world §3.5 / mainline §6.2 |
| `tex_portrait_*` | 对话演出立绘引用（DLG 屏，ux-spec §3.1） | ux-spec §4.5 / art-bible §4.5 |

> ⚠️ **朝代热切换铺路**（X6 愿景外，架构不挡路）：所有资产 ID 含 `dyn_threekingdoms_chibi` 命名空间；换朝代 = 换一套命名空间 + 朝代包（`data/dynasties/<dynasty_id>.tres`），美术侧通过 TileSet 色温即可视觉区分朝代（art-bible §5.1 视觉 token 契约）。本切片仅 1 朝代。

---

## 9. 待审批项与引擎/管线风险

> 沿用 art-bible §11（待主创审批）+ §12（已知风险），**仅列影响资产的部分**。本清单**不擅自冻结**，以「倾向值 + 待拍板」标注。

### 9.1 待主创审批（影响资产，art-bible §11）

1. **【俯视角度 ③】3/4（60°–65°）是否拍板** —— 影响**全部角色/建筑精灵绘制角度**（本清单 §1.4）。倾向 60°–65°。**越早定越省返工（最高优先级）**。
2. **【Tile 尺寸 ④】64px vs 32px** —— 影响 TileSet 制作规模（本清单 §1.4 全以 64px 给规格）。倾向 64px，待 P3-2 测试图敲定。
3. **【系统人格语气 ①】冷峻数据流 vs 带毒舌记录员** —— 影响 UI 失真/抖动幅度（`ui_panel_frame_system`/`ui_title_logo` 边缘抖动）。倾向冷峻基底 + 极轻微失真。
4. **【本土奇幻上限 ②】朱黄墨晕能到多强** —— 影响 `vfx_folk_ink_bloom`/诸葛亮借风特效强度。倾向 MVP/目标态严守「兆头/小术」级，呼风唤雨级仅限重大演出且由系统冷光叠加约束。

### 9.2 引擎/管线风险（art-bible §12 + architecture §13）

1. **性能阈值未冻结**：§1.5 同屏精灵/粒子/并发遭遇阈值为美术侧倾向，精确值待 architecture §11「P6 剖析冻结」+ P3-2 工程骨架核对（architecture §13 K1–K9 API 缺口）。**本清单按倾向预算设计，超限时由 C4/C5 降级而非崩帧**（architecture §11）。
2. **历史考据 vs 风格化**：角色/建筑形制为「东汉末参考方向，待历史顾问确认」（art-bible §5.4/§12①）。美术以「民间志怪架空」为盾，核心人物剪角辨识（曹操多疑/关羽重义）保持可识别。**形制审定前，名角精灵先按 art-bible §4.2 标志物方向产剪角占位**。
3. **俯视角辨识度待精灵验证**：名角靠剪角+标志物辨识（art-bible §4.2），需在 P5 用实际精灵验证「数像素外可认」，**可能反哺调整尺寸**（art-bible §4.4）——`char_*` 尺寸上限预留 256×256 余量即为此。
4. **双轨反差可读性**：冷光 UI 过强抢世界、过弱失 litRPG 味（art-bible §12②）。靠 §1.5 叠层纪律（冷光仅 L5）+ §6 系统材质半透明约束平衡，需 P4-1 UX 规格（已合入）+ Playtest 校准。
5. **Godot API 缺口**（architecture §13 K2/K3/K9）：`TileMapLayer` 多层组织、`YSort` 用法、`Camera2D` zoom、自动拼接（terrain/peering）等精确用法待 P3-2 核对。本清单**只定资产规格，不臆造引擎 API**；Tile 自动拼接变体（§3.1 `_shore_edge`）以「提供最小角/边集」交付，拼接规则交程基岩。

---

## 10. 与验收要点 / 基线一致性自检

> 对齐 issue「验收要点」+ art-bible §10 自检口径。逐条核对：

| 验收点（issue） | 本清单对应处理 | 一致性 |
|---|---|---|
| 逐资产给出：ID/用途/轨道/风格参照/尺寸上限/源·工程格式/动画·方向/状态变体/AI 提示词 | §1.1 字段 schema + §3–§6 逐资产条目全字段齐备 | ✅ |
| 命名严守 §9.1–9.5（小写蛇形 + 类别前缀 + 命名空间 + 变体后缀） | §1.2 总则 + 全部资产 ID 遵守；与 `game/data` 字段一一对应（§8 映射表） | ✅ |
| MVP/目标态分层清晰（引 §8.5 预算表） | §1.1 字段逐条标注 + §7 汇总表 + §7.2 MVP 关键路径；对齐 game-concept §7.1/§7.2 | ✅ |
| 视觉一致性：对齐双轨反差 + 双轨色相法则（§2.4） | §2 纪律 + 逐资产标轨道 + §6 VFX 色相三轨不混用 | ✅ |
| 待审批项（§11，尤其 ③ 视角 ④ Tile 尺寸）以「倾向值 + 待拍板」标注 | §1.4 + §9.1，不擅自冻结 | ✅ |
| 不臆造引擎 API；性能精确阈值未冻结标「待 P3 核对」 | §1.5 + §9.2，architecture §11/§13 引用 | ✅ |
| 纯文档任务，自验证走结构核对，不跑 Godot | §0 自验证说明 + 本 §10 结构核对 | ✅ |
| 覆盖四类（赤壁 TileSet / 角色 / 系统面板 UI / VFX） | §3 / §4 / §5 / §6 四类齐全 | ✅ |
| 命名词根遵守 issue 指定（`tile_/prop_ dyn_threekingdoms_chibi_*` 等） | §3 全部 `tile_/prop_` + 命名空间；§4 `char_/npc_`；§5 `ui_/tex_`；§6 `vfx_` | ✅ |
| 角色：玩家 + MVP 名角 + 阵营士卒 + 志怪克制形 | §4.1 玩家 + §4.2 名角(诸葛/曹/周/关) + §4.3 士卒(魏/蜀/吴) + §4.4 志怪 | ✅ |
| UI：HUD + 系统面板 + 主菜单 key art | §5.2 HUD + §5.3 系统面板 + §5.4 主菜单 | ✅ |
| VFX：系统术法 + 志怪 + 火攻 + 改写/偏差反馈 | §6.1 系统 + §6.2 志怪 + §6.3 火攻 + §6.4 改写/偏差 | ✅ |

### 10.1 状态变体 ↔ v_i 枚举 一一对应核对（art-bible §9.5 数据驱动）

| v_i（S1 拥有，rewrite §3.1） | 枚举值 | 资产状态变体（S5 world_visual 映射） | 核对 |
|---|---|---|---|
| `v_boat` | unchained/half_chain/full_chain | `prop_..._ship_tower_chain_off/_partial/_on` | ✅ 三态全 |
| `v_wind` | southeast/none/northwest | `tile_..._water_wave_wind_se/_none/_nw` + `prop_..._reed_wind_*` + `prop_..._flag_*_wind_*` + `vfx_fire_attack_wind_*` | ✅ 三态全（多资产联动） |
| `v_altar` | intact/destroyed | `prop_..._altar_intact/_destroyed` | ✅ 二态全 |
| `v_cao` | alive/dead | NPC 实例存在性（`char_cao_cao` 布置/移除，无显式资产变体） | ✅（场景级） |
| `v_guan` | arrived/not_arrived/turned | `char_guan_yu` 布置变体（阵营色+位置，无独立资产变体） | ✅（场景级） |

> ✅ **v_i 视觉化全覆盖**：S5 据 S1 `variable_changed` 切换 `world_visual`（architecture §8.2 `WindDirector` + open-world §2.3），本清单为每个 v_i 枚举值提供了对应的资产变体，**无遗漏**（落地支柱③「可丈量沙盘」）。

---

## 11. 下一步建议（给主理人 · 游承峰）

1. **本 issue（P4-2）完成后**，请主创优先审批 §9.1 第 1/2 项（**俯视角度 + Tile 尺寸**）——它们决定全部后续资产制作规模与返工量，越早定越省成本。
2. **P5 制作（制作阶段）**：可据本清单 §7.2「MVP 关键路径资产」**按优先级排产**（世界基底 → 角色 → UI → VFX）；§3–§6 每条的 AI 提示词可直接喂生成管线，公共前缀（§1.6）保证气质统一。
3. **P3/P6 协同**：§1.5 性能倾向 + §9.2 引擎风险已标「待 P3-2 核对 / P6 剖析冻结」，建议 P3-2 工程骨架先用 MVP 关键路径资产做测试图（TileSet 拼贴 + 同屏精灵压测），反哺冻结 Tile 尺寸与同屏阈值。
4. **可访问性复核**：阵营多通道辨识（§2.4）+ UI 文字缩放/对比度（art-bible §6.3）+ 减少动效（震屏/glitch 可关）须在 P5 Playtest 与 X5 可访问性矩阵（待 P3 联合）交叉验证。

---

## 12. P6 juice 着色器与最小视觉挂载代码（`shd_` 新增前缀 · art-bible §9 扩展）

> 来源：P6 视觉打磨（issue #24 / `p6-polish-juice.md`）。art-bible §9.2 未给「着色器」类别前缀，**本节新增 `shd_`（shader）前缀**，命名结构 `<shd_>_<命名空间>_<主体>`，小写蛇形（守 art-bible §9.1）。juice 视觉挂载脚本属工程 `game/scripts/juice/`，用 class_name（`JuiceController`/`ScreenShake`/`WeaponTrail`），不进美术资产命名空间。

### 12.1 juice 着色器（`game/shaders/*.gdshader` · CanvasItem · Godot 4.7 可工作）

| 资产 ID（§9 口径） | 文件路径 | 轨道 | 用途 | 对齐 | MVP |
|---|---|---|---|---|---|
| `shd_juice_screen_damage_vignette` | `game/shaders/screen_damage_vignette.gdshader` | A 点睛（朱砂赤） | 受击屏幕边缘红光（多通道之一） | art-bible §2.1 / combat §6.5/§7.6① | ✅ 已接线 |
| `shd_juice_hit_flash` | `game/shaders/hit_flash.gdshader` | 中性（白闪） | 精灵受击白闪 | combat §6.5 / art-bible §7.1 | ✅ 待接线 |
| `shd_juice_weapon_trail` | `game/shaders/weapon_trail.gdshader` | A（宣纸白墨描） | 普攻挥砍拖尾（**非系统青蓝**，art-bible §2.4） | art-bible §7.1/§2.4 | ✅ 待接线 |
| `shd_juice_glitch_deviation` | `game/shaders/glitch_deviation.gdshader` | B 点睛（警示橙红） | 高 Δ 世界线震荡屏幕失真 | art-bible §2.5/§7.2 | ✅ 待接线 |
| `shd_world_color_grade` | `game/shaders/world_color_grade.gdshader` | 双轨色温 | 世界色温分级（待用，默认 intensity=0） | art-bible §0/§2 [待主创审批] | ⏸ 待用 |

### 12.2 juice 视觉挂载代码（`game/scripts/juice/*.gd` · 最小视觉挂载，不改玩法逻辑）

| class_name | 挂载 | 职责 | 接线状态 |
|---|---|---|---|
| `JuiceController` | `world.tscn` Systems/ | juice 编排 + `reduce_motion` 可访问性总开关 | ✅ 已接线（监听 `EventBus.hp_changed`） |
| `ScreenShake` | `Camera2D` 子节点 | trauma 模型震屏（写 `Camera2D.offset`） | ✅ 已接线 |
| `WeaponTrail` | 玩家/武器子节点（Line2D） | 普攻拖尾采样 | ⏳ 待 player.gd 接 `add_swing_point` |

### 12.3 命名 ↔ 路径 ↔ 数据映射（art-bible §9.5）

- 着色器资产 ID（`shd_juice_*`）↔ Godot 资源路径（`game/shaders/<简短名>.gdshader`）一一对齐（§12.1 表）。
- juice 不产 `Δ`/不写 `v_i`（守 combat §2.9 DAG 硬契约）；只观察 `EventBus.hp_changed` 做纯表现。
- 可访问性：`reduce_motion` 经 `JuiceController.set_reduce_motion()` 接设置菜单（ux-spec §11.1），详见 `p6-polish-juice.md` §3.2/§7。

---

*—— 林绘澄（art-director）· Phase 4 预制作（P4-2 资产清单 + 规格）· P6 juice 资产节（§12）由 issue #24 追加 · 待主创评审*
