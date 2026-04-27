import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { CreateTestCaseDto } from './dto/create-testcase.dto';
import { ExecuteTestCaseDto } from './dto/execute-testcase.dto';

@Injectable()
export class TestManagementService {
  constructor(private prisma: PrismaService) {}

  private async nextScenarioCode(projectId: string): Promise<string> {
    const count = await this.prisma.testScenario.count({ where: { projectId } });
    return `TS-${String(count + 1).padStart(3, '0')}`;
  }

  private async nextCaseCode(): Promise<string> {
    const count = await this.prisma.testCase.count();
    return `TC-${String(count + 1).padStart(3, '0')}`;
  }

  async createScenario(projectId: string, dto: CreateScenarioDto) {
    const code = await this.nextScenarioCode(projectId);
    return this.prisma.testScenario.create({
      data: {
        projectId,
        code,
        title: dto.title,
        description: dto.description,
        type: dto.type ?? 'integration',
        testData: dto.testData,
        reqId: dto.reqId || undefined,
        featureId: dto.featureId || undefined,
        status: 'draft',
      },
      include: {
        testCases: true,
        feature: { select: { id: true, code: true, title: true } },
      },
    });
  }

  async findAllScenarios(projectId: string, query: { reqId?: string; featureId?: string; type?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 50);
    const skip = (page - 1) * limit;
    const where: any = { projectId };
    if (query.reqId) where.reqId = query.reqId;
    if (query.featureId) where.featureId = query.featureId;
    if (query.type) where.type = query.type;
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
          testCases: { select: { id: true, title: true, result: true, status: true } },
          feature: { select: { id: true, code: true, title: true } },
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
    return this.prisma.testScenario.update({
      where: { id: scenarioId },
      data: { ...dto, reqId: dto.reqId || undefined, featureId: dto.featureId || undefined },
    });
  }

  async removeScenario(projectId: string, scenarioId: string) {
    await this.findOneScenario(projectId, scenarioId);
    return this.prisma.testScenario.delete({ where: { id: scenarioId } });
  }

  async createTestCase(scenarioId: string, dto: CreateTestCaseDto) {
    return this.prisma.testCase.create({
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
    return this.prisma.testCase.update({ where: { id: caseId }, data: dto });
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
}
