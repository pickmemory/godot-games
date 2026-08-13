extends Node
## （注：Autoload 脚本不加 class_name —— Godot 4.7 硬错误，见 EventBus 脚本注与 engine-reference K10。）

## DynastyLoader · 朝代包加载 + 静态数据校验（基础层 F3/F6）。
## 参考：architecture §6.3 / §8.1 / §8.4；adr-004 / adr-005。
##
## P3-2 仅占位：加载 active_dynasty + 跑 F3 validate_data()（architecture §6.3：
## Σw_i=1.0 / 蓝图可达 / causal_links 引用 / ability_id join；失败即拒启动报错）
## 的实际逻辑留待 S5 核心层 issue。当前仅保留 Autoload 注册名与朝代命名空间常量。

## 当前朝代命名空间（art-bible §9.1 / open-world §0；垂直切片仅 1 朝代）。
const DEFAULT_DYNASTY: StringName = &"dyn_threekingdoms_chibi"

var active_dynasty: StringName = DEFAULT_DYNASTY
