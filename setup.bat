@echo off
REM ============================================================
REM life-vocab-app · 一键创建 venv + 安装 edge-tts
REM 双击或命令行 `setup.bat` 即可运行
REM ============================================================
setlocal

set "PROJECT_DIR=%~dp0"
set "MANAGED_PY=C:\Users\Administrator\.workbuddy\binaries\python\versions\3.13.12\python.exe"
set "VENV_DIR=C:\Users\Administrator\.workbuddy\binaries\python\envs\life-vocab"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"

echo.
echo [1/3] 检查 Managed Python...
if not exist "%MANAGED_PY%" (
    echo   !! 找不到: %MANAGED_PY%
    echo       请先安装 WorkBuddy managed Python 3.13.12
    exit /b 1
)
echo   OK %MANAGED_PY%

echo.
echo [2/3] 创建 venv (若无)...
if not exist "%VENV_PY%" (
    "%MANAGED_PY%" -m venv "%VENV_DIR%" || (echo   !! venv 创建失败 & exit /b 1)
) else (
    echo   OK venv 已存在
)

echo.
echo [3/3] 安装 edge-tts...
"%VENV_PY%" -m pip install --upgrade pip  1>nul 2>nul
"%VENV_PY%" -m pip install -r "%PROJECT_DIR%requirements.txt"
if errorlevel 1 (
    echo   !! edge-tts 安装失败
    exit /b 1
)

echo.
echo ==========================================================
echo   OK 完成！
echo   下一步: 双击 run.bat 或命令行跑 `run.bat --topic kitchen --limit 5`
echo ==========================================================
endlocal
