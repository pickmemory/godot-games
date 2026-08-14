class_name EnemyAttackData
extends Resource
## EnemyAttackData · 敌人单次攻击数据（数据驱动 · S4 · combat §3.3 / §2.8 ai.attacks 子资源）。
##
## 落 data/enemies/<enemy_id>.tres 的 ai.attacks[]（内联子资源）。敌人近战劈砍的时序/倍率/范围/击退。
## 被 enemy.gd（_tick_attack / _start_attack / _current_attack）/ player.gd（_enemy_attack）读。
## 参考：architecture §6.2；adr-002；combat §2.8。

## 攻击 id（snake_case；enemy attack_landed 信号回传用）。
@export var id: StringName = &""

## 前摇 windup（秒，可读 telegraph）。
@export var windup: float = 0.0

## 命中盒生效 active（秒）。
@export var active: float = 0.0

## 后摇 recover（秒）。
@export var recover: float = 0.0

## 伤害倍率 mult（combat §4.1 mult_skill）。
@export var mult: float = 1.0

## 攻击范围 range_px（命中盒半径 + 起手判定距离）。
@export var range_px: float = 0.0

## 击退 knockback_px（命中玩家施加的击退位移）。
@export var knockback_px: float = 0.0

## 是否可被打断 interruptible（combat §2.8）。
@export var interruptible: bool = true

## 冷却 cooldown（秒）。
@export var cooldown: float = 0.0
