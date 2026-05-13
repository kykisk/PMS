import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { CreateTestCaseDto } from './dto/create-testcase.dto';
import { ExecuteTestCaseDto } from './dto/execute-testcase.dto';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { CreateDefectDto, UpdateDefectDto } from './dto/defect.dto';

const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['assigned', 'closed'],
  assigned: ['in_progress', 'open'],
  in_progress: ['resolved'],
  resolved: ['verified', 'reopened'],
  verified: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['assigned', 'in_progress'],
};

@Injectable()
export class TestManagementService {
  constructor(private prisma: PrismaService) {}

  private async nextScenarioCode(projectId: string): Promise<string> {
    const all = await this.prisma.testScenario.findMany({
      where: { projectId },
      select: { code: true },
    });
    let maxNum = 0;
    for (const s of all) {
      const num = parseInt(s.code.replace('TS-', ''), 10) || 0;
      if (num > maxNum) maxNum = num;
    }
    return `TS-${String(maxNum + 1).padStart(3, '0')}`;
  }

  private async nextCaseCode(): Promise<string> {
    const count = await this.prisma.testCase.count();
    return `TC-${String(count + 1).padStart(3, '0')}`;
  }

   async createScenario(projectId: string, dto: CreateScenarioDto) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await this.nextScenarioCode(projectId);
      try {
        return await this.prisma.testScenario.create({
          data: {
            projectId, code,
            title: dto.title,
            description: dto.description,
            type: dto.type ?? 'integration',
            testType: dto.testType ?? 'functional',
            testData: dto.testData,
            reqId: dto.reqId || undefined,
            featureId: dto.featureId || undefined,
            status: dto.status ?? 'draft',
          },
          include: {
            testCases: true,
            requirement: { select: { id: true, code: true, title: true } },
            feature: { select: { id: true, code: true, title: true } },
          },
        });
      } catch (e: any) {
        if (e?.code === 'P2002' && attempt < 4) continue;
        throw e;
      }
    }
  }

  async findAllScenarios(projectId: string, query: { reqId?: string; featureId?: string; type?: string; testType?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(2000, query.limit ?? 50);
    const skip = (page - 1) * limit;
    const where: any = { projectId };
    if (query.reqId) where.reqId = query.reqId;
    if (query.featureId) where.featureId = query.featureId;
    if (query.type) where.type = query.type;
    if (query.testType) where.testType = query.testType;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.testScenario.findMany({
        where,
        include: {
          requirement: { select: { id: true, code: true, title: true } },
          feature: { select: { id: true, code: true, title: true, reqId: true,
            requirement: { select: { id: true, code: true, title: true } } } },
          _count: { select: { testCases: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.testScenario.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOneScenario(projectId: string, scenarioId: string) {
    const scenario = await this.prisma.testScenario.findFirst({
      where: { id: scenarioId, projectId },
      include: {
        testCases: { orderBy: { createdAt: 'asc' } },
        feature: { select: { id: true, code: true, title: true, reqId: true,
          requirement: { select: { id: true, code: true, title: true } } } },
      },
    });
    if (!scenario) throw new NotFoundException('TestScenario not found');
    return scenario;
  }

  async updateScenario(projectId: string, scenarioId: string, dto: Partial<CreateScenarioDto>) {
    await this.findOneScenario(projectId, scenarioId);
    const updated = await this.prisma.testScenario.update({
      where: { id: scenarioId },
      data: { ...dto, reqId: dto.reqId || undefined, featureId: dto.featureId || undefined },
    });
    await this.markPhasesOutdated(projectId);
    return updated;
  }

  async removeScenario(projectId: string, scenarioId: string) {
    await this.findOneScenario(projectId, scenarioId);
    return this.prisma.testScenario.delete({ where: { id: scenarioId } });
  }

  async createTestCase(scenarioId: string, dto: CreateTestCaseDto) {
    const scenario = await this.prisma.testScenario.findUnique({ where: { id: scenarioId }, select: { projectId: true } });
    const created = await this.prisma.testCase.create({
      data: {
        scenarioId,
        title: dto.title,
        type: dto.type ?? 'integration',
        steps: dto.steps,
        testData: dto.testData,
        expected: dto.expected,
        status: 'pending',
      },
    });
    if (scenario) await this.markPhasesOutdated(scenario.projectId);
    return created;
  }

  async findAllTestCases(scenarioId: string) {
    return this.prisma.testCase.findMany({
      where: { scenarioId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOneTestCase(caseId: string) {
    const tc = await this.prisma.testCase.findUnique({ where: { id: caseId } });
    if (!tc) throw new NotFoundException('TestCase not found');
    return tc;
  }

  async updateTestCase(caseId: string, dto: Partial<CreateTestCaseDto>) {
    const tc = await this.prisma.testCase.findUnique({ where: { id: caseId }, include: { scenario: { select: { projectId: true } } } });
    const updated = await this.prisma.testCase.update({ where: { id: caseId }, data: dto });
    if (tc?.scenario) await this.markPhasesOutdated(tc.scenario.projectId);
    return updated;
  }

  async executeTestCase(caseId: string, dto: ExecuteTestCaseDto, executedBy: string) {
    return this.prisma.testCase.update({
      where: { id: caseId },
      data: {
        result: dto.result,
        actual: dto.actual,
        executedBy,
        executedAt: new Date(),
        status: 'executed',
      },
    });
  }

  async removeTestCase(caseId: string) {
    return this.prisma.testCase.delete({ where: { id: caseId } });
  }

  // ─── Wave 2: TestCycle ───────────────────────────────────────────

  async nextCycleCode(projectId: string): Promise<string> {
    const last = await this.prisma.testCycle.findFirst({
      where: { projectId, code: { not: 'CY-000' } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    if (!last) return 'CY-001';
    const num = parseInt(last.code.replace('CY-', ''), 10) || 0;
    return `CY-${String(num + 1).padStart(3, '0')}`;
  }

  async createCycle(projectId: string, dto: CreateCycleDto) {
    const code = await this.nextCycleCode(projectId);
    return this.prisma.testCycle.create({
      data: {
        projectId,
        code,
        title: dto.title,
        description: dto.description,
        scope: dto.scope ?? 'full',
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status ?? 'planned',
      },
    });
  }

  private async computeCycleStats(projectId: string, cycleId: string) {
    const executions = await this.prisma.testExecution.findMany({ where: { cycleId } });
    const total = await this.prisma.testCase.count({ where: { scenario: { projectId } } });
    const pass = executions.filter(e => e.result === 'pass').length;
    const fail = executions.filter(e => e.result === 'fail').length;
    const blocked = executions.filter(e => e.result === 'blocked').length;
    const skipped = executions.filter(e => e.result === 'skipped').length;
    const notExecuted = total - executions.length;
    const passRate = total > 0 ? Math.round((pass / total) * 100) : 0;
    return { total, pass, fail, blocked, skipped, notExecuted, passRate, executed: executions.length };
  }

  async findAllCycles(projectId: string) {
    const cycles = await this.prisma.testCycle.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    const result: any[] = [];
    for (const cycle of cycles) {
      const stats = await this.computeCycleStats(projectId, cycle.id);
      result.push({ ...cycle, stats });
    }
    return result;
  }

  async findOneCycle(projectId: string, cycleId: string) {
    const cycle = await this.prisma.testCycle.findFirst({
      where: { id: cycleId, projectId },
    });
    if (!cycle) throw new NotFoundException('TestCycle not found');
    const stats = await this.computeCycleStats(projectId, cycleId);
    const executions = await this.prisma.testExecution.findMany({
      where: { cycleId },
      include: { testCase: { include: { scenario: true } } },
      orderBy: { executedAt: 'desc' },
    });
    return { ...cycle, stats, executions };
  }

  async updateCycle(projectId: string, cycleId: string, dto: Partial<CreateCycleDto>) {
    await this.findOneCycle(projectId, cycleId);
    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return this.prisma.testCycle.update({ where: { id: cycleId }, data });
  }

  async removeCycle(projectId: string, cycleId: string) {
    await this.findOneCycle(projectId, cycleId);
    return this.prisma.testCycle.delete({ where: { id: cycleId } });
  }

  async getCycleStats(projectId: string, cycleId: string) {
    await this.findOneCycle(projectId, cycleId);
    return this.computeCycleStats(projectId, cycleId);
  }

  // ─── Wave 2: TestExecution ──────────────────────────────────────

  async createExecution(cycleId: string, dto: CreateExecutionDto, executedBy: string) {
    const execution = await this.prisma.testExecution.create({
      data: {
        cycleId,
        testCaseId: dto.testCaseId,
        result: dto.result,
        actual: dto.actual,
        note: dto.note,
        executedBy,
      },
    });
    // 하위호환: TestCase.result/status도 동시 업데이트
    await this.prisma.testCase.update({
      where: { id: dto.testCaseId },
      data: { result: dto.result, actual: dto.actual, executedBy, executedAt: new Date(), status: 'executed' },
    });
    return execution;
  }

  async findExecutionsByCycle(cycleId: string) {
    return this.prisma.testExecution.findMany({
      where: { cycleId },
      include: { testCase: { include: { scenario: true } } },
      orderBy: { executedAt: 'desc' },
    });
  }

  async findExecutionsByCase(caseId: string) {
    return this.prisma.testExecution.findMany({
      where: { testCaseId: caseId },
      include: { cycle: true },
      orderBy: { executedAt: 'desc' },
    });
  }

  // ─── Wave 2: Defect ─────────────────────────────────────────────

  async nextDefectCode(projectId: string): Promise<string> {
    const last = await this.prisma.defect.findFirst({
      where: { projectId },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    if (!last) return 'DF-001';
    const num = parseInt(last.code.replace('DF-', ''), 10) || 0;
    return `DF-${String(num + 1).padStart(3, '0')}`;
  }

  async createDefect(projectId: string, dto: CreateDefectDto, reportedBy: string) {
    const code = await this.nextDefectCode(projectId);
    return this.prisma.defect.create({
      data: {
        projectId,
        code,
        title: dto.title,
        description: dto.description,
        severity: dto.severity ?? 'major',
        priority: dto.priority ?? 'medium',
        status: 'open',
        reportedBy,
        assigneeId: dto.assigneeId,
        executionId: dto.executionId,
      },
    });
  }

  async findAllDefects(projectId: string, query: { status?: string; severity?: string; priority?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 50);
    const skip = (page - 1) * limit;
    const where: any = { projectId };
    if (query.status) where.status = query.status;
    if (query.severity) where.severity = query.severity;
    if (query.priority) where.priority = query.priority;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.defect.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.defect.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOneDefect(projectId: string, defectId: string) {
    const defect = await this.prisma.defect.findFirst({
      where: { id: defectId, projectId },
    });
    if (!defect) throw new NotFoundException('Defect not found');
    return defect;
  }

  async updateDefect(projectId: string, defectId: string, dto: UpdateDefectDto) {
    if (dto.status) {
      const current = await this.findOneDefect(projectId, defectId);
      const valid = VALID_TRANSITIONS[current.status];
      if (!valid?.includes(dto.status)) {
        throw new BadRequestException(`${current.status} → ${dto.status} 전이는 허용되지 않습니다`);
      }
      const data: any = { ...dto };
      if (dto.status === 'resolved') {
        data.resolvedAt = new Date();
      }
      return this.prisma.defect.update({ where: { id: defectId }, data });
    }
    return this.prisma.defect.update({ where: { id: defectId }, data: dto });
  }

  async removeDefect(projectId: string, defectId: string) {
    await this.findOneDefect(projectId, defectId);
    return this.prisma.defect.delete({ where: { id: defectId } });
  }

  // ─── Wave 2: Stats ──────────────────────────────────────────────

  async getTestSummary(projectId: string) {
    const cycles = await this.prisma.testCycle.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    const result: any[] = [];
    for (const cycle of cycles) {
      const stats = await this.computeCycleStats(projectId, cycle.id);
      result.push({ ...cycle, stats });
    }
    return result;
  }

  private async markPhasesOutdated(projectId: string) {
    await this.prisma.testPhase.updateMany({
      where: { projectId, status: { in: ['planned', 'in_progress'] } },
      data: { outdated: true },
    });
  }
}
