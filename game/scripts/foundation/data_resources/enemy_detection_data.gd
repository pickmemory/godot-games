class_name EnemyDetectionData
extends Resource
## EnemyDetectionData · 敌人感知参数（数据驱动 · S4 · combat §3.3 / §2.7 detection 子资源）。
##
## 落 data/enemies/<enemy_id>.tres 的 detection（内联子资源）。敌人视野锥/听觉/警戒累积参数。
## 被 enemy.gd（_update_detection）读。参考：architecture §6.2；adr-002；combat §2.7。

## 视野锥半角（度；玩家相对朝向夹角 ≤ 此值则可视）。
@export var view_cone_half_deg: float = 40.0

## 视野半径（px）。
@export var view_radius_px: float = 256.0

## 听觉半径（px；进入即累积 sight_meter）。
@export var hearing_radius_px: float = 144.0

## 视野内 sight_meter 累积速率（1/秒；达 1.0 进 CHASE）。
@export var sight_gain_rate: float = 1.5

## 听觉内 sight_meter 累积速率（1/秒）。
@export var hear_gain_rate: float = 3.0

## 脱战计时 lose_target_time（秒；丢失目标后多久回 PATROL）。
@export var lose_target_time: float = 5.0

## sight_meter 自然衰减时间常数 alert_decay（秒；1/alert_decay 为衰减速率）。
@export var alert_decay: float = 3.0
