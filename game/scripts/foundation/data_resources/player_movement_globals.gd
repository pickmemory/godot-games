class_name PlayerMovementGlobals
extends Resource
## PlayerMovementGlobals · 玩家移动全局参数（数据驱动 · architecture §6 / adr-002）。
##
## 落 data/globals/player_movement_globals.tres。S5 玩家控制器（player.gd）只读此资源；改数值改此处，
## 不硬编码到脚本。参考：adr-002；architecture §6.2。

## 行走 / 冲刺 / 潜行 速度（px/s）。
@export var walk_speed: float = 180.0
@export var sprint_speed: float = 320.0
@export var crouch_speed: float = 90.0

## 加速度 / 摩擦减速（px/s²；player.gd move_toward 用）。
@export var acceleration: float = 1200.0
@export var friction: float = 1400.0
