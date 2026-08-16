#!/usr/bin/env bash
# 一键刷新 .ai/code-facts/ —— 机械提取代码事实（零 LLM）。
# 改了 web/src/** 或 web/data/** 之后跑这个，知识库自动同步；产物随 workflow 一并合入。
# 用法: scripts/ai-context/refresh.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

NODE_BIN="$(command -v node || true)"
[ -n "$NODE_BIN" ] || { echo "❌ 未找到 node"; exit 1; }
mkdir -p .ai/code-facts

echo "⟳ 刷新 .ai/code-facts/"
"$NODE_BIN" scripts/ai-context/extract.mjs
echo "✅ 完成。提交 .ai/code-facts/ 让接力 AI 共享最新代码事实（手写文档按 AGENTS.md 协议增量更新）。"
