class_name Boot
extends Node

## 启动场景（F6 · architecture §8.4 启动序列）。
##
## P3-2 最小：Autoload 就绪后进入 world。
##   - Autoload（EventBus/DynastyLoader/SaveManager）在主场景前初始化，本 issue 仅占位空壳。
##   - DynastyLoader 加载朝代包 + 数据校验、SaveManager 读档注入 C1/C2/C3 态 —— 留后续 issue。
##
## 顺序（§8.4 完整版，本 issue 仅跑通「能进入 world」）：
##   1. Autoload 初始化 → 2. DynastyLoader 加载 active_dynasty + validate_data()
##      → 3. SaveManager 读档注入 → 4. change_scene_to_file(world) → 5. C2 派发节点（Loop A 起步）。

func _ready() -> void:
	# 延迟到帧末切换场景：_ready 期间场景树仍在添加节点，直接 change_scene 会触发
	# 「Parent node is busy adding/removing children」错误（Godot 已提示用 call_deferred）。
	get_tree().call_deferred("change_scene_to_file", "res://scenes/world/world.tscn")
