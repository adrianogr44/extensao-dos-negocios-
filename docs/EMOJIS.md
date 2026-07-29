# Suporte a Emojis no FFmpeg

## Status Atual

O sistema agora suporta renderização de emojis em textos de vídeos. Para que os emojis funcionem corretamente, é necessário instalar uma fonte com suporte a emoji.

## Instalação de Fontes com Emoji

### Método 1: Script Automático (Recomendado)

```bash
chmod +x scripts/install-emoji-fonts.sh
./scripts/install-emoji-fonts.sh
```

### Método 2: Manual (Linux/Ubuntu)

```bash
sudo apt-get update
sudo apt-get install -y fonts-noto-color-emoji fonts-noto-mono
```

### Método 3: Manual (macOS com Homebrew)

```bash
brew tap homebrew/cask-fonts
brew install --cask font-noto-color-emoji
```

## Como Usar

1. **No editor**: Adicione um texto com emoji (ex: `⚽ Futebol`)
2. **Renderize**: O emoji será renderizado automaticamente se a fonte estiver instalada

## Fontes Suportadas (em ordem de prioridade)

1. **Noto Color Emoji** - Recomendada (suporte completo a emojis coloridos)
2. **Noto Emoji** - Boa alternativa
3. **Noto Sans** - Fallback (emojis em preto/branco)
4. **DejaVu Sans** - Padrão (emojis podem não renderizar)

## Troubleshooting

### Emojis não aparecem no vídeo renderizado

1. Verifique se a fonte está instalada:
```bash
ls /usr/share/fonts/opentype/noto/NotoColorEmoji.ttf
# ou
ls /usr/share/fonts/truetype/noto/NotoColorEmoji.ttf
```

2. Se não encontrar, execute:
```bash
./scripts/install-emoji-fonts.sh
```

3. Reinicie o servidor:
```bash
npm run dev
```

### Usando fonte customizada

Se quiser usar uma fonte específica:

```bash
FFMPEG_FONT_PATH=/caminho/para/sua/fonte.ttf npm run dev
```

## Emojis Suportados

Praticamente todos os emojis Unicode são suportados com a fonte Noto Color Emoji:

- 😀 Emoticons
- ⚽🏀🎾 Esportes
- 🍕🍔🍜 Comida
- 🚗🚙🚁 Transporte
- 🏠🏢🏰 Locais
- ❤️💚💙 Símbolos
- 🇧🇷 Bandeiras
- E muito mais!

## Logs

Ao iniciar o servidor, você verá qual fonte está sendo usada:

```
[ffmpeg] Usando fonte com emoji suporte: /usr/share/fonts/opentype/noto/NotoColorEmoji.ttf
```

ou

```
[ffmpeg] Nenhuma fonte com emoji encontrada. Usando DejaVu Sans (emojis podem não renderizar)
```
