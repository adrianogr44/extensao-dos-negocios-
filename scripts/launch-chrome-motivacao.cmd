@echo off
REM ============================================================
REM Chrome MOTIVACAO - porta 9223 - perfil dedicado
REM NAO usa taskkill - o Chrome FUTEBOL 9222 fica aberto junto.
REM Se a porta 9223 ja estiver ativa, nao reinicia nada.
REM ============================================================

netstat -ano | findstr ":9223" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo Porta 9223 ja esta em uso - o Chrome Motivacao ja esta aberto.
  echo Use este navegador para fazer login nas contas MOTIVACAO.
  echo NAO feche esta janela - a postagem MOTIVACAO precisa dela.
  echo.
  exit /b 0
)

echo Iniciando Chrome MOTIVACAO com debug remoto na porta 9223...
echo Use este navegador para fazer login nas contas MOTIVACAO.
echo NAO feche esta janela - o script de postagem MOTIVACAO precisa dela.
echo.

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9223 --remote-allow-origins=http://127.0.0.1 --user-data-dir="%USERPROFILE%\chrome-debug-profile-motivacao" --no-first-run