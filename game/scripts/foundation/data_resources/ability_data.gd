class_name AbilityData
extends Resource
## AbilityData · 能力执行数据（数据驱动 · S4 战斗执行 · combat §3.2 / architecture §6.2）。
##
## 落 data/skills/<ability_id>.tres（C4 执行数据；与 C3 解锁数据 data/progression/skills/ 按 ability_id join，
## 两段式无重复所有者，architecture §6.2 拍板）。定义术法的消耗/冷却/前摇/伤害/rewrite_proxy 映射。
## 被 combat_system.gd（can_cast/begin_cast/commit_cast）/ player.gd（_tick_cast 读 cast_time）读。
## enum Kind 被 combat_system 用 `AbilityData.Kind.REWRITE_PROXY` 引用（释放即发 verb_executed）。
## 参考：adr-002；combat §2.6。

## 能力 kind 分类（combat §3.2 / §2.6 `kind: attack | buff | utility | rewrite_proxy`）。
enum Kind {
	ATTACK = 0,        # 攻击术法（造伤害）
	BUFF = 1,          # 增益
	UTILITY = 2,       # 工具
	REWRITE_PROXY = 3, # 改写代理：兼作改写动词的物理执行，不造伤害（缝合战斗与改写，§2.6）
}

## 能力 id（snake_case；被 C3 grants.value 引用，join 键）。
@export var ability_id: StringName = &""

## 显示名（UI 用，如「系统·借风术」）。
@export var display_name: String = ""

## 朝代命名空间（dyn_threekingdoms_chibi）。
@export var dynasty: StringName = &""

## 能力类型（见 Kind 枚举；int 以兼容 .tres 整数加载，C4 据 Kind.REWRITE_PROXY 发 verb_executed）。
@export var kind: int = Kind.ATTACK

## 战意消耗 bf_cost（点）。
@export var bf_cost: int = 0

## 冷却 cooldown（秒）。
@export var cooldown: float = 0.0

## 施法前摇 cast_time（秒；前摇可被受击打断，打断不耗 BF，combat §2.2/§2.6）。
@export var cast_time: float = 0.0

## 伤害规格（子 Resource：mult_skill/damage_type；rewrite_proxy 不造伤害 = null）。
## nullable Resource：.tres 可赋 null（当前 MVP 唯一能力 ability_system_magic_wind 即 null）。
## 前向兼容：未来可填 DamageData 子资源（combat §3.2 damage 字段）。
@export var damage: Resource = null

## rewrite_proxy 触发的改写动词 id（仅 kind=REWRITE_PROXY：释放即发 verb_executed，C4 不写 v_i/Δ）。
@export var rewrite_proxy_verb: StringName = &""

## 物理执行前置：所需场所 id（S5 校验 requires.scene；combat §5.4）。
@export var requires_scene: StringName = &""

## VFX / SFX / 动画引用（art-bible §9 命名；资产归林绘澄/阮和鸣）。
@export var vfx_ref: StringName = &""
@export var sfx_ref: StringName = &""
@export var anim_ref: StringName = &""

## 特殊 flag（如 triggers_system_voice，game-concept §6.2 分支C）。
@export var special_flags: PackedStringArray = PackedStringArray()

## MVP 是否可用（game-concept §7.1 玩家能力最小集；MVP 仅 1 个系统术法）。
@export var mvp_available: bool = false
