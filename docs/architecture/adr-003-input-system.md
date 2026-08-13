# ADR-003 · 输入系统（键鼠 + 手柄）

> 阶段：Phase 3 · 技术搭建（P3-1）　|　角色：程基岩（engineering-lead）
> 状态：已决策（带缺口标记）　|　影响层：基础层 F2
> 关联：`architecture.md` §2.3/§12；基线「PC 优先（Windows，键鼠 + 手柄）」；`combat.md` §6.6；`art-bible.md` §6.3（X5 可访问性）。

## 上下文

- 基线：PC 优先（Windows），**键鼠 + 手柄**双支持（`AGENTS.md` / `project-charter`）。
- 玩法动词分散多系统：移动/stance（G1→C5）、战斗（G1→C4）、采集/交互/对话（G4/G3→C5）、UI/面板（G7）、改写确认（G7→C3）。
- 可访问性（X5）：须可重映射；UI 双套提示图标（`combat §6.6`）；WCAG AA 目标（`art-bible §6.3`）。

## 备选方案

**A. 输入抽象层**
- A1 InputMap 动作（action）抽象 + `Input` 单例查询：在 `project.godot` InputMap 定义语义动作（`move_left`/`interact`/`basic_attack`...），每个动作绑键鼠 + 手柄事件；代码只查动作不查原始键。Godot 原生、重映射友好。
- A2 代码内硬编码键码扫描：不抽象，违背可重映射 + 双设备目标。
- A3 第三方输入插件：增加依赖，无必要。

**B. 手柄处理**
- B1 InputMap 直接绑手柄事件（`InputEventJoypadMotion`/`InputEventJoypadButton`）+ 死区配置：原生。
- B2 手动 `Input.get_joy_axis` 轮询 + 自写死区：重复造轮。

**C. UI 提示图标**
- C1 检测最后输入设备类型（键鼠/手柄）动态切提示图标。
- C2 固定双套图标常显（占屏）。

## 决定

1. **动作抽象**（A1）：F2 在 InputMap 定义语义动作集，**每个动作绑键鼠 + 手柄两个事件**（双绑定）。代码只调 `Input.is_action_pressed("move_left")` 等，**不碰原始键码**。动作集（P3-2 拍板，建议）：
   - 移动：`move_up/down/left/right`（WASD / 左摇杆）。
   - 姿态：`sprint`（Shift / L3）、`crouch`（Ctrl / R3 切换）。
   - 战斗：`basic_attack`（鼠标左键 / 手柄□/RT）、`skill_1`（鼠标右键 / 手柄△/RB，对应 `ability_system_magic_wind` MVP 唯一术法）。
   - 交互：`interact`（E / 手柄△）、`dialogue_next`。
   - UI：`ui_accept/cancel/menu/pause`、`panel_tab_next` 等（继承 Godot 默认 + 扩展）。
2. **手柄死区/抖动**（B1）：在 InputMap 事件上设 deadzone（倾向 0.2~0.3，⚠️ 精确值 + `InputEventJoypadMotion` API 待 P3-2 核对 K8）；摇杆方向由 `Input.get_vector("move_left","move_right","move_up","move_down")` 取（Godot 4 原生带死区处理）。
3. **可重映射**：提供设置菜单（X5 目标态）；P3-2 先建默认方案，重映射 UI 进 P4-1。
4. **UI 图标动态切换**（C1）：F2 监听最后输入设备类型（`Input.is_event_from_touch`/手柄事件检测 ⚠️待核），广播 `input_device_changed(keyboard|gamepad)` → G7 HUD/提示动态切图标。
5. **暂停/菜单**：`pause` 动作触发 `SceneTree.paused` + 暂停菜单（CanvasLayer，`process_mode = PROCESS_MODE_WHEN_PAUSED` ⚠️待核精确枚举名）。

## 后果

- **正面**：动作抽象让玩法代码（G1/G4/G7）与具体设备解耦，键鼠/手柄零额外分支；InputMap 原生重映射为 X5 可访问性铺路；双绑定一次满足基线「键鼠 + 手柄」。
- **负面 / 风险**：
  - 手柄按键映射跨厂商差异（Xbox/PS/通用）——用 Godot `joybutton` 抽象 + 控制器映射 DB（Godot 内建 SDL DB），不硬编码厂商键名。
  - 「最后输入设备检测」若 Godot API 不直接支持，需在 `_input` 里判 `event` 类型推断（P3-2 实现）。
  - 改写面板的「蓝图选择」需方向键导航（手柄无鼠标）——G7 改写面板 UI 须支持方向键焦点导航（`ui_focus_next` 等），P4-1 UX 规格 + P3 须确保 Control 焦点链完整。
- **缺口（A5）**：`InputEventJoypadMotion` 死区 API、设备检测 API、`process_mode` 暂停枚举名——标 `[待 P3-2 确认]`（K8 + K9 类）。

---

*程基岩（engineering-lead）· P3-1 ADR-003 · 待主创评审*
