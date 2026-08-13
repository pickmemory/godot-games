extends Node
## （注：Autoload 脚本不加 class_name —— Godot 4.7 硬错误，见 EventBus 脚本注与 engine-reference K10。）

## SaveManager · 存档/读档/槽位/跨系统原子写（基础层 F4 = X4）。
## 参考：architecture §9 / control-manifest 存档节；adr-004（注册名）。
##
## P3-2 仅占位：跨系统原子写 + 一致性校验（§9.2）+ Loop A 持久态快照的实际逻辑
## 留待 X4（存档）issue。当前仅保留 Autoload 注册名。
##
## 红线（control-manifest 存档节）：
##   - C1/C2/C3/C5 持久态单次事务写入（临时文件 + rename），禁分散写。
##   - Loop B（HP/BF/alert/敌人实例）不持久化；读档满血 + 清警戒 + C5 重建遭遇。

# TODO(p4-save): 实现 atomic_save() / load_slot() / 一致性校验（architecture §9.2）。
