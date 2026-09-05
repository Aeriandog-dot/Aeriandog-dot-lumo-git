@echo off
chcp 65001 >nul
REM Lumo 一键启动(Windows)
cd /d %~dp0
echo 启动 Lumo ...
node server.js
pause