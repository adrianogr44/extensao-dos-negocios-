@echo off
echo Fechando Chrome existente...
taskkill /f /im chrome.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo Iniciando Chrome com debug remoto na porta 9222...
echo Use este navegador normalmente (ja esta logado nas suas contas).
echo NAO feche esta janela - o script de postagem precisa dela.
echo.

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --remote-allow-origins=* --user-data-dir="%USERPROFILE%\chrome-debug-profile" --no-first-run
