#!/usr/bin/env bash
# 一键重启开发环境：杀掉旧的 Vite / Edge TTS，再同时启动两者。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# 冷门默认端口（可用环境变量覆盖）
WEB_PORT="${WEB_PORT:-17321}"
TTS_PORT="${TTS_PORT:-17322}"
# 顺延端口 + 历史默认端口一并清理
EXTRA_WEB_PORTS=(17323 17324 5173 5174 5175 5176)
EXTRA_TTS_PORTS=(8787)

kill_port() {
  local port="$1"
  local pids
  pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "→ 释放端口 :${port} (PID ${pids//$'\n'/ })"
    # shellcheck disable=SC2086
    kill ${pids} 2>/dev/null || true
    sleep 0.2
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      # shellcheck disable=SC2086
      kill -9 ${pids} 2>/dev/null || true
    fi
  fi
}

kill_pattern() {
  local pattern="$1"
  local pids
  pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "→ 结束进程匹配: ${pattern} (PID ${pids//$'\n'/ })"
    # shellcheck disable=SC2086
    kill ${pids} 2>/dev/null || true
    sleep 0.2
    pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      # shellcheck disable=SC2086
      kill -9 ${pids} 2>/dev/null || true
    fi
  fi
}

echo "==> 清理旧进程"
kill_port "$WEB_PORT"
kill_port "$TTS_PORT"
for p in "${EXTRA_WEB_PORTS[@]}" "${EXTRA_TTS_PORTS[@]}"; do
  kill_port "$p"
done

# 按命令行再扫一遍（限本项目相关，避免误杀其它仓库的 Vite）
kill_pattern "node scripts/edge-tts-server\\.mjs"
kill_pattern "${ROOT}/node_modules/.*vite"
kill_pattern "concurrently .*npm run tts"

sleep 0.3
export WEB_PORT TTS_PORT
echo "==> 启动 Vite + Edge TTS"
echo "    前端: http://localhost:${WEB_PORT}/"
echo "    TTS:  http://127.0.0.1:${TTS_PORT}/api/tts?text=apple"
echo "    Ctrl+C 结束全部"
echo

exec npm run dev
