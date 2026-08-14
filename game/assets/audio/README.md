# 音频资产清单 · `game/assets/audio/`

> 阶段：Phase 6 · 打磨（P6-1）　|　负责：阮和鸣（audio-director）
> 规格与命名源：`docs/design/audio/sound-design.md`（§4 事件清单、§5 命名约定、§3 四态 BGM、§6 总线）。
> 生成工具：mmx（`AGENTS.md` 多模态资产生成）——BGM 用 `music-3.0 --instrumental`，VO 用 `speech synthesize`。
> 工程格式：`.mp3`（Godot 4.7 原生支持导入，`art-bible §8.3`：音频 `.ogg`/`.wav`/`.mp3` 阮和鸣管）。

## 已生成占位资产

| 文件 | 类别 | 状态/用途 | mmx 模型 | 备注 |
|---|---|---|---|---|
| `bgm_menu.mp3` | BGM | 菜单态（水墨开篇卷轴 + 冷光标题） | music-3.0 instrumental | 古琴+箫留白，慢板 |
| `bgm_explore.mp3` | BGM | 探索态（赤壁江岸求知） | music-3.0 instrumental | 民族 ambient，神秘张力 |
| `bgm_combat.mp3` | BGM | 战斗态（朱赤战火，Loop B） | music-3.0 instrumental | 战鼓+紧密打击+二胡张力 |
| `bgm_choice.mp3` | BGM | 抉择态（改写面板系统冷光） | music-3.0 instrumental | 极简古琴点+电子 pad（轨道 B） |
| `vo_system_dispatch.mp3` | VO | 系统派单旁白（X1，「记录员」人格） | speech-2.8-hd | 冷静中性男声；文案「已锁定目标：借东风…」 |
| `vo_system_complete.mp3` | VO | 系统完成旁白 | speech-2.8-hd | 冷静中性男声；「节点已确认…」 |
| `vo_system_vanish.mp3` | VO | 系统消失旁白 | speech-2.8-hd | 冷静中性男声；「目标节点未触发存在条件…」 |

## 未生成（规格待产）

mmx 无专用音效（SFX）生成工具（仅 image/music/speech/video），故以下 SFX 为**纯规格**，见 `sound-design.md §4` 完整事件清单。P5 由阮和鸣/林绘澄用免版权音效库或合成器产真实占位：

- **战斗**（`combat §3.2` `sfx_ref` / §6.4 S4 直接播放）：`sfx_player_attack_swing`、`sfx_player_attack_hit`、`sfx_player_hurt`（多通道）、`sfx_system_magic_burst`（青蓝几何）、`sfx_system_magic_wind`、`sfx_npc_alert_*`、`sfx_player_footstep_*` 等。
- **改写/因果**：`sfx_system_delta_<minor/notable/critical>`、`sfx_system_rewrite_lock`、`sfx_system_cp_tick`、`sfx_timeline_branch`。
- **UI/面板**（轨道 B 冷光，200–350 ms 扫描开合）：`sfx_ui_panel_open/close`、`sfx_ui_value_tick`、`sfx_ui_confirm`、`sfx_ui_skill_unlock`。
- **环境床**（轨道 A，目标态）：`sfx_ambient_river/reed/camp_loop`、`sfx_fire_loop`。

## 命名约定（`sound-design.md §5`）

- `bgm_<state>`：`bgm_menu` / `bgm_explore` / `bgm_combat` / `bgm_choice`
- `sfx_<来源>_<动作>`：`sfx_system_*`（轨道 B 冷光）/ `sfx_player_*` / `sfx_npc_*` / `sfx_ui_*`（轨道 B）/ `sfx_ambient_*`（轨道 A）
- `vo_system_<触发>`：`vo_system_dispatch` / `vo_system_complete` / `vo_system_vanish`
- 与 GDD 占位引用一字一致：`sfx_system_magic_burst`（`combat §3.2`）、`system_*_voice`（`mainline-quest §3.2`）

## 混音 / 实现

- 总线结构（Master/BGM/SFX/VO + VO 侧链）见 `sound-design.md §6`。
- 响度基准为母带目标（占位 mmx 资产未做母带标准化），P5/P6 由程基岩在总线层归一。
- 朝代热切换：四态 BGM 经朝代包 `audio_pack.tres` `bgm_refs` 引用（`sound-design.md §3.3`）。
