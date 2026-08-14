class_name DetectionGlobalsData
extends Resource
## DetectionGlobalsData · 感知/噪声全局配置（数据驱动 · S4 拥有全局感知规则 · combat §3.4 / architecture §6.2）。
##
## 落 data/globals/detection_globals.tres（落点以 architecture §6.2 为准，非 combat §3.4 字面 data/combat/）。
## 定义全局警戒档位表 + 各动作噪声值 + 环境修正。被 combat_system.gd（_scan_alert）读。
## 参考：adr-002；combat §2.7/§4.5/§7.7①。

## 警戒档位表（0~3；C4 扫场景战斗体定档后查 alert_mult）。
@export var alert_levels: Array[AlertLevelData] = []

## 各动作噪声值（px；S5 据玩家 stance/动作耦合噪声到敌人 hearing_radius，[TODO open-world]）。
@export var noise_sprint: float = 160.0
@export var noise_walk: float = 64.0
@export var noise_crouch: float = 0.0
@export var noise_basic_attack: float = 96.0
@export var noise_system_magic: float = 128.0

## 环境修正：湿地噪声倍率 / 芦苇遮蔽视野倍率 / 烟雾阻断视野。
@export var on_wetland_mult: float = 1.5
@export var reed_conceal_sight_mult: float = 0.3
@export var smoke_block_sight: bool = true


## 取某警戒档位的 alert_mult（未命中档位回 1.0）。供 combat_system._scan_alert 调。
func get_alert_mult_for_level(level: int) -> float:
	for a in alert_levels:
		if a != null and a.level == level:
			return a.alert_mult
	return 1.0
