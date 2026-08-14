shader_type canvas_item;
render_mode unshaded;
// P6 juice · 受击屏幕边缘「朱砂赤」光晕
// 对齐：art-bible §2.1 点睛 A「朱砂赤」；combat §6.5 受击反馈；§7.6① 多通道（红光 + HP 下沉 + 音效 + 震屏）。
// 挂载：L5_SystemCanvas/DamageVignette（全屏 ColorRect，mouse_filter=IGNORE，不挡输入）。
// 驱动：JuiceController.pulse_vignette() tween「intensity」0→1→0。
// 可访问性（art-bible §2.3 / combat §7.6①）：朱赤光只是受击反馈的「颜色通道」之一，绝不靠单一颜色传达——
//   reduce_motion 时震屏关，但本红光 + HP 条下沉 + 音效仍保留（多通道）。
// 长宽比无关：用「方块距离」max(|dx|,|dy|) 算边缘，避免非正方形屏拉伸成椭圆。

uniform float intensity : hint_range(0.0, 1.0) = 0.0;                      // 当前强度（0=全透）
uniform vec4 glow_color : source_color = vec4(0.85, 0.12, 0.10, 1.0);      // 朱砂赤（art-bible §2.1 点睛 A）
uniform float edge_band : hint_range(0.05, 0.6) = 0.32;                    // 边缘带宽（占半屏 0..0.5 的比例）
uniform float max_alpha : hint_range(0.0, 1.0) = 0.55;                     // 节制上限（art-bible §3.1 不抢世界）

void fragment() {
	vec2 p = abs(UV - vec2(0.5));            // 0 中心 .. 0.5 边
	float e = max(p.x, p.y);                 // 到最近边的「方块」距离（长宽比无关）
	float v = smoothstep(0.5 - edge_band, 0.5, e);
	COLOR = vec4(glow_color.rgb, v * intensity * max_alpha);
}
