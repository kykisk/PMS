import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany({ select: { id: true, name: true } })
  let totalCycles = 0
  let totalExecutions = 0

  for (const project of projects) {
    const executedCases = await prisma.testCase.findMany({
      where: { scenario: { projectId: project.id }, result: { not: null } },
      include: { scenario: true },
    })
    if (executedCases.length === 0) continue

    const existingLegacyCycle = await prisma.testCycle.findFirst({
      where: { projectId: project.id, code: 'CY-000' },
    })
    const legacyCycle = existingLegacyCycle ?? await prisma.testCycle.create({
      data: {
        projectId: project.id,
        code: 'CY-000',
        title: '마이그레이션 이전 실행 기록',
        scope: 'full',
        status: 'completed',
      },
    })
    if (!existingLegacyCycle) totalCycles++

    for (const tc of executedCases) {
      const existing = await prisma.testExecution.findFirst({
        where: { testCaseId: tc.id, cycleId: legacyCycle.id },
      })
      if (existing) continue
      await prisma.testExecution.create({
        data: {
          testCaseId: tc.id,
          cycleId: legacyCycle.id,
          result: tc.result!,
          actual: tc.actual ?? undefined,
          executedBy: tc.executedBy ?? undefined,
          executedAt: tc.executedAt ?? new Date(),
        },
      })
      totalExecutions++
    }
    console.log(`✓ ${project.name}: ${executedCases.length}개 케이스`)
  }
  console.log(`완료 - 사이클: ${totalCycles}, 실행기록: ${totalExecutions}`)
}

main()
  .catch(e => { console.error('실패:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
