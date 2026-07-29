$possiblePaths = @(
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)

$chromePath = $null
foreach ($p in $possiblePaths) {
    if (Test-Path $p) { $chromePath = $p; break }
}

if (-not $chromePath) {
    Write-Error "Chrome nao encontrado."
    exit 1
}

$userData = "$env:LOCALAPPDATA\Google\Chrome\User Data"

Write-Host "Fechando Chrome existente..."
taskkill /f /im chrome.exe 2>$null
Start-Sleep -Seconds 4

Write-Host ""
Write-Host "Iniciando Chrome com debug remoto na porta 9222..."
Write-Host "Use este navegador normalmente (ja esta logado nas suas contas)."
Write-Host "NAO feche esta janela - o script de postagem precisa dela."
Write-Host ""

Start-Process -FilePath $chromePath -ArgumentList "--remote-debugging-port=9222", "--remote-allow-origins=*", "--user-data-dir=`"$env:USERPROFILE\chrome-debug-profile`"", "--no-first-run"
