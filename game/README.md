# 《赤壁·改写者》垂直切片 · Godot 4.7 工程

> Phase 3 · P3-2 · 工程骨架 + 玩家可移动最小场景 · 程基岩（engineering-lead）
> 基线锚点：`AGENTS.md`（Godot 4.7.1 stable / GDScript / 渲染 `2d` / 拉伸 `canvas_items` / 工程根 `game/`）。
> 架构输入：`docs/architecture/architecture.md`（§2.2 目录 / §2.3 配置 / §8 场景树 / §13 API 缺口）、
> `adr-001`（渲染拉伸）、`adr-003`（输入）、`adr-004`（节点/信号）、`control-manifest.md`。

## 目录结构（对齐 architecture §2.2 + §6.2 数据落点表）

```
game/
├── project.godot            # 由 tests/build/generate_project.gd 权威生成（见下）
├── scenes/
│   ├── boot.tscn            # 启动场景（architecture §8.4）
│   ├── world/world.tscn     # 开放世界主场景（L0~L5 叠层 + Player + Camera2D，§8.2）
│   ├── actors/player.tscn   # 玩家 actor 场景（G1，architecture §3.3）
│   └── ui/ panel/           # 系统 UI 场景占位（轨道 B，后续 issue）
├── scripts/
│   ├── foundation/          # F1~F7（零游戏知识；data_resources/ 存数据驱动 Resource 类）
│   ├── core/                # C1~C5（本 issue 不实现）
│   ├── gameplay/            # G1~G9 场景表面（actors/ world 等）
│   └── autoload/            # EventBus / DynastyLoader / SaveManager（§8.1 注册名）
├── data/                    # 数据驱动（GDD 数值落点，见各子目录 README 对齐 §6.2）
│   ├── globals/             # 全局参数：player_movement_globals.tres（本 issue 数据驱动演示）
│   └── variables/ nodes/ blueprints/ verbs/ causal_links/ quests/ panel/ progression/skills/
│       combat/ skills/ enemies/ world/ intel/ encounters/ npcs/ dynasties/
├── assets/                  # 美术/音频资产（林绘澄/阮和鸣管；本 issue 仅生成占位 TileSet）
└── tests/
    ├── build/generate_project.gd   # project.godot + 测试资产的可复现生成器
    └── unit/                # 单测脚手架（严守真/程基岩 P4 起）
```

## project.godot 的生成方式（知识诚实，不手写易错格式）

`project.godot` 的 **InputMap 段**（`Object(InputEventKey,...)` / `Object(InputEventJoypadMotion,...)` 内联格式）
跨 Godot 4.x 版本变化且冗长，手写极易出错。本工程采用**可复现生成器**权威产出：

```
$GODOT_BIN --headless --path game tests/build/setup.tscn   # 运行一次即生成/刷新
```

- 生成器：`tests/build/generate_project.gd`（经 `tests/build/setup.tscn` 挂载运行）。
- 产出：`project.godot`（设置 + InputMap 双绑定 + Autoload）、`assets/tilesets/test_tileset.tres`、
  `data/globals/player_movement_globals.tres`。
- InputMap 动作均用 Godot 常量（`KEY_W` / `JOY_BUTTON_*` / `JOY_AXIS_*`）构造，**不臆造键码/索引**。
- 生成后 `project.godot` 即为本 issue 的交付物；如需调整 InputMap，**改生成器再重跑**，勿手改 `project.godot`。

## 验证命令（AGENTS.md 硬门）

```
cd game && $GODOT_BIN --headless --import --quit     # 零报错通过
```

## 范围（守垂直切片，本 issue 不实现）

- 仅最小可移动场景：移动（WASD + 左摇杆）+ stance（sprint/crouch）+ Camera2D 跟随。
- C1~C5 系统逻辑、美术资产、存档读写、寻路烘焙、重映射 UI → 留后续 issue（见 issue #10 范围）。
