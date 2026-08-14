class_name PlayerDodgeData
extends Resource
## PlayerDodgeData · 玩家闪避数据（数据驱动 · S4 · combat §2.4 / §3.1 dodge 子资源）。
##
## 落 data/combat/player_combat.tres 的 dodge。MVP 闪避关闭（mvp_enabled=false，GDD 基线优先于 roadmap
## 「无敌帧」字面措辞，见 issue comment）。被 player.gd / combat_system.gd（i_frames hook）读。
## 参考：architecture §6.2；adr-002；combat §2.4。

## 闪避战意消耗 bf_cost（点）。
@export var bf_cost: int = 0

## 无敌帧时长 i_frames（秒；闪避期间无视受击判定）。
@export var i_frames: float = 0.0

## 翻滚位移 dodge_dist（px）。
@export var dodge_dist_px: float = 0.0

## 后摇 recover（秒，不可取消）。
@export var recover: float = 0.0

## MVP 是否启用（false = 闪避关闭；combat §2.4 完整集，game-concept §7.2）。
@export var mvp_enabled: bool = false
