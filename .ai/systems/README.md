# 系统文档索引（.ai/systems/）

> 每个系统一页：**业务规则（带 `文件 · 符号` 锚点）+ 公式表 + 状态机 + 不变量 + 现状/规划严格分开**。
> 写作协议：先读源码再写；每条断言可被 grep 到锚点；不凭印象写数值（数值先查 `code-facts/`）。

## 新建系统文档模板

```markdown
# <系统名>（<源文件>）

> 源码：<文件>。结构（导出/依赖）见 ../code-facts/module-map.md。本页只写业务意图与规则。

## 业务规则
- R1: <规则> —— 锚点 `文件 · 符号名`
## 关键计算/公式
| 指标 | 公式 | 锚点 |
## 状态机 / 事件流（如有）
## 不变量 / 约束
## 现状 vs 规划（严格分开；规划注明"未实现"）
```

## 索引

| 系统 | 文档 | 状态 |
|---|---|---|
| 挖掘/工具天梯/掉落 | [mining-tools.md](mining-tools.md) | ✅ |
| 编年史（章节时间轴/NPC/对话/任务/演出） | [chronicle.md](chronicle.md) | ✅ |
| 昼夜/时辰/天体/灯光 | [day-night-lighting.md](day-night-lighting.md) | ✅ |
| 探索结构/罗盘 | [explore.md](explore.md) | ✅（MC-6 D-2 新建） |
| 奇遇（编年之间的随机事件层） | [encounters.md](encounters.md) | ✅（MC-6 D-3 新建） |
| 体素世界（chunk/地形色彩带/网格化/碰撞） | [voxel-world.md](voxel-world.md) | ✅（D-1 时补齐：色彩带+裸岩+河滩规则；碰撞细节待后续充实） |
| 农耕/建造定居 | — | 待补 |
| 存档（差分/适配器） | — | 待补 |
| 声音层（BGM 四态/环境分层/事件旁白；含 sfx.js 程序合成） | [audio.md](audio.md) | ✅（MC-6 D-4 新建） |
| 流水线（.github 接力机制） | 见 AGENTS.md「接力制作机制」+ known-issues 流水线案 | ✅（散页） |

> 待补页的义务：任何 agent 大改对应系统时，顺手把该页写出来（协议见 ../CONTEXT.md 维护规矩）。
