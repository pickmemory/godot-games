extends Node
## （注：Autoload 脚本不加 class_name —— Godot 4.7 将 class_name 与同名 Autoload 冲突定为硬解析错误
## 「Class X hides an autoload singleton」，见 docs/engine-reference/godot/4.7.md K10。
## 单例以注册名 EventBus 作为全局句柄，class_name 冗余。）

## EventBus · 跨系统信号中枢（基础层 F5）。
## 参考：architecture §7 / §8.1；adr-004 §决定1。
##
## P3-2（本 issue）只建骨架 + Autoload 注册名占位：
##   - 不持有任何游戏态（纯路由，adr-004「单例不滥用」）。
##   - S1~S5 的跨系统 typed signals 严格按 architecture §7.2 总表登记，
##     留待对应核心层（C1~C5）issue 实现；本占位不预定义信号，避免私加跨系统信号。
##
## 设计纪律（adr-004 §5 / control-manifest 信号节）：
##   - 生产方 EventBus.xxx.emit(...)；消费方自愿 EventBus.xxx.connect(callable)。
##   - P5 不得私加跨系统信号（需 ADR/issue 评审）。
##   - 场景内高频信号走节点原生 signal / 节点分组，不塞总线。

# ── 已登记的 §7.2 跨系统信号（按总表实现，非私加；control-manifest：新增跨系统信号须 ADR/issue 评审）──

## C4→C5：遭遇清场（architecture §7.2 C4 发出表 / open-world §2.6）。
## 由战斗侧（C4/G5 EncounterSpawner）判定全灭或玩家脱战后发出；C5 据此更新遭遇 spawn_state。
## 载荷：encounter_id（遭遇表 id，StringName）。
signal encounter_cleared(encounter_id: StringName)

# TODO(p-followup): 其余 §7.2 跨系统信号随对应核心层（C1~C5）issue 落地登记。
