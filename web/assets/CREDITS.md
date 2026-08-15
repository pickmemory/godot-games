# 素材来源与许可登记（CREDITS）

> 红线：每引入一个第三方素材必须在此登记（来源 URL + 许可 + 用途）。
> 只准 CC0 / CC-BY；CC-BY-SA 与 GPL 禁止引入（闭源商用传染风险）。
> review 时校验本文件与 web/assets/ 实际内容一致。

## 当前状态（MC-1 / MC-2 / MC-3b）

| 素材 | 来源 | 许可 | 用途 |
|---|---|---|---|
| 程序化像素贴图 atlas（10 瓦片） | 本项目 `web/src/textures.js` 自绘 | 自研（无第三方版权） | 全部方块贴图（占位美术） |
| WebAudio 合成音效 | 本项目 `web/src/main.js` 程序合成 | 自研 | 挖掘/破坏/放置反馈音 |
| 行尸体素模型 | 本项目 `web/src/mob.js` 程序化 BoxGeometry 搭建 | 自研 | 夜间敌对生物「流民行尸」 |
| WebAudio 生存音效（受击/呻吟/夜风） | 本项目 `web/src/main.js` 程序合成 | 自研 | 第一夜恐惧氛围 |
| 红心条 / 红晕 / 死亡界面 | 本项目 `web/index.html` CSS + DOM | 自研 | 血量与死亡 UI |
| 挖掘裂纹分段贴图（8 段） | 本项目 `web/src/textures.js` 程序化 canvas 绘制 | 自研（无第三方版权） | MC-2c 挖掘进度裂纹 overlay |
| 掉落物实体模型 | 本项目 `web/src/drops.js` 程序化 BoxGeometry + 自绘 atlas UV | 自研 | MC-2c 方块/物品掉落物 |
| WebAudio 全套 SFX（脚步/挖掘分段/破碎/放置/拾取/受击/呻吟/夜风） | 本项目 `web/src/sfx.js` 程序合成 | 自研 | MC-2c 手感打磨音效 |
| NPC 低模体素村民（占位）+ 头顶名牌 | 本项目 `web/src/npc.js` 程序化 BoxGeometry/CylinderGeometry + CanvasTexture | 自研 | MC-3b NPC 实体模型（Quaternius CC0 GLB 适配接口已预留：`model.type='glb'`，引入时须在此登记来源 URL 与许可） |
| 对话面板/立绘占位/交谈提示 UI | 本项目 `web/src/dialog.js` + `web/index.html` CSS/DOM + canvas 立绘占位 | 自研 | MC-3b 对话与任务界面 |
| 任务系统（状态机，无素材） | 本项目 `web/src/quests.js` | 自研 | MC-3b 最小任务接口（供 MC-3d 事件弧） | MC-1 为纯程序化占位；按路线图 MC-5a（美术圣经 v2）与各阶段美术任务接入：
- Kenney.nl（Voxel Pack 等，CC0，商用免署名）
- Quaternius.com（低模角色/道具/建筑，CC0）
- OpenGameArt.org（仅 CC0 / CC-BY 条目；CC-BY 须在此署名作者与链接）
- mmx 生成（中文书法 UI / 三国方块变体 / 中文旁白 / 中式 BGM）→ 标注 "mmx 生成（自研）"

## 登记格式

| 素材文件/目录 | 来源 URL | 许可 | 作者署名（CC-BY 必填） | 引入阶段 |
|---|---|---|---|---|
| （示例）web/assets/textures/kenney-voxel/ | https://kenney.nl/assets/voxel-pack | CC0 | — | MC-5a |
