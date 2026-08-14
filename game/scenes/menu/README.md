<!-- 场景 · 主菜单 + 存档槽位 + 确认弹窗（轨道 B 系统材质，ux-spec §4/§9）· P5-8（issue #20） -->
# scenes/menu/

垂直切片开场链路入口：`boot.tscn → main_menu.tscn → 新游戏/继续 → world.tscn`（architecture §8.4 / §9.2）。

## 文件
| 文件 | 职责 | 回引 |
|---|---|---|
| `main_menu.tscn` + `main_menu.gd` | 主菜单（ux-spec §4 关键屏幕一 MM）：标题区 / 条目区（继续/新游戏/存档槽位/设置/退出）/ 底部冷光数据条；内嵌设置子页 | ux-spec §4.2/§4.3 |
| `save_slot_panel.tscn` + `save_slot_panel.gd` | 存档槽位子面板（ux-spec §4.3）：≥3 槽，每槽章节/Δ累计/世界线/时间/朝代；空槽直写、非空二次确认（§9.3）。**主菜单/未来暂停菜单共用**（§15 风险3 DRY） | ux-spec §4.3 |
| `confirm_dialog.tscn` + `confirm_dialog.gd` | 通用确认弹窗（ux-spec §9.1）：模态·居中·默认焦点=取消（防误触高危） | ux-spec §9.1 |

## 设计纪律
- **greybox 占位**：ColorRect + StyleBoxFlat 纯色 + 系统材质字体；真实开场卷轴/冷光材质由 **P5-10（art-director）** 替换（本 issue 不生成真实美术）。
- **路径决策**：roadmap（issue #20）指定 `game/scenes/menu/`，与 `game/scenes/rewrite_node_chibi/` 独立场景惯例一致；ux-spec §3.1 建议 `scenes/ui/`，以 roadmap 为准。
- **存档所有权**：本目录只做 UI；持久化逻辑在 `scripts/autoload/save_manager.gd`（X4）。
- **输入**：守 ux-spec §4.4（ui_up/down/left/right/accept/cancel；主菜单**不响应 ui_pause**）；双设备键鼠+手柄（adr-003）。

## 验证
- `$GODOT_BIN --headless --import --quit`（在 `game/`）无错误。
- 单元测试：`res://tests/unit/test_save_manager.tscn`（28 项，覆盖原子写/读档/槽位摘要/一致性校验/新游戏继续/自动存档/schema 迁移）。
