# juice 视觉挂载代码（P6 · art-director 最小视觉挂载）

> 对齐：`docs/design/art/p6-polish-juice.md`（设计 + 接线契约 + 可访问性）。
> 边界：本目录脚本【只做纯表现】，不读写 HP/BF/Δ/v_i 等玩法态，不改玩法数值/逻辑（issue 红线）。
> 配套着色器：`game/shaders/`（screen_damage_vignette / hit_flash / weapon_trail / glitch_deviation）。

## 文件
| 脚本 | 挂载 | 职责 |
|---|---|---|
| `juice_controller.gd`（`class_name JuiceController`） | `world.tscn` Systems/ 子节点 | juice 编排：监听 `EventBus.hp_changed`（HP 下降→受击反馈）、震屏/命中停顿/红光 API、`reduce_motion` 可访问性总开关 |
| `screen_shake.gd`（`class_name ScreenShake`） | `Camera2D` 子节点 | trauma 模型相机震屏（写 `Camera2D.offset`，与 world.gd 的 `global_position` 正交）；节制，reduce_motion 关 |
| `weapon_trail.gd`（`class_name WeaponTrail`） | 玩家/武器子节点（Line2D） | 普攻挥砍拖尾（宣纸白墨描，轨 A）；玩法层 active 帧采样 `add_swing_point()` |

## 已落地接线（world.tscn · additive，零玩法改动）
- `Systems/JuiceController`（camera/screen_shake/vignette 三个 NodePath export 默认值即对齐 world 树）
- `Camera2D/ScreenShake`
- `L5_SystemCanvas/DamageVignette`（全屏 ColorRect + `shaders/screen_damage_vignette.gdshader`）

## 待程基岩接线点（见 p6-polish-juice.md §6 + issue comment）
- **命中停顿触发**：`player.gd` 命中敌人（`_check_hitbox_hits`）后调 `juice.request_hit_stop()`（一行）。
- **拖尾采样**：`player.gd` 普攻 active 帧调 `trail.add_swing_point(weapon_tip_global_pos)`。
- **高 Δ glitch**：`RewriteFeedbackController` feedback_tier=critical 时 tween `glitch_deviation` material 的 `intensity`（叠层级序 [待程基岩确认]）。
- **减少动效设置**：设置菜单（ux-spec §11.1）→ `juice.set_reduce_motion(bool)`。
