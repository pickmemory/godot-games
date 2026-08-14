class_name PlayerStaggerData
extends Resource
## PlayerStaggerData · 玩家硬直槽数据（数据驱动 · S4 · combat §2.5 / §3.1 stagger 子资源）。
##
## 落 data/combat/player_combat.tres 的 stagger。MVP 硬直槽关闭（mvp_enabled=false；完整集留 game-concept §7.2）。
## 参考：architecture §6.2；adr-002；combat §2.5。

## 硬直槽阈值 stagger_threshold（受击硬直值累计达此值进入硬直态）。
@export var stagger_threshold: float = 0.0

## 硬直持续 stagger_dur（秒）。
@export var stagger_dur: float = 0.0

## 硬直槽自然回复 regen_stagger（点/秒）。
@export var regen_stagger: float = 0.0

## MVP 是否启用（false = 硬直槽关闭；combat §2.5 完整集）。
@export var mvp_enabled: bool = false
