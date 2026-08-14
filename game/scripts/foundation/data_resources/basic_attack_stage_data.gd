class_name BasicAttackStageData
extends Resource
## BasicAttackStageData · 普攻连段单段数据（数据驱动 · S4 · combat §2.3 / §3.1 basic_attack_stages 子资源）。
##
## 落 data/combat/player_combat.tres 的 basic_attack_stages[]。玩家普攻 3 段连段每段的倍率/时序/击退。
## 被 player.gd（_tick_attack / _start_attack / _check_hitbox_hits）读。
## 参考：architecture §6.2；adr-002。

## 本段伤害倍率 mult（combat §4.1 mult_skill；如 1.0/1.0/1.4）。
@export var mult: float = 1.0

## 本段硬直值 stagger_value（击中敌人施加的硬直）。
@export var stagger_value: float = 0.0

## 前摇 windup（秒，可读 telegraph）。
@export var windup: float = 0.0

## 命中盒生效 active（秒）。
@export var active: float = 0.0

## 后摇 recover（秒）。
@export var recover: float = 0.0

## 派生窗口起点 cancel_from（占本段总时长比例 [0,1]；≈0.60 可接下一段，combat §2.3）。
@export var cancel_from: float = 0.6

## 击退 knockback（px；第 3 段带击退，combat §2.3）。
@export var knockback: float = 0.0
