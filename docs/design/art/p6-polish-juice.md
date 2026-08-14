# P6 视觉打磨与 juice · 占位美术配色对齐 + 屏幕震屏/命中停顿/武器拖尾

> 阶段：Phase 6 · 打磨（P6）　|　执行角色：林绘澄（art-director）
> Issue：#24 `[P6] 视觉打磨与 juice · 占位美术配色对齐 art-bible + 屏幕震屏/命中停顿/拖尾`
> 文档版本：v0.1（首版，待主创评审）　|　状态：可评审 / juice 已落地接线（world.tscn additive）+ 着色器与挂载代码已通过 headless import。
> 基线锚点：`AGENTS.md` 设计基线表（2D 俯视 ARPG / 改写因果心脏 / 三国·赤壁 / Godot 4.7.1 / GDScript）。
> **唯一视觉引用源**：`docs/design/art/art-bible.md`（§0 双轨 / §2 配色 / §2.3 可访问性红线 / §2.5 Δ 三档 / §3.1 镜头节制 / §6 UI / §7 动效 / §9 命名）。凡引用写作 `art-bible §x`。
> 前置产出（消费/打磨）：`asset-manifest.md`（P4-2 命名/规格）、`p5-10-core-asset-generation.md`（P5-10 已落 14 张占位美术 + mmx vision 核对）、`gdd/systems/combat.md`（juice 反馈锚点 §6.5/§7.6①）、`gdd/ux-spec.md`（可访问性分级 §11）。
> 工程锚点：Godot 4.7.1 stable · `gl_compatibility` · `canvas_items`/`expand` · 1920×1080。

---

## 0. 任务边界与范围

- **是**：把 P5-10 已落占位美术的**配色对齐 art-bible**（配色审计 + 首版固化 hex 调色板 + 把 art-bible 关键色编码进 juice 着色器）；交付**juice 着色器与最小视觉挂载代码**（屏幕震屏 / 命中停顿 / 武器拖尾 / 受击朱赤边缘光 / 高 Δ glitch）；落地**多通道受击反馈 + 可访问性「减少动效」接口**。
- **不是**：不改玩法数值/逻辑（HP/BF/伤害/FSM 归文策渊/程基岩）；不臆造引擎 API；不重画 P5-10 已 vision-confirmed 的占位美术（重风格化重出图属续产，见 §3.4）；不碰音频（阮和鸣）。
- **范围**：垂直切片（1 朝代·赤壁 + Loop A/B）的 juice 与配色对齐；多朝代 / 在线服务不做（`game-concept §7.3`）。
- **可访问性是基础要求**（`team/art-director.md` 核心能力 5）：juice 须可被「减少动效 / 减少屏幕震」抑制（combat §7.6① / ux-spec §11.1），受击反馈多通道、不靠单一颜色（art-bible §2.3）。

---

## 1. 块一 · 占位美术配色对齐 art-bible（配色审计 + 首版固化 hex）

> art-bible §2 给的是**色相描述**（如「极低饱和深褐黑」），未冻结 hex。P6 打磨由 art-director **首版固化**双轨主辅色系 hex，作为 P6+ 全部资产/juice 着色器/续产的**唯一数值色源**（呼应 asset-manifest §2 视觉一致性纪律）。⚠️ hex 为首版固化，**[待主创审批]**（沿用 art-bible §11 待审批①②）。

### 1.1 双轨主辅色系 hex（首版固化 · P6）

**轨道 A · 历史世界（暖·墨彩）** — 引 art-bible §2.1

| 角色 | 色名 | hex (sRGB) | RGB(0..1) | 用途 |
|---|---|---|---|---|
| 主色 A | 大地焦墨 | `#2A2620` | (0.165, 0.149, 0.125) | 地形基底/阴影/剪影 |
| 主色 A' | 宣纸黄 | `#EDE6D3` | (0.929, 0.902, 0.827) | 留白/江面/天空底 |
| 辅色 A | 赭石 | `#9C5B2E` | (0.612, 0.357, 0.180) | 山石/土路/木质 |
| 辅色 A' | 墨青/黛蓝 | `#2F4A4A` | (0.184, 0.290, 0.290) | 江水深部/远景/植被暗部 |
| 点睛 A | **朱砂赤** | `#D91F1A` | **(0.851, 0.122, 0.102)** | 战火/血气/蜀阵营/受击红光 |
| 点睛 A' | 冷金 | `#B8954A` | (0.722, 0.584, 0.290) | 营火/盔甲/魏阵营饰 |

**轨道 B · 系统（冷·数据光）** — 引 art-bible §2.1

| 角色 | 色名 | hex (sRGB) | RGB(0..1) | 用途 |
|---|---|---|---|---|
| 主色 B | 系统青蓝 | `#36C5D0` | (0.212, 0.773, 0.816) | 面板边框/术法主体/改写描边 |
| 主色 B' | 数据白 | `#E8F4F6` | (0.910, 0.957, 0.965) | 文字/数据/网格线 |
| 辅色 B | 网格墨蓝 | `#1A2733` | (0.102, 0.153, 0.200) | 面板底/扫描线/阴影 |
| 点睛 B | **警示橙红** | `#F27319` | **(0.949, 0.451, 0.098)** | 高 Δ 警告/重大偏差/glitch 浸润 |

**三国阵营色**（多通道辅助，art-bible §2.3 可访问性红线：**禁仅靠色相**辨识）— 引 art-bible §2.3

| 阵营 | 主色 hex | 辅色 hex | 多通道（色相+旗号+形制+剪影） |
|---|---|---|---|
| 曹魏 | 玄黑 `#1C1C22` | 冷金 `#B8954A` | 方正旗号 + 规整阵列 |
| 蜀汉 | 朱赤 `#D91F1A` | 暖金 `#C99A3C` | 汉旗 + 朴厚形制 |
| 孙吴 | 青碧 `#2E8C8A` | 冷银 `#9FB3BD` | 水纹旗 + 轻灵水师装 |

### 1.2 P5-10 占位美术配色对齐审计（逐资产）

> 审计依据：P5-10 §0.5.3 的 `mmx vision describe` 核对结论 + 本任务 §1.1 固化 hex。状态：✅ on-spec（配色/轨道/命名合规）/ ⚠️ 微偏（占位技法导致，P6/P7 手绘收口）/ 🔧 本任务已用着色器编码校正色。

| 资产（P5-10） | 轨道 | 对齐 art-bible 节 | 配色审计结论 | 状态 |
|---|---|---|---|---|
| `char_player_traveler_idle_s` / `_walk_s` | A 主体 + B 暗纹 | §4.1 反差人格 / §2.1 | 暖墨彩（赭/墨青/米），idle 不显冷光（守 §4.1「暗藏系统身份」）；剪角对比度高 | ✅ on-spec |
| `npc_folk_bandit_idle_s` | A（凡人 folk） | §4.3 阵营模板 / §2.4 | 暖墨彩粗布赭褐 + 劈砍钝刀；**无冷光、无朱黄墨晕**（凡人，非志怪/非系统，p5-10 §7 决策） | ✅ on-spec |
| `tile_..._ground_dry` / `_wetland` | A | §2.1 / §5.2 | 焦墨+赭石旱地 / 湿地低饱和带水渍；4 折镜像无缝（占位技法，4 抱对称） | ⚠️ 无缝占位（P7 手绘收口） |
| `tile_..._water_river` / `_water_wave_wind_se` | A | §2.2 / §5.2 | 墨青深水（黛蓝 `#2F4A4A` 系）+ 宣纸白浪纹（提亮至 `#EDE6D3` 系，浪向 SE→倾 NW） | ✅ on-spec（浪向已 reconcile） |
| `tile_..._shore_edge` | A | §5.2 | 水陆过渡边；满铺，待 terrain 角/边集（程基岩 TileSet peering） | ⚠️ terrain 集待续产 |
| `prop_..._reed_wind_se` | A | §5.3/§5.5 | 半透芦苇倾 NW（SE 风），赭/墨青；潜行遮挡（combat §3.4 `reed_conceal_sight_mult:0.3`） | ✅ on-spec |
| `prop_..._camp_tent_shu` | A（蜀） | §2.3 / §5.4 | 朱赤 `#D91F1A` + 暖金 + 汉旗纹样（多通道，非纯色相） | ✅ on-spec |
| `ui_panel_frame_system` | B | §6.1 / §6.4 | 仅青蓝硬边框环 + 透明内部（global-white key）；半透网格墨蓝底由 `system_panel.tscn` BgRect 透出 | ✅ on-spec |
| `ui_panel_rewrite_blueprint_card` | B | §6.1 / §5.3 | 冷青蓝横向卡 + 边框 + 内几何纹；上下白边键透浮动卡 | ✅ on-spec |
| `ui_panel_tab_icon_deviation` / `_skill_tree` | B | §6.1 / §5.3 | 冷青蓝抽象几何图标；精确字形（Δ三角/节点图）为抽象占位 | ⚠️ 字形占位（P7 手绘） |

**审计结论**：P5-10 占位美术**整体 on-spec**（配色/轨道/命名零硬偏离）；剩余为占位技法局限（tile 4 折镜像对称、Tab 图标字形抽象），归 P7 手绘收口，**非本任务范围**。本任务在 **juice 层**把 art-bible 关键色（朱砂赤 / 警示橙红 / 宣纸白）**编码进着色器**（§2.2），使 juice 本身配色精确对齐。

### 1.3 全局重调色（world color grade）—— [待主创审批后启用，本任务不擅自开]

art-bible §11 待审批①②未冻结「系统人格语气 / 本土奇幻上限」，且 P5-10 已 vision-confirmed 占位 look。**全局屏幕重调色**（对 world 根做双轨色温分级 shader）会改变已验收的整体观感，属风格决策——**本任务不擅自启用**，仅在 §2 提供 `world_color_grade.gdshader`（轨道 A 暖/轨道 B 冷的轻量色温分级，默认 intensity=0）作为「主创审批后一键启用」的待用件，避免返工。

---

## 2. 块二 · Juice 着色器与视觉动效（`game/shaders/` + `game/scripts/juice/`）

> 节制总纲（art-bible §3.1「避免战斗时剧烈抖动破坏俯视全局可读性」+ combat §1.4 战斗「轻」）：所有 juice **幅度小、时长短、可被 reduce_motion 抑制**。受击反馈**多通道**（combat §7.6①：朱赤边缘光 + HP 下沉 + 震屏 + 音效），**不靠单一颜色**（art-bible §2.3 可访问性红线）。

### 2.1 着色器清单（`game/shaders/*.gdshader` · `CanvasItem` · Godot 4.7 可工作）

| 文件 | 用途 | 关键 uniform（默认值·单位） | 对齐 |
|---|---|---|---|
| `screen_damage_vignette.gdshader` | 受击屏幕边缘朱砂赤光晕 | `intensity`(0..1, 默认0) / `glow_color`(朱砂赤 `#D91F1A`) / `edge_band`(0.32 占半屏) / `max_alpha`(0.55 节制上限) | art-bible §2.1 点睛A / combat §6.5/§7.6① |
| `hit_flash.gdshader` | 精灵受击白闪（叠在原图 alpha 上） | `flash`(0..1, 默认0) / `flash_color`(白) | combat §6.5 / art-bible §7.1 |
| `weapon_trail.gdshader` | 普攻挥砍墨笔拖尾（沿长度淡出） | `fade`(0..1) / `ink_color`(宣纸白偏暖) / `tail_power`(1.6 笔锋) | art-bible §7.1 动态线 / §2.4 色相法则（**轨 A 墨描，非系统青蓝**） |
| `glitch_deviation.gdshader` | 高 Δ 世界线震荡屏幕失真（读 SCREEN_TEXTURE） | `intensity`(0..1) / `warn_color`(警示橙红 `#F27319`) / `slice_strength`/`scanline_freq` | art-bible §2.5 高Δ / §7.2 重大偏差 |
| `world_color_grade.gdshader`（待用，默认 intensity=0） | 双轨色温轻分级（轨 A 暖/轨 B 冷） | `intensity`(0) / `warm_tint`/`cool_tint` | art-bible §0/§2 [待主创审批后启用] |

**色相纪律落地**（art-bible §2.4 + asset-manifest §2）：着色器编码的色相严守轨道——受击红光 = **朱砂赤（轨 A 点睛）**；高 Δ 警示 = **警示橙红（轨 B 点睛）**；普攻拖尾 = **宣纸白墨描（轨 A）** ≠ 系统术法青蓝几何（轨 B `vfx_system_*`）。两套奇幻绝不混用。

### 2.2 最小视觉挂载代码（`game/scripts/juice/*.gd` · art-director 产出 · 不改玩法逻辑）

| 脚本（class_name） | 挂载 | 职责与参数（单位） |
|---|---|---|
| `juice_controller.gd`（`JuiceController`） | `world.tscn` Systems/ 子节点 | juice 编排：监听 `EventBus.hp_changed`（HP 下降→受击反馈）；`request_shake(trauma 0..1)` / `request_hit_stop(dur s, scale)` / `pulse_vignette(color,peak,rise s,fall s)`；`set_reduce_motion(bool)` 可访问性总开关；`reduce_motion` export |
| `screen_shake.gd`（`ScreenShake`） | `Camera2D` 子节点 | trauma 模型震屏：`offset = trauma²×max_amp(px)×随机`；`max_amp=8px`（节制）/`decay=4/s`/`add_trauma(0..1)`；写 `Camera2D.offset`（与 world.gd 的 `global_position` 正交） |
| `weapon_trail.gd`（`WeaponTrail`） | 玩家/武器子节点（Line2D） | 普攻拖尾采样：`add_swing_point(global_pos)`；`max_points=12`/`lifetime=0.18s`/`ink_color=宣纸白`；reduce_motion 时不画 |

**节制数值锚点**（首版，[待 P6 Playtest]）：受击震屏注入 `trauma=0.35` → 峰值 ≈ `0.35²×8 ≈ 0.98px`（极轻，俯视可读性优先）；受击红光 `max_alpha=0.55`（边缘，中心透明，不挡战场）；命中停顿 `hit_stop_scale=0.06 / dur=0.045s`（短促给手感）。

### 2.3 已落地接线（world.tscn · additive · 零玩法改动）

- `Systems/JuiceController`（camera/screen_shake/vignette 三 NodePath export 默认值即对齐 world 树）。
- `Camera2D/ScreenShake`（trauma 震屏，写 offset）。
- `L5_SystemCanvas/DamageVignette`（全屏 ColorRect + `screen_damage_vignette.gdshader`，`mouse_filter=IGNORE` 不挡输入，`intensity` 默认 0）。
- **运行链**：玩家被命中 → C4 `EventBus.hp_changed(new,max)` → `JuiceController._on_hp_changed` 检测 `new<prev` → `pulse_vignette()`（朱赤边缘光，始终）+ `request_shake(0.35)`（reduce_motion 时跳过）。HP 权威仍属 C4，本节点只「观察」已有信号。

---

## 3. 块三 · 多通道受击反馈 + 可访问性

### 3.1 多通道受击反馈（combat §7.6① / art-bible §2.3 可访问性红线）

玩家受击 = 单一颜色风险点，故**四通道并行**，任一关闭仍有冗余：

| 通道 | 载体 | reduce_motion 时 | 归属 |
|---|---|---|---|
| ① 朱赤边缘光 | `DamageVignette` + `screen_damage_vignette.gdshader` | **保留**（颜色通道，非动效） | 本任务（已接线） |
| ② HP 条下沉 | HUD `hp_changed` 监听（既有） | 保留 | C3/HUD（既有） |
| ③ 微震屏 | `ScreenShake` trauma 模型 | **关闭**（offset=0） | 本任务（已接线） |
| ④ 受击音效 | sfx | 保留 | 阮和鸣（audio-director，占位） |

### 3.2 可访问性「减少动效 / 减少屏幕震」接口（combat §7.6① / ux-spec §11.1）

- **总开关**：`JuiceController.set_reduce_motion(bool)` → 同步 `ScreenShake.set_reduce_motion()`；震屏 offset 恒零、命中停顿不启动、glitch intensity 钳 0、拖尾不采样。**朱赤边缘光 + HP 条 + 音效保留**（多通道不靠单一颜色，art-bible §2.3）。
- **接线点（交程基岩，issue comment）**：设置菜单（ux-spec §11.1「减少动效」开关）→ 调 `juice.set_reduce_motion(bool)`。本任务预留接口 + export，不擅自接设置 UI（属 UX/工程）。
- **分级对齐**：本接口对齐 ux-spec §11.1 自定基线「减少动效：可关闭 glitch/抖动/扫描（前庭敏感）」。

---

## 4. 命名（严守 art-bible §9 + asset-manifest §1.2）

> art-bible §9.2 未给「着色器」类别前缀。本任务**新增约定** `shd_`（shader）前缀，落入 asset-manifest §12（见下）。juice 视觉挂载脚本不属美术资产命名空间（属工程 `scripts/`），用 `snake_case` 类名（`JuiceController`/`ScreenShake`/`WeaponTrail`）。

| 资产 ID（art-bible §9 snake_case） | 类别 | 命名合规 |
|---|---|---|
| `shd_juice_screen_damage_vignette` | juice 受击红光着色器 | `shd_` + `juice` 命名空间 + 主体 ✅ |
| `shd_juice_hit_flash` | juice 受击白闪着色器 | ✅ |
| `shd_juice_weapon_trail` | juice 普攻拖尾着色器 | ✅ |
| `shd_juice_glitch_deviation` | juice 高 Δ glitch 着色器 | ✅ |
| `shd_world_color_grade` | 世界色温分级着色器（待用） | ✅ |

> 文件名用更简短 `screen_damage_vignette.gdshader` 等（Godot 资源路径），资产 ID（命名规范口径）= `shd_juice_*`，二者在 asset-manifest §12 映射表一一对应（art-bible §9.5 数据驱动对接）。

---

## 5. 与基线/前置一致性自检

| 验收点（issue / team·art-director 输出规范） | 本任务处理 | 核对 |
|---|---|---|
| 占位美术配色对齐 art-bible（玩家/山贼/TileSet/UI） | §1 双轨 hex 首版固化 + §1.2 逐资产审计（P5-10 整体 on-spec，juice 层编码关键色） | ✅ |
| Juice：屏幕震屏（节制）/ 命中停顿 / 武器拖尾 | §2.1 着色器 + §2.2 挂载代码；震屏 trauma²×8px 极轻（art-bible §3.1） | ✅ |
| 受击反馈多通道（红光+震屏+音效，不只靠颜色） | §3.1 四通道；reduce_motion 保留颜色+HP+音效 | ✅ |
| 可访问性：震屏可被「减少动效/减少屏幕震」抑制 | §3.2 `set_reduce_motion()` 总开关 + export | ✅ |
| 命名严守 art-bible §9 + asset-manifest §1.2 | §4 新增 `shd_` 前缀 + 映射表 | ✅ |
| 数据驱动/引擎对齐（Godot 4.7 CanvasItem/GPUParticles2D 可工作，不臆造 API） | §2 全 `CanvasItem` shader + `Camera2D.offset`/`Engine.time_scale`/`Line2D` 均为 Godot 4.7 实存 API | ✅ |
| 非越界：juice GDScript 是最小视觉挂载，不改玩法数值/逻辑 | §2.3 只观察 `EventBus.hp_changed`；`request_*()` 供玩法层调用（接线点入 comment）；未改 player.gd/enemy.gd/combat_system.gd | ✅ |
| mmx：重风格化优先 mmx image，不可用降级 | mmx 可用；P5-10 占位已 vision-confirmed on-spec（§1.2），本任务未重出图（重风格化属续产，§3.4 列） | ✅ |
| 自验证：headless import 通过 | §6 本任务文件零报错、EXIT=0 | ✅ |

---

## 6. 自验证（替代会审 · 已执行）

| 项 | 方法 | 结果 |
|---|---|---|
| 着色器导入 | `$GODOT_BIN --headless --import --quit`（game/ 下，Godot 4.7.1） | 4 着色器 + `world_color_grade` 全部生成 `.uid`，零 shader 报错 ✅ |
| 脚本导入 + class_name 注册 | 同上 | `JuiceController`/`ScreenShake`/`WeaponTrail` 三 class_name 注册成功，`.gd.uid` 生成 ✅ |
| world.tscn additive 接线 | 同上 | `Systems/JuiceController`/`Camera2D/ScreenShake`/`L5_SystemCanvas/DamageVignette` 加载零报错 ✅ |
| 命名/路径合规 | `ls game/shaders/` + `asset-manifest §7` 映射 | ✅ |
| 整体 import | `EXIT=0` | ✅（注：既有 rewrite/quest/save 脚本有**与本任务无关**的 pre-existing 类型解析报错，见 §8） |

---

## 7. 待程基岩/engineering-lead 接线点（issue comment 已汇总）

> art-director 产出最小视觉挂载代码 + 着色器；以下「玩法层触发」一行接线交程基岩（守 issue 红线：不改玩法逻辑，需协调点写 comment）。

1. **命中停顿触发**：`player.gd` `_check_hitbox_hits()` 命中敌人后调 `juice.request_hit_stop()`（一行；juice 节点经 `get_tree().get_first_node_in_group("juice")` 或 owner 取）。
2. **拖尾采样**：`player.gd` 普攻 active 阶段调 `trail.add_swing_point(weapon_tip_global_pos)`（`WeaponTrail` 作 Player 子节点挂载）。
3. **高 Δ glitch**：`RewriteFeedbackController` 在 `feedback_tier=critical`（art-bible §2.5）时 tween `glitch_deviation` material 的 `intensity`（0→peak→0）。⚠️ 需该 ColorRect 所在 CanvasLayer 的 layer 序 > 世界层（读 SCREEN_TEXTURE 后处理），**[待程基岩确认]** 叠层级序。
4. **减少动效设置**：设置菜单（ux-spec §11.1）→ `juice.set_reduce_motion(bool)`。
5. **hit_flash 升级**（可选）：`enemy.gd` 现有 modulate 灰闪（L297）可换为 `hit_flash.gdshader` 的 `flash` 参数 tween（更高质感），engineer 择一。

---

## 8. 已知风险与对齐标注

1. **既有 pre-existing 解析报错（非本任务）**：`--import` 时 `rewrite_causality_engine.gd`/`quest_system.gd`/`save_manager.gd` 报「Could not find type `CausalLinksData`/`RewriteNodeData`/`QuestNodeDispatchData`/`ChapterData`」等——经核这些类型**在任何 .gd 中均未定义 class_name**（既有缺陷），且这些文件**未被本任务改动**（`git status` 仅 world.tscn + 新增 juice/shaders）。本任务 EXIT=0、新增文件零报错。**建议主理人派独立 issue 修复**（属 rewrite/quest 系统，非 art-director 范围，红线不顺手改）。
2. **占位美术无缝/字形局限**：tile 4 折镜像对称、Tab 图标字形抽象（P5-10 §0.5.4），归 P7 手绘收口，非本任务。
3. **全局重调色待审批**：`world_color_grade.gdshader` 默认 intensity=0，[待主创审批 art-bible §11①②] 后启用（§1.3）。
4. **glitch 叠层级序**：读 SCREEN_TEXTURE 的后处理需 CanvasLayer layer 序正确（§7.3），[待程基岩确认]。
5. **命中停顿用 `Engine.time_scale`**：全局瞬态（0.045s），reduce_motion 时不启动；若未来与慢动作技能冲突，改 per-tree `process` 暂停（[待程基岩确认]）。

---

## 9. 待主创审批项（沿用 art-bible §11）

| # | 项 | 倾向 | 影响 |
|---|---|---|---|
| ① | 系统人格语气（冷峻 vs 毒舌记录员） | 冷峻 + 极轻微失真 | glitch/边框抖动幅度 |
| ② | 本土奇幻上限（朱黄墨晕强度） | 「兆头/小术」级 | 高 Δ glitch 与本土术法强度边界 |
| — | **本任务首版固化 hex 调色板（§1.1）** | 见表 | 全部资产/juice 的数值色源；越早冻结越省返工 |

---

*—— 林绘澄（art-director）· Phase 6 打磨（P6 视觉打磨与 juice）· juice 已落地接线 + 着色器/挂载代码通过 headless import · 待主创/工程评审*
