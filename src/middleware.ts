import { NextRequest, NextResponse } from 'next/server'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Protege as rotas /api/* mutaveis contra CSRF. Varias delas spawnam/matam processos
// (start-all, scheduler, chrome, publish) ou apagam arquivos (videos) — sem isso, um
// site externo aberto no navegador poderia dispara-las via fetch cross-origin.
// Navegadores SEMPRE enviam o header Origin em requisicoes cross-origin; se o Origin
// nao bate com o host do painel, recusamos. Requisicoes sem Origin (ferramentas locais,
// curl, o proprio scheduler) passam — o vetor de risco e o navegador de terceiros.
export function middleware(request: NextRequest) {
  if (!MUTATING.has(request.method)) return NextResponse.next()

  const origin = request.headers.get('origin')
  if (!origin) return NextResponse.next()

  const host = request.headers.get('host')
  let originHost = ''
  try {
    originHost = new URL(origin).host
  } catch {
    originHost = ''
  }

  if (!host || originHost !== host) {
    return NextResponse.json({ error: 'Origem nao permitida' }, { status: 403 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
