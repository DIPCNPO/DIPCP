@echo off

REM 切换到项目根目录
cd /d "%~dp0"

REM 启动自定义开发服务器（禁用缓存）
python start-dev.py

pause
