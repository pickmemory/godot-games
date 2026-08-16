# itch 商店物料目录 · D-7 产出索引

> 归属：路远行（release-ops）· 视觉规范基线：`docs/design/art-bible.md` v2。
> 本目录物料**不随游戏 zip 分发**（非 `web/assets/`，不参与 CREDITS↔web/assets 对账；登记见 `web/assets/CREDITS.md`「非运行时发布物料」节）。

## 封面

| 文件 | 规格 | 内容 | 状态 |
|---|---|---|---|
| `cover-itch-v1.jpg` | 1:1 方图（mmx image） | 汉代夯土村落暮色 + 黄巾幡 + 烽燧烟，大地色低饱和（美术圣经 §2） | **v1 可用**；正式版建议林绘澄叠书法标题《三国长卷》（AI 书法错字风险见美术圣经 §5.3，故 v1 无文字）后裁 630×500 |

> itch 封面展示区约 630×500，1:1 方图自动裁切最稳；Steam capsule 全套另见 `../store-assets.md` §1（仍待美术）。

## 截图（1920×1080 实机，无头 Chromium 采集）

| 文件 | 场景 | 采集方式 |
|---|---|---|
| `screenshots/01-opening.png` | D-5 开场长镜头：高空俯瞰 + 竖排书法题签 + 院线黑边 | `PW_CHROMIUM=<chrome> node tools/capture-store-shots.mjs` |
| `screenshots/02-day-village.png` | 白昼村落 + 完整 HUD（hotbar/日晷/罗盘/任务追踪；键位卡已收起，fps 调试条已隐藏） | 同上（每张均过视口内可见性断言 + 像素方差>100） |
| `screenshots/03-dialog.png` | 陈叟对话（平民视角立绘 + 对话树） | 同上 |
| `screenshots/04-crafting.png` | 列表式合成面板（品类区隔点，demo-vision §四） | 同上 |
| `screenshots/05-190-burn.png` | 第二章 190·讨董：焚城橙红天际 + 焦土色带 | 同上（`?chapter=190-dong-zhuo&new`） |

> 截图为程序化自研画面（代码+贴图全自研）；CI 无 CJK 字体，截图机安装 LXGW WenKai（OFL）渲染 UI 汉字（玩家机上走 KaiTi/宋体系统栈，观感近似；楷体正式内嵌方案见 compliance-audit N4）。
> 与 Steam 截图清单关系：本组 5 张对应 `store-assets.md` §2 场景 2/3/4/5，可直接复用；场景 1「第一夜浓雾+行尸」**仍缺**（无头环境夜间推进受限），待真机补拍。
