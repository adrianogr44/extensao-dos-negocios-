export default function ExtensaoPage() {
  const features = [
    {
      icon: '📸',
      title: 'Instagram — Reels em massa',
      desc: 'Baixa todos os Reels de um perfil pelo link ou username, com limite opcional (0 = todos).',
    },
    {
      icon: '📺',
      title: 'YouTube Shorts',
      desc: 'Baixa Shorts e vídeos do YouTube direto pelo link. Sem marca d’água, no formato do navegador.',
    },
    {
      icon: '🎵',
      title: 'TikTok',
      desc: 'Baixa vídeos do TikTok pelo link @usuario/video/ID, usando a sessão logada do navegador.',
    },
    {
      icon: '📊',
      title: 'Progresso em tempo real',
      desc: 'Barra de progresso e log de cada vídeo (página encontrada, URL obtida, download iniciado).',
    },
    {
      icon: '📁',
      title: 'Pasta organizada',
      desc: 'Tudo salvo automaticamente em Downloads/FabricaReels com nomes por perfil/título.',
    },
    {
      icon: '🔒',
      title: 'Usa sua sessão do navegador',
      desc: 'Não pede senha: aproveita o login que você já tem no Instagram, YouTube e TikTok.',
    },
  ]

  const steps = [
    'Abra chrome://extensions no Chrome',
    'Ative o "Modo do desenvolvedor" (canto superior direito)',
    'Clique em "Carregar sem compactação"',
    'Selecione a pasta chrome-extension do projeto',
  ]

  const usage = [
    {
      platform: 'Instagram',
      example: 'https://www.instagram.com/vovoteodoro/',
      desc: 'Cole o link do perfil (ou username), escolha o máximo de Reels e clique em "Baixar Reels".',
    },
    {
      platform: 'YouTube',
      example: 'https://www.youtube.com/shorts/ABcdEfGhIjk',
      desc: 'Cole o link do Shorts ou vídeo e clique em "Baixar Shorts". A extensão abre a página, aguarda carregar e baixa o vídeo.',
    },
    {
      platform: 'TikTok',
      example: 'https://www.tiktok.com/@usuario/video/1234567890',
      desc: 'Cole o link do vídeo e clique em "Baixar Vídeo". O vídeo é baixado com a qualidade disponível para sua sessão.',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-purple-400">
          Extensão do Chrome
        </p>
        <h1 className="mt-1 text-2xl font-bold">Downloader — Fábrica de Reels</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Extensão que baixa vídeos direto do navegador: Reels do Instagram em massa,
          Shorts do YouTube e vídeos do TikTok.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-zinc-800 bg-zinc-900 p-5"
          >
            <p className="text-2xl">{f.icon}</p>
            <h3 className="mt-2 font-semibold text-zinc-100">{f.title}</h3>
            <p className="mt-1 text-sm text-zinc-400">{f.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">Como instalar</h2>
          <ol className="list-inside list-decimal space-y-2 text-sm text-zinc-300">
            {steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="text-sm text-zinc-500">
            Depois de instalada, o ícone 📦 aparece na barra de ferramentas do Chrome.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">Como usar</h2>
          {usage.map((u) => (
            <div key={u.platform} className="space-y-1">
              <p className="text-sm font-medium text-purple-300">{u.platform}</p>
              <code className="block rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                {u.example}
              </code>
              <p className="text-xs text-zinc-500">{u.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 p-6 text-sm">
        <h3 className="font-semibold text-amber-300">Dicas</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-zinc-300">
          <li>O Instagram precisa estar logado no navegador onde a extensão está instalada.</li>
          <li>Para YouTube, a página do Shorts precisa carregar antes do download — aguarde o log.</li>
          <li>Os vídeos ficam em <strong>Downloads/FabricaReels/</strong>.</li>
        </ul>
      </div>
    </div>
  )
}