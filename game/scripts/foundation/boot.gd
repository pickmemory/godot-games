class_name Boot
extends Node

## 启动场景（F6 · architecture §8.4 启动序列）。
##
## P5-8（本 issue）：开场链路接线 boot → 主菜单 → 新游戏/继续 → world。
##   - Autoload（EventBus/DynastyLoader/SaveManager）在主场景前初始化：
##     SaveManager._ready 扫描槽位（读最近存档，供主菜单「继续」默认聚焦，§8.4）；
##     DynastyLoader 载 active_dynasty（占位，§8.4 第 2 步完整校验留 S5）。
##   - 本节点仅负责「Autoload 就绪后跳转 MainMenu」；存档注入 world 的重同步在 world._ready
##     经 SaveManager.apply_pending_load() 完成（architecture §9.2 读档重同步）。
##
## 顺序（§8.4 完整版）：
##   1. Autoload 初始化 → 2. DynastyLoader 加载 active_dynasty + validate_data()
##      → 3. SaveManager 读最近存档（MainMenu 据此默认聚焦 继续游戏 / 开始新游戏）
##      → 4. change_scene_to(MainMenu) → 5. 玩家选 新游戏/继续 → change_scene_to(world)
##      → 6. world._ready 据存档重同步（§9.2）+ C2 派发节点（Loop A 起步）。

func _ready() -> void:
	# 延迟到帧末切换场景：_ready 期间场景树仍在添加节点，直接 change_scene 会触发
	# 「Parent node is busy adding/removing children」错误（Godot 已提示用 call_deferred）。
	get_tree().call_deferred("change_scene_to_file", "res://scenes/menu/main_menu.tscn")
