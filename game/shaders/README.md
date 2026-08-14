# 着色器（`game/shaders/`）· P6 juice + 视觉

> 阶段：P6 视觉打磨与 juice（issue #24 / `docs/design/art/p6-polish-juice.md`）。
> 全部 `CanvasItem` 着色器，Godot 4.7.1 `gl_compatibility` 可工作。命名口径 `shd_*`（asset-manifest §12 / art-bible §9 扩展）。

## 文件

| 文件 | 资产 ID | 用途 | 挂载 / 接线 |
|---|---|---|---|
| `screen_damage_vignette.gdshader` | `shd_juice_screen_damage_vignette` | 受击屏幕边缘朱砂赤光晕（art-bible §2.1 点睛A） | `L5_SystemCanvas/DamageVignette`（world.tscn 已接线）；`JuiceController.pulse_vignette()` 驱动 `intensity` |
| `hit_flash.gdshader` | `shd_juice_hit_flash` | 精灵受击白闪（combat §6.5） | Sprite2D.material；受击 tween `flash` 0→1→0（待程基岩接 enemy/player） |
| `weapon_trail.gdshader` | `shd_juice_weapon_trail` | 普攻墨笔拖尾（art-bible §7.1 动态线 / §2.4 轨A 墨描） | Polygon2D 拖尾片；UV.x 沿长度，`fade` 生命周期（与 `WeaponTrail` Line2D 方案二选一） |
| `glitch_deviation.gdshader` | `shd_juice_glitch_deviation` | 高 Δ 世界线震荡屏幕失真（art-bible §2.5/§7.2） | L5 全屏 ColorRect 读 SCREEN_TEXTURE；`RewriteFeedbackController` critical 档驱动 `intensity`（叠层级序 [待程基岩确认]） |
| `world_color_grade.gdshader` | `shd_world_color_grade` | 双轨色温分级（待用，默认 intensity=0） | 待主创审批后启用（art-bible §11 待审批①②） |

## 配套挂载代码
`game/scripts/juice/`：`JuiceController` / `ScreenShake` / `WeaponTrail`（见该目录 README）。

## 可访问性
所有动效类 juice（震屏/glitch/拖尾/命中停顿）受 `JuiceController.set_reduce_motion(bool)` 总开关抑制；朱赤边缘光 + HP 条 + 音效保留（多通道，不靠单一颜色，art-bible §2.3 / combat §7.6①）。
