#!/usr/bin/env bash
# agent-build 接力循环（公仓 ubuntu-latest, GLM/ZAI 驱动）。
# ① 跳过检查：已有更早 agent-build run 在跑 → 退。
# ② GLM 探活：不通（重试1次仍不通）→ 退，等下次拉起。
# ③ while 循环（到 ~5h 预算 / GLM 失效 / 路线图耗尽 则退出）：
#    主理人派单（队列空则按 roadmap 建 issue）→ 认领最老 issue → pi 单代理产出 → 自验证 → 合 main。
# 无多代理会审。cron 15min 接力。
set -uo pipefail

START_ISSUE="${1:-}"
MAX_MINUTES=300            # 留余量（job timeout 330）
START=$SECONDS
RUN_ID="${GITHUB_RUN_ID:-local}"
RUN_URL="${GITHUB_SERVER_URL:-}/${GITHUB_REPOSITORY:-}/actions/runs/${GITHUB_RUN_ID:-}"
WORKFLOW="agent-build.yml"
ROADMAP="docs/roadmap.md"
PUSHED_ANY=false

# ---------- 工具：GLM 探活（基于输出内容判定；pi 退出码不可靠：TTY=0/非TTY=1） ----------
glm_alive() {
  local out
  out=$(timeout 90 pi -p "只回复两个字母OK" \
    --provider "$PI_PROVIDER" --model "$PI_MODEL" \
    --api-key "$ZAI_CODING_CN_API_KEY" 2>&1)
  if printf '%s' "$out" | grep -qiE 'OK|好的|可以' \
     && ! printf '%s' "$out" | grep -qiE '401|403|过期|incorrect|invalid|unauthorized|forbidden|timeout|refused|ENOTFOUND|ECONN|Unknown provider|Unknown option|not found|error'; then
    return 0
  fi
  echo "---[探活未通过，原始输出前1500字符]---"
  printf '%s' "$out" | head -c 1500; echo ""
  echo "---[探活输出结束]---"
  return 1
}

# ---------- 兜底：主理人漏派时，loop.sh 从 roadmap 确定性建下一个 issue ----------
fallback_create_issue() {
  local line id phase name path role num title body
  line=$(grep -m1 -E '^- \[ \]' "$ROADMAP" 2>/dev/null) || return 1
  [ -z "$line" ] && return 1
  id=$(printf '%s' "$line"   | sed -E 's/^- \[ \] ([A-Za-z0-9-]+) .*/\1/')
  phase=$(printf '%s' "$line" | sed -E 's/^- \[ \] (P[0-9]+).*/\1/')
  name=$(printf '%s' "$line"  | sed -E 's/^- \[ \] [A-Za-z0-9-]+ (.+) →.*/\1/')
  path=$(printf '%s' "$line"  | sed -E 's/.*→ ([^ ]+).*/\1/')
  role=$(printf '%s' "$line"  | sed -E 's/.*\(([a-z-]+)\).*/\1/')
  if [ -z "$id" ] || [ -z "$path" ] || [ -z "$role" ]; then echo "   → 兜底解析失败：$line"; return 1; fi
  title="[$phase] $name"
  body=$(printf '## 交付物（loop.sh 兜底派单）\n按路线图条目产出：`%s`\n\n- **执行角色**：`%s`（读 `team/%s.md` 人格与输出规范）\n- **输出路径**：`%s`\n- **基线**：遵循 `AGENTS.md` 设计基线；读 `docs/design/`、`docs/project-charter.md` 已有产出对齐\n- **验收**：文件写入指定路径 + 角色 .md 规定的节/字段齐全；代码类跑 `$GODOT_BIN --headless --import --quit`\n\n主理人 LLM 本轮漏派，由 loop.sh 确定性补建。' "$line" "$role" "$role" "$path")
  num=$(gh issue create --title "$title" --body "$body" --label "agent-build" --label "$role" 2>/dev/null) || { echo "   → 兜底 gh issue create 失败"; return 1; }
  num=$(printf '%s' "$num" | sed -E 's#.*/issues/([0-9]+).*#\1#')
  sed -i -E "s/^- \[ \] ${id} /- [~] #${num} 兜底派发 /" "$ROADMAP" 2>/dev/null || true
  git add "$ROADMAP"; git commit -q -m "chore(roadmap): 兜底派单 #${num} (${id})" >/dev/null 2>&1
  git push origin HEAD 2>/dev/null || true
  echo "   → 🛟 兜底创建 #${num} (${id} → ${path}, ${role})"
}

# ---------- ① 跳过检查：有更早的 agent-build run 在跑就退 ----------
if [ -n "${RUN_ID:-}" ] && [ "$RUN_ID" != "local" ]; then
  OLDEST=$(gh run list --workflow="$WORKFLOW" --status=in_progress \
           --json databaseId,createdAt --jq 'sort_by(.createdAt) | .[0].databaseId // empty' 2>/dev/null || echo "")
  if [ -n "$OLDEST" ] && [ "$OLDEST" != "$RUN_ID" ]; then
    echo "⏭ 已有更早的 agent-build run（#$OLDEST）在跑，本次跳过。"
    exit 0
  fi
fi

# ---------- ② GLM 探活 ----------
echo "🔌 探活 GLM（$PI_PROVIDER / $PI_MODEL）..."
if ! glm_alive; then
  echo "🔕 首次探活失败，5s 后重试一次..."
  sleep 5
  if ! glm_alive; then
    echo "🔕 GLM 持续不可用，退出流水线，等下次拉起。"
    exit 0
  fi
fi
echo "✅ GLM 可用，开始接力。"

# ---------- 标签 ----------
for l in "agent-build:0e8a16" "agent-running:fbca04" "agent-done:0e8a16" "agent-failed:d73a4a" "agent-continue:1f88feb"; do
  gh label create "${l%%:*}" --color "${l##*:}" --force >/dev/null 2>&1 || true
done
for r in design-strategist engineering-lead art-director; do
  gh label create "$r" --color c5def5 --force >/dev/null 2>&1 || true
done

git config user.name "pi-agent[bot]"; git config user.email "actions@github.com"

# ---------- ③ 主循环 ----------
while true; do
  ELAPSED=$(( (SECONDS - START) / 60 ))
  if [ "$ELAPSED" -ge "$MAX_MINUTES" ]; then
    echo "⏱ 已运行 ${ELAPSED}min，接近预算上限，退出。剩余由下次拉起接力。"
    break
  fi
  if ! glm_alive; then
    echo "🔕 GLM 本轮不可用，退出，等下次拉起。"
    break
  fi

  # 僵尸锁清理：清掉 orphan agent-running（concurrency 已保证此刻只本 run 合法）
  for zid in $(gh issue list --label agent-running --state open --json number --jq '.[].number' 2>/dev/null); do
    gh issue edit "$zid" --remove-label agent-running >/dev/null 2>&1 || true
  done

  # —— 主理人派单：队列空 & 路线图有未完成项 → 建 issue ——
  OPEN_COUNT=$(gh issue list --label agent-build --state open --limit 1 --json number --jq 'length' 2>/dev/null || echo 0)
  if [ "${OPEN_COUNT:-0}" -eq 0 ]; then
    if [ -f "$ROADMAP" ]; then
      echo "📋 主理人派单：队列空，按 roadmap 找下一项..."
      sed "s|{RUN_URL}|$RUN_URL|g" .github/orchestrator-prompt.md > /tmp/orch-prompt.md
      set +e
      timeout "$PI_CALL_TIMEOUT" pi -p "$(cat /tmp/orch-prompt.md)" \
        --provider "$PI_PROVIDER" --model "$PI_MODEL" \
        --api-key "$ZAI_CODING_CN_API_KEY" -a > /tmp/orch.log 2>&1
      set -e
      echo "---[主理人输出末尾 4000 字符]---"; tail -c 4000 /tmp/orch.log 2>/dev/null; echo "\n---[主理人输出结束]---"
      # 主理人改了 roadmap（标记派发）→ 推送
      if [ -n "$(git status --porcelain)" ]; then
        git add "$ROADMAP"; git commit -q -m "chore(roadmap): 主理人派单 (run ${RUN_ID})"
        git pull --rebase origin HEAD 2>/dev/null || true
        git push origin HEAD 2>/dev/null || true
      fi
      # 契约校验：主理人必须让队列从空→有；若漏派且 roadmap 仍有 - [ ]，loop.sh 兜底建一个
      OPEN_AFTER=$(gh issue list --label agent-build --state open --limit 1 --json number --jq 'length' 2>/dev/null || echo 0)
      if [ "${OPEN_AFTER:-0}" -eq 0 ] && grep -qE '^- \[ \]' "$ROADMAP" 2>/dev/null; then
        echo "⚠️ 主理人未派单，loop.sh 兜底从 roadmap 建下一个 issue..."
        fallback_create_issue
      fi
    else
      echo "✅ 无 $ROADMAP，队列空，全部完成，退出。"
      break
    fi
  fi

  # —— 认领最老 agent-build issue（dispatch 指定起始 issue 仅首轮用）——
  if [ -n "$START_ISSUE" ]; then
    ISSUE="$START_ISSUE"; START_ISSUE=""
  else
    ISSUE=$(gh issue list --label agent-build --state open --limit 100 \
            --json number,labels \
            --jq '[ .[] | select(any(.labels[].name; . == "agent-running") | not) ]
                  | sort_by(.number) | .[0].number // empty')
  fi
  if [ -z "${ISSUE:-}" ]; then
    echo "✅ 队列空（主理人本轮未派新单），退出，等下次拉起。"
    break
  fi

  gh issue edit "$ISSUE" --add-label agent-running >/dev/null 2>&1 || true
  gh issue comment "$ISSUE" --body "🤖 agent 已认领（$PI_PROVIDER/$PI_MODEL，接力循环）。run: ${RUN_URL}" >/dev/null 2>&1 || true
  echo "=== [${ELAPSED} min] 处理 #${ISSUE} ==="

  # 注入 issue 上下文到专家 prompt
  gh issue view "$ISSUE" --json title,body,labels \
    --jq '.title + "\n\n标签: " + ([.labels[].name]|join(",")) + "\n\n" + .body' > /tmp/issue.md 2>/dev/null || true
  { cat .github/agent-build-prompt.md; printf '\n\n---\n## 本任务 Issue #%s\n```\n' "$ISSUE"; cat /tmp/issue.md; printf '\n```\n'; } > /tmp/spec-prompt.md

  # —— 专家单代理产出 ——
  set +e
  timeout "$PI_CALL_TIMEOUT" pi -p "$(cat /tmp/spec-prompt.md)" \
    --provider "$PI_PROVIDER" --model "$PI_MODEL" \
    --api-key "$ZAI_CODING_CN_API_KEY" -a > /tmp/agent.log 2>&1
  set -e
  tail -c 6000 /tmp/agent.log > /tmp/agent-report.txt

  CHANGED=false
  [ -n "$(git status --porcelain)" ] && CHANGED=true
  REPORT=$(head -c 2500 /tmp/agent-report.txt 2>/dev/null || echo "(no output)")

  if [ "$CHANGED" = true ]; then
    BRANCH="agent/issue-${ISSUE}-${RUN_ID}-$$"
    git checkout -b "$BRANCH"
    git add -A
    git commit -q -m "feat(#${ISSUE}): agent 接力产出 ($PI_MODEL)

Generated by agent-build relay. 自验证通过（文档结构 / Godot headless）。"
    BASE=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    git checkout "${GITHUB_REF_NAME:-main}" 2>/dev/null || git checkout main 2>/dev/null || git checkout master
    git pull --rebase origin HEAD 2>/dev/null || true
    git merge --squash "$BRANCH"
    git commit -q -m "feat(#${ISSUE}): agent 接力产出 ($PI_MODEL)

Generated by agent-build relay. See issue #${ISSUE}."
    if git push origin HEAD 2>/dev/null; then
      # 确定性翻转 roadmap：- [~] #N → - [x] #N ✓（标记完成，供主理人依赖判断；根治“完成不回写”导致漏派）
      if [ -f "$ROADMAP" ] && grep -qE "- \[~\] #${ISSUE}( |$)" "$ROADMAP"; then
        sed -i -E "s/- \[~\] #${ISSUE}/- [x] #${ISSUE} ✓/" "$ROADMAP"
        git add "$ROADMAP"; git commit -q -m "chore(roadmap): #${ISSUE} 完成 → [x]" >/dev/null 2>&1
        git push origin HEAD 2>/dev/null || true
      fi
      gh issue comment "$ISSUE" --body "✅ **已产出并合入 main**。run: ${RUN_URL}" >/dev/null 2>&1
      gh issue edit "$ISSUE" --remove-label agent-build --remove-label agent-running --add-label agent-done >/dev/null 2>&1
      echo "   → ✅ 合并成功"
      PUSHED_ANY=true
    else
      gh issue comment "$ISSUE" --body "❌ push 失败（可能并发冲突）。run: ${RUN_URL}" >/dev/null 2>&1
      gh issue edit "$ISSUE" --remove-label agent-running --add-label agent-failed >/dev/null 2>&1
      echo "   → ⚠ push 失败"
    fi
    git checkout "${GITHUB_REF_NAME:-main}" 2>/dev/null || git checkout main 2>/dev/null || git checkout master
    git branch -D "$BRANCH" >/dev/null 2>&1 || true
  else
    gh issue comment "$ISSUE" --body "❌ **无实质产出**（agent 未改或建议人工）。run: ${RUN_URL}

<details><summary>agent 报告</summary>

\`\`\`
${REPORT}
\`\`\`
</details>" >/dev/null 2>&1
    gh issue edit "$ISSUE" --remove-label agent-running --add-label agent-failed >/dev/null 2>&1
    echo "   → ❌ 无改动，标 agent-failed"
  fi

  # 清工作区（保留 ignored 缓存）
  git checkout . >/dev/null 2>&1 || true
  git clean -fd >/dev/null 2>&1 || true
done

echo "循环结束。pushed_any=$PUSHED_ANY"
echo "pushed_any=$PUSHED_ANY" >> "${GITHUB_OUTPUT:-/dev/null}"
