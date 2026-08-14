<!-- 美术资产 · 系统面板 UI（轨道 B 冷青蓝 · art-bible §6 / asset-manifest §5）-->
<!-- 目标目录：垂直切片系统面板 / HUD / 主菜单 UI 件（ui_*）。-->
<!-- 状态（2025-08-14，P5-10 v0.2）：mmx 可用，真实占位资产已落位 4 张 ——
      ui_panel_frame_system（系统面板背景九宫格，仅青蓝边框环 + 透明内部，作 NinePatchRect，透出 system_panel.tscn 的 BgRect）
      ui_panel_rewrite_blueprint_card（改写面板蓝图卡）
      ui_panel_tab_icon_deviation / ui_panel_tab_icon_skill_tree（2 Tab 图标）。
      逐资产规格 + 最终 prompt + 接线计划见 docs/design/art/p5-10-core-asset-generation.md（§6/§0.5/§8.3）。-->
<!-- 轨道纪律（art-bible §0/§3.2）：ui_* 只允许出现在 L5_SystemCanvas / RewritePanel，冷光不污染世界。-->
<!-- 技术美术：panel_frame 经 global-white key 得透明内部；图标 / 改写卡 flood-white key（p5-10 §0.5.2）。-->
<!-- 续产待办：ui_skill_tree_node / ui_panel_rewrite_verb_card / 精确 Tab 字形（delta/节点图）/ HUD 资源条 + 图标 / 主菜单 key art（p5-10 §0.5.4）。-->
