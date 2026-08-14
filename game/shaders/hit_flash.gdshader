shader_type canvas_item;
render_mode unshaded;
// P6 juice · 角色 / 敌人精灵受击白闪
// 对齐：combat §6.5 受击反馈；art-bible §7.1 受击动势；§2.1（朱赤阵营敌人可把 flash_color 改朱赤）。
// 挂载：Sprite2D.material = ShaderMaterial(this)。受击瞬间 set「flash」=1，再 tween→0。
// 与 enemy.gd 现有 modulate 灰闪并存；本 shader 为更高质感的「白→本色」过渡，engineer 可择一切换（接线点见 p6-polish-juice.md）。

uniform float flash : hint_range(0.0, 1.0) = 0.0;                          // 0=本色 .. 1=全闪
uniform vec4 flash_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);        // 受击白闪

void fragment() {
	vec4 c = texture(TEXTURE, UV);
	// 透明像素不参与闪（flash*c.a），保持精灵干净 alpha 边缘。
	COLOR = vec4(mix(c.rgb, flash_color.rgb, flash * c.a), c.a);
}
