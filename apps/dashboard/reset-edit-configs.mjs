import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetInvalidConfigs() {
  console.log('🔍 Procurando por editConfigs com valores inválidos...')

  const allConfigs = await prisma.editConfig.findMany({
    select: { videoId: true, overlayCropBottom: true, overlayY: true, overlayCropTop: true }
  })

  const invalidConfigs = allConfigs.filter(c =>
    (c.overlayCropBottom && c.overlayCropBottom > 1000) ||
    (c.overlayY && c.overlayY < -500) ||
    (c.overlayY && c.overlayY > 1500) ||
    (c.overlayCropTop && c.overlayCropTop > 1000)
  )

  console.log(`📋 Encontrados ${invalidConfigs.length} configs com valores inválidos`)

  if (invalidConfigs.length === 0) {
    console.log('✅ Nenhum valor inválido encontrado!')
    process.exit(0)
  }

  console.log('\n🔧 Resetando para defaults...')

  for (const config of invalidConfigs) {
    await prisma.editConfig.update({
      where: { videoId: config.videoId },
      data: {
        overlayCropTop: 0,
        overlayCropBottom: 0,
        overlayY: 0,
      }
    })
    console.log(`  ✓ ${config.videoId}`)
  }

  console.log(`\n✅ ${invalidConfigs.length} configs resetadas com sucesso!`)
  process.exit(0)
}

resetInvalidConfigs().catch(err => {
  console.error('❌ Erro:', err.message)
  process.exit(1)
})
