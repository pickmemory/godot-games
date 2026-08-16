# 0003 测试策略：无头浏览器三件套 + 视觉断言铁律

日期：2026-08-16 · 状态：生效

## 背景

CI 里只有 node（无浏览器、无 Godot），流水线自验证长期只跑 `node --check`（纯语法）。2026-08-16 E 交谈"不可见"案：状态机全对（DOM class/文本断言全绿）但面板被 CSS 解析事故渲染到视口外 720px——纯状态断言抓不住。

## 决策

1. **本地三件套**（git-bash / Windows）：
   - `tools/smoke-web.mjs` 冒烟（加载/60fps/81 chunks/零 JS 错/像素方差证实真渲染）
   - `tools/repro-e-talk.mjs` E 交谈回归（**含视觉断言**：面板 `position:fixed` 且 rect 在视口内）
   - `tools/verify-mc5x.mjs` 功能 11 项（日晷 canvas 采样/灯光池真实强度断言）
2. **视觉断言铁律**：任何 UI 交付，断言必须含 `getBoundingClientRect` 在视口内 + computedStyle 关键属性；canvas 类 UI 断言像素采样（painted>阈值）。
3. CI（无浏览器）底线：`node --check` 全量 + 结构检查；真视觉验证由主创本地跑三件套。
4. 新功能验证脚本进 `tools/`，命名 `verify-<域>.mjs`，模式复用（本地 http 服务 + playwright-core + PW_CHROMIUM 环境变量，见 known-issues P2）。
