class_name EnemyData
extends Resource
## EnemyData · 敌人定义（数据驱动 · S4 战斗执行数值 · combat §3.3 / architecture §6.2）。
##
## 落 data/enemies/<enemy_id>.tres。敌人基础属性 + 感知/攻击/AI 内联子资源。
## 被 enemy.gd（_ready / _tick_* / take_hit）/ player.gd（读攻方标量）/ test_combat.gd 读。
##
## 巡逻路线（patrol_route）不落本文件：归 S5 遭遇布置（open-world §3.3），由遭遇生成器运行时注入。
## 参考：adr-002。

## 敌人 id（snake_case；art-bible §9.1 命名空间）。
@export var enemy_id: StringName = &""

## 显示名（UI/调试用，如「赤壁山贼」）。
@export var display_name: String = ""

## 朝代命名空间（dyn_threekingdoms_chibi）。
@export var dynasty: StringName = &""

## 阵营 faction（folk 民间 / wei / shu / wu；art-bible §9.x）。
@export var faction: StringName = &"folk"

## HP 上限 / 攻击基础 / 防御基础（combat §4.1 dmg 公式）。
@export var hp_max: int = 0
@export var atk_base: int = 0
@export var def_base: int = 0

## 移动速度 move_speed_px（px/s；FSM 按 chase/patrol 倍率缩放）。
@export var move_speed_px: float = 0.0

## 抗性 resist ∈ [0,0.8]（按伤害类型；combat §4.1）。
@export var resist_physical: float = 0.0
@export var resist_system_arcane: float = 0.0
@export var resist_fire: float = 0.0

## 硬直阈值 stagger_threshold（受击硬直值累计达此值进 HURT 态，combat §2.5/§2.8）。
@export var stagger_threshold: float = 0.0

## 受击反应时长 hurt_dur（秒；P5-1 用固定 HURT 时长，combat §2.5）。
@export var hurt_dur: float = 0.4

## 击退质量 knockback_mass（越大越不易被击退；take_hit: knockback/mass）。
@export var knockback_mass: float = 1.0

## 感知子资源（视野/听觉/警戒累积）。
@export var detection: EnemyDetectionData = null

## AI 子资源（FSM 预设 + 攻击集 + 速度倍率）。
@export var ai: EnemyAIData = null

## 精灵引用 / 动画引用（art-bible §9 命名；资产归林绘澄）。
@export var sprite_ref: StringName = &""
@export var anim_ref: StringName = &""

## 改写动词 id（**代码访问的额外字段，.tres 不落**：普通敌人空 = 击杀不发 verb_executed；
## 改写目标敌人如曹操/庞统填对应 verb_id；combat §2.9 / §5.3 DAG）。默认空（普通敌人）。
@export var rewrite_verb_id: StringName = &""
