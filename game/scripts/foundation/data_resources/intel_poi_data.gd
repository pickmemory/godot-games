class_name IntelPOIData
extends Resource
## IntelPOIData · 情报采集点（数据驱动 · S5 拥有采集内容 · open-world §3.2 / §2.2）。
##
## 落 data/intel/<poi_id>.tres。玩家进入交互区按 E 采集 → S5（RewriteNodeDirector）代理聚合 intel_cov
## → 发 intel_updated（S5→S1，降 diff/解锁蓝图）。字段契约对齐 open-world §3.2。
## 被 RewriteNodeDirector（data/scenes/rewrite_node_chibi/east_wind_flow.tres 的 clue_pois[]）读。
## 参考：architecture §6.2；adr-002。

## 采集点 id（snake_case）。
@export var poi_id: StringName = &""

## 朝代命名空间（dyn_threekingdoms_chibi；art-bible §9.1）。
@export var dynasty: StringName = &""

## 采集点显示名（greybox 标记用，如「芦苇观察点」「江岸渔夫」）。
@export var display_name: String = ""

## 世界坐标（S5 布置交互区位置用）。
@export var position: Vector2 = Vector2.ZERO

## 交互半径（px；玩家进入此范围按 E 采集）。
@export var interact_radius_px: float = 80.0

## 情报类别（如 wind_intel；S5 按类聚合 intel_cov）。
@export var intel_kind: StringName = &""

## 单点情报覆盖率贡献 intel_raw ∈ [0,1]（S5 累加得 intel_cov）。
@export var intel_raw: float = 0.0

## 关联改写节点 id（情报服务于哪个节点，如 n2_east_wind）。
@export var relates_to_node: StringName = &""

## 情报条目 id（S5 发 intel_updated 的 new_intels 元素，供 S1/S3 登记）。
@export var intel_entry_id: StringName = &""

## lore/世界观文本（采集时展示，art-bible §5.5）。
@export var lore_text: String = ""

## 采集时系统旁白文案（X1 冷光记录员语气）。
@export var system_voice_on_collect: String = ""
