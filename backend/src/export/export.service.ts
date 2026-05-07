import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async requirementsExcel(projectId: string): Promise<Buffer> {
    const rows = await this.prisma.requirement.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
    const data = [
      ['ID', '분류', '요구사항명', '상세설명', '우선순위', '상태', '입력경로', '등록일'],
      ...rows.map(r => [
        r.code, r.category ?? '', r.title, r.description ?? '',
        r.priority, r.status, r.source,
        new Date(r.createdAt).toLocaleDateString('ko-KR'),
      ]),
    ];
    return this.buildExcel(data, '요구사항정의서', [8, 12, 30, 40, 8, 8, 10, 12]);
  }

  async wbsExcel(projectId: string): Promise<Buffer> {
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      include: {
        feature: { select: { code: true, title: true, requirement: { select: { code: true, title: true } } } },
        issues: { select: { type: true, title: true, severity: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const data = [
      ['Task ID', '상위 기능', '상위 요구사항', 'Task명', '상세설명', '담당자', '진척율(%)', '시작일', '종료일', '상태', '이슈수'],
      ...tasks.map(t => [
        t.code,
        `${t.feature.code} - ${t.feature.title}`,
        t.feature.requirement ? `${t.feature.requirement.code} - ${t.feature.requirement.title}` : '',
        t.title, t.description ?? '',
        t.assigneeId ?? '',
        t.progress,
        t.startDate ? new Date(t.startDate).toLocaleDateString('ko-KR') : '',
        t.endDate ? new Date(t.endDate).toLocaleDateString('ko-KR') : '',
        t.status,
        t.issues.length,
      ]),
    ];
    return this.buildExcel(data, 'WBS', [8, 20, 20, 25, 30, 12, 8, 10, 10, 8, 6]);
  }

  async rtmExcel(projectId: string): Promise<Buffer> {
    const requirements = await this.prisma.requirement.findMany({
      where: { projectId },
      include: {
        features: {
          include: {
            tasks: { select: { code: true, title: true, status: true } },
            testScenarios: { select: { code: true, title: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const rows: any[][] = [
      ['요구사항 ID', '요구사항명', '우선순위', '상태', '기능 ID', '기능명', 'Task ID', 'Task명', '테스트 시나리오 ID', '시나리오명'],
    ];
    for (const req of requirements) {
      if (req.features.length === 0) {
        rows.push([req.code, req.title, req.priority, req.status, '', '', '', '', '', '']);
        continue;
      }
      for (const feat of req.features) {
        const maxLen = Math.max(feat.tasks.length, feat.testScenarios.length, 1);
        for (let i = 0; i < maxLen; i++) {
          rows.push([
            i === 0 ? req.code : '', i === 0 ? req.title : '', i === 0 ? req.priority : '', i === 0 ? req.status : '',
            i === 0 ? feat.code : '', i === 0 ? feat.title : '',
            feat.tasks[i]?.code ?? '', feat.tasks[i]?.title ?? '',
            feat.testScenarios[i]?.code ?? '', feat.testScenarios[i]?.title ?? '',
          ]);
        }
      }
    }
    return this.buildExcel(rows, 'RTM', [8, 25, 8, 8, 8, 20, 8, 20, 10, 25]);
  }

  async testPlanExcel(projectId: string): Promise<Buffer> {
    const scenarios = await this.prisma.testScenario.findMany({
      where: { projectId },
      include: {
        testCases: { orderBy: { createdAt: 'asc' } },
        feature: { select: { code: true, title: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const wb = XLSX.utils.book_new();

    const scenData = [
      ['시나리오 ID', '시나리오명', '유형', '연결기능', '테스트데이터', '상태', '케이스수'],
      ...scenarios.map(s => [
        s.code, s.title, s.type,
        s.feature ? `${s.feature.code} - ${s.feature.title}` : '',
        s.testData ?? '', s.status, s.testCases.length,
      ]),
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(scenData);
    ws1['!cols'] = [8, 30, 8, 20, 20, 8, 6].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, '테스트시나리오');

    const caseData = [
      ['시나리오 ID', '케이스명', '유형', '입력데이터', '기대결과', '실제결과', '수행결과', '수행일'],
      ...scenarios.flatMap(s => s.testCases.map(c => [
        s.code, c.title, c.type, c.testData ?? '',
        c.expected ?? '', c.actual ?? '', c.result ?? '',
        c.executedAt ? new Date(c.executedAt).toLocaleDateString('ko-KR') : '',
      ])),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(caseData);
    ws2['!cols'] = [8, 30, 8, 20, 25, 25, 8, 10].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, '테스트케이스');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  private buildExcel(data: any[][], sheetName: string, colWidths: number[]): Buffer {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = colWidths.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async requirementsJson(projectId: string) {
    return this.prisma.requirement.findMany({
      where: { projectId },
      select: { code: true, category: true, title: true, description: true, priority: true, status: true, source: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async wbsJson(projectId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      include: { feature: { select: { code: true, title: true } }, issues: { select: { id: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return tasks.map(t => ({
      code: t.code, featureCode: t.feature.code, featureTitle: t.feature.title,
      title: t.title, progress: t.progress, status: t.status, issueCount: t.issues.length,
      startDate: t.startDate, endDate: t.endDate,
    }));
  }

  async rtmJson(projectId: string) {
    const requirements = await this.prisma.requirement.findMany({
      where: { projectId },
      include: { features: { include: { tasks: { select: { code: true } }, testScenarios: { select: { code: true } } } } },
      orderBy: { createdAt: 'asc' },
    });
    const rows: any[] = [];
    for (const req of requirements) {
      if (req.features.length === 0) {
        rows.push({ reqCode: req.code, reqTitle: req.title });
        continue;
      }
      for (const feat of req.features) {
        const maxLen = Math.max(feat.tasks.length, feat.testScenarios.length, 1);
        for (let i = 0; i < maxLen; i++) {
          rows.push({
            reqCode: i === 0 ? req.code : '', reqTitle: i === 0 ? req.title : '',
            featCode: i === 0 ? feat.code : '', featTitle: i === 0 ? feat.title : '',
            taskCode: feat.tasks[i]?.code ?? '', scenarioCode: feat.testScenarios[i]?.code ?? '',
          });
        }
      }
    }
    return rows;
  }

  async testPlanJson(projectId: string) {
    const scenarios = await this.prisma.testScenario.findMany({
      where: { projectId },
      include: { testCases: { select: { id: true, result: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return {
      scenarios: scenarios.map(s => ({
        code: s.code, title: s.title, type: s.type, status: s.status,
        caseCount: s.testCases.length,
        passed: s.testCases.filter(c => c.result === 'pass').length,
        failed: s.testCases.filter(c => c.result === 'fail').length,
      })),
    };
  }

  async dbDesignExcel(projectId: string): Promise<Buffer> {
    const tables = await this.prisma.dbTable.findMany({
      where: { projectId },
      include: { feature: { select: { code: true, title: true } } },
      orderBy: { name: 'asc' },
    });

    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['테이블명', '설명', '연결 기능', '컬럼 수', '인덱스 수'],
      ...tables.map(t => [
        t.name,
        t.description ?? '',
        t.feature ? `${t.feature.code} - ${t.feature.title}` : '',
        Array.isArray(t.columns) ? (t.columns as any[]).length : 0,
        Array.isArray(t.indexes) ? (t.indexes as any[]).length : 0,
      ]),
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [20, 30, 25, 8, 8].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, summaryWs, '테이블 목록');

    for (const table of tables) {
      const cols = Array.isArray(table.columns) ? (table.columns as any[]) : [];
      const colData = [
        ['컬럼명', '타입', 'Nullable', 'PK', 'FK (참조)', '설명'],
        ...cols.map((c: any) => [
          c.name ?? '', c.type ?? '', c.nullable ? 'Y' : 'N',
          c.primaryKey ? 'Y' : '', c.foreignKey ?? '', c.description ?? '',
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(colData);
      ws['!cols'] = [20, 15, 8, 5, 25, 30].map(w => ({ wch: w }));
      const sheetName = table.name.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async apiDesignExcel(projectId: string): Promise<Buffer> {
    const specs = await this.prisma.apiSpec.findMany({
      where: { projectId },
      include: { feature: { select: { code: true, title: true } } },
      orderBy: [{ path: 'asc' }, { method: 'asc' }],
    });

    const data = [
      ['Method', 'Path', '요약', '설명', '연결 기능', 'Request Body', 'Response (200)', '상태코드'],
      ...specs.map(a => [
        a.method, a.path, a.summary, a.description ?? '',
        a.feature ? `${a.feature.code} - ${a.feature.title}` : '',
        a.requestBody ? JSON.stringify(a.requestBody, null, 2) : '',
        a.responseBody ? JSON.stringify(a.responseBody, null, 2) : '',
        Array.isArray(a.statusCodes)
          ? (a.statusCodes as any[]).map(s => `${s.code} ${s.description}`).join(', ')
          : '',
      ]),
    ];
    return this.buildExcel(data, 'API 명세', [8, 35, 25, 30, 20, 40, 40, 25]);
  }
}
