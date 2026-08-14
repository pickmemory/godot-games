class_name EnemyAIData
extends Resource
## EnemyAIData · 敌人 AI 配置（数据驱动 · S4 · combat §3.3 / §2.8 ai 子资源）。
##
## 落 data/enemies/<enemy_id>.tres 的 ai（内联子资源）。FSM 预设 + 攻击集 + 追击/巡逻速度倍率。
## 被 enemy.gd（_tick_patrol / _tick_chase / _current_attack）读。
## 参考：architecture §6.2；adr-002；combat §2.8。

## FSM 预设名（如 "patrol_chase_attack"；P5-1 折叠三态 + 死亡）。
@export var fsm_preset: String = "patrol_chase_attack"

## 可用攻击集（enemy.gd 按 _attack_index 取；P5-1 单攻击常态）。
@export var attacks: Array[EnemyAttackData] = []

## 追击速度倍率（chase_speed_mult · move_speed_px）。
@export var chase_speed_mult: float = 1.0

## 巡逻速度倍率（patrol_speed_mult · move_speed_px）。
@export var patrol_speed_mult: float = 0.55
