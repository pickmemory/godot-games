class_name TestGround
extends TileMapLayer

## L1_Ground 测试地面铺设器（P3-2 占位）。
## 参考：architecture §8.2 L1_Ground（TileMapLayer）；art-bible §8.1（Tile=64px）。
##
## 在 _ready 用 assets/tilesets/test_tileset.tres 的首个图块铺一片矩形，
## 仅作为「可走动的最小可视化地面」，正式赤壁 TileSet 待林绘澄 P4-2。
##
## 注意：本脚本挂在 L1_Ground（TileMapLayer）节点上；tile_set 由场景 .tscn 注入后 _ready 读取。

func _ready() -> void:
	_paint_test_rect()


func _paint_test_rect() -> void:
	if tile_set == null:
		push_warning("L1_Ground: tile_set 未配置，跳过测试铺设")
		return
	# 首个图块源 id（生成器仅添加一个 TileSetAtlasSource）。
	var source_id := tile_set.get_source_id(0)
	var atlas_coords := Vector2i(0, 0)
	# 铺 48×32 Tile 矩形（约 3072×2048 px），足够 Camera2D 缓动巡视。
	for x in range(-24, 24):
		for y in range(-16, 16):
			set_cell(Vector2i(x, y), source_id, atlas_coords, 0)
