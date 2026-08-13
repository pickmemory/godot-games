# ADR-004 · 节点 / 信号架构（vs 单例滥用）

> 阶段：Phase 3 · 技术搭建（P3-1）　|　角色：程基岩（engineering-lead）
> 状态：已决策（带缺口标记）　|　影响层：基础层 F5/F6；核心层部署形态
> 关联：`architecture.md` §3/§7/§8；`AGENTS.md`「节点分组、信号优先于全局单例滥用」；`systems-index.md` §3.1 DAG；各 GDD §6 信号契约。

## 上下文

- 基线铁律（`AGENTS.md`）：**节点分组、信号优先于全局单例滥用**。
- DAG 硬约束（`systems-index §3.1`）：5 系统跨系统通信须无环，共享数值唯一所有者；消费方只读契约、绝不反向写。
- 信号契约已由 5 GDD §6 完整定义（`architecture §7.2` 总表 ~30 条跨系统信号）。
- 系统部署需求：C1/C2/C3 持有跨场景 Loop A 态；C4/C5 与世界场景同生命周期；战斗态不持久化。
- 风险：Godot 易陷入「全 Autoload 单例 + 直接引用」反模式 → 全局可变态泛滥、DAG 失守、测试困难。

## 备选方案

**A. 跨系统通信机制**
- A1 EventBus Autoload（typed signals 中枢）+ 场景内直接信号/节点分组：跨系统信号走中枢解耦；场景内就近用原生信号。
- A2 全 Autoload 单例 + 直接方法调用（`S1.compute_delta(...)`）：直接但耦合高、DAG 易破、测试难。
- A3 纯节点分组广播（`call_group`）：无中心但弱类型、难调试、信号载荷传递不便。

**B. 状态型系统部署**
- B1 持久态系统 Autoload（C1/C2/C3）+ 场景态系统场景内节点（C4/C5）经分组定位。
- B2 全系统 Autoload：C4/C5 持场景态成全局单例，跨场景切换易残留脏态。
- B3 全系统场景内：C1/C2/C3 换场景丢 Loop A 态，不可接受。

**C. 生产/消费解耦**
- C1 信号驱动（生产方 emit，消费方自愿 connect）。
- C2 轮询查询（消费方每帧读生产方属性）：热路径开销 + 耦合。

## 决定

1. **EventBus Autoload 作为跨系统信号中枢**（A1）：单一 Autoload `EventBus`，声明全部跨系统 typed signals（`architecture §7.2` 总表）。生产方 `EventBus.cp_awarded.emit(...)`；消费方在 `_ready()` 里 `EventBus.cp_awarded.connect(_on_cp_awarded)`。**EventBus 不持有任何游戏态**（纯路由，守「单例不滥用」）。
2. **状态型系统部署**（B1）：
   - **Autoload**（合理单例，持有跨场景 Loop A 态）：`EventBus`(F5)、`DynastyLoader`(F3/F6)、`SaveManager`(F4)、`RewriteCausalityEngine`(C1)、`MainlineQuestDirector`(C2)、`PanelProgression`(C3)。
   - **场景内节点**（world 场景子，与世界同生命周期）：`OpenWorldSystem`(C5)、`CombatSystem`(C4)，`add_to_group("open_world_system"/"combat_system")` 供 Autoload 系统经 `get_tree().get_first_node_in_group(...)` 定位。
3. **场景内就近用原生信号/分组**：C4↔C5↔actors 在 world 场景内用节点直接 signal 或 `call_group`（如 C5 广播 `player_at_scene` 给 C4 感知节点）。**不**把场景内高频信号塞进 EventBus（避免总线噪声）。
4. **信号驱动，禁轮询**（C1）：跨系统状态变更经信号；消费方在回调内更新本地只读契约副本，**不**每帧读生产方属性。
5. **DAG 守护**（守 `systems-index §3.1`）：信号载荷是**只读事实/契约增量**（如 `cp_awarded(amount)` = 通知，不是「请改你的账户」）；消费方自行决定如何应用（如 C3 收 `cp_awarded` 自算 `CP_credited` 入账，C1 不知 C3 内部）。**P5 代码评审须拦截**：任何系统持有另一系统内部态引用、或直接写共享数值 → 违 DAG，拒合并。
6. **X1（旁白）纯消费**：X1 不持有态、不反向通信，只 connect 各 `*_voiced` 信号回放；人格基调经文案 id 接口注入（待审批），架构不耦合语气。
7. **调试钩子**：EventBus 提供 `debug_log_signals` 开关（boot 配置），运行时打印信号流，便于 P5/P6 追踪 DAG 违规与 Loop A 走查（呼应 `architecture §10`）。

## 后果

- **正面**：EventBus 解耦生产/消费（无直接引用），DAG 硬约束可机械校验（守 `systems-index §3.1`）；持久/场景态分离干净（C4/C5 不污染跨场景态）；信号驱动让心脏 C1 可独立单测（只 emit/收信号，不依赖 UI/世界，A7）；调试钩子让信号流可观测。
- **负面 / 风险**：
  - EventBus 成为「上帝总线」风险——缓解：信号名严格按 GDD §6 总表（§7.2），**禁止 P5 私加跨系统信号**（需 ADR 或 issue 评审）；场景内信号走原生不走总线。
  - Autoload C1/C2/C3 之间若直接引用仍破解耦——强制经 EventBus 通信（C2 派发 → `EventBus.node_activated.emit` → C1 收，非 `RewriteCausalityEngine.activate()`）。
  - 场景切换时 C4/C5 节点重建，Autoload 系统的 connect 若绑到旧节点会失效——C4/C5 在 world `_ready` 主动 connect EventBus；切出 world 时 disconnect（防悬挂回调）。⚠️ 生命周期管理待 P3-2 实测。
  - typed signal 在 Godot 4 重命名会静默断连——P3-2 须建 EventBus 信号清单为单一事实源（可考虑 codegen 或编辑器 lint）。
- **缺口（A5）**：typed signal 精确语法（参数类型注解）、`get_first_node_in_group` 性能、信号生命周期 connect/disconnect 模式——标 `[待 P3-2 确认]`（K5）。

---

*程基岩（engineering-lead）· P3-1 ADR-004 · 待主创评审*
