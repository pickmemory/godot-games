<!-- 美术资产 · TileSet（art-bible §5.1/§8.1）-->
<!-- 目标目录：赤壁村落 TileSet 图块 + 必要 prop（tile_/prop_，命名空间 dyn_threekingdoms_chibi，Tile 64×64px 倾向，轨道 A 暖墨彩）。-->
<!-- 状态（2025-08-14，P5-10 v0.2）：mmx 可用，真实占位资产已落位 8 张 ——
      tile_ground_dry / _ground_wetland / _water_river / _water_wave_wind_se / _shore_edge（ground 5 类全覆盖）
      + prop_reed_wind_se / prop_camp_tent_shu（2 prop）。
      逐资产规格 + 最终 prompt + 接线计划见 docs/design/art/p5-10-core-asset-generation.md（§5/§0.5/§8.4）。-->
<!-- 现状：test_tileset.tres 仍为 P3-2 测试占位（PlaceholderTexture2D 64×64）；正式 TileSet .tres 待程基岩用本目录图块接线。-->
<!-- 轨道纪律（art-bible §0/§3.2）：tile_/prop_ 属轨道 A 暖墨彩；本土奇幻朱黄墨晕仅限 altar 等志怪侧（art-bible §2.4），不掺系统冷光。-->
<!-- 技术美术：tile 经 4 折镜像 make-seamless（边缘亮度差=0.0，占位技法，含 4 抱对称）；water_wave 经黑键+提亮得「宣纸白浪」透明叠层；reed 水平镜像为倾 NW（v_wind=se 物理向）（p5-10 §0.5.2）。-->
<!-- 续产待办：water_wave_wind_none/_nw + reed_wind_none/_nw（待 v_wind 浪向 reconcile）、prop_altar_intact/_destroyed、prop_flag_shu、shore_edge terrain 角/边集（p5-10 §0.5.4）。-->
