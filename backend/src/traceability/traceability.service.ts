import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TraceabilityService {
  constructor(private prisma: PrismaService) {}

  async createLink(projectId: string, sourceType: string, sourceId: string, targetType: string, targetId: string, linkType = 'derives') {
    return this.prisma.traceabilityLink.upsert({
      where: { sourceType_sourceId_targetType_targetId: { sourceType, sourceId, targetType, targetId } },
      create: { projectId, sourceType, sourceId, targetType, targetId, linkType },
      update: { linkType },
    });
  }

  async deleteLink(sourceType: string, sourceId: string, targetType: string, targetId: string) {
    return this.prisma.traceabilityLink.deleteMany({
      where: { sourceType, sourceId, targetType, targetId },
    });
  }

  async getMatrix(projectId: string) {
    const [requirements, features, tasks, scenarios, useCases, userStories, dbTables, apiSpecs] = await Promise.all([
      this.prisma.requirement.findMany({ where: { projectId }, orderBy: { code: 'asc' } }),
      this.prisma.feature.findMany({ where: { projectId }, include: { requirement: { select: { id: true } } } }),
      this.prisma.task.findMany({ where: { projectId }, include: { feature: { select: { id: true } } } }),
      this.prisma.testScenario.findMany({ where: { projectId }, include: { testCases: { select: { id: true, result: true, status: true } } } }),
      this.prisma.useCase.findMany({ where: { projectId }, orderBy: { code: 'asc' } }),
      this.prisma.userStory.findMany({ where: { projectId }, orderBy: { code: 'asc' } }),
      this.prisma.dbTable.findMany({ where: { projectId }, include: { feature: { select: { id: true } } } }),
      this.prisma.apiSpec.findMany({ where: { projectId }, include: { feature: { select: { id: true } } } }),
    ]);

    return requirements.map(req => {
      const reqFeatures = features.filter(f => f.reqId === req.id || f.requirement?.id === req.id);
      const reqScenarios = scenarios.filter(s => s.reqId === req.id);
      const reqUseCases = useCases.filter(u => u.requirementId === req.id);
      const reqUserStories = userStories.filter(u => u.requirementId === req.id);

      return {
        requirement: { id: req.id, code: req.code, title: req.title, status: req.status },
        useCases: reqUseCases.map(u => ({ id: u.id, code: u.code, title: u.title, actor: u.actor, status: u.status })),
        userStories: reqUserStories.map(u => ({ id: u.id, code: u.code, title: u.title, asA: u.asA, iWantTo: u.iWantTo, status: u.status })),
        features: reqFeatures.map(f => {
          const featureTasks = tasks.filter(t => t.featureId === f.id);
          const featureScenarios = scenarios.filter(s => s.featureId === f.id);
          const featureDbTables = dbTables.filter(d => d.featureId === f.id);
          const featureApiSpecs = apiSpecs.filter(a => a.featureId === f.id);
          return {
            id: f.id, code: f.code, title: f.title, status: f.status,
            dbTables: featureDbTables.map(d => ({ id: d.id, name: d.name, description: d.description })),
            apiSpecs: featureApiSpecs.map(a => ({ id: a.id, method: a.method, path: a.path, summary: a.summary })),
            tasks: featureTasks.map(t => ({ id: t.id, code: t.code, title: t.title, progress: t.progress, status: t.status })),
            testScenarios: featureScenarios.map(s => ({ id: s.id, code: s.code, title: s.title, result: this.aggregateResult(s.testCases) })),
          };
        }),
        directScenarios: reqScenarios.map(s => ({ id: s.id, code: s.code, title: s.title, result: this.aggregateResult(s.testCases) })),
      };
    });
  }

  private aggregateResult(testCases: { result: string | null; status: string }[]): string {
    if (!testCases || testCases.length === 0) return 'no_cases';
    if (testCases.some(tc => tc.result === 'fail')) return 'fail';
    if (testCases.every(tc => tc.result === 'pass')) return 'pass';
    return 'pending';
  }

  async getCoverage(projectId: string) {
    const [reqCount, featureCount, taskCount, scenarioCount, ucCount, usCount] = await Promise.all([
      this.prisma.requirement.count({ where: { projectId } }),
      this.prisma.feature.count({ where: { projectId } }),
      this.prisma.task.count({ where: { projectId } }),
      this.prisma.testScenario.count({ where: { projectId } }),
      this.prisma.useCase.count({ where: { projectId } }),
      this.prisma.userStory.count({ where: { projectId } }),
    ]);
    const reqWithFeature = await this.prisma.requirement.count({ where: { projectId, features: { some: {} } } });
    const featureWithTask = await this.prisma.feature.count({ where: { projectId, tasks: { some: {} } } });
    const featureWithTest = await this.prisma.feature.count({ where: { projectId, testScenarios: { some: {} } } });
    const passedCases = await this.prisma.testCase.count({ where: { scenario: { projectId }, result: 'pass' } });
    const totalCases = await this.prisma.testCase.count({ where: { scenario: { projectId } } });

    return {
      requirements: { total: reqCount, withFeature: reqWithFeature, coverage: reqCount > 0 ? Math.round((reqWithFeature / reqCount) * 100) : 0 },
      features: { total: featureCount, withTask: featureWithTask, withTest: featureWithTest,
        taskCoverage: featureCount > 0 ? Math.round((featureWithTask / featureCount) * 100) : 0,
        testCoverage: featureCount > 0 ? Math.round((featureWithTest / featureCount) * 100) : 0 },
      tasks: { total: taskCount },
      testScenarios: { total: scenarioCount },
      testCases: { total: totalCases, passed: passedCases, passRate: totalCases > 0 ? Math.round((passedCases / totalCases) * 100) : 0 },
      useCases: { total: ucCount },
      userStories: { total: usCount },
    };
  }
}
