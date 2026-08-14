class_name TestGround
extends TileMapLayer

## L1_Ground 赤壁地貌铺设器（P5-10 接线：mmx 真实资产）。
## 用 tileset_dyn_threekingdoms_chibi.tres 四源（dry/wetland/water/shore）铺一片
## 「旱地基底 + 蜿蜒赤壁江 + 水陆过渡岸 + 滩涂」的垂直切片地貌。
## 参考：art-bible §5（墨青江水）/ asset-manifest §3（赤壁 TileSet）/ architecture §8.2 L1_Ground。
##
## 源 id 顺序对齐 tileset_dyn_threekingdoms_chibi.tres（dry=0 / wetland=1 / water=2 / shore=3）。
## 本脚本挂在 L1_Ground（TileMapLayer）；tile_set 由场景 .tscn 注入后 _ready 读取。

const SRC_DRY := 0
const SRC_WETLAND := 1
const SRC_WATER := 2
const SRC_SHORE := 3

const AC := Vector2i(0, 0)
const HALF_W := 30   # x: [-30, 30) = 60 格 ≈ 3840px
const HALF_H := 20   # y: [-20, 20) = 40 格 ≈ 2560px


func _ready() -> void:
	_paint_chibi()


func _paint_chibi() -> void:
	if tile_set == null:
		push_warning("L1_Ground: tile_set 未配置，跳过铺设")
		return
	# 1. 旱地基底铺满（大背景）
	for x in range(-HALF_W, HALF_W):
		for y in range(-HALF_H, HALF_H):
			set_cell(Vector2i(x, y), SRC_DRY, AC, 0)
	# 2. 蜿蜒赤壁江（横向 + 正弦微弯）：江心 2 格水，南北各 1 格岸 + 1 格滩涂
	for x in range(-HALF_W, HALF_W):
		var cy: int = 2 + int(round(sin(x * 0.22) * 2.0))   # 江心行（微蜿蜒，振幅 ±2）
		set_cell(Vector2i(x, cy), SRC_WATER, AC, 0)
		set_cell(Vector2i(x, cy + 1), SRC_WATER, AC, 0)
		_set_if_in_range(x, cy - 1, SRC_SHORE)   # 北岸
		_set_if_in_range(x, cy + 2, SRC_SHORE)   # 南岸
		_set_if_in_range(x, cy - 2, SRC_WETLAND) # 北滩涂
		_set_if_in_range(x, cy + 3, SRC_WETLAND) # 南滩涂


func _set_if_in_range(x: int, y: int, src: int) -> void:
	if x >= -HALF_W and x < HALF_W and y >= -HALF_H and y < HALF_H:
		set_cell(Vector2i(x, y), src, AC, 0)
