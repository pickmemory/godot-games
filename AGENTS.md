# AGENTS.md — 自主接力制作 · AI 协作约定

> 任何 AI agent（本地 pi 会话 / GitHub Actions 流水线里的 pi）在本项目干活前必读。
> 本项目用「主理人派单 + 专家接力」的自主流水线推进，机制见 `.github/`。

## 项目一句话
**《三国长卷》**：体素沙盒 × 亲历式历史剧。你不是改写者，你是长卷里的一个名字——从 184 年黄巾之乱的流民开始，在真实编年里活着：挖矿种田筑屋是生计，烽火烧过来时怎么活下来是抉择。**MC 骨架 100%（手感/第一夜/工具天梯）+ 平民视角亲历真实三国历史**。设计信条：先给恐惧，再给天梯，最后给沙盒。

## 设计基线（已锁定，勿擅改；改动需主创确认）
| 维度 | 决定 |
|---|---|
| 品类 | 体素沙盒（Minecraft-like）× 亲历式历史叙事（平民尺度，非英雄、非改写） |
| 引擎/语言 | **纯 Web：HTML + 原生 ES Modules + Three.js（CDN import map，零构建）** |
| 游戏根 | `web/`，入口 `web/index.html`，源码 `web/src/*.js` |
| 美术 | Kenney/Quaternius（CC0）+ OpenGameArt（仅 CC0/CC-BY）+ mmx 中文特调；程序化 canvas 仅占位 |
| 上架 | 发布期 Electron + steamworks.js 打包 Steam；存档层抽象（开发期 localStorage → Steam Cloud 同构替换） |
| 平台 | PC 优先（Windows，键鼠 + 手柄 Gamepad API） |
| 章节结构 | 章节 = 真实编年（黄巾 184 → 讨董 190 → ……），数据驱动，世界状态随章节真实迁移 |
| 核心循环 | 挖/建手感包 → 第一夜弧线 → 工具天梯 → 生计定居 → 历史事件冲刷（每层动机咬合） |
| 规模 | 主创 + AI 专家团，小而锋利；开发全程浏览器即开即测 |

## 专家团与 SOP（详见 `team/*.md`）
七阶段流水线，角色：游承峰(主理人/编排) · 文策渊(design-strategist/设计叙事) · 程基岩(engineering-lead/技术引擎) ·
林绘澄(art-director/美术) · 阮和鸣(audio-director/音频) · 严守真(quality-lead/QA) · 路远行(release-ops/发布)。
- **质量门**：PASS / CONCERNS / FAIL（见 `team/README.md`）。
- **铁律**：用户始终掌舵；高影响动作（提交/发布/删除）须审批；专业产出以成员结论为准；编排者只编排不建造。
- 本流水线**跳过多代理会审**，以**单代理自验证**替代（文档查结构 / 代码跑 `node --check`）。

## 目录结构
```
godot-games/
├── web/                     # 游戏根（index.html + src/ + assets/）
│   ├── src/
│   │   ├── main.js          # 装配/主循环/昼夜
│   │   ├── world.js         # chunk 管理（16×16×64，视距加载/卸载）
│   │   ├── terrain.js       # simplex 噪声地形 + 树
│   │   ├── mesher.js        # 面剔除网格化
│   │   ├── blocks.js        # 方块注册表（数据驱动）
│   │   ├── textures.js      # 纹理 atlas（Kenney 优先，程序化占位）
│   │   ├── player.js        # 第一人称 + AABB 体素碰撞 + 飞行
│   │   ├── interaction.js   # DDA 射线选块 + 挖掘/放置 + 手感反馈
│   │   └── ui.js            # 准星/hotbar/FPS
│   └── assets/              # 第三方素材 + CREDITS.md（许可登记，必更）
├── docs/
│   ├── roadmap.md           # 路线图（主理人据此派单）
│   └── superpowers/         # 设计文档 + 实施计划
├── team/                    # 专家团定义（人格 + SOP）
└── .github/                 # 自主接力流水线（workflow / loop / prompts）
```

## 接力制作机制
- **主理人步骤**（`.github/orchestrator-prompt.md`）：读 `docs/roadmap.md`，为第一个未完成项创建 `agent-build` issue（带角色标签），在 roadmap 标记 `- [~] #N 已派发`。
- **专家步骤**（`.github/agent-build-prompt.md`）：认领最老 `agent-build` issue，按对应 `team/<角色>.md` 人格产出交付物到指定路径，自验证后由 workflow 合入 main。
- 触发：cron 每 15min；在跑则跳过；GLM 不可用则退出等下次；队列空则秒退。

## Web 工程约定
- **零构建**：不用 npm/bundler/打包器；`web/index.html` 用 import map 从 CDN 引 Three.js，ES Modules 直跑。
- 模块边界：模块间只通过导出签名通信（见 `docs/superpowers/plans/` 各计划 Interfaces 段）；新增方块只改 `blocks.js` 注册表（数据驱动，勿散落硬编码）。
- 性能：chunk 生成/网格化分帧入队；贴图 NearestFilter 像素风；单 draw call per chunk。
- **验证**：`node --check web/src/*.js` 全绿 + 模块/文档结构齐全；浏览器手测按交付物附带的验收清单。
- 章节/事件数据落 `web/data/*.json`，代码读取，避免硬编码（为 MC-3 历史长卷引擎铺路）。

## 美术与资产政策（红线）
- **只准 CC0 / CC-BY**：Kenney.nl、Quaternius.com 全 CC0 可商用；OpenGameArt **禁用 CC-BY-SA 与 GPL**（传染，闭源商用风险）。
- 每引入一个第三方素材必须登记 `web/assets/CREDITS.md`（来源 URL + 许可 + 用途）；review 校验。
- mmx 特调仅用于 CC0 库没有的：中文书法 UI、三国专属方块变体、中文旁白配音、中式乐器 BGM。生成前对齐 `docs/design/`（产出后）的美术圣经。

## 多模态资产生成（MiniMax `mmx` CLI · Token Plan 驱动）
CI 装了 `mmx`（`npm i -g mmx-cli`）并配 `MINIMAX_API_KEY`。美术/音频类交付物**优先 mmx 出真实资产**，而非纯规格：
- 图像 `mmx image "<prompt>" --aspect-ratio 1:1 --out-dir web/assets/`（方块贴图用 1:1）
- BGM `mmx music generate --prompt "<风格/情绪>" --instrumental --out web/assets/audio/x.mp3`
- 旁白 `mmx speech synthesize --text "..." --voice <音色> --out web/assets/audio/x.mp3`
- 视觉核对 `mmx vision <图>`
mmx 未装/无 key 时降级：优先 Kenney/Quaternius/OGA(CC0) 现成素材，再降级纯规格文档。

## 红线（违反会被 workflow 拒合并）
- 不做 git 操作（add/commit/push/branch）——workflow 管 git。
- 不碰密钥、`.env*`、`.github/workflows/`（除非 issue 或主创明确要求）。
- 不删测试或弱化校验来"让它过"。
- 不臆造 Three.js/DOM API；不确定就标记。
- **不引入 CC-BY-SA/GPL 素材；CREDITS.md 必须与素材同步更新。**
- 只做当前 issue 的事，不顺手改别的；需用户决策的写进 issue comment。
