shader_type canvas_item;
render_mode unshaded;
// P6 juice · 高 Δ「世界线震荡」glitch（重大偏差屏幕失真）
// 对齐：art-bible §2.5 高 Δ「撕裂/失真/扫描故障 + 橙红警示」；§7.2 重大偏差 / 世界线震荡。
// 挂载：L5_SystemCanvas 全屏 ColorRect，material = ShaderMaterial(this)，读 SCREEN_TEXTURE 做后处理式失真。
//   ⚠️ 需该 ColorRect 所在 CanvasLayer 的 layer 序 > 世界层（渲染在 world 之后），[待程基岩确认] 叠层级序。
// 驱动：RewriteFeedbackController 在 feedback_tier=critical（art-bible §2.5）时 tween「intensity」。
// 可访问性（ux-spec §11.1「减少动效」· 前庭敏感）：JuiceController.reduce_motion=true 时 intensity 强制 0（glitch 全关）。

uniform sampler2D SCREEN_TEXTURE : hint_screen_texture, filter_linear_mipmap;
uniform float intensity : hint_range(0.0, 1.0) = 0.0;                      // 0=原样 .. 1=强失真
uniform vec4 warn_color : source_color = vec4(0.95, 0.45, 0.10, 1.0);      // 警示橙红（art-bible §2.1 点睛 B）
uniform float slice_strength : hint_range(0.0, 0.05) = 0.012;              // 横向切片最大位移
uniform float scanline_freq : hint_range(50.0, 400.0) = 160.0;             // 扫描线频率

float rand(vec2 co) {
	return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

void fragment() {
	// reduce_motion / 无偏差：直通原屏（JuiceController 也会把 intensity 钳到 0）。
	if (intensity <= 0.001) {
		COLOR = texture(SCREEN_TEXTURE, SCREEN_UV);
		return;
	}
	vec2 uv = SCREEN_UV;
	float t = TIME;
	// 横向条带随机位移（撕裂感）
	float band = floor(uv.y * 24.0);
	float shift = (rand(vec2(band, floor(t * 18.0))) - 0.5) * slice_strength * intensity;
	uv.x += shift;
	// 微 RGB 错位（色散）
	float rgb_off = 0.0015 * intensity;
	float r = texture(SCREEN_TEXTURE, uv + vec2(rgb_off, 0.0)).r;
	float g = texture(SCREEN_TEXTURE, uv).g;
	float b = texture(SCREEN_TEXTURE, uv - vec2(rgb_off, 0.0)).b;
	vec3 col = vec3(r, g, b);
	// 扫描线暗纹
	col *= 0.92 + 0.08 * sin(uv.y * scanline_freq);
	// 边缘橙红警示浸润（方块距离，长宽比无关）
	float edge = smoothstep(0.42, 0.5, max(abs(uv.x - 0.5), abs(uv.y - 0.5)));
	col = mix(col, warn_color.rgb, edge * intensity * 0.5);
	COLOR = vec4(col, 1.0);
}
