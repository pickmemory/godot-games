# 0001 项目转向：Godot 三国 ARPG → Web 体素沙盒

日期：2026-08-15 · 状态：生效

## 背景

原《赤壁改写》（Godot 4.7 俯视角 ARPG，54 个 GDScript）推进到 Phase 6。主创判断该方向缺乏市场差异且 AI 接力效率受限，决定彻底转向体素沙盒《三国长卷》。

## 决策

- 技术栈：**纯 Web（HTML + 原生 ES Modules + Three.js CDN import map，零构建）**。
- 概念：MC 骨架 100% × 平民视角**亲历**真实三国编年（非改写——差异化更强且零 DMCA 风险）。
- 发布：开发期浏览器；上架期 Electron + steamworks.js（先例：Vampire Survivors）。

## 备选与否决理由

- Godot 体素：headless 验证慢、体素生态弱、AI 训练数据密度低于 Web/Three.js（直接影响 GLM 接力质量）。
- Unity/Unreal：小团队 + AI 流水线迭代成本高。
- 纯 MC 克隆：竞品调研（Hytale 复活 / Vintage Story / Allumeria DMCA 案）证明零出圈且有法律风险。

完整论证：`docs/superpowers/specs/2026-08-15-minecraft-pivot-design.md`。旧资产在 git 历史（feat(#13)~(#26)）。
