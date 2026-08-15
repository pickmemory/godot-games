# 发布清单 · 《三国长卷》Steam 首发（v0.1 · 首发范围：184 黄巾 + 190 讨董两章）

> 归属：路远行（release-ops）· MC-5e（issue #41）· 清单版本：2026-08 · 适用：Windows 首发
> 用法：各角色按部门勾选并署名；**go/no-go 判定见 §7**。Blocker 未清不发布，除非主理人书面豁免。
> 版本快照基线：MC-1~MC-4 全量 + MC-5a 美术圣经 v2 + MC-5b 第二章 + MC-5d Playtest Round 1。

## 0. 版本与构建元数据

| 项 | 值 | 状态 |
|---|---|---|
| 版本号 | `0.1.0`（`tools/electron/package.json`） | ☐ 核对 |
| 构建号 | Steam Build ID（上传后回填） | ☐ 回填 |
| 目标 depot | AppID（主 depot，Windows x64） | ☐ 待 App ID 审批 |
| 存档版本 | `SAVE_VERSION = 1`（`web/src/save.js`） | ☐ 确认首发即 v1 |

## A. 代码与构建（程基岩 / 路远行）

- [ ] A-1 `node --check` 全绿：`web/src/*.js` + `tools/electron/{main,preload}.js` + `tools/electron/build.mjs`
- [ ] A-2 浏览器直开冒烟：`web/index.html` 双章可开（`?chapter=190-dong-zhuo&new`），零构建基线未被破坏（web/ 内无 npm/bundler 痕迹）
- [ ] A-3 `tools/electron`：`npm install` → `npm start` 壳内可玩；CDN 断网场景 `SGSC_WEB_ROOT=dist/stage/web npm start` 离线可玩
- [ ] A-4 `npm run dist:win` 产出 NSIS 安装包 + `win-unpacked/`；干净 Win10/Win11 虚机安装可玩
- [ ] A-5 Steam Cloud：壳内自动存档 → 关 Steam → 读镜像档；开 Steam → 云档恢复（同一存档文件 `sgsc-save-v1.json`）
- [ ] A-6 成就「活过第一夜」在 Steamworks sandbox 弹出且幂等（重复夜→昼不重弹）
- [ ] A-7 localStorage → 云档一次性迁移：MC-4c 浏览器旧档在壳内首启被搬上云
- [ ] A-8 性能抽测：视距内 chunk 加载、挖掘/放置帧率（对照 playtest round-1 §7 的 E3 项）

## B. 内容与 QA（严守真 / 文策渊）

- [ ] B-1 **Blocker 清零**：round-1 报告（`docs/playtests/round-1.md` §5）的「真实浏览器无法启动」Blocker 已修复并复测
- [ ] B-2 Critical C1（第一夜叙事锚点脱节）/ C2（恐惧消解漏洞）已有主创决策记录与修复或豁免
- [ ] B-3 两章完整通关冒烟：开场演出 → 任务链 → 章节迁移（184→190 世界状态）→ 死亡重生 → 存档往返
- [ ] B-4 中文本地化：全 UI 中文显示无乱码（首发仅简中，字符串冻结见 F-2）
- [ ] B-5 E3 人工体验项（手感/恐惧/性能观感，round-1 §7）主创或指定试玩者签收

## C. 商店与物料（林绘澄 / 路远行）

- [ ] C-1 Capsule 全套（规格与产出状态见 `store-assets.md` §1，多数**待美术产出**）
- [ ] C-2 截图 ≥5 张（1920×1080）+ 预告片 1 条（规格见 `store-assets.md` §2-3）
- [ ] C-3 商店页文案：短描述（中/英）、长描述、标签（生存/沙盒/体素/历史）
- [ ] C-4 Steamworks 后台：App 信息、depot、Cloud 配额、成就 `ACH_SURVIVE_FIRST_NIGHT` 登记完成（**待 App ID 审批后**）

## D. 法务与合规（游承峰把关）

- [ ] D-1 `web/assets/CREDITS.md` 与实际素材一致；全量许可为 CC0/CC-BY/自研，**无 CC-BY-SA/GPL**（review 校验）
- [ ] D-2 CC-BY 素材（如有）署名已进商店页/游戏内鸣谢
- [ ] D-3 Steam 分级问卷（内容调查）填写提交
- [ ] D-4 Electron/Three.js/steamworks.js 许可证声明（MIT 等）附于分发物
- [ ] D-5 存档/遥测隐私说明：本作无第三方遥测，Steam Cloud 仅同步存档（写进商店页 FAQ）

## E. 发布工程（路远行）

- [ ] E-1 上传流：`node build.mjs --appid=<正式ID>` → 核对 vdf → steamcmd 上传 → 后台预览构建
- [ ] E-2 分支策略：首发仅 `default` 分支；预留 `beta` 分支做补丁验证
- [ ] E-3 steamworks.js 云/成就在**真 Steam 环境**（非 sandbox）实测一轮（CI 无法覆盖，见 tools/electron/README.md 已知限制）
- [ ] E-4 回滚预案演练：后台「previous build」回滚路径走通一次（见 `rollback-plan.md`）
- [ ] E-5 代码签名：证书决策落地（未签名则确认 Steam/杀软误报监控值班安排）

## F. 社区与运营（路远行）

- [ ] F-1 首发公告 + 补丁说明（玩家语言，中文）备好
- [ ] F-2 **字符串冻结**：发布分支冻结后除 Blocker 热修不改字符串
- [ ] F-3 已知问题清单随商店页公告（诚实列出 round-1 遗留项）
- [ ] F-4 反馈渠道：Steam 讨论区值班表 + issue 模板

## 7. Go / No-Go 门控

**判定规则（全部满足 = GO，任一不满足 = NO-GO）**：

| # | 门 | 判定 | 责任人 |
|---|---|---|---|
| G1 | Blocker = 0（B-1） | ☐ GO ☐ NO-GO | 严守真 |
| G2 | Critical 项已修复或主创书面豁免（B-2） | ☐ GO ☐ NO-GO | 游承峰 |
| G3 | 干净虚拟机安装可玩 + 两章通关冒烟（A-4/B-3） | ☐ GO ☐ NO-GO | 程基岩/严守真 |
| G4 | Steam Cloud + 成就真机验证通过（E-3） | ☐ GO ☐ NO-GO | 路远行 |
| G5 | 法务清零：CREDITS 校验 + 分级问卷提交（D-1/D-3） | ☐ GO ☐ NO-GO | 游承峰 |
| G6 | 商店物料齐备或主创明确接受降级发布（C-1~C-4） | ☐ GO ☐ NO-GO | 林绘澄/游承峰 |
| G7 | 回滚预案演练通过（E-4） | ☐ GO ☐ NO-GO | 路远行 |

**签发**：主理人（游承峰）签字 + 日期：＿＿＿＿＿＿
