param(
  [Parameter(Mandatory=$true)]
  [string]$InputVideo,
  [string]$Template = "$env:USERPROFILE\Downloads\template-novo.png",
  [string]$Caption = "",
  [string]$OutputDir = "$env:USERPROFILE\Downloads\FabricaReels"
)

$templateW = 1080
$templateH = 1350
$videoX = 0
$videoY = 290
$videoW = 1080
$videoH = 960  # reduced to make room for caption
$captionY = $videoY + $videoH + 30  # below video

# Get username from filename
$inName = [System.IO.Path]::GetFileNameWithoutExtension($InputVideo)
$username = ""

$m = [regex]::Match($inName, 'reel_(.+?)_\d+$')
if ($m.Success) { $username = $m.Groups[1].Value }

# Generate caption if not provided
if (-not $Caption) {
  $captions = @(
    "✨ ${username}: momentos que inspiram",
    "💫 autocuidado é prioridade • @${username}",
    "🌟 ${username}: cada dia um novo recomeço",
    "🦋 seja luz • @${username}",
    "🌸 ${username} • cuidado que transforma",
    "✨ respira, confia, segue • @${username}",
    "💛 ${username}: sua paz não tem preço",
    "🌿 autocuidado não é egoísmo • @${username}",
    "⭐ ${username}: brilhe do seu jeito",
    "🍂 ${username} • essência que acolhe"
  )
  $Caption = $captions[(Get-Random -Maximum $captions.Length)]
}

$outFile = Join-Path $OutputDir "${inName}_final.mp4"

Write-Host "🎬 Aplicando template em: $InputVideo"
Write-Host "📝 Legenda: $Caption"

# Write filter graph using a batch file (avoids all PowerShell escaping issues)
$filterFile = $env:TEMP + "\ffmpeg_filter_" + (Get-Random) + ".txt"
$filter = "`[0:v`]scale=trunc($templateW/2)*2:trunc($templateH/2)*2[bg];`n"
$filter += "`[1:v`]scale=w=$videoW:h=-1:force_original_aspect_ratio=increase,crop=$videoW`:$videoH:0:(ih-$videoH)/2[video];`n"
$filter += "`[bg`]`[video`]overlay=$videoX`:$videoY`:shortest=1,drawtext=text='$Caption':fontsize=38:fontcolor=#D4A574:x=(w-text_w)/2:y=$captionY:fontfile=C\:/Windows/Fonts/arial.ttf:box=1:boxcolor=black@0.3:boxborderw=8"
Set-Content -Path $filterFile -Value $filter -NoNewline -Encoding Ascii

ffmpeg -y -loglevel error -stats `
  -loop 1 -i "$Template" `
  -i "$InputVideo" `
  -filter_complex_script "$filterFile" `
  -c:a copy -shortest "$outFile"

Remove-Item -LiteralPath $filterFile -ErrorAction SilentlyContinue

if ($LASTEXITCODE -eq 0) {
  Write-Host "✅ Salvo: $outFile" -ForegroundColor Green
} else {
  Write-Host "❌ Erro ao processar" -ForegroundColor Red
}
