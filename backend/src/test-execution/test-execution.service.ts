import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateRoundDto } from './dto/create-round.dto';
import { UpdateRoundDto } from './dto/update-round.dto';
import { SaveResultDto } from './dto/save-result.dto';

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  planned: ['in_progress', 'closed'],
  in_progress: ['completed', 'closed'],
  completed: ['closed'],
  closed: [],
};

@Injectable()
export class TestExecutionService {
  constructor(private prisma: PrismaService) {}

  // ─── Phase ──────────────────────────────────────────────────────

  private async nextPhaseCode(projectId: string): Promise<string> {
    const last = await this.prisma.testPhase.findFirst({
      where: { projectId },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    if (!last) return 'TP-001';
    const num = parseInt(last.code.replace('TP-', ''), 10) || 0;
    return `TP-${String(num + 1).padStart(3, '0')}`;
  }

  async createPhase(projectId: string, dto: CreatePhaseDto) {
    const code = await this.nextPhaseCode(projectId);
    const phase = await this.prisma.testPhase.create({
      data: {
        projectId,
        code,
        title: dto.title,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: 'planned',
      },
    });
    // 자동 스냅샷 생성
    await this.createSnapshot(projectId, phase.id);
    return this.prisma.testPhase.findUnique({
      where: { id: phase.id },
      include: { rounds: true },
    });
  }

  async createSnapshot(projectId: string, phaseId: string) {
    const scenarios = await this.prisma.testScenario.findMany({
      where: { projectId },
      include: { testCases: { orderBy: { createdAt: 'asc' } } },
      orderBy: { code: 'asc' },
    });
    const snapshotData = {
      createdAt: new Date().toISOString(),
      scenarios: scenarios.map(s => ({
        id: s.id,
        code: s.code,
        title: s.title,
        type: s.type,
        cases: s.testCases.map((c, idx) => ({
          id: c.id,
          index: idx,
          title: c.title,
          priority: c.priority || 'medium',
          steps: c.steps,
          testData: c.testData,
          expected: c.expected,
        })),
      })),
    };
    return this.prisma.testPhase.update({
      where: { id: phaseId },
      data: { snapshotData, snapshotAt: new Date(), outdated: false },
    });
  }

  async listPhases(projectId: string) {
    const phases = await this.prisma.testPhase.findMany({
      where: { projectId },
      include: { rounds: { orderBy: { roundNumber: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return phases.map(p => ({
      ...p,
      snapshotData: undefined,
      roundCount: p.rounds.length,
      latestRound: p.rounds[p.rounds.length - 1] || null,
    }));
  }

  async getPhase(projectId: string, phaseId: string) {
    const phase = await this.prisma.testPhase.findFirst({
      where: { id: phaseId, projectId },
      include: { rounds: { orderBy: { roundNumber: 'asc' } } },
    });
    if (!phase) throw new NotFoundException('TestPhase not found');
    // snapshotData 제외
    const { snapshotData, ...rest } = phase;
    return rest;
  }

  async getPhaseWithSnapshot(projectId: string, phaseId: string) {
    const phase = await this.prisma.testPhase.findFirst({
      where: { id: phaseId, projectId },
      include: { rounds: { orderBy: { roundNumber: 'asc' } } },
    });
    if (!phase) throw new NotFoundException('TestPhase not found');
    return phase;
  }

  async updatePhase(projectId: string, phaseId: string, dto: UpdatePhaseDto) {
    const current = await this.prisma.testPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!current) throw new NotFoundException('TestPhase not found');

    if (dto.status && dto.status !== current.status) {
      const valid = VALID_STATUS_TRANSITIONS[current.status];
      if (!valid || !valid.includes(dto.status)) {
        throw new BadRequestException(`${current.status} → ${dto.status} 전이 불가`);
      }
    }

    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    delete data.startDate;
    delete data.endDate;
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);

    return this.prisma.testPhase.update({
      where: { id: phaseId },
      data,
    });
  }

  async deletePhase(projectId: string, phaseId: string) {
    const phase = await this.prisma.testPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) throw new NotFoundException('TestPhase not found');
    return this.prisma.testPhase.delete({ where: { id: phaseId } });
  }

  // ─── Round ──────────────────────────────────────────────────────

  async createRound(projectId: string, phaseId: string, dto: CreateRoundDto) {
    const phase = await this.getPhaseWithSnapshot(projectId, phaseId);
    const existingRounds = await this.prisma.testRound.findMany({
      where: { phaseId },
      orderBy: { roundNumber: 'asc' },
    });
    const roundNumber = existingRounds.length + 1;

    const snapshot = phase.snapshotData as any;
    const totalCases = snapshot?.scenarios?.reduce((sum: number, s: any) => sum + s.cases.length, 0) || 0;

    const round = await this.prisma.testRound.create({
      data: {
        phaseId,
        roundNumber,
        testerName: dto.testerName,
        testerDept: dto.testerDept,
        executedAt: dto.executedAt ? new Date(dto.executedAt) : undefined,
        scope: dto.scope ?? 'full',
        sourceRoundId: dto.sourceRoundId,
        totalCases,
      },
    });

    // partial scope: 이전 회차의 fail/blocked results 복사 (result=null)
    if (dto.scope === 'partial' && dto.sourceRoundId) {
      const sourceResults = await this.prisma.testRoundResult.findMany({
        where: {
          roundId: dto.sourceRoundId,
          result: { in: ['fail', 'blocked'] },
        },
      });
      if (sourceResults.length > 0) {
        await this.prisma.testRoundResult.createMany({
          data: sourceResults.map(r => ({
            roundId: round.id,
            scenarioCode: r.scenarioCode,
            caseTitle: r.caseTitle,
            caseIndex: r.caseIndex,
            result: undefined,
            actual: undefined,
            stepResults: undefined,
            defectId: undefined,
          })),
        });
        // partial일 때 totalCases를 복사된 건수로 업데이트
        await this.prisma.testRound.update({
          where: { id: round.id },
          data: { totalCases: sourceResults.length },
        });
      }
    }

    return this.prisma.testRound.findUnique({
      where: { id: round.id },
      include: { results: true },
    });
  }

  async listRounds(projectId: string, phaseId: string) {
    // phase 존재 확인
    const phase = await this.prisma.testPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) throw new NotFoundException('TestPhase not found');
    return this.prisma.testRound.findMany({
      where: { phaseId },
      orderBy: { roundNumber: 'asc' },
    });
  }

  async getRound(projectId: string, phaseId: string, roundId: string) {
    const round = await this.prisma.testRound.findFirst({
      where: { id: roundId, phaseId, phase: { projectId } },
      include: { results: true },
    });
    if (!round) throw new NotFoundException('TestRound not found');
    return round;
  }

  async updateRound(projectId: string, phaseId: string, roundId: string, dto: UpdateRoundDto) {
    const round = await this.prisma.testRound.findFirst({
      where: { id: roundId, phaseId, phase: { projectId } },
    });
    if (!round) throw new NotFoundException('TestRound not found');

    const data: any = { ...dto };
    if (dto.executedAt) data.executedAt = new Date(dto.executedAt);

    return this.prisma.testRound.update({
      where: { id: roundId },
      data,
    });
  }

  async deleteRound(projectId: string, phaseId: string, roundId: string) {
    const round = await this.prisma.testRound.findFirst({
      where: { id: roundId, phaseId, phase: { projectId } },
    });
    if (!round) throw new NotFoundException('TestRound not found');
    return this.prisma.testRound.delete({ where: { id: roundId } });
  }

  // ─── Results ────────────────────────────────────────────────────

  async saveResults(roundId: string, dtos: SaveResultDto[]) {
    for (const dto of dtos) {
      // compound unique가 없으므로 findFirst + create/update
      const existing = await this.prisma.testRoundResult.findFirst({
        where: { roundId, scenarioCode: dto.scenarioCode, caseTitle: dto.caseTitle },
      });
      if (existing) {
        await this.prisma.testRoundResult.update({
          where: { id: existing.id },
          data: {
            caseIndex: dto.caseIndex,
            result: dto.result,
            actual: dto.actual,
            stepResults: dto.stepResults,
            defectId: dto.defectId,
          },
        });
      } else {
        await this.prisma.testRoundResult.create({
          data: {
            roundId,
            scenarioCode: dto.scenarioCode,
            caseTitle: dto.caseTitle,
            caseIndex: dto.caseIndex,
            result: dto.result,
            actual: dto.actual,
            stepResults: dto.stepResults,
            defectId: dto.defectId,
          },
        });
      }
    }
    await this.recalculateCounts(roundId);
    return { saved: dtos.length };
  }

  async updateResult(roundId: string, resultId: string, dto: Partial<SaveResultDto>) {
    const result = await this.prisma.testRoundResult.findFirst({
      where: { id: resultId, roundId },
    });
    if (!result) throw new NotFoundException('TestRoundResult not found');
    const updated = await this.prisma.testRoundResult.update({
      where: { id: resultId },
      data: {
        result: dto.result,
        actual: dto.actual,
        stepResults: dto.stepResults,
        defectId: dto.defectId,
      },
    });
    await this.recalculateCounts(roundId);
    return updated;
  }

  async getResults(roundId: string) {
    return this.prisma.testRoundResult.findMany({
      where: { roundId },
      orderBy: [{ scenarioCode: 'asc' }, { caseIndex: 'asc' }],
    });
  }

  private async recalculateCounts(roundId: string) {
    const results = await this.prisma.testRoundResult.findMany({ where: { roundId } });
    await this.prisma.testRound.update({
      where: { id: roundId },
      data: {
        passCount: results.filter(r => r.result === 'pass').length,
        failCount: results.filter(r => r.result === 'fail').length,
        blockedCount: results.filter(r => r.result === 'blocked').length,
        naCount: results.filter(r => r.result === 'na').length,
      },
    });
  }

  // ─── Testers ────────────────────────────────────────────────────

  async getTesters(projectId: string) {
    const rounds = await this.prisma.testRound.findMany({
      where: { phase: { projectId } },
      select: { testerName: true, testerDept: true },
      distinct: ['testerName'],
      orderBy: { createdAt: 'desc' },
    });
    return rounds;
  }

  // ─── Dashboard ──────────────────────────────────────────────────

  async getDashboard(projectId: string, phaseId: string) {
    const phase = await this.prisma.testPhase.findFirst({ where: { id: phaseId, projectId } });
    if (!phase) throw new NotFoundException('TestPhase not found');

    const rounds = await this.prisma.testRound.findMany({
      where: { phaseId },
      orderBy: { roundNumber: 'asc' },
    });

    const snapshot = phase.snapshotData as any;
    const totalCases = snapshot?.scenarios?.reduce((sum: number, s: any) => sum + s.cases.length, 0) || 0;

    // Fail 다발 케이스 Top 10
    const allResults = await this.prisma.testRoundResult.findMany({
      where: { round: { phaseId }, result: { in: ['fail', 'blocked'] } },
    });
    const failMap: Record<string, number> = {};
    allResults.forEach(r => {
      const key = `[${r.scenarioCode}] ${r.caseTitle}`;
      failMap[key] = (failMap[key] || 0) + 1;
    });
    const topFails = Object.entries(failMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({ key, count }));

    return { totalCases, rounds, topFails };
  }

  // ─── Outdated marking ──────────────────────────────────────────

  async markPhasesOutdated(projectId: string) {
    await this.prisma.testPhase.updateMany({
      where: { projectId, status: { in: ['planned', 'in_progress'] }, outdated: false },
      data: { outdated: true },
    });
  }
}
