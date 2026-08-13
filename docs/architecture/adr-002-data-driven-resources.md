# ADR-002 · 数据驱动方案（.tres / .json 与代码边界）

> 阶段：Phase 3 · 技术搭建（P3-1）　|　角色：程基岩（engineering-lead）
> 状态：已决策（带缺口标记）　|　影响层：基础层 F3；核心层全部（读数据）
> 关联：`architecture.md` §5/§6；`AGENTS.md` 数据驱动；`art-bible.md` §9 命名；各 GDD §3 数据契约。

## 上下文

- 基线（`AGENTS.md`）：GDD 数值落 `game/data/*.tres` / `*.json`，代码读取，避免硬编码；命名 `snake_case` + 朝代命名空间 `dyn_threekingdoms_chibi`。
- 5 个系统 GDD（§3）已给出完整字段契约（节点/变量/蓝图/动词/因果链/技能/敌人/遭遇/情报/朝代包等），均标「`.tres` 资源类名/类型映射 `[待程基岩确认]`」。
- 范围（`game-concept §7`）：垂直切片 = 1 朝代 + Loop A；不做商城/Live Ops/程序化生成历史线（手工设计 + 数据驱动）。

## 备选方案

**A. 静态游戏数据载体格式**
- A1 自定义 `Resource`（`.tres`，GDScript `class_name X extends Resource`）：编辑器可视化、强类型、引用安全（拖拽引用）、`ResourceLoader` 缓存、Git diff 友好。
- A2 全 `JSON`：外部工具/翻译友好，但弱类型、引用需字符串、无编辑器可视化、易漂移。
- A3 全硬编码 Dictionary：最不数据驱动，违背基线。

**B. 哪些数据用 JSON**
- B1 长文本/对话/本地化用 JSON，其余 .tres（混合）。
- B2 全 .tres（含长文本）。

**C. 资源类组织**
- C1 集中放 `scripts/foundation/data_resources/`（基础层，被核心/玩法读）。
- C2 分散到各系统 scripts/。

**D. 运行时态 vs 静态数据边界**
- D1 静态数据（.tres）只读；运行时态入存档（ConfigFile/序列化），绝不写回 .tres。
- D2 运行时态也写 .tres（每存档一个 .tres）。

## 决定

1. **静态游戏数据 = 自定义 Resource（`.tres`）**（A1）。资源类 `class_name` 用 PascalCase（如 `RewriteNodeData`、`EnemyData`、`EncounterTableData`、`DynastyPackData`），放 `scripts/foundation/data_resources/`（C1，基础层零游戏知识、可独立测）。文件/字段 id 用 `snake_case`（如 `node_id: n2_east_wind`），对齐 `art-bible §9`。
2. **JSON 用于长文本/对话/本地化**（B1）：对话、`system_*_voice` 多语言文本、事件脚本用 `data/**.json`；其余 .tres。理由：翻译协作 + 外部编辑 + 热加载。
3. **运行时态绝不写回 .tres**（D1）：C1/C2/C3/C5 持久态经 F4 SaveManager 序列化到存档（`architecture §9`）。静态 .tres 是只读蓝图。
4. **数据落点**：按 `architecture §6.2` 表（拍板 GDD「以 ADR 为准」者）。**`skills/*.tres` 所有权澄清**：`data/skills/<ability_id>.tres`（C4 执行）/ `data/progression/skills/<skill_id>.tres`（C3 解锁），按 ability_id join（两段式，回应当 `combat §7.7②` / `open-world §7.6④`）。
5. **加载机制**：F3 `DynastyLoader` 在 boot 加载朝代包 + 递归引用（TileSet/遭遇/BGM），`ResourceLoader.load`（⚠️ 大资源 `load_threaded_*` 待 P3-2 核对 K7）。静态数据缓存；按需加载节点/敌人。
6. **数据校验**：F3 `validate_data()` 在 boot 跑——`Σw_i=1.0` 归一化、蓝图可达性（`rewrite-causality §5.5`）、`causal_links`/`existence_dep` 引用与 `condition` 可解析、`ability_id` join 一致。**失败即拒绝启动报错**（不静默降级）。

## 后果

- **正面**：强类型 .tres 在编辑器内可视化调数值（设计师可零代码迭代，呼应 `team/engineering-lead.md`「gameplay 数据驱动」）；引用安全（改 id 编辑器即报红）；静态/运行时边界清晰，存档不被污染；数据校验前置把 `rewrite-causality §5.5` 数据健壮性问题挡在启动期。
- **负面 / 风险**：
  - .tres 二进制 diff 噪声——`.tres`（文本）优于 `.res`（二进制），Git 友好；约定**提交 .tres 不提交 .res**。
  - 自定义 Resource 类多（~20+），需 P3-2 一次性建好基类（如 `GameData` 基类带 `dynasty`/`id` 公共字段 + `_validate()` 钩子）。
  - JSON 长文本与 .tres 引用的**一致性**（如对话 id ↔ 任务文案）需校验纳入 F3 `validate_data()`。
  - **资源循环引用风险**（如 节点↔蓝图互相引用）——避免循环，用 id 字符串引用替代直接 Resource 引用（`ability_id` join 模式推广）。
- **缺口（A5）**：`ResourceLoader.load_threaded_*` 是否必要、自定义 Resource 的 `@export` 数组/字典类型限制、`ResourceSaver` 用法——标 `[待 P3-2 确认]`（K6/K7）。

---

*程基岩（engineering-lead）· P3-1 ADR-002 · 待主创评审*
