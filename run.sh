#!/usr/bin/env bash
# life-vocab-app · 离线音频预生成 (Git Bash 一键包装)
# 通过 venv 内的 Python 跑 gen_audio.py,避免污染系统环境
#
# 用法:
#   ./run.sh                        全量生成
#   ./run.sh --topic kitchen        仅厨房
#   ./run.sh --limit 10             每主题前 10 张
#   ./run.sh --rewrite              强制覆盖已有 mp3

set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PY="C:/Users/Administrator/.workbuddy/binaries/python/envs/life-vocab/Scripts/python.exe"

if [ ! -f "$VENV_PY" ]; then
  echo "!! 找不到 venv: $VENV_PY"
  echo "   请先执行 ./setup.sh"
  exit 1
fi

echo "venv    : $VENV_PY"
echo "script  : $PROJECT_DIR/gen_audio.py"
echo "args    : $*"
echo

"$VENV_PY" "$PROJECT_DIR/gen_audio.py" "$@"
