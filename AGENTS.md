# AGENTS.md — 自主接力制作 · AI 协作约定

> 任何 AI agent（本地 pi 会话 / GitHub Actions 流水线里的 pi）在本项目干活前必读。
> 本项目用「主理人派单 + 专家接力」的自主流水线推进，机制见 `.github/`。

## 项目一句话
一款 **2D 俯视角开放世界** ARPG：玩家获得「**改写/因果系统**」，穿越到 **三国·赤壁之战**，
通过探索 / 战斗 / 结盟改写关键历史节点，系统计算"历史偏差"并反馈成长。当前阶段：**垂直切片 / 可玩 Demo**（1 朝代 + 核心循环）。

## 设计基线（已锁定，勿擅改；改动需主创确认）
| 维度 | 决定 |
|---|---|
| 交付形态 | 垂直切片 / 可玩 Demo（1 朝代 + 核心循环） |
| 视角/维度 | 2D 俯视角开放世界（Godot 4.7 `TileMapLayer`） |
| 系统心脏 | 改写/因果引擎，外包 主线任务驱动 + 面板成长 |
| 朝代舞台 | 三国 · 赤壁之战 |
| 平台 | PC 优先（Windows，键鼠 + 手柄） |
| 基调 | 正剧 + 轻度 litRPG 元幽默 + 民间志怪式奇幻（非纯修仙） |
| 战斗 | 俯视角实时轻动作 ARPG（普攻 + 系统术法/技能） |
| 核心循环 | 任务→探索→改写→反馈（Loop A） |
| 引擎/语言 | Godot 4.7.1 stable / GDScript |
| 规模 | 主创 + AI 专家团，小而锋利 |

## 专家团与 SOP（详见 `team/*.md`）
七阶段流水线，角色：游承峰(主理人/编排) · 文策渊(design-strategist/设计叙事) · 程基岩(engineering-lead/技术引擎) ·
林绘澄(art-director/美术) · 阮和鸣(audio-director/音频) · 严守真(quality-lead/QA) · 路远行(release-ops/发布)。
- **阶段**：0诊断 → 1概念孵化 → 2系统设计 → 3技术搭建 → 4预制作 → 5制作 → 6打磨 → 7发布。
- **质量门**：PASS / CONCERNS / FAIL（见 `team/README.md`）。
- **铁律**：用户始终掌舵；高影响动作（提交/发布/删除）须审批；专业产出以成员结论为准；编排者只编排不建造。
- 本流水线**跳过多代理会审**，以**单代理自验证**替代（文档查结构 / 代码跑 Godot headless）。

## 目录结构
```
godot-games/
├── team/                    # 专家团定义（人格 + SOP）
├── docs/
│   ├── project-charter.md      # 项目宪章（基线 + 循环 + 范围）
│   ├── roadmap.md              # 路线图（主理人据此派单）
│   ├── design/gdd/             # 游戏概念 + 逐系统 GDD
│   ├── design/art/             # 美术圣经 + 资产规格
│   └── architecture/           # 主架构 + ADR（程基岩产）
├── game/                    # Godot 4.7 工程（project.godot 在此）— Phase 3 起
└── .github/                 # 自主接力流水线（workflow / loop / prompts）
```

## 接力制作机制
- **主理人步骤**（`.github/orchestrator-prompt.md`）：读 `docs/roadmap.md`，为第一个未完成项创建 `agent-build` issue（带角色标签），在 roadmap 标记 `- [~] #N 已派发`。
- **专家步骤**（`.github/agent-build-prompt.md`）：认领最老 `agent-build` issue，按对应 `team/<角色>.md` 人格产出交付物到指定路径，自验证后由 workflow 合入 main。
- 触发：cron 每 15min；在跑则跳过；GLM 不可用则退出等下次；队列空则秒退。

## Godot 4.7 约定
- 工程根在 `game/`；`project.godot` 渲染 `2d`，拉伸模式 `canvas_items`。
- 脚本用 GDScript；节点分组、信号优先于全局单例滥用。
- 数据驱动：GDD 数值落 `game/data/*.tres` / `*.json`，代码读取，避免硬编码。
- 朝代 = TileSet + 遭遇表 + BGM 的组合，可热切换（为多朝代扩展铺路）。
- 验证：`$GODOT_BIN --headless --import --quit`（在 `game/` 下）。

## 多模态资产生成（MiniMax `mmx` CLI · Token Plan 驱动）
CI 装了 `mmx`（`npm i -g mmx-cli`）并配 `MINIMAX_API_KEY`（订阅 Key，区域 cn=api.minimaxi.com）。美术/音频类交付物**优先用 mmx 出真实占位资产**，而非纯规格：
- 图像 `mmx image "<prompt>" --aspect-ratio 16:9 --out-dir game/assets/sprites/`（image-01）
- BGM `mmx music generate --prompt "<风格/情绪>" --instrumental --out game/assets/audio/x.mp3`（music-3.0，纯器乐）
- 旁白/配音 `mmx speech synthesize --text "..." --voice <音色> --out game/assets/audio/x.mp3`（speech-2.6-hd；“系统”旁白用冷静中性音色）
- 视觉核对 `mmx vision <图>`
生成前必读 `docs/design/art/art-bible.md` 对齐配色/风格/命名；输出到 `game/assets/`，命名遵循 `asset-manifest.md`。mmx 未装/无 key 时降级纯文档。

## 红线（违反会被 workflow 拒合并）
- 不做 git 操作（add/commit/push/branch）——workflow 管 git。
- 不碰密钥、`.env*`、`.github/workflows/`（除非 issue 明确要求）。
- 不删测试或弱化校验来"让它过"。
- 不臆造引擎 API；不确定就标记。
- 只做当前 issue 的事，不顺手改别的；需用户决策的写进 issue comment。
