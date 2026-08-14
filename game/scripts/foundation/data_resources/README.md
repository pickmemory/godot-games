# data_resources/ · 数据资源类（基础层 F3 · adr-002 §决定1）

> 所有静态游戏数据的自定义 `Resource` 子类（`class_name X extends Resource`）。
> 基础层零游戏知识、可独立测；被核心层（C1~C5）与玩法层只读引用。静态 .tres 是只读蓝图，运行时态绝不写回。
>
> 字段契约 = 各 `.tres` 实际属性 + 对应 GDD §3（rewrite-causality / mainline-quest / combat / open-world / panel-progression）+ architecture §6.2 落点表 + adr-002。**零臆造**。
>
> 注意：本目录曾于某次合并/集成中整体丢失（issue #26 · P6-Blocker），导致核心系统与全部 .tres 加载失败、游戏无法启动。本目录由程基岩按 .tres + 核心系统实际访问字段（含代码访问但 .tres 未落的 `EnemyData.rewrite_verb_id`）重建。

## 资源类 → GDD/落点速查

| 资源类 | 脚本 | GDD 来源 | 落点 | 所有者 |
|---|---|---|---|---|
| RewriteEnumValueData | rewrite_enum_value_data.gd | rewrite-causality §3.1 | data/variables/*.tres entries[] | S1 |
| RewriteVariableData | rewrite_variable_data.gd | rewrite-causality §3.1 | data/variables/<var_id>.tres | S1 |
| NodeVarEntryData | node_var_entry_data.gd | rewrite-causality §3.2 | data/nodes/*.tres vars[] | S1 |
| RewriteNodeData | rewrite_node_data.gd | rewrite-causality §3.2 | data/nodes/<node_id>.tres | S1 |
| BlueprintVarEntry | blueprint_var_entry.gd | rewrite-causality §3.3 | data/blueprints/*.tres vars[] | S1 |
| RewriteBlueprintData | rewrite_blueprint_data.gd | rewrite-causality §3.3 | data/blueprints/<bp_id>.tres | S1 |
| VerbEffectSet | verb_effect_set.gd | rewrite-causality §3.5 | data/verbs/*.tres effect_sets[] | S1 |
| RewriteVerbData | rewrite_verb_data.gd | rewrite-causality §3.5 | data/verbs/<verb_id>.tres | S1 |
| CausalTransformEntry | causal_transform_entry.gd | rewrite-causality §3.4 | data/causal_links/*.tres transform_entries[] | S1 |
| CausalLinkData | causal_link_data.gd | rewrite-causality §3.4 | data/causal_links/*.tres links[] | S1 |
| CausalLinksData | causal_links_data.gd | rewrite-causality §3.4 | data/causal_links/<dynasty>.tres | S1 |
| ChapterNodeEntryData | chapter_node_entry_data.gd | mainline-quest §3.1 | data/quests/chapters/*.tres ordered_nodes[] | S2 |
| ChapterData | chapter_data.gd | mainline-quest §3.1 | data/quests/chapters/<chapter_id>.tres | S2 |
| QuestNodeDispatchData | quest_node_dispatch_data.gd | mainline-quest §3.2 | data/quests/nodes/<node_id>.tres | S2 |
| IntelPOIData | intel_poi_data.gd | open-world §3.2 | data/intel/<poi_id>.tres | S5 |
| RewriteNodeFlowData | rewrite_node_flow_data.gd | issue #19 | data/scenes/rewrite_node_chibi/<flow_id>.tres | S5 |
| BasicAttackStageData | basic_attack_stage_data.gd | combat §3.1 | data/combat/player_combat.tres basic_attack_stages[] | S4 |
| PlayerDodgeData | player_dodge_data.gd | combat §2.4/§3.1 | data/combat/player_combat.tres dodge | S4 |
| PlayerStaggerData | player_stagger_data.gd | combat §2.5/§3.1 | data/combat/player_combat.tres stagger | S4 |
| PlayerCombatData | player_combat_data.gd | combat §3.1 | data/combat/player_combat.tres | S4 |
| EnemyDetectionData | enemy_detection_data.gd | combat §3.3/§2.7 | data/enemies/*.tres detection | S4 |
| EnemyAttackData | enemy_attack_data.gd | combat §3.3/§2.8 | data/enemies/*.tres ai.attacks[] | S4 |
| EnemyAIData | enemy_ai_data.gd | combat §3.3/§2.8 | data/enemies/*.tres ai | S4 |
| EnemyData | enemy_data.gd | combat §3.3 | data/enemies/<enemy_id>.tres | S4 |
| AlertLevelData | alert_level_data.gd | combat §3.4 | data/globals/detection_globals.tres alert_levels[] | S4 |
| DetectionGlobalsData | detection_globals_data.gd | combat §3.4 | data/globals/detection_globals.tres | S4 |
| AbilityData | ability_data.gd | combat §3.2 | data/skills/<ability_id>.tres | S4 |
| PlayerMovementGlobals | player_movement_globals.gd | architecture §6 | data/globals/player_movement_globals.tres | S5 |
| PanelUiStrings | panel_ui_strings.gd | panel-progression §3.5 | data/panel/ui_strings.tres | S3 |

## 辅助方法（核心系统/测试直接调）

- `RewriteNodeData.sum_weights()` — 节点内 Σw_i（§4.1 归一化校验）。
- `RewriteVariableData.get_deviation_for(value)` — 取值偏离度（镜像 C1._deviation_for_var）。
- `RewriteVerbData.get_effect_map()` — 聚合 effect_sets 为 {var_id: value}（C1 改 v_i 用）。
- `CausalLinksData.get_outgoing_links(source_node)` — 取出向因果链（C1 解析下游）。
- `CausalLinkData.transform_value(upstream)` — 值映射查表 + fallback。
- `DetectionGlobalsData.get_alert_mult_for_level(level)` — 警戒档位倍率查表。
