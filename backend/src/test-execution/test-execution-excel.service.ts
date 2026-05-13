import { Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TestExecutionExcelService {
  constructor(private prisma: PrismaService) {}

  async exportTemplate(projectId: string, phaseId: string): Promise<Buffer> {
    const phase = await this.prisma.testPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) throw new NotFoundException('TestPhase not found');

    const snapshot = phase.snapshotData as any;
    if (!snapshot?.scenarios) throw new NotFoundException('스냅샷 데이터가 없습니다');

    const wb = XLSX.utils.book_new();
    const rows: any[][] = [];

    rows.push(['수행자:', '']);
    rows.push(['부서:', '']);
    rows.push(['수행일:', '']);
    rows.push([]);
    rows.push(['No', '시나리오ID', '시나리오명', '케이스명', '우선순위', '입력값', '기대결과', '결과', '비고']);

    let no = 1;
    for (const s of snapshot.scenarios) {
      for (const c of s.cases) {
        rows.push([
          no++,
          s.code,
          s.title,
          c.title,
          c.priority || 'medium',
          c.testData ?? '',
          c.expected ?? '',
          '',
          '',
        ]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [5, 12, 25, 30, 8, 20, 25, 10, 20].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, '테스트수행');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async importResults(projectId: string, phaseId: string, buffer: Buffer) {
    const phase = await this.prisma.testPhase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) throw new NotFoundException('TestPhase not found');

    const snapshot = phase.snapshotData as any;
    if (!snapshot?.scenarios) throw new NotFoundException('스냅샷 데이터가 없습니다');

    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

    const testerName = String(data[0]?.[1] ?? '').trim();
    const testerDept = String(data[1]?.[1] ?? '').trim();
    const executedAtRaw = String(data[2]?.[1] ?? '').trim();

    const normalizeResult = (val: string): string | null => {
      const v = val?.trim().toLowerCase();
      if (!v) return null;
      if (v === 'p' || v === 'pass') return 'pass';
      if (v === 'f' || v === 'fail') return 'fail';
      if (v === 'b' || v === 'blocked') return 'blocked';
      if (v === 'n' || v === 'n/a' || v === 'na') return 'na';
      return null;
    };

    const matched: any[] = [];
    const unmatched: string[] = [];
    const invalidValues: string[] = [];

    for (let i = 4; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || !row[1]) continue;

      const scenarioCode = String(row[1]).trim();
      const caseTitle = String(row[3]).trim();
      const rawResult = String(row[7] ?? '').trim();
      const actual = String(row[8] ?? '').trim();

      const normalizedResult = normalizeResult(rawResult);
      if (rawResult && !normalizedResult) {
        invalidValues.push(`Row ${i + 1}: "${rawResult}"`);
      }

      const scenarioMatch = snapshot.scenarios.find((s: any) => s.code === scenarioCode);
      if (!scenarioMatch) {
        unmatched.push(`Row ${i + 1}: ${scenarioCode} - ${caseTitle}`);
        continue;
      }

      const caseMatch = scenarioMatch.cases.find((c: any) => c.title === caseTitle);
      if (!caseMatch) {
        unmatched.push(`Row ${i + 1}: ${scenarioCode} - ${caseTitle}`);
        continue;
      }

      matched.push({
        scenarioCode,
        caseTitle,
        caseIndex: caseMatch.index,
        result: normalizedResult,
        actual: actual || null,
      });
    }

    const existingRounds = await this.prisma.testRound.findMany({
      where: { phaseId },
    });
    const roundNumber = existingRounds.length + 1;
    const totalCases = snapshot.scenarios.reduce((sum: number, s: any) => sum + s.cases.length, 0);

    const round = await this.prisma.testRound.create({
      data: {
        phaseId,
        roundNumber,
        testerName: testerName || '(엑셀 업로드)',
        testerDept: testerDept || undefined,
        executedAt: executedAtRaw ? new Date(executedAtRaw) : new Date(),
        scope: 'full',
        totalCases,
        importedAt: new Date(),
      },
    });

    if (matched.length > 0) {
      await this.prisma.testRoundResult.createMany({
        data: matched.map(m => ({
          roundId: round.id,
          scenarioCode: m.scenarioCode,
          caseTitle: m.caseTitle,
          caseIndex: m.caseIndex,
          result: m.result,
          actual: m.actual,
        })),
      });

      const results = await this.prisma.testRoundResult.findMany({ where: { roundId: round.id } });
      await this.prisma.testRound.update({
        where: { id: round.id },
        data: {
          passCount: results.filter(r => r.result === 'pass').length,
          failCount: results.filter(r => r.result === 'fail').length,
          blockedCount: results.filter(r => r.result === 'blocked').length,
          naCount: results.filter(r => r.result === 'na').length,
        },
      });
    }

    return {
      roundId: round.id,
      matched: matched.length,
      unmatched,
      invalidValues,
      testerName: testerName || '(엑셀 업로드)',
    };
  }

  async exportResult(projectId: string, phaseId: string): Promise<Buffer> {
    const phase = await this.prisma.testPhase.findFirst({
      where: { id: phaseId, projectId },
      include: {
        rounds: {
          orderBy: { roundNumber: 'asc' },
          include: { results: true },
        },
      },
    });
    if (!phase) throw new NotFoundException('TestPhase not found');

    const snapshot = phase.snapshotData as any;
    const wb = XLSX.utils.book_new();

    // 시트1: 요약
    const summaryRows: any[][] = [
      ['회차', '수행자', '부서', '전체', 'Pass', 'Fail', 'Blocked', 'N/A', 'Pass율(%)'],
    ];
    for (const r of phase.rounds) {
      const passRate = r.totalCases > 0 ? Math.round((r.passCount / r.totalCases) * 100) : 0;
      summaryRows.push([
        `${r.roundNumber}회차`,
        r.testerName,
        r.testerDept ?? '',
        r.totalCases,
        r.passCount,
        r.failCount,
        r.blockedCount,
        r.naCount,
        passRate,
      ]);
    }
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    summaryWs['!cols'] = [10, 12, 12, 8, 8, 8, 8, 8, 10].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, summaryWs, '요약');

    // 시트2~N: 각 round별
    for (const r of phase.rounds) {
      const sheetName = `${r.testerName}_${r.testerDept || ''}_ ${r.roundNumber}회차`.slice(0, 31);
      const rows: any[][] = [
        ['No', '시나리오ID', '시나리오명', '케이스명', '우선순위', '입력값', '기대결과', '결과', '비고'],
      ];

      let no = 1;
      if (snapshot?.scenarios) {
        for (const s of snapshot.scenarios) {
          for (const c of s.cases) {
            const resultRecord = r.results.find(
              (res) => res.scenarioCode === s.code && res.caseTitle === c.title,
            );
            rows.push([
              no++,
              s.code,
              s.title,
              c.title,
              c.priority || 'medium',
              c.testData ?? '',
              c.expected ?? '',
              resultRecord?.result ?? '',
              resultRecord?.actual ?? '',
            ]);
          }
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [5, 12, 25, 30, 8, 20, 25, 10, 20].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }
}
