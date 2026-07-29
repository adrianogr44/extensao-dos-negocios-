#!/bin/bash
# Script para instalar fontes com suporte a emoji para FFmpeg

echo "Instalando fontes com suporte a emoji..."

if command -v apt-get &> /dev/null; then
  echo "Detectado sistema baseado em Debian/Ubuntu"
  sudo apt-get update
  sudo apt-get install -y fonts-noto-color-emoji fonts-noto-mono
  echo "✓ Fontes Noto instaladas com sucesso!"
  echo ""
  echo "Fontes instaladas:"
  echo "  - Noto Color Emoji: /usr/share/fonts/opentype/noto/NotoColorEmoji.ttf"
  echo "  - Noto Sans: /usr/share/fonts/opentype/noto/NotoSans-Regular.ttf"
  echo ""
  echo "O FFmpeg agora usará essas fontes automaticamente para emojis!"
elif command -v brew &> /dev/null; then
  echo "Detectado macOS com Homebrew"
  brew tap homebrew/cask-fonts
  brew install --cask font-noto-color-emoji
  echo "✓ Fonte Noto Color Emoji instalada com sucesso!"
else
  echo "❌ Sistema não detectado. Instale manualmente:"
  echo "  - Download: https://fonts.google.com/noto/specimen/Noto+Color+Emoji"
  echo "  - Copie para: ~/.fonts/ ou /usr/share/fonts/opentype/"
  exit 1
fi

fc-cache -fv 2>/dev/null || true
echo "✓ Cache de fontes atualizado!"
