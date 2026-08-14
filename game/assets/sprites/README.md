<!-- 美术资产 · 精灵（角色 / 敌人，art-bible §4）-->
<!-- 目标目录：垂直切片角色 / 敌人精灵（char_/npc_，带透明 .png，轨道 A 暖墨彩）。-->
<!-- 状态（2025-08-14，P5-10 v0.2）：mmx 可用，真实占位资产已落位 ——
      char_player_traveler_idle_s / char_player_traveler_walk_s（玩家 idle+walk，方向集 _s 先行）
      npc_folk_bandit_idle_s（山贼，凡人 folk，见 p5-10 §7 对齐决策）。
      逐资产规格 + 最终 prompt + 接线计划见 docs/design/art/p5-10-core-asset-generation.md（§3/§4/§0.5/§8.1-8.2）。-->
<!-- 轨道纪律（art-bible §0/§3.2）：char_/npc_ 属轨道 A 暖墨彩，冷光不污染世界；玩家系统纹仅施法态浮现（art-bible §4.1）。-->
<!-- 技术美术：mmx image-01 无原生 alpha，透明由 Pillow flood-white key 实现（p5-10 §0.5.2）。-->
<!-- 续产待办：方向集 _n/_e/_w + 序列帧（普攻/施法/受击/倒地）+ 山贼 _attack + 名角（诸葛/曹/周/关）（复用 p5-10 §3/§4 prompt）。-->
