class_name AlertLevelData
extends Resource
## AlertLevelData · 警戒档位数据（数据驱动 · S4 · combat §3.4 / §2.7 alert_levels 子资源）。
##
## 落 data/globals/detection_globals.tres 的 alert_levels[]。每个警戒档位的 level/name/倍率。
## 被 DetectionGlobalsData.get_alert_mult_for_level 查表。参考：architecture §6.2；adr-002；combat §4.5/§7.7①。

## 档位 level（0=unaware / 1=suspicious / 2=detected / 3=engaged）。
@export var level: int = 0

## 档位名（unaware/suspicious/detected/engaged）。
@export var name: String = "unaware"

## 该档位 alert_mult（combat §4.5；影响改写难度 + 脱战再生门控；首版倾向值 [待审批]）。
@export var alert_mult: float = 1.0
