import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsecaseService {
  constructor(private prisma: PrismaService) {}

  async listUseCases(projectId: string) {
    return this.prisma.useCase.findMany({
      where: { projectId },
      include: { requirement: { select: { id: true, code: true, title: true } } },
      orderBy: { code: 'asc' },
    });
  }
  async createUseCase(projectId: string, data: any) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await this.prisma.useCase.findFirst({ where: { projectId }, orderBy: { code: 'desc' }, select: { code: true } });
      const num = last ? (parseInt(last.code.replace('UC-', ''), 10) || 0) : 0;
      const code = `UC-${String(num + 1).padStart(3, '0')}`;
      try { return await this.prisma.useCase.create({ data: { projectId, code, ...data } }); }
      catch (e: any) { if (e?.code === 'P2002' && attempt < 4) continue; throw e; }
    }
  }
  async updateUseCase(id: string, data: any) {
    return this.prisma.useCase.update({ where: { id }, data });
  }
  async deleteUseCase(id: string) {
    return this.prisma.useCase.delete({ where: { id } });
  }

  async listUserStories(projectId: string) {
    return this.prisma.userStory.findMany({
      where: { projectId },
      include: { requirement: { select: { id: true, code: true, title: true } } },
      orderBy: { code: 'asc' },
    });
  }
  async createUserStory(projectId: string, data: any) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const last = await this.prisma.userStory.findFirst({ where: { projectId }, orderBy: { code: 'desc' }, select: { code: true } });
      const num = last ? (parseInt(last.code.replace('US-', ''), 10) || 0) : 0;
      const code = `US-${String(num + 1).padStart(3, '0')}`;
      try { return await this.prisma.userStory.create({ data: { projectId, code, ...data } }); }
      catch (e: any) { if (e?.code === 'P2002' && attempt < 4) continue; throw e; }
    }
  }
  async updateUserStory(id: string, data: any) {
    return this.prisma.userStory.update({ where: { id }, data });
  }
  async deleteUserStory(id: string) {
    return this.prisma.userStory.delete({ where: { id } });
  }

  async importUseCasesFromExcel(projectId: string, buffer: Buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    let created = 0; let updated = 0; let skipped = 0; const errors: string[] = [];
    for (const [i, row] of rows.entries()) {
      const title = row['제목'] || row['title'];
      if (!title) { errors.push(`Row ${i + 2}: 제목 누락`); skipped++; continue; }
      const data = {
        title,
        actor: row['Actor'] || row['actor'] || undefined,
        description: row['설명'] || row['description'] || undefined,
        precondition: row['사전조건'] || undefined,
        postcondition: row['사후조건'] || undefined,
        priority: row['우선순위'] === '높음' ? 'high' : row['우선순위'] === '낮음' ? 'low' : 'medium',
      };
      const rowCode = row['코드'] || row['code'];
      if (rowCode) {
        const existing = await this.prisma.useCase.findFirst({ where: { projectId, code: String(rowCode) } });
        if (existing) { await this.prisma.useCase.update({ where: { id: existing.id }, data }); updated++; continue; }
      }
      const count = await this.prisma.useCase.count({ where: { projectId } });
      const code = `UC-${String(count + 1).padStart(3, '0')}`;
      await this.prisma.useCase.create({ data: { projectId, code, status: 'draft', ...data } });
      created++;
    }
    return { created, updated, skipped, errors };
  }

  getUseCaseExcelTemplate(): Buffer {
    const ws = XLSX.utils.aoa_to_sheet([
      ['제목', 'Actor', '설명', '사전조건', '사후조건', '우선순위'],
      ['로그인 Use Case', '부모', '사용자가 이메일로 로그인한다', '미로그인 상태', '로그인 완료', '높음'],
    ]);
    ws['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 30 }, { wch: 20 }, { wch: 20 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Use Case');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  async importUserStoriesFromExcel(projectId: string, buffer: Buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    let created = 0; let updated = 0; let skipped = 0; const errors: string[] = [];
    for (const [i, row] of rows.entries()) {
      const title = row['제목'] || row['title'];
      if (!title) { errors.push(`Row ${i + 2}: 제목 누락`); skipped++; continue; }
      const data = {
        title,
        asA: row['역할(As a)'] || row['asA'] || undefined,
        iWantTo: row['원하는것(I want to)'] || row['iWantTo'] || undefined,
        soThat: row['목적(So that)'] || row['soThat'] || undefined,
        priority: row['우선순위'] === '높음' ? 'high' : row['우선순위'] === '낮음' ? 'low' : 'medium',
        storyPoints: row['스토리포인트'] ? Number(row['스토리포인트']) : undefined,
      };
      const rowCode = row['코드'] || row['code'];
      if (rowCode) {
        const existing = await this.prisma.userStory.findFirst({ where: { projectId, code: String(rowCode) } });
        if (existing) { await this.prisma.userStory.update({ where: { id: existing.id }, data }); updated++; continue; }
      }
      const count = await this.prisma.userStory.count({ where: { projectId } });
      const code = `US-${String(count + 1).padStart(3, '0')}`;
      await this.prisma.userStory.create({ data: { projectId, code, status: 'draft', ...data } });
      created++;
    }
    return { created, updated, skipped, errors };
  }

  getUserStoryExcelTemplate(): Buffer {
    const ws = XLSX.utils.aoa_to_sheet([
      ['제목', '역할(As a)', '원하는것(I want to)', '목적(So that)', '우선순위', '스토리포인트'],
      ['체크리스트 입력', '부모', '매일 체크리스트를 입력하고 싶다', '아이 성장을 추적하기 위해', '높음', '3'],
    ]);
    ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 10 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'User Story');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }
}
