@echo off
REM ============================================================
REM 本地 mmx 鉴权脚本（Windows）
REM 读取 ..\.env 的 MINIMAX_API_KEY，mmx auth login 持久化到 %USERPROFILE%\.mmx
REM 用法：双击本文件，或在仓库根执行 tools\mmx-setup.cmd
REM ============================================================
setlocal enabledelayedexpansion
set "ENVFILE=%~dp0..\.env"
if not exist "%ENVFILE%" (
  echo [error] 找不到 .env：%ENVFILE%
  echo         请先复制 .env.example 为 .env 并填入 MINIMAX_API_KEY
  exit /b 1
)
for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%ENVFILE%") do (
  set "k=%%a"
  if /i "!k!"=="MINIMAX_API_KEY" set "MINIMAX_API_KEY=%%b"
  if /i "!k!"=="MINIMAX_REGION" set "MINIMAX_REGION=%%b"
)
if "%MINIMAX_API_KEY%"=="" (
  echo [error] .env 里 MINIMAX_API_KEY 仍为空，请先填入 Key
  exit /b 1
)
echo [mmx] region = %MINIMAX_REGION%
echo [mmx] auth login --api-key ...
call mmx auth login --api-key "%MINIMAX_API_KEY%" || (echo [error] mmx auth 失败 & exit /b 1)
echo [mmx] quota ...
call mmx quota
echo.
echo [ok] mmx 已持久化鉴权，后续 mmx image/music/speech 可直接调用。
endlocal
