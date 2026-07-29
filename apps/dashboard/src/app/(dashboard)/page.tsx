import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

async function getStats() {
  const [totalVideos, totalNichos, byStatus] = await Promise.all([
    prisma.video.count(),
    prisma.niche.count(),
    prisma.video.groupBy({ by: ['status'], _count: true }),
  ])

  const statusMap: Record<string, number> = {}
  byStatus.forEach((s: { status: string; _count: number }) => { statusMap[s.status] = s._count })

  return { totalVideos, totalNichos, statusMap }
}

export default async function DashboardPage() {
  const stats = await getStats()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-zinc-400">Visão geral do PostReels</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total de Vídeos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalVideos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Nichos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalNichos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Baixados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-400">{stats.statusMap['downloaded'] || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Processados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">{stats.statusMap['completed'] || 0}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
