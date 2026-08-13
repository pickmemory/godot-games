# ADR-001 · 渲染管线与拉伸策略

> 阶段：Phase 3 · 技术搭建（P3-1）　|　角色：程基岩（engineering-lead）
> 状态：已决策（带缺口标记）　|　影响层：基础层 F1
> 关联：`architecture.md` §2/§8/§11/§13；`AGENTS.md` 渲染 `2d` / 拉伸 `canvas_items`；`art-bible.md` §1.3/§3.1/§3.2/§8.1。

## 上下文

- 基线锁定：2D 俯视角开放世界；Godot 4.7.1 stable；PC 优先（Windows）；`project.godot` 渲染 `2d`、拉伸模式 `canvas_items`（`AGENTS.md`）。
- 美术约束（`art-bible`）：设计分辨率 1920×1080；64×64px Tile；渲染叠层 L0~L5（L5 系统叠层为轨道 B 冷光唯一入口）；4K 经拉伸适配，不重绘美术。
- 现状：`game/` 工程尚未创建（P3-2），`project.godot` 字段待落地。

## 备选方案

**A. 渲染方法（`rendering/renderer/rendering_method`）**
- A1 `gl_compatibility`：OpenGL 3.3 / WebGL2 级；2D 友好、PC 全兼容、为移动端愿景铺路；无 3D 高级特性（本项目不需要）。
- A2 `forward+`：现代 Vulkan 默认；2D 亦支持，但为 3D 重场景优化，对本 2D 项目属浪费且兼容面窄。
- A3 `mobile`：Vulkan 移动级；2D 支持，介于前两者。

> ⚠️ **知识诚实缺口**：`AGENTS.md` 写「渲染 `2d`」，但 Godot 4 **无字面 "renderer=2d" 项目设置**——2D 由场景节点类型决定，渲染方法三选一是 `gl_compatibility`/`mobile`/`forward+`。「渲染 2d」的本意是「2D 优先（无 3D）」，非某渲染方法开关。此澄清待 P3-2 复核。

**B. 拉伸模式（`window/stretch/mode`）**
- B1 `canvas_items`（基线锁定）：缩放 CanvasItem（2D 内容），UI 与世界同步缩放，像素/矢量一致。
- B2 `disabled`：不缩放（不同分辨率留黑边/裁切）——与「4K 适配」冲突。

**C. 拉伸纵横比（`window/stretch/aspect`）**
- C1 `expand`：视口随宽屏扩展（给上方战场更多可视区，适配超宽屏/4K），推荐。
- C2 `keep`：固定 16:9 留黑边（最安全但浪费屏）。
- C3 `keep_width` / `keep_height`：单轴固定。

## 决定

1. **渲染方法**：`rendering/renderer/rendering_method = gl_compatibility`（倾向）。⚠️ 待 P3-2 在 `game/project.godot` 实测确认（若 4.7 默认/兼容性无异常即采纳；并复核 `AGENTS.md`「渲染 2d」本意）。**本项目不使用任何 3D 场景/特性**。
2. **拉伸模式**：`display/window/stretch/mode = canvas_items`（基线，不可改）。
3. **纵横比**：`display/window/stretch/aspect = expand`（倾向）。
4. **视口**：`display/window/size/viewport_width/height = 1920/1080`（`art-bible §3.1`）；UI 锚点按安全区留边。
5. **叠层组织**（`art-bible §3.2`）：L0 视差远景 / L1 地面 TileMapLayer / L2 实体 TileMapLayer / L3 角色 YSort / L4 前景半透 / **L5 `CanvasLayer` 系统叠层（轨道 B 冷光唯一入口）**。冷光**严禁**出现在 L1~L4。
6. **Tile 像素密度**：64×64px（`art-bible §8.1`）；32×32 仅远景备选。

## 后果

- **正面**：gl_compatibility 给 2D 最广兼容（PC + 移动愿景）；`canvas_items` + `expand` 让 1920×1080 美术资产无损铺到 4K/超宽屏，无需重绘（`art-bible §8.4`）；叠层纪律落地「双轨反差」（冷光仅 L5）。
- **负面 / 风险**：
  - `expand` 下超宽屏可能露出更多战场（影响俯视战斗信息密度），需 zoom/相机边距配合（P3-2 调）。
  - 4K 经缩放可能像素糊化——手绘风不强制 pixel-perfect（`art-bible §8.1`），可接受；若主菜单 key art 要求锐利则单独高分辨率资产（`art-bible §8.4`）。
  - gl_compatibility 不支持部分高级后处理（如某类屏幕空间效果）——本作 Δ glitch/扫描线用 2D shader/AnimationPlayer 实现，不依赖高级后处理。
- **缺口（A5）**：gl_compatibility 默认性、`Camera2D` zoom/边距、`YSort` 节点用法、`TileMapLayer` 分层（含碰撞层）——均标 `[待 P3-2 确认]`（`architecture §13` K1~K4/K9），P3-2 工程骨架实测后回填本 ADR 与 `docs/engine-reference/godot/4.7.md`。

---

*程基岩（engineering-lead）· P3-1 ADR-001 · 待主创评审*
