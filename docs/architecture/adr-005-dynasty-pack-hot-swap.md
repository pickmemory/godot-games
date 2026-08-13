# ADR-005 · 朝代热切换（TileSet + 遭遇表 + BGM 组合）

> 阶段：Phase 3 · 技术搭建（P3-1）　|　角色：程基岩（engineering-lead）
> 状态：已决策（本切片只铺路，不实现切换）　|　影响层：基础层 F3/F6；核心层 C5
> 关联：`architecture.md` §6.4；`AGENTS.md` Godot 约定「朝代热切换」；`game-concept.md` §7.3；`systems-index.md` §1.2 X6；`open-world.md` §3.1/§3.7；`art-bible.md` §5.1/§9.1。

## 上下文

- 基线（`AGENTS.md`）：**朝代 = TileSet + 遭遇表 + BGM 的组合，可热切换**（为多朝代扩展铺路）。
- 范围（`game-concept §7.3` / `systems-index §1.2 X6`）：**跨朝代热切换明确愿景外**，本切片仅 1 朝代（三国·赤壁）；但要求「架构不挡路」——换数据即可换朝代。
- 各 GDD §3.7 已为热切换留口：所有数据带 `dynasty` 命名空间；公式朝代无关；`save_state` 的 `active_dynasty` 字段为多朝代分组留维度。
- 命名（`art-bible §9.1`）：朝代命名空间 `dyn_threekingdoms_chibi`，多朝代换此字段。

## 备选方案

**A. 朝代数据组织单位**
- A1 朝代包（`DynastyPackData` Resource 聚合 TileSet 引用 + 遭遇表包 + BGM 包 + 据点/场所集 + MVP 子集）：换朝代 = 换一个包。
- A2 散列文件无聚合（TileSet/遭遇/BGM 各自独立加载）：无统一入口，切换逻辑分散易错。
- A3 每朝代独立 Godot 工程：最重，跨朝代偏差累积/穿越者维度无法共享。

**B. 加载时机**
- B1 启动/进 world 一次性加载当前朝代包（本切片单朝代）。
- B2 运行时热切换（多朝代无缝）：愿景，需异步加载/卸载/状态迁移，本切片不做。

**C. 公式与逻辑朝代相关性**
- C1 公式/逻辑朝代无关，只数据带朝代：换包即换朝代。
- C2 公式/逻辑含朝代分支：换朝代要改代码，违背「热切换」。

## 决定

1. **朝代包为单位**（A1）：`data/dynasties/<dynasty_id>.tres`（`DynastyPackData`）聚合：`tileset_refs`(ground/props/collision) + `encounter_table_pack` + `bgm_pack` + `strongholds[]` + `scenes[]` + `mvp_stronghold_subset`/`mvp_scene_subset`（`open-world §3.1`）。
2. **加载机制**（B1）：F3 `DynastyLoader` 在 boot 据 `active_dynasty`（存档字段，默认 `dyn_threekingdoms_chibi`）**一次性加载**朝代包 + 递归引用；进 world 场景据包实例化 TileMap/遭遇/情报/NPC。**本切片不实现运行时热切换**（B2 愿景）。
3. **公式/逻辑朝代无关**（C1，硬约束）：C1 的 Δ/CP/M 公式、C4 的伤害/感知公式、C2 的派发逻辑、C5 的探索流程**不含任何朝代硬编码**；换朝代只换数据包，不改 GDScript。**P5 评审拦截**：代码中出现朝代字符串字面量（非 `dynasty` 字段读取）→ 违规。
4. **命名空间隔离**：所有静态数据带 `dynasty: dyn_threekingdoms_chibi` 字段；`DynastyLoader` 按命名空间加载，跨朝代 id 不冲突（如 `n2_east_wind` 与未来 `dyn_x.n2_x` 隔离）。
5. **穿越者维度共享**：CP 账户/技能解锁属「穿越者本体」（C3），**不按朝代分组**（`panel §3.6`）；C1 改写态/任务态按朝代分组（`save_state` 已留 `active_dynasty` + 可加 `dynasty_progress` 维度）——**跨朝代偏差累积为愿景，本切片不做**，但数据结构不挡路。
6. **本切片范围红线**：仅加载 1 朝代；**不做**跨朝代切换 UI、跨朝代偏差总账、多朝代并存。架构验收点 =「换一个 `dynasty_id` 包 + 重启即换朝代」，无需改代码。

## 后果

- **正面**：朝代包为单位使「换包换朝代」成立，落地基线愿景且不超范围；公式朝代无关 + 命名空间隔离让未来加朝代是纯数据工作；穿越者维度共享避免重复养成（符合「一个穿越者多朝代」高概念）。
- **负面 / 风险**：
  - 朝代包聚合大（TileSet + 遭遇 + NPC + 情报全在一个命名空间）——加载耗时，需 F3 异步加载 + 加载提示（目标态）；本切片单朝代可同步加载。
  - 跨朝代数据一致性（如同一 NPC 在不同朝代）——本切片 N/A；愿景期需 NPC id 跨朝代映射规范。
  - 若 P5 误在公式写朝代分支会破坏热切换——靠 ADR + 代码评审 + F3 校验（扫描朝代字符串字面量）兜底。
  - BGM 包（音频）本架构只占位引用，实际由阮和鸣（audio-director）定义；F7 音频总线 hook 需与 DynastyLoader 协调（播放当前朝代 BGM）。
- **缺口（A5）**：异步加载 API（`load_threaded_*`）、朝代包内大 TileSet 内存预算——标 `[待 P3-2/P6 确认]`（K7）。

---

*程基岩（engineering-lead）· P3-1 ADR-005 · 待主创评审*
