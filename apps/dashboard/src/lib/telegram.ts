// Telegram notification module
// Envia notificações de publicação via Telegram Bot API

const PLATFORM_LABELS: Record<string, string> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
}

export interface PublicationNotifyItem {
  platform: string
  scheduledFor?: Date
  success: boolean
  error?: string
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.log('[Telegram] Não configurado (TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID), ignorando alerta')
    return false
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[Telegram] Falha ao enviar mensagem: ${res.status} ${body}`)
      return false
    }

    return true
  } catch (error) {
    console.error('[Telegram] Erro ao enviar mensagem:', error)
    return false
  }
}

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] || platform
}

export function formatDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Envia uma notificação resumida de um lote de publicações agendadas.
 * Agrupada por plataforma e horário da postagem.
 */
export async function notifyPublicationBatch(items: PublicationNotifyItem[]): Promise<void> {
  if (!isTelegramConfigured() || items.length === 0) return

  // Agrupar por (horário + plataforma) para agendar mensagens por "rodada" de postagem
  const groups = new Map<string, PublicationNotifyItem[]>()

  for (const item of items) {
    const timeKey = item.scheduledFor ? item.scheduledFor.getTime().toString() : 'now'
    const key = `${timeKey}:${item.platform}`
    const group = groups.get(key)
    if (group) {
      group.push(item)
    } else {
      groups.set(key, [item])
    }
  }

  for (const group of groups.values()) {
    const platform = platformLabel(group[0].platform)
    const scheduledFor = group[0].scheduledFor
    const total = group.length
    const success = group.filter((i) => i.success).length
    const failed = total - success
    const errors = group.filter((i) => !i.success && i.error).map((i) => i.error)

    const timeStr = scheduledFor
      ? ` às ${formatDateTime(scheduledFor)}`
      : ''

    const lines: string[] = []
    lines.push(`🚀 <b>PostReels — Postagem agendada${timeStr}</b>`)
    lines.push('')
    lines.push(`🎬 Total de vídeos: <b>${total}</b>`)
    lines.push(`📱 Plataforma: <b>${platform}</b>`)
    lines.push('')
    lines.push(`✅ Sucesso: <b>${success}</b>`)
    lines.push(`❌ Erros: <b>${failed}</b>`)

    if (errors.length > 0) {
      lines.push('')
      lines.push('Detalhes dos erros:')
      for (const error of errors.slice(0, 3)) {
        lines.push(`  • ${error}`)
      }
      if (errors.length > 3) {
        lines.push(`  … e mais ${errors.length - 3} erro(s)`)
      }
    }

    await sendTelegramMessage(lines.join('\n'))
  }
}