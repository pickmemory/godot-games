shader_type canvas_item;
render_mode unshaded;
// P6 · 世界色温分级（双轨反差强化）· 待用件，默认 intensity=0（直通原样，不改已验收 look）
// 对齐：art-bible §0 双轨反差 / §2.1 配色。启用前须主创审批（art-bible §11 待审批①②），
//   因全局重调色会改变 P5-10 已 vision-confirmed 的整体观感（p6-polish-juice.md §1.3）。
// 挂载：world 根之上的 CanvasLayer 全屏 ColorRect，读 SCREEN_TEXTURE。intensity=0 时等价于不挂。
// 思路：轻微把中亮区往「宣纸黄/赭」暖拉、暗部往「网格墨蓝」冷压，强化双轨；幅度极小（避免抢戏）。

uniform sampler2D SCREEN_TEXTURE : hint_screen_texture, filter_linear_mipmap;
uniform float intensity : hint_range(0.0, 1.0) = 0.0;                      // 0=直通 .. 1=满分级（建议启用值 0.25~0.4）
uniform vec3 warm_tint : source_color = vec3(0.98, 0.93, 0.80);            // 宣纸黄偏暖（art-bible §2.1 主色 A'）
uniform vec3 cool_tint : source_color = vec3(0.55, 0.68, 0.74);            // 墨青偏冷（art-bible §2.1 辅色 A' / 轨 B 网格墨蓝之间）
uniform float warm_lift : hint_range(0.0, 0.5) = 0.12;                     // 亮区暖提强度
uniform float cool_press : hint_range(0.0, 0.5) = 0.18;                    // 暗部冷压强度

void fragment() {
	vec3 col = texture(SCREEN_TEXTURE, SCREEN_UV).rgb;
	if (intensity <= 0.001) {
		COLOR = vec4(col, 1.0);
		return;
	}
	float l = dot(col, vec3(0.299, 0.587, 0.114));            // 亮度（Rec.601）
	float warm_w = smoothstep(0.45, 0.95, l) * warm_lift;     // 仅亮区暖提
	float cool_w = smoothstep(0.45, 0.05, l) * cool_press;    // 仅暗部冷压
	vec3 graded = col;
	graded = mix(graded, graded * warm_tint, warm_w);
	graded = mix(graded, graded * cool_tint, cool_w);
	COLOR = vec4(mix(col, graded, intensity), 1.0);
}
