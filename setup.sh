#!/usr/bin/env bash
# life-vocab-app · 创建 venv + 装 edge-tts (Git Bash)
set -e
MANAGED_PY="C:/Users/Administrator/.workbuddy/binaries/python/versions/3.13.12/python.exe"
VENV_DIR="C:/Users/Administrator/.workbuddy/binaries/python/envs/life-vocab"
VENV_PY="$VENV_DIR/Scripts/python.exe"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[1/3] 检查 Managed Python..."
if [ ! -f "$MANAGED_PY" ]; then
  echo "   !! 找不到: $MANAGED_PY"
  exit 1
fi
echo "   OK $MANAGED_PY"

echo
echo "[2/3] 创建 venv (若无)..."
if [ ! -f "$VENV_PY" ]; then
  "$MANAGED_PY" -m venv "$VENV_DIR"
else
  echo "   OK venv 已存在"
fi

echo
echo "[3/3] 安装 edge-tts..."
"$VENV_PY" -m pip install --upgrade pip >/dev/null 2>&1
"$VENV_PY" -m pip install -r "$PROJECT_DIR/requirements.txt"
echo "   OK"

echo
echo "=========================================================="
echo "  完成。下一步: ./run.sh --topic kitchen --limit 5"
echo "=========================================================="
