shader_type canvas_item;
render_mode unshaded;
// P6 juice · 普攻挥砍拖尾（ink 笔锋淡出）
// 对齐：art-bible §7.1 动态线「披风/衣摆/武器拖尾拉长动势」；§7.2/§7.3 节奏与帧预算。
// 色相法则（art-bible §2.4）：普攻 = 凡人近战，拖尾 = 宣纸白 / 淡墨白描（轨 A）；
//   ≠ 系统术法的青蓝几何（那是 vfx_system_*，轨 B）。两套奇幻绝不混用。
// 挂载：Polygon2D / mesh 拖尾片材质，UV.x 沿拖尾长度（0=握柄 .. 1=刀尖）。JuiceController 生命周期驱动 fade。

uniform float fade : hint_range(0.0, 1.0) = 1.0;                           // 整体可见度（生命周期淡出）
uniform vec4 ink_color : source_color = vec4(0.92, 0.90, 0.82, 1.0);       // 宣纸白偏暖（art-bible §2.1 主色 A' 宣纸黄→偏白）
uniform float tail_power : hint_range(0.5, 4.0) = 1.6;                     // 笔锋衰减曲率（尖端淡）

void fragment() {
	float along = clamp(UV.x, 0.0, 1.0);
	float a = pow(1.0 - along, tail_power) * fade;
	COLOR = vec4(ink_color.rgb, a);
}
