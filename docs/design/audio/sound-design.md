# 音频方向 + 音效设计文档 · 《赤壁·改写者》

> 阶段：Phase 6 · 打磨（P6-1）　|　执行角色：阮和鸣（audio-director）
> 文档版本：v0.1（首版，待主创评审）　|　状态：可评审
> 基线锚点：`AGENTS.md`「设计基线」表（2D 俯视角开放世界 ARPG / 改写·因果心脏 / 三国·赤壁 / 正剧+轻度 litRPG 元幽默+民间志怪式奇幻 / Godot 4.7.1 / GDScript / PC 优先 / Loop A）、`AGENTS.md`「Godot 4.7 约定」「多模态资产生成」节。
> 设计依赖（**显式引用**，本文件与之一致，不另立术语/触发点/命名）：
> - `docs/design/art/art-bible.md`（P1-2）——**§0 双轨反差总纲、§1.2 Mood Board、§2 双轨配色、§2.2 赤壁时代色温、§2.4 奇幻来源色相法则（青蓝 vs 朱黄绝不混用）、§2.5 Δ 视觉三档、§5.1 视觉 token 与 BGM token 行、§6 系统材质 / litRPG 爽感（数值跳动即时、UI 开合 200–350 ms）、§7 动效与帧预算、§9 命名空间（音频归阮和鸣）**。本文凡引用写作 `art-bible §x`。
> - `docs/design/gdd/game-concept.md`（P1-1）——**§1 术语（系统 / Δ / CP / v_i / 改写节点）、§2 三支柱、§3.3 美学（Narrative/Challenge/Sensation）、§6.2 分支 C「玩家自借触发系统特殊旁白」、§9① 系统人格基调待审批**。本文凡引用写作 `game-concept §x`。
> - `docs/design/gdd/systems/combat.md`（P2-5 / S4）——**§2.7 噪声半径感知（奔跑 160 / 行走 64 / 潜行 0、湿地 ×1.5）、§3.2 能力执行数据（`sfx_ref` 占位）、§3.4 警戒档位 `alert_level`、§6.2 HP/BF/警戒只读、§6.4 战斗表现资产归 S4 直接播放、§6.6 可访问性多通道红线、§7.4 朝代热切换**。本文凡引用写作 `combat §x`。
> - `docs/design/gdd/systems/mainline-quest.md`（P2-3 / S2）——**§3.2 系统语气文案（`system_dispatch_voice` / `system_complete_voice` / `system_vanish_voice`）、§6.2/§6.3 旁白播报契约**。本文凡引用写作 `mainline-quest §x`。
> - `docs/design/gdd/systems/rewrite-causality.md`（P2-2 / S1）——**§2.7 Δ 视觉三档、§4.4 反馈档位 I（minor/notable/critical）、§6.1 `feedback_tier` / `critical_deviation_triggered` 信号、Δ 与历史线分叉旁白**。本文凡引用写作 `rewrite-causality §x`。
> - `docs/design/gdd/systems/panel-progression.md`（P2-4 / S3）+ `docs/design/gdd/ux-spec.md`（P4-1）——**面板呼出/关闭、数值跳动、UI 开合 200–350 ms、记录员语气、系统材质**。本文凡引用写作 `panel-progression §x` / `ux-spec §x`。
> - `docs/design/gdd/systems-index.md`（P2-1）——**§2 S4/X1 边界、§6 横切实体归属（系统人格行 X1）、§1.2 X1/X5 定义**。本文凡引用写作 `systems-index §x`。
> - `docs/design/art/asset-manifest.md`（P4-2）——**音频资产占位归阮和鸣**。
> 本文件建立全作统一**听觉身份**，并把玩法/叙事触发点翻译成**音效设计文档 + 完整音频事件清单 + 实现策略**。音频是「双轨反差」(`art-bible §0`) 在听觉上的镜像：**两套音色调色板绝不混用**，用音色区分功劳归属（`game-concept §6.2` 分支 C）。**所有 Godot 精确 API 一律标 `[待程基岩确认]`，存疑即标注，不臆造。**

---

## 0. 文档边界与使用方式

- **是**：① 音乐方向与情感基调；② 声音调色板（双轨乐器/音色 token）；③ BGM 四态状态机（菜单/探索/战斗/抉择）；④ 音效设计 + 完整音频事件清单；⑤ 命名约定；⑥ 混音说明（总线结构）；⑦ Godot 4.7 音频实现策略；⑧ 可访问性（X5）。
- **不是**：不写程序逻辑（交程基岩 P3/P5）、不产美术资产（交林绘澄）、不定玩法数值（交文策渊）、不写系统旁白**文案**（文案归 S1/S2 文策渊，本文件只定**声线/语气/触发/演出规格**）。
- **范围**：覆盖**垂直切片 = 1 朝代（赤壁）+ Loop A 闭环**所需听觉身份与占位资产；多朝代 BGM 热切换仅作架构预留（`game-concept §7.3` 愿景，本切片不实现）。
- **资产现状**：BGM 四态 + 系统旁白 VO 三句已用 mmx 生成**真实占位资产**（`game/assets/audio/`）；SFX 因 mmx 无专用音效工具，**降级为纯规格**（详见 §4 + 资产清单附录）。
- **自验证**：文档走**结构核对**（八节齐备 / 命名与 GDD 占位引用一致 / 事件清单可被代码按命名读取）；Godot headless `--import --quit` 跑通过（资产被 `.import` 引入，§9）。

---

## 1. 音乐方向 / 情感基调

> 把 `AGENTS.md` 基线「正剧 + 轻度 litRPG 元幽默 + 民间志怪式奇幻（非纯修仙）」翻译成**听觉情感曲线**，并与 `art-bible §1.2 Mood Board`、`§2 配色`、`§2.2 赤壁色温`做**情绪协同**（视觉暖冷 → 听觉暖冷同源）。

### 1.1 一句话听觉总纲

> **「双轨反差」即听觉签名**：轨道 A（历史世界·暖）用**东方原声民族乐器 + 水墨留白**；轨道 B（系统·冷）用**冷光电子音色 + 几何质感**；二者**同屏并存的张力**本身就是本作的声音——与 `art-bible §0` 视觉双轨一一镜像。**两套音色绝不混入同一条总线层**（§2 纪律），用音色区分功劳归属（`game-concept §6.2` 分支 C：玩家自借东风 = 系统特殊旁白 + 青蓝冷光音，诸葛亮借风 = 朱黄墨晕暖音）。

### 1.2 情感基调四关键词（锚 `art-bible §1.2`）

| 听觉关键词 | 对应美术 Mood（`art-bible §1.2`） | 赤壁色温锚（`art-bible §2.2`） | 听觉落点 |
|---|---|---|---|
| **氤氲留白**（ink-wash / restraint） | 世界基底：焦墨/淡墨 + 留白 | 宣纸黄、大地焦墨 | 大量负空间（silent/negative space）：古琴泛音、箫的长气口、环境留白；忌铺满 |
| **民间志怪的克制**（folk-supernatural / understated） | 志怪层：墨晕 + 符箓暖光 | 朱黄（奇幻子集） | 偶发本土音色（木鱼/钟磬/纸响）作兆头，**点到为止**；禁金光大佛/御剑飞行式轰鸣（呼应「非纯修仙」） |
| **战火的厚重**（earthy / gongbi heavy） | 战火主题：朱赤 × 墨青江 | 朱砂赤、冷金营火 | 战鼓 + 紧密打击 + 擦弦张力，工笔重彩式的**厚重但不爆裂**；火焰用低频咆哮 + 沙质噪声 |
| **系统的冷光几何**（holographic / cold cyan） | 系统层：青蓝数据光 | 系统青蓝、数据白、警示橙红 | 低饱和合成 pad、数字粒子音、扫描频率音；冷、脆、几何；**仅在系统叠层 / 改写面板 / 抉择态出现** |

### 1.3 情感曲线（与 Loop A 同频）

> 听觉随核心循环 Loop A（`game-concept §5`）起伏，与 `rewrite-causality §4.4` 反馈档位 I（minor/notable/critical）联动：

```
菜单(氤氲·开场) → 探索(留白·求知·志怪兆头) → 改写/抉择(冷光·张力·系统介入) → 战斗(战火·紧迫·秒级) → 反馈(Δ 旁白·历史线分叉) → 回探索
                                                  ↑
                                          Δ 三档驱动旁白量级（minor 静默 / notable 短旁白 / critical 长演出+世界线震荡 glitch 音）
```

- **正剧为底**：常态听觉是**克制的东方留白**，不让音乐抢戏（守 `systems-index §8` 认知过载；音乐是「探索/正剧沉浸」的衬底，不是主角）。
- **litRPG 爽感为点睛**：仅在系统面板/数值跳动/反馈时给**即时、脆、几何**的冷光音效（`art-bible §6` litRPG 面板气质；Sensation 美学，`game-concept §3.3`）——爽感来自**UI 反馈音**，不来自 BGM 喧闹。
- **元幽默的边界**（`game-concept §9①` 待审批）：系统旁白按「**冷峻第三方观测者/记录员**」人格倾向撰写语气（`mainline-quest §3.2` 文案已落地），元幽默**仅限系统注释/UI 弹窗的旁白语气**，绝不渗入 BGM 与世界环境音——听觉上 BGM/环境音永远是正剧底色，只有系统旁白 VO 带「记录员」人格。

### 1.4 与 art-bible 的情绪协同表（验收锚）

| art-bible 视觉情绪 | 本文件听觉对应 | 协同方式 |
|---|---|---|
| §1.2 世界基底（ink-wash 留白） | 古琴泛音 + 箫长气口 + 环境负空间（探索态） | 视觉留白 = 听觉留白（同步克制） |
| §2.2 江水青墨 × 战火朱赤 | 探索 = 墨青冷调环境；战斗 = 朱赤暖调打击 | 色温冲突 → 听觉冷暖切换（探索→战斗） |
| §2.2 冷金营火（暖光安全） | 营寨/存档点 ambient 暖低频 hum（目标态） | 视觉安全锚 = 听觉安全锚 |
| §2.5 Δ 三档（minor 稳 / notable 冷光描边 / critical glitch） | Δ 反馈音三档：minor 弱 tick / notable 冷光扫频 / critical glitch 撕裂（§4） | Δ 视觉档 = Δ 听觉档（一一对应） |
| §6 litRPG 数值跳动即时 | UI 数值跳动即时 tick 音（无延迟） | 视觉即时 = 听觉即时（Sensation） |

---

## 2. 声音调色板（乐器 / 音色 / 质感 token）

> 落地 `art-bible §2.4` 奇幻色相法则在听觉上的镜像：**两套音色调色板绝不混用**。同一场戏用音色区分功劳归属（`game-concept §6.2` 分支 C）。

### 2.1 轨道 A · 本土志怪（朱黄墨晕 · 暖 · 原声）

> 服务「历史世界 + 本土志怪奇幻」。**世界、环境、NPC、本土术士（诸葛亮借风）、战火**全部走此轨。

| token | 乐器/音色 | 质感 | 用途 |
|---|---|---|---|
| `inst_guqin` | 古琴（泛音为主） | 氤氲、留白、木质感 | 探索/菜单基底，正剧底色主奏 |
| `inst_xiao` | 箫/竹笛（长气口） | 苍凉、悠远 | 探索/菜单副旋律，江岸旷远感 |
| `inst_erhu` | 二胡（擦弦张力） | 哀婉、紧张 | 战斗张力、悲伤过场 |
| `inst_war_drums` | 战鼓/建鼓 | 厚重、紧迫 | 战斗态节奏基底（赤壁战火） |
| `inst_perc_tight` | 紧密打击（鼓/木鱼/钹） | 节奏驱动 | 战斗态节奏推进 |
| `inst_folk_omen` | 木鱼/钟磬/纸响（克制兆头音） | 志怪兆头、点到为止 | 本土志怪奇遇/术士兆头（`art-bible §1.2` 志怪层） |
| `tex_fire_roar` | 低频咆哮 + 沙质噪声（火） | 厚重、工笔重彩 | 战火 VFX（朱赤火 + 墨烟，`art-bible §7.2`） |
| `tex_water_ink` | 墨青江水低频 wash + 偶发浪纹 | 氤氲、流动 | 江水环境（赤壁江） |
| `tex_reed_wind` | 芦苇摩擦 + 风声（受 `v_wind` 驱动走向，`art-bible §5.5`） | 自然、可读 | 江岸环境 + 风向信息音（N2 借东风） |

**纪律**：轨道 A 全程**暖、原声、留白**；战火厚重但不爆裂；志怪兆头克制，禁轰鸣。

### 2.2 轨道 B · 系统/冷光（青蓝几何 · 冷 · 合成）

> 服务「改写/因果系统」。**系统 UI、改写面板、系统术法、Δ 可视化、历史线分叉演出、系统旁白 VO 的底音**走此轨。

| token | 音色 | 质感 | 用途 |
|---|---|---|---|
| `inst_sys_pad` | 低饱和合成 pad（冷青色调） | 冷、几何、悬浮 | 抉择态 BGM 底、系统面板 ambient |
| `inst_sys_particle` | 数字粒子音（高频碎点） | 脆、几何、低饱和 | 系统术法 VFX（青蓝几何，`art-bible §7.2`）、面板粒子 |
| `inst_sys_scan` | 扫描频率音（sweep / sine glide） | 冷、数据感 | 改写「扫描/锁定」目标变量（`art-bible §7.2` 改写瞬间）、面板开合 |
| `inst_sys_glitch` | 故障撕裂音（bitcrush / digital noise burst） | 失真、警示 | 高 Δ 世界线震荡（`art-bible §2.5` critical 档）、`critical_deviation_triggered` |
| `inst_sys_warn` | 警示橙红音（中频脉冲） | 警示、克制 | 高 Δ 警告、重大偏差提示（`art-bible §2.1` 点睛 B 警示橙红） |
| `tex_sys_data_tick` | 等宽数据 tick（即时、脆） | 数据感、即时 | UI 数值跳动、CP/Δ/RE 数值滚动（litRPG 爽感，`art-bible §6`） |

**纪律**：轨道 B 全程**冷、脆、几何**；只在**系统叠层（L5）/ 改写面板 / 抉择态 / 系统术法 VFX** 出现；**绝不污染轨道 A 的世界环境音**（呼应 `art-bible §3.2` 叠层纪律：冷光只在 L5）。

### 2.3 双轨绝不混用纪律（核心色相法则 · `art-bible §2.4` 镜像）

| 同一戏剧情境 | 轨道 A（暖）怎么做 | 轨道 B（冷）怎么做 | 不混用验证 |
|---|---|---|---|
| **借东风（N2）**——诸葛亮借（本土） | 朱黄墨晕 + `inst_folk_omen` + `tex_reed_wind` 走向反转 | （不介入） | 诸葛借风 = 纯暖音；功劳归本土 |
| **借东风（N2）**——玩家自借（系统，分支 C） | （世界仍暖底，但**不强化**暖奇幻音） | 青蓝几何 + `inst_sys_scan` + 系统特殊旁白 VO | 玩家自借 = 冷光音 + 系统旁白；功劳归玩家（`game-concept §6.2`） |
| **术法爆裂** `sfx_system_magic_burst` | （敌方本土术若有，用 `inst_folk_omen`） | `inst_sys_particle` + `inst_sys_scan`（青蓝几何） | 玩家系统术法 = 冷光；本土术士 = 暖；**同屏不混** |
| **受击反馈** | 世界打击音（刀剑碰撞，暖侧物理音） | （不介入，受击是世界事件） | 受击走世界物理音（S4 直接播放，`combat §6.4`） |

> ⚠️ **漂移红线**：若系统冷光音铺满世界（变成「赛博三国」电子乐），或系统面板/旁白退化成民族乐器（失去 litRPG 系统感），则「双轨反差」崩塌——与 `art-bible §0` 视觉反例同源。**两套调色板总线分层隔离**（§6），从混音层面保证不混。

---

## 3. 动态层级（BGM 状态机）

> 四态听觉身份：**菜单 / 探索 / 战斗 / 抉择**。落地 `AGENTS.md`「朝代 = TileSet + 遭遇表 + BGM」组合热切换（朝代包引用一组 BGM），与 `combat §7.4` 朝代热切换、`art-bible §5.1` BGM token 行对接。

### 3.1 四态定义与资产

| 状态 | 听觉身份 | 主导调色板 | 占位资产 | mmx 生成 prompt 摘要（对齐 art-bible 情绪） |
|---|---|---|---|---|
| **菜单 `menu`** | 水墨开篇卷轴 + 系统冷光标题叠（`art-bible §6.2` 主菜单） | A 为主（古琴+箫留白），B 仅标题入场一瞬 | `bgm_menu.mp3` ✅ | 传统水墨氛围开场，古琴与箫，疏离留白，三国 melancholic grandeur，慢板 |
| **探索 `explore`** | 赤壁江岸求知 · 志怪兆头偶发 | A（古琴+箫+环境 wash） | `bgm_explore.mp3` ✅ | 探索 ambient 民族，古琴竹笛，墨青江岸，神秘张力，克制 |
| **战斗 `combat`** | 朱赤战火 · 秒级紧迫（Loop B，`combat §1.1`） | A（战鼓+紧密打击+二胡张力） | `bgm_combat.mp3` ✅ | 紧迫战斗，战鼓紧密打击，二胡张力，赤壁战火，驱动但不爆裂 |
| **抉择 `choice`** | 改写面板/系统决策 · 冷光张力 | **B 为主**（合成 pad + 弱古琴点） | `bgm_choice.mp3` ✅ | 冷氛围决策音乐，极简古琴点 + 电子 pad，全息青蓝数据感，权衡命运 |

> 占位资产均为 mmx `music-3.0` **纯器乐**（`--instrumental`）生成；规格与命名见 §5、资产清单附录。

### 3.2 状态机：触发条件与过渡

```
                  ┌──────────┐
          ┌──────▶│  menu    │◀──── 启动 / 回主菜单
          │       └────┬─────┘
          │            │ 开始新存档/读档 → crossfade 1.5s
          │            ▼
          │       ┌──────────┐  进入遭遇(alert≥2 发现/交战, combat §2.7)  ┌──────────┐
          │       │ explore  │──────────────────────────────────────────▶│  combat  │
          │       │          │◀───────────── 脱战(lose_target_time=6s, alert 衰减回未察觉) ┤
          │       └────┬─────┘            crossfade 1.0s (入) / 1.5s (出)        └──────────┘
          │            │ 打开改写面板 (S3 RewritePanel, ux-spec §3.1)
          │            │   ↓ BGM duck −6dB + 切 choice
          │            ▼
          │       ┌──────────┐
          │       │  choice  │── 关闭改写面板 → 回上一态(explore/combat)
          │       └──────────┘   crossfade 0.8s
          │
          └── 关卡/节点结算 → 历史线分叉演出(STG, ux-spec) → 回 explore
```

**触发条件（与 GDD 信号对齐，零臆造）**：
- `menu ↔ explore`：场景加载（`boot.tscn → world.tscn`，`ux-spec §3.1`）。
- `explore → combat`：`combat §2.7` `alert_level` 升到 `发现(2)/交战(3)`（S4 发 `combat_alert_changed`/`alert_state_changed`）。**MVP 简化**：玩家进入 S5 遭遇触发区即切战斗态（`combat §2.1`）。
- `combat → explore`：脱战（`lose_target_time=6s` + `alert` 衰减回 `未察觉`，`combat §2.7`）。
- `explore/combat → choice`：玩家打开改写面板（S3 `RewritePanel`，`ux-spec §3.1` RewritePrompt）。**choice 优先级最高**（玩家主动暂停世界改写，§6 duck 规则）。
- 任意 → 历史线分叉演出（STG）：`rewrite-causality §4.4` `feedback_tier` 锁定结算触发；演出结束回 `explore`。

**过渡手法**：
| 过渡 | 手法 | 时长 | 理由 |
|---|---|---|---|
| menu → explore | 长交叉淡化（crossfade） | 1.5 s | 开场仪式感，留白承接 |
| explore → combat | 横切（stinger 过门）+ 快 crossfade | 0.5 s | 战斗突发，需即时紧张（`combat §1.1` 秒级） |
| combat → explore | crossfade | 1.5 s | 脱战舒缓，忌硬切出戏 |
| → choice（改写面板开） | 当前 BGM duck −6 dB + 叠 choice pad | 0.8 s | 玩家「进入系统空间」的冷光侵入感（不改断世界音，呼应双轨并存） |
| 历史线分叉演出 | choice/combat BGM duck −12 dB，演出用专门 sting + 旁白 VO | — | 演出为情感峰值，旁白为王（VO 总线最高优先级，§6） |

### 3.3 与「朝代 = TileSet + 遭遇表 + BGM」热切换对接字段

> 落地 `AGENTS.md` Godot 约定 + `combat §3.6` / `mainline-quest §3.5` 朝代热切换口。朝代包引用一组 BGM（按状态），引擎按 `active_dynasty` 加载。**本切片单朝代，结构预留多朝代**。

朝代音频包字段（建议落 `game/data/<dynasty>/audio_pack.tres`，`[待程基岩确认]` 资源类）：

```yaml
dynasty: dyn_threekingdoms_chibi          # art-bible §5.1 / §9.1 命名空间
bgm_refs:                                  # 四态 BGM 引用（按状态键）
  menu:   bgm_menu                         # res://assets/audio/bgm_menu.mp3
  explore: bgm_explore
  combat: bgm_combat
  choice: bgm_choice
# —— 朝代专属环境音床（目标态，MVP 用 explore BGM 顶替）——
ambient_bed_refs:                          # 世界环境音（轨道 A，可被 v_i 驱动）
  river:        sfx_ambient_river_loop     # 墨青江水 wash
  reed_marsh:   sfx_ambient_reed_loop      # 芦苇荡（受 v_wind 驱动，art-bible §5.5）
  camp_night:   sfx_ambient_camp_loop      # 冷金营火暖低频
vo_voice_profile:                          # 系统旁白声线（多朝代可换声线）
  system_narrator: "calm_neutral_male"     # 见 §4.3 VO 声线
```

> ✅ **热切换验收**：换朝代 = 换 `audio_pack.tres`（换 BGM 引用 + 环境音 + 声线），状态机逻辑（§3.2）朝代无关——与 `combat §3.6`「公式朝代无关，换数据包」、`mainline-quest §3.5`「换章节包」同构。

---

## 4. 音效设计文档 + 完整音频事件清单

> 逐交互/事件给（触发条件 / 优先级 / 变体数 / 分层 / 距离衰减 / 总线归属）。**至少覆盖** issue 点名的触发点（战斗 / 改写·因果 / 系统旁白 VO / UI·面板）。

### 4.1 字段定义（统一 schema）

| 字段 | 含义 |
|---|---|
| **事件 ID** | 按 §5 命名约定，可与代码 `sfx_ref`/`vo_*` 字段一一对应（`combat §3.2`） |
| **触发条件** | 来自哪个系统/信号（零臆造，回引 GDD 节号） |
| **优先级** | `P0`(必须听见，如 VO/受击) / `P1`(重要反馈，命中/术法) / `P2`(氛围/重复，脚步/环境) |
| **变体数** | 防单调的随机变体数（首版倾向） |
| **分层** | 单层 / 双层（底+顶）/ 三层（底+中+顶） |
| **距离衰减** | 2D 衰减半径 px（对齐 `combat §2.7` 噪声半径量级，Tile=64px） |
| **总线** | §6 总线归属（BGM/SFX/VO，再分子轨） |
| **资产状态** | ✅ 已生成 / ⏳ 规格待产（mmx 无 SFX 工具，降级） |

### 4.2 战斗音效（`combat §3.2` `sfx_ref` / §6.4 S4 直接播放）

| 事件 ID | 触发条件 | 优先级 | 变体 | 分层 | 衰减 | 总线 | 状态 |
|---|---|---|---|---|---|---|---|
| `sfx_player_attack_swing` | 普攻挥砍（`combat §2.3` `attack_n` active 帧） | P1 | 3 | 单层（空气切割 whoosh） | 近场 96px | SFX/combat | ⏳ |
| `sfx_player_attack_hit` | 普攻命中盒命中敌人（`combat §2.3`） | P1 | 3（金属/肉体/护甲） | 双层（打击 + 材质） | 160px | SFX/combat | ⏳ |
| `sfx_player_hurt` | **玩家受击多通道反馈**之一（`combat §6.6` / `art-bible §2.3` 红线：红光＋震屏＋**音效**） | **P0** | 2（轻/重） | 双层（闷击 + 玩家闷哼底） | 全场（玩家自身） | SFX/combat | ⏳ |
| `sfx_player_dodge` | 闪避翻滚（完整集，`combat §2.4`） | P1 | 2 | 单层（布料+落地） | 近场 96px | SFX/combat | ⏳ 完整集 |
| `sfx_system_magic_burst` | **术法爆裂**（青蓝几何轨，`combat §3.2` 占位引用；`ability_system_combat_burst`） | P1 | 2 | 三层（`inst_sys_scan` 蓄 + `inst_sys_particle` 爆 + 余响） | 256px | **SFX/system_magic（轨道 B 子轨）** | ⏳ |
| `sfx_system_magic_wind` | 玩家自借东风术法（`ability_system_magic_wind`，rewrite_proxy，`combat §3.2`） | P1 | 1 | 三层（`inst_sys_scan` + 风 + 系统余响） | 384px | SFX/system_magic | ⏳ |
| `sfx_npc_attack_swing` | 敌人挥砍预备（`combat §2.8`，攻击 windup 帧） | P2 | 2 | 单层 | 128px | SFX/combat | ⏳ |
| `sfx_npc_alert_suspicious` | 敌人升 `警戒(1)`（`combat §2.7`）——脚步转向/疑问哼声 | P2 | 2 | 单层 | 192px | SFX/alert | ⏳ |
| `sfx_npc_alert_detected` | 敌人升 `发现(2)`（喊叫联动周围，`combat §2.7`） | P1 | 2 | 双层（喊 + 警锣） | 320px | SFX/alert | ⏳ |
| `sfx_npc_death` | 敌人倒地（`combat §2.9`，移除战斗实体） | P2 | 2 | 双层（倒地 + 材质） | 160px | SFX/combat | ⏳ |
| `sfx_player_footstep_<sprint/walk/crouch>` | 脚步噪声（**驱动感知半径**：sprint 160 / walk 64 / crouch 0 px，`combat §2.7`） | P2 | 4/态 | 单层 | = 噪声半径（湿地 ×1.5，`combat §3.4`） | SFX/foley | ⏳ |
| `sfx_alert_state_change` | `alert_level` 跨档 UI 提示音（S4 `alert_state_changed`，`combat §6.1`） | P1 | 1/档 | 单层（`inst_sys_warn` 脉冲） | UI（无衰减） | SFX/ui | ⏳ |

> ⚠️ **多通道反馈红线**（`combat §6.6` / `art-bible §2.3`）：受击、重大命中、术法爆裂须**红光/震屏/音效三通道并存**，不可仅靠颜色/仅靠音效。音效是其中一通道，**非替代**。可访问性削弱见 §8。

### 4.3 系统旁白 VO（X1 触发，`systems-index §6` 系统人格行 · `mainline-quest §6.3`）

> 「系统」人格 = **冷峻第三方观测者/记录员**（`game-concept §9①` **待审批**，按倾向撰写留接口）。VO 文案归 S1/S2（文策渊），**声线/语气/演出归本文件 + X1**。VO 总线**最高优先级**，侧链压低 BGM/SFX（§6）。

| 事件 ID | 触发条件 | 优先级 | 文案（来自 GDD，本文件只定声线） | 声线（占位） | 总线 | 资产 |
|---|---|---|---|---|---|---|
| `vo_system_dispatch` | 派单旁白（`mainline-quest §6.2` `quest_dispatch_voiced` / `node_activated`） | **P0** | 「已锁定目标：借东风。当前节点偏差归零。记录员就位。」（`mainline-quest §3.2`） | 冷静中性男声 | VO | ✅ `vo_system_dispatch.mp3` |
| `vo_system_complete` | 完成旁白（`node_resolved`，`mainline-quest §3.2`） | **P0** | 「节点已确认。偏差已记录，因果已传递。」 | 冷静中性男声 | VO | ✅ `vo_system_complete.mp3` |
| `vo_system_vanish` | 消失旁白（`node_vanished`，`mainline-quest §3.2`） | **P0** | 「目标节点未触发存在条件。世界线已重排。」 | 冷静中性男声 | VO | ✅ `vo_system_vanish.mp3` |
| `vo_system_branch_c`（目标态） | 玩家自借东风分支 C（`game-concept §6.2` / `rewrite-causality §3.2` `triggers_system_voice`） | P0 | （文案待 S1 定，倾向「检测到：历史偏差源归于观测者。记录在案。」） | 冷静中性男声 + 极轻微冷光底音 | VO | ⏳ 待文案 |
| `vo_system_delta_critical`（目标态） | `critical_deviation_triggered`（`rewrite-causality §6.1`） | P0 | （倾向「警告：世界线剧烈震荡。」+ glitch 底音） | 冷静中性男声 + `inst_sys_glitch` | VO | ⏳ 待文案 |

**占位声线选择**：mmx `speech synthesize`，音色 `Chinese (Mandarin)_Male_Announcer`（冷静中性播报员，最贴近「冷峻记录员」倾向）。⚠️ **声线待主创审批**（`game-concept §9①`）：若主创定「带点毒舌的记录员」，换声线（如 `Chinese (Mandarin)_News_Anchor` 或调整 speed/pitch）即可，**不改 VO 触发逻辑**。模型用 mmx 默认 `speech-2.8-hd`（issue 提及 `speech-2.6-hd`，mmx CLI 默认升级到 2.8-hd，质量更高，向后兼容）。

### 4.4 改写/因果音效（Δ 反馈 · `rewrite-causality §2.7` / §4.4 / §6.1）

| 事件 ID | 触发条件 | 优先级 | 变体 | 分层 | 衰减 | 总线 | 状态 |
|---|---|---|---|---|---|---|---|
| `sfx_system_delta_minor` | Δ 实时预览变化（`deviation_recomputed(is_preview=true)`，`rewrite-causality §6.1`），低 Δ | P2 | 1 | 单层（弱 `tex_sys_data_tick`） | UI | SFX/ui | ⏳ |
| `sfx_system_delta_notable` | Δ 进 notable 档（`rewrite-causality §4.4`） | P1 | 1 | 双层（`inst_sys_scan` + tick） | UI | SFX/system_magic | ⏳ |
| `sfx_system_delta_critical` | Δ ≥ `Δ_critical`（critical 档，`rewrite-causality §4.4/§4.5`） | **P0** | 1 | 三层（`inst_sys_glitch` 撕裂 + `inst_sys_warn` + 低频震） | UI | SFX/system_magic | ⏳ |
| `sfx_system_rewrite_lock` | 改写「扫描/锁定」目标变量瞬间（`art-bible §7.2` 改写瞬间：扫描→冷光描边→`v_i` 浮标） | P1 | 1 | 双层（`inst_sys_scan` 锁定 + `tex_sys_data_tick`） | UI | SFX/system_magic | ⏳ |
| `sfx_system_cp_tick` | CP 入账数值跳动（`cp_awarded`，`rewrite-causality §6.1`，即时 litRPG 爽感 `art-bible §6`） | P2 | 1 | 单层（即时脆 tick） | UI | SFX/ui | ⏳ |
| `sfx_system_variable_changed` | `v_i` 改变（`rewrite-causality §6.1` `variable_changed` → S5 切 `world_visual`） | P2 | 1 | 单层（数据确认音） | UI | SFX/system_magic | ⏳ |
| `sfx_timeline_branch` | 历史线分叉演出 sting（STG，`ux-spec`；`feedback_tier` notable/critical） | P1 | 2（notable/critical） | 双层（冷光扫 + 时间轴拉开） | UI/演出 | SFX/system_magic | ⏳ |

### 4.5 UI / 面板音效（`panel-progression` + `ux-spec` + `art-bible §6`）

> litRPG 爽感来自 **UI 反馈音的即时性**（`art-bible §6`：开合 200–350 ms 冷光扫描展开，数值跳动即时）。所有 UI 音走**轨道 B 冷光**（`inst_sys_scan`/`tex_sys_data_tick`）。

| 事件 ID | 触发条件 | 优先级 | 变体 | 时长 | 总线 | 状态 |
|---|---|---|---|---|---|---|
| `sfx_ui_panel_open` | 系统面板/改写面板呼出（`ux-spec §3.1`，`art-bible §7.3` 200–350 ms 扫描展开） | P1 | 1 | 200–350 ms（`inst_sys_scan` 上行） | SFX/ui | ⏳ |
| `sfx_ui_panel_close` | 面板关闭 | P1 | 1 | 150–250 ms（`inst_sys_scan` 下行） | SFX/ui | ⏳ |
| `sfx_ui_hover` | 控件焦点（手柄/键盘焦点框，`ux-spec §2`） | P2 | 1 | <80 ms（弱 tick） | SFX/ui | ⏳ |
| `sfx_ui_confirm` | 确认/提交（如改写「确认改写」按钮，`rewrite-causality §2.1⑦`） | P1 | 1 | 100 ms（锁定音） | SFX/ui | ⏳ |
| `sfx_ui_cancel` | 取消/返回 | P2 | 1 | 80 ms（短下行） | SFX/ui | ⏳ |
| `sfx_ui_value_tick` | 数值跳动滚动（HP/BF/CP/Δ/RE，`panel-progression §6.5` HUD，即时） | P2 | 1 | 即时（每跳一次） | SFX/ui | ⏳ |
| `sfx_ui_skill_unlock` | 技能解锁（`ability_unlocked` S3→S4，`panel-progression §6.3`） | P1 | 1 | 300 ms（冷光展开+确认） | SFX/system_magic | ⏳ |
| `sfx_ui_error` | 操作失败（如 RE 不足、未在改写场所，`combat §5.4`） | P1 | 1 | 120 ms（`inst_sys_warn` 短脉冲） | SFX/ui | ⏳ |

### 4.6 世界/环境音（轨道 A · 目标态，MVP 用 BGM 顶替）

| 事件 ID | 触发条件 | 优先级 | 衰减 | 总线 | 状态 |
|---|---|---|---|---|---|
| `sfx_ambient_river_loop` | 赤壁江环境床（常驻，`art-bible §5.2`） | P2 | 全场（音量低） | SFX/ambient | ⏳ 目标态 |
| `sfx_ambient_reed_loop` | 芦苇荡（**受 `v_wind` 驱动强度/走向**，`art-bible §5.5`） | P2 | 区域 | SFX/ambient | ⏳ 目标态 |
| `sfx_ambient_camp_loop` | 营寨/存档点暖低频（冷金营火安全锚，`art-bible §2.2`） | P2 | 区域 | SFX/ambient | ⏳ 目标态 |
| `sfx_fire_loop` | 战火（朱赤火+墨烟，`art-bible §7.2`，受风向影响） | P1 | 区域 | SFX/combat | ⏳ 目标态 |

> **MVP 范围对齐 `game-concept §7.1`**：MVP 听觉身份 = 四态 BGM + 系统旁白 VO 三句 + 战斗/改写/UI **核心 SFX 子集**（普攻挥砍/命中/受击/术法爆裂/UI 开合/Δ 反馈音）；环境音床、闪避音、目标态旁白（branch_c/critical）列为**目标态**，本切片不强制产。

---

## 5. 命名约定（`art-bible §9` 音频归阮和鸣）

> 与 `game/data/*.tres` 字段**一一可对应**（`combat §3.2` `sfx_ref` / `vfx_ref`；`art-bible §9.5` 数据驱动对接）。

### 5.1 总则

- 一律 **小写蛇形 `snake_case`**，禁空格/中文/大写（与 `art-bible §9.1` 一致）。
- 结构：`<类别前缀>_<主体>[_<状态/变体>]`。
- **朝代命名空间 `dyn_threekingdoms_chibi`**：音频资产默认**不带朝代后缀**（四态 BGM、通用 SFX/VO 跨朝代复用引擎层）；**朝代专属环境音/声线**通过朝代音频包 `audio_pack.tres` 的 `dynasty` 字段 + 引用区分（§3.3）。多朝代扩展换 `audio_pack` 引用即可，无需给每个文件加 `_dyn_xxx` 后缀（与 `combat §3.6`「换数据包不换公式」同构）。

### 5.2 类别前缀

| 前缀 | 含义 | 示例 |
|---|---|---|
| `bgm_` | 背景音乐（四态 / 朝代包引用） | `bgm_menu`、`bgm_explore`、`bgm_combat`、`bgm_choice` |
| `sfx_` | 音效（交互/事件/环境） | `sfx_system_magic_burst`、`sfx_player_attack_hit`、`sfx_ui_panel_open` |
| `vo_system_` | 系统旁白配音（X1，「记录员」人格） | `vo_system_dispatch`、`vo_system_complete`、`vo_system_vanish` |
| `sfx_ambient_` | 环境音床（轨道 A 世界床，目标态） | `sfx_ambient_river_loop`、`sfx_ambient_reed_loop` |

### 5.3 来源/子系统 token（sfx_ 主体内）

| token | 含义 | 调色板归属 | 示例 |
|---|---|---|---|
| `system` | 系统术法/改写/冷光（轨道 B） | **B（青蓝）** | `sfx_system_magic_burst`、`sfx_system_delta_critical`、`sfx_ui_skill_unlock` |
| `player` | 玩家行为（普攻/闪避/脚步，世界物理音） | A（物理音，非奇幻） | `sfx_player_attack_hit`、`sfx_player_footstep_sprint` |
| `npc` | 敌人/NPC（攻击/警戒/死亡） | A | `sfx_npc_alert_detected` |
| `ui` | 系统 UI（面板/数值/确认，轨道 B 冷光） | **B（青蓝）** | `sfx_ui_panel_open`、`sfx_ui_value_tick` |
| `alert` | 警戒态（S4 `alert_level`） | A（世界）+ 警示 | `sfx_npc_alert_detected` |
| `timeline` | 历史线分叉演出 | **B（冷光）** | `sfx_timeline_branch` |
| `ambient` | 世界环境床 | A | `sfx_ambient_river_loop` |

### 5.4 状态/变体后缀（沿用 `art-bible §9.4` 精神）

| 后缀 | 含义 | 示例 |
|---|---|---|
| `_loop` | 循环音（环境床/BGM） | `sfx_ambient_river_loop` |
| `_v<n>` | 随机变体编号 | `sfx_player_attack_hit_v02` |
| `_<sprint/walk/crouch>` | 玩家 stance（对齐 `combat §2.7` 噪声半径） | `sfx_player_footstep_sprint` |
| `_<minor/notable/critical>` | Δ 反馈档位（对齐 `rewrite-causality §4.4` I 档） | `sfx_system_delta_notable` |

### 5.5 与已有 GDD 占位引用的一致性（验收）

- `combat §3.2` `sfx_ref: sfx_system_magic_burst` —— ✅ 本文件 `sfx_system_magic_burst`（§4.2）一字不差。
- `combat §3.2` `sfx_ref: sfx_system_magic_wind`（`ability_system_magic_wind`） —— ✅ §4.2 `sfx_system_magic_wind`。
- `mainline-quest §3.2` `system_dispatch_voice`/`system_complete_voice`/`system_vanish_voice` —— ✅ 本文件 `vo_system_dispatch`/`vo_system_complete`/`vo_system_vanish`（§4.3），文案逐字沿用。

---

## 6. 混音说明（总线结构）

> Godot 4.7 原生 `AudioServer` / Bus 实现（`[待程基岩确认]` 精确节点/效果类，本文不臆造 API；Godot 4.x 已知稳定能力：`AudioServer` 总线管理、`AudioStreamPlayer`/`2D`/`3D`、总线效果链 `AudioEffectLimiter`/`Compressor`）。

### 6.1 总线树（建议 `default_bus_layout.tres`）

```
Master                                              [Limiter −1 dBTP 防削顶]
 ├── BGM                                            [低通滤波（可选）+ duck 受 VO 侧链]
 │    ├── bgm_menu / bgm_explore / bgm_combat / bgm_choice  （四态互斥播放）
 ├── SFX                                            [duck 受 VO 侧链 −3dB]
 │    ├── SFX/combat        （战斗打击/受击/挥砍/术法爆裂）
 │    ├── SFX/system_magic  （轨道 B 冷光：系统术法/Δ/改写锁定/分叉）
 │    ├── SFX/ui            （面板开合/数值跳动/确认 —— 轨道 B）
 │    ├── SFX/foley         （脚步/物理 foley —— 轨道 A 物理音）
 │    ├── SFX/alert         （警戒态）
 │    └── SFX/ambient       （环境床 —— 轨道 A）
 └── VO                                             [最高优先级；触发侧链压低 BGM/SFX]
      └── vo_system_*      （系统旁白，记录员人格）
```

### 6.2 响度基准（PC 平台 · 目标态，`[待 P6 剖析冻结]`）

| 总线 | 目标响度（LUFS，倾向） | 峰值上限（dBTP） | 说明 |
|---|---|---|---|
| Master | −16 LUFS（整游戏集成响度，PC 单机常用） | −1 dBTP（Limiter 防削顶） | 留 −1 dBTP 动态余量 |
| BGM | −20 LUFS（衬底，不抢戏） | −6 dBTP | 留白型东方音乐，动态保留 |
| SFX | −18 LUFS（瞬时高于 BGM） | −3 dBTP | 受击/命中 P0 事件可瞬时近 −3 dBTP |
| VO | −15 LUFS（**最响**，旁白为王） | −2 dBTP | 系统旁白必须清晰可辨（可访问性，§8） |

> ⚠️ 占位 mmx 资产响度**未做母带标准化**（mmx music 输出响度不固定，VO 为 32kHz/128kbps）；**响度基准为母带目标**，实际资产须在 P5/P6 经过程基岩在总线层用 `Limiter` + 分总线音量归一（或在资产导入后做响度匹配）。本文件给目标，不臆造已达标。

### 6.3 VO 侧链压低（ducking）

> 当系统旁白 VO 播放时，BGM/SFX 自动降低，保证旁白清晰。

- **实现倾向**（`[待程基岩确认]` 精确效果链）：Godot 4 的 `AudioEffectCompressor` **不直接暴露跨总线 sidechain 输入**的简单接口；**务实方案** = **信号驱动代码 duck**：VO `AudioStreamPlayer` 发 `started`/`finished` 信号 → 音频管理器对 BGM/SFX 总线 `AudioServer.set_bus_volume_db()` 做 −6/−3 dB 平滑过渡（`[待程基岩确认]` 用 `Tween` 或 `create_tween()`）。
- **真·侧链压缩**列为**目标态优化**（可能需 GDExtension/第三方），MVP 用代码 duck 足够。

### 6.4 距离衰减（2D 位置音效）

- 战斗/世界音效用 **`AudioStreamPlayer2D`**（`[待程基岩确认]` 精确衰减曲线参数 `max_distance`/`attenuation`/`easing`），衰减半径对齐 `combat §2.7` 噪声半径量级（sprint 160 / walk 64 px，湿地 ×1.5）与 §4.2 各事件「衰减」列。
- UI/VO/改写面板音用 **`AudioStreamPlayer`**（非位置，无衰减，全场）。
- BGM 用 **`AudioStreamPlayer`**（非位置，全局）。

---

## 7. 音频实现策略（Godot 4.7 原生 · 不臆造 API）

### 7.1 中间件选型：**Godot 4.7 原生 AudioServer/Bus，不引第三方中间件**

- 理由：垂直切片规模（四态 BGM + ~25 SFX + 3–5 VO）在 Godot 原生总线 + `AudioStreamPlayer` 能力内**完全够用**；引 FMOD/Wwise 增加构建/发布复杂度（`systems-index §1.2` 范围纪律）。多朝代/复杂混音目标态再评估。
- **存疑即标注**：以下 Godot 精确 API/效果类名一律 `[待程基岩确认]`，本文件不臆造：总线效果链精确类（`AudioEffectCompressor` sidechain 可行性）、`AudioStreamPlayer2D` 衰减曲线参数名、`AudioServer` 总线增删方法签名、`.mp3` 导入采样率策略。

### 7.2 事件实例化 / 池化

- **频繁/并发 SFX**（挥砍/命中/脚步/术法）用**对象池（pool）**或 Godot `AudioStreamPlayer` 复用，忌每次 `instance` 新节点（GC/性能，`art-bible §8.4` 性能纪律）。
- **BGM**：单态单 player，四态切换用 crossfade（§3.2），忌同时播多 BGM。
- **VO**：单 player 串行（系统旁白不并发，记录员一次说一句）。

### 7.3 同发语音数与内存预算（PC 平台 · `art-bible §8.4` 同源纪律）

| 维度 | MVP 倾向 | 目标态倾向 | 说明 |
|---|---|---|---|
| 同发 SFX 语音数（polyphony） | ≤ 8 | ≤ 16 | 战斗密集时受击+挥砍+脚步+术法并发；超出按优先级 `P0>P1>P2` 抢占（§4） |
| 同发 BGM | 1（+ choice 叠加时 2，duck） | 1–2 | 四态互斥；choice 可叠加 duck |
| 同发 VO | 1 | 1 | 串行，不并发 |
| 音频内存（解码流） | ≤ 64 MB | ≤ 128 MB | BGM 流式（不预解码全曲）；SFX 池预解码热集；PC 内存宽裕但仍守纪律 |

### 7.4 与 S4 / X1 的播放边界（`combat §6.4` / `systems-index §6`）

> **关键边界**：谁触发、谁播放。

| 音频类型 | 触发方 | 播放方 | 资产归 |
|---|---|---|---|
| **战斗表现音效**（挥砍/命中/受击/术法爆裂/敌人） | S4（战斗事件） | **S4 直接播放**（`combat §6.4`：S4 战斗表现资产由 S4 直接播放） | `sfx_*`（本文件命名） |
| **系统旁白 VO** | S1/S3（`node_resolved`/`node_vanished`/`feedback_tier`）/ S2（`node_activated` → `quest_dispatch_voiced`） | **X1 播放**（`systems-index §6` 系统人格行：旁白演出归 X1） | `vo_system_*` |
| **UI/面板音效** | S3（面板交互）/ S1（Δ/CP 反馈信号） | **S3/UI 层播放** | `sfx_ui_*` / `sfx_system_*` |
| **BGM 状态切换** | S4 alert / S5 场景加载 / S3 面板开合 | **音频管理器（建议 autoload 单例，`[待程基岩确认]`）播放** | `bgm_*` |

> ⚠️ **不越界**：S4 不播旁白 VO（那是 X1）；X1 不播战斗打击音（那是 S4）。资产命名遵循 §5，播放边界遵循本表。**本文件不实现代码，只定边界**——精确路由（autoload 单例名、信号订阅）`[待程基岩确认]`，建议 P3-1 架构 ADR 确认。

### 7.5 数据驱动对接（`AGENTS.md` 数据驱动约定）

- `combat §3.2` `sfx_ref` 字段引用本文件事件 ID（如 `sfx_ref: sfx_system_magic_burst`）——代码读 `sfx_ref` 字符串 → 查音频管理器事件表 → 播放。**事件 ID 即数据键**，无硬编码。
- BGM 四态引用落朝代包 `audio_pack.tres` `bgm_refs`（§3.3）。
- VO 文案落 S1/S2 数据（`system_*_voice` 字段，`mainline-quest §3.2`），声线/演出落 X1/本文件。

---

## 8. 可访问性（X5 · `systems-index §1.2`）

> 呼应 `combat §6.6` 多通道红线、`art-bible §2.3` 阵营色相红线、`art-bible §6.3` 字体可访问性。音频侧的可访问性选项：

| 选项 | 默认 | 作用 | 对齐 |
|---|---|---|---|
| **VO 字幕开关** `opt_vo_subtitle` | 开 | 系统旁白 VO 同步显示字幕（冷光等宽字，`art-bible §6.1`） | 听障友好；`game-concept §9①` 系统旁白须可读 |
| **字幕开关**（总） `opt_subtitle_all` | 开 | 所有 VO + 关键 SFX 提示字幕 | `combat §6.6` |
| **降低震屏对应音效削弱** `opt_reduce_motion_audio` | 关 | 开启「减少动效」时，受击震屏/Δ critical glitch 的**低频震感音**同步削弱（−6 dB），保留信息音 | `combat §6.6` 多通道：削震屏不删音效，只降冲击感 |
| **单声道降混** `opt_mono_downmix` | 关 | 立体声降混为单声道（单耳听障友好） | Godot 总线 `AudioEffectStereoEnhance` 反向 / 或 player channel=1 `[待程基岩确认]` |
| **VO 音量独立** | — | VO 总线独立音量滑块（保证旁白始终可听，玩家可调） | §6.3 侧链 + 独立音量双保险 |
| **BGM/SFX 独立音量** | — | BGM、SFX、VO、Master 四独立滑块（标准可访问性） | §6 总线树天然支持 |

> **多通道纪律**（`combat §6.6`）：受击/重大反馈 = 视觉（红光）+ 触觉/动效（震屏）+ **听觉（音效）** 三通道并存。可访问性选项**削弱某一通道**（如降震屏）**不删除其他通道**——降震屏时音效仍响（只降低频冲击感），保证信息不丢失。

---

## 9. 自验证（单代理自验证，跳过会审）

### 9.1 文档结构核对（八节齐备，issue §A 1–8）

- [x] §1 音乐方向 / 情感基调（对齐 art-bible §1.2/§2/§2.2 + 基线）✅
- [x] §2 声音调色板（双轨 A 朱黄 / B 青蓝，绝不混用，呼应 art-bible §2.4 + game-concept §6.2）✅
- [x] §3 动态层级（四态菜单/探索/战斗/抉择 + 切换触发/过渡 + 朝代热切换对接字段）✅
- [x] §4 音效设计 + 完整音频事件清单（战斗/改写·因果/系统旁白 VO/UI·面板全覆盖，含多通道受击、术法爆裂 `sfx_system_magic_burst`、潜行噪声半径、警戒、Δ 旁白、system_dispatch/complete/vanish、面板呼出/关闭/数值跳动 200–350ms）✅
- [x] §5 命名约定（`bgm_*`/`sfx_*`/`vo_system_*` 前缀，与 `sfx_system_magic_burst` 占位一致）✅
- [x] §6 混音说明（Master/BGM/SFX/VO 总线 + VO 侧链 + 响度基准 + 削顶/余量）✅
- [x] §7 音频实现策略（Godot 4.7 原生 + 池化 + 同发预算 + S4/X1 边界，存疑标注）✅
- [x] §8 可访问性（字幕/VO 字幕/降震屏削音/单声道降混）✅

### 9.2 命名与 GDD 占位引用一致性

- `sfx_system_magic_burst`（`combat §3.2`）✅ 一字不差
- `sfx_system_magic_wind`（`combat §3.2`）✅
- `vo_system_dispatch/complete/vanish` ↔ `system_dispatch/complete/vanish_voice`（`mainline-quest §3.2`）✅ 文案逐字沿用
- 事件清单可被代码按命名读取（`combat §3.2` `sfx_ref` = 本文件事件 ID）✅

### 9.3 听觉一致性自检

- 四态 BGM 不串轨：menu/explore/combat = 轨道 A（暖原声）；**choice = 轨道 B（冷光）**——四态中 choice 是唯一冷光主导态，与「改写面板 = 系统叠层」一致 ✅
- 两套调色板不混用：轨道 A（inst_guqin/xiao/erhu/war_drums/folk_omen）与轨道 B（inst_sys_pad/particle/scan/glitch/warn）**总线分层隔离**（§6 SFX/combat·foley·ambient = A；SFX/system_magic·ui + VO = B）✅
- VO 人格基调 = 冷静中性男声（`Chinese (Mandarin)_Male_Announcer`），与 `game-concept §9①`「冷峻记录员」倾向一致；留接口待主审定「带毒舌」✅

### 9.4 Godot headless 导入不回归

- 在 `game/` 跑 `$GODOT_BIN --headless --import --quit`：音频资产（7 个 .mp3）被 `.import` 引入，无脚本/场景加载错误。结果见报告（§「自验证」）。**资产当前未被场景硬引用**（仅为占位文件导入），故导入不回归；待 P5 接入 AudioStreamPlayer 时再验证播放。

---

## 10. 待主创审批项（发现听觉张力，不擅自定稿）

1. **【系统旁白声线 / 人格基调】**（`game-concept §9①`）：当前占位用 `Chinese (Mandarin)_Male_Announcer`（冷静中性男声）对应「冷峻记录员」倾向。若主创定「带点毒舌的记录员」，换声线（如 `News_Anchor` 或调 speed/pitch）即可，**不改 VO 触发逻辑/命名**。须主创拍板声线 + 是否给旁白加极轻微 glitch 底音（`art-bible §11①` 视觉语气延伸）。
2. **【响度基准是否冻结】**（§6.2）：−16 LUFS Master / VO −15 / BGM −20 / SFX −18 为 PC 单机倾向值，须 P6 剖析冻结（`art-bible §8.4` 同源「P6 剖析冻结前不锁死」）。占位 mmx 资产未做母带标准化。
3. **【VO 侧链实现方】**（§6.3）：Godot 原生 `AudioEffectCompressor` 跨总线 sidechain 可行性 `[待程基岩确认]`；MVP 倾向代码 duck（信号驱动 `set_bus_volume_db`），真侧链列目标态。须程基岩 P3 ADR 确认。
4. **【环境音床是否进 MVP】**（§4.6）：当前列目标态（用 explore BGM 顶替世界床）。若 Playtest 觉得探索「太空」，倾向把 `sfx_ambient_river_loop` + `sfx_ambient_reed_loop` 提前进 MVP。须主创 + 严守真 Playtest 定。
5. **【多朝代 BGM 声线差异】**（愿景，`game-concept §7.3`）：朝代音频包 `audio_pack.tres` 已预留 `vo_voice_profile` 字段；多朝代是否每朝代换系统声线（如唐/宋不同播音员）属愿景，本切片不定。

---

## 11. 已知风险与对齐标注

1. **SFX 降级为纯规格**：mmx 无专用音效生成工具（只有 image/music/speech/video），故 §4 战斗/UI/Δ SFX **未生成实资产**，仅给规格（事件 ID/触发/变体/分层/总线）。须林绘澄/阮和鸣 P5 用免版权音效库或合成器产真实占位 SFX。已在资产清单标注「⏳ 规格待产」。**非臆造**——issue §B 明确「可用 mmx 或标注降级」。
2. **占位资产响度未标准化**：mmx music 输出响度不固定，VO 为 32kHz/128kbps；§6.2 响度基准为目标态，实际资产须 P5/P6 母带。占位资产**仅验证「能生成、能导入、气质对齐」**，不保证混音达标。
3. **VO 模型版本**：issue 提及 `speech-2.6-hd`，mmx CLI 默认用 `speech-2.8-hd`（更新版本，向后兼容，质量更高）。若主创要求严格 2.6-hd，可 `--model speech-2.6` 重生成。
4. **Godot 音频 API 存疑**：§6/§7 多处标 `[待程基岩确认]`（总线效果链 sidechain、`AudioStreamPlayer2D` 衰减参数、autoload 音频管理器路由）。本文件不臆造，待 P3-1 架构 ADR 与程基岩核对。
5. **BGM 状态机触发依赖 S4/S5 信号**：§3.2 `explore↔combat` 切换依赖 `combat §2.7` alert 信号；MVP 若 S4/S5 信号未就绪，BGM 切换可能降级为「场景加载即切」。须与程基岩 P5 对齐信号时序。

---

## 附录 A · 占位资产清单（`game/assets/audio/`）

> 同步更新于 `game/assets/audio/README.md`。命名遵循 §5；生成工具 mmx（`AGENTS.md` 多模态资产生成）。

| 文件 | 类别 | 状态/用途 | 生成 | 大小 | 备注 |
|---|---|---|---|---|---|
| `bgm_menu.mp3` | BGM | 菜单态（水墨开篇） | mmx music-3.0 instrumental | ~3.9 MB | 古琴+箫留白 |
| `bgm_explore.mp3` | BGM | 探索态（赤壁江岸） | mmx music-3.0 instrumental | ~5.1 MB | 民族 ambient |
| `bgm_combat.mp3` | BGM | 战斗态（朱赤战火） | mmx music-3.0 instrumental | ~1.1 MB | 战鼓+二胡张力 |
| `bgm_choice.mp3` | BGM | 抉择态（系统冷光） | mmx music-3.0 instrumental | ~6.8 MB | 古琴点+电子 pad |
| `vo_system_dispatch.mp3` | VO | 派单旁白（X1） | mmx speech-2.8-hd | ~101 KB / 6.2s | 冷静中性男声 |
| `vo_system_complete.mp3` | VO | 完成旁白（X1） | mmx speech-2.8-hd | ~76 KB / 4.6s | 冷静中性男声 |
| `vo_system_vanish.mp3` | VO | 消失旁白（X1） | mmx speech-2.8-hd | ~83 KB / 5.1s | 冷静中性男声 |

**未生成（⏳ 规格待产，mmx 无 SFX 工具）**：所有 `sfx_*`（战斗/UI/Δ/环境）——规格见 §4。P5 由阮和鸣/林绘澄用免版权音效库或合成器产真实占位。

---

*—— 阮和鸣（audio-director）· Phase 6 打磨（P6-1 音频方向 + 占位音效/BGM）· 待主创评审*
