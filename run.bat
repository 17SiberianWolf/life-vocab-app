@echo off
REM ============================================================
REM life-vocab-app · 离线音频预生成 (Windows 一键包装)
REM 使用 venv 内的 Python + edge-tts,避免污染系统环境
REM
REM 用法:
REM   run.bat                       全量生成 (会很久)
REM   run.bat --topic kitchen       仅厨房
REM   run.bat --limit 10            每主题前 10 张
REM   run.bat --rewrite             强制覆盖已有 mp3
REM ============================================================
setlocal

set "PROJECT_DIR=%~dp0"
set "VENV_PY=C:\Users\Administrator\.workbuddy\binaries\python\envs\life-vocab\Scripts\python.exe"

if not exist "%VENV_PY%" (
    echo !! 找不到 venv: %VENV_PY%
    echo    请先双击 setup.bat 创建环境
    exit /b 1
)

echo.   venv: %VENV_PY%
echo.   script: %PROJECT_DIR%gen_audio.py
echo.   args: %*
echo.

"%VENV_PY%" "%PROJECT_DIR%gen_audio.py" %*
endlocal
