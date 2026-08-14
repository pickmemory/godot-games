class_name RewriteNarrationData
extends Resource

## 系统旁白文案（X1 · 轨道 B 冷光记录员语气 · 数据驱动）。
##
## 归属：改写/因果**反馈层**（issue #18 抉择与历史线反馈）。文案归 S3 反馈层（本资源），
## 配音/字幕**演出表现**归 X1（阮和鸣 P6-1 mmx speech，本 issue 不产配音，见 issue 备注）。
##
## 语气基调（game-concept §9① **待审批**）：占位「冷峻第三方观测者/记录员」中性语气。
## 主创定稿前不擅自改口吻；若主创定「带点毒舌」，只改本 .tres 文案字段，不改消费方逻辑
## （panel-progression §1.4 / mainline §6.3 同口径两段式）。
##
## 文案支持占位符（String.format）：{node} {label} {delta} {m} {cp} {target} {token} {reason}。
## 落点：systems/rewrite/rewrite_narration_chibi.tres（朝代命名空间 dyn_threekingdoms_chibi）。

@export var dynasty: StringName = &"dyn_threekingdoms_chibi"   # art-bible §9.1
@export var system_tone: StringName = &"cold_recordist"        # §9① 待审批占位

# ── 派单开场（node_activated）── 节点 system_intro 由 S1 节点数据提供；本字段为可选前缀框。
@export var dispatch_prefix: String = ""

# ── 意图声明旁白（blueprint_declared，玩家选蓝图 = 声明意图，rewrite §2.4）──
## 占位符 {label} = 蓝图 intent_label。
@export var intent_voice_template: String = "意图已归档：{label}。偏差将据此丈量。"
## special_flags 命中 self_replacement 时的旁白（game-concept §6.2 分支 C「功劳归于玩家」）。
@export var self_replacement_voice: String = "注：本次借风功劳归于穿越者本人。记录员已标注。"

# ── 结算旁白（node_resolved，按 feedback_tier 分档，rewrite §4.4 / panel §2.5）──
@export var settle_voice_minor: String = "节点已确认。偏差微弱，历史线维持。"
@export var settle_voice_notable: String = "节点已确认。偏差已记录，因果已传递。"
@export var settle_voice_critical: String = "节点已确认。历史线在此分叉，记录员全功率观测。"

# ── 重大偏差 / 世界线震荡（critical_deviation_triggered，game-concept §6.3）──
@export var worldline_shaken_voice: String = "世界线剧烈震荡。下游节点难度上浮，风险已转嫁。"

# ── 意图落空兜底（M=0 蓝图不可达，rewrite §5.5）──
@export var intent_unreachable_voice: String = "意图落空。偏差仍被记录，因果点≈0。"

# ── 节点消失（node_vanished，存在性依赖不满足）──
## 占位符 {node}。
@export var node_vanished_voice: String = "目标节点 {node} 已从历史中消失。记录员归档。"

# ── 因果→下游播报（causal_link_propagated existence，game-concept §6.3）──
## 占位符 {target}（下游节点）/ {token}（met→出现 / unmet→消失）。
@export var causal_downstream_appear: String = "→ {target} 【出现】"
@export var causal_downstream_vanish: String = "→ {target} 【消失】"

# ── 连续 critical 演出降级压缩提示（panel §2.5 防疲劳）──
@export var consecutive_critical_note: String = "（世界线持续震荡，演出已压缩以减负。）"


## 取按 tier 的结算旁白（tier=0 minor / 1 notable / 2 critical）。
func get_settle_voice(tier: int) -> String:
	match tier:
		2: return settle_voice_critical
		1: return settle_voice_notable
		_: return settle_voice_minor
