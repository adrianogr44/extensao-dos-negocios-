@echo off
REM ============================================================
REM INICIAR AGENDADORES - Futebol (9222) + Motivacao (9223)
REM Executa o script PowerShell totalmente escondido (sem janela).
REM A Tarefa Agendada do Windows chama o .ps1 direto (tambem sem janela).
REM Logs: scripts\postar-log.txt e scripts\postar-log-motivacao.txt
REM ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0iniciar-agendadores.ps1"