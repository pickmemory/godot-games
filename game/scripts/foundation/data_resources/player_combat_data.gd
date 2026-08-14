class_name PlayerCombatData
extends Resource
## PlayerCombatData · 玩家战斗配置（数据驱动 · S4 战斗执行数值 · combat §3.1 / architecture §6.2）。
##
## 落 data/combat/player_combat.tres。S4（CombatSystem）读 HP/BF/atk/def/crit + 普攻连段；玩法层
## （player.gd）读段值/范围/前摇。C4 持 HP/BF 权威（combat §3.5 非持久），本资源是只读蓝图。
## 参考：adr-002。

## 实体 id（art-bible §9.2 命名一致；穿越者玩家 = char_player_traveler）。
@export var entity_id: StringName = &""

## 朝代命名空间（dyn_threekingdoms_chibi）。
@export var dynasty: StringName = &""

## HP 上限 / 脱战再生（hp_regen_ooc 点/秒，仅 alert≤1，combat §3.1/§4.2）。
@export var hp_max: int = 100
@export var hp_regen_ooc: float = 0.0

## 战意 BF 上限 / 被动再生（regen_bf_passive 点/秒）/ 命中回 BF（regen_bf_on_hit 点/次，combat §4.2）。
@export var bf_max: int = 100
@export var regen_bf_passive: float = 0.0
@export var regen_bf_on_hit: int = 0

## 攻击/防御基础值（combat §4.1 dmg 公式 atk_base/def_base）。
@export var atk_base: int = 0
@export var def_base: int = 0

## 暴击概率 crit_chance / 暴击倍率 crit_mult（combat §4.1）。
@export var crit_chance: float = 0.0
@export var crit_mult: float = 1.0

## 普攻连段（combat §2.3；3 段，mult 1.0/1.0/1.4）。
@export var basic_attack_stages: Array[BasicAttackStageData] = []

## 命中盒形制/范围/每挥命中数（hitbox_shape=arc_front；range_px；combat §3.1）。
@export var hitbox_shape: String = "arc_front"
@export var hitbox_range_px: float = 0.0
@export var hitbox_hits_per_swing: int = 1

## 闪避 / 硬直 子资源（MVP 均 mvp_enabled=false）。
@export var dodge: PlayerDodgeData = null
@export var stagger: PlayerStaggerData = null

## 失败重开规则（reload_encounter / nearest_camp；combat §3.1 on_downed，应用归 S5）。
@export var respawn_rule: String = "reload_encounter"

## 失败 CP 惩罚（点；combat §3.1；MVP=0 不扣）。
@export var cp_penalty: int = 0

## 失败是否丢失改写进度（combat §3.1；MVP=false）。
@export var node_progress_loss: bool = false
