import { Injectable, NotFoundException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';

@Injectable()
export class RequirementService {
  constructor(private prisma: PrismaService) {}

  private async nextCode(projectId: string): Promise<string> {
    const last = await this.prisma.requirement.findFirst({
      where: { projectId },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    if (!last) return 'REQ-001';
    const num = parseInt(last.code.replace('REQ-', ''), 10) || 0;
    return `REQ-${String(num + 1).padStart(3, '0')}`;
  }

  async create(projectId: string, dto: CreateRequirementDto, source = 'manual') {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await this.nextCode(projectId);
      try {
        return await this.prisma.requirement.create({ data: { projectId, code, source, ...dto } });
      } catch (e: any) {
        if (e?.code === 'P2002' && attempt < 4) continue;
        throw e;
      }
    }
    throw new Error('코드 생성 실패');
  }

  async findAll(projectId: string, query: { status?: string; priority?: string; category?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 50);
    const skip = (page - 1) * limit;
    const where: any = { projectId };
    if (query.status) where.status = query.status;
    if (query.priority) where.priority = query.priority;
    if (query.category) where.category = query.category;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.requirement.findMany({
        where,
        include: { features: { select: { id: true, code: true, title: true, status: true } } },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.requirement.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(projectId: string, reqId: string) {
    const req = await this.prisma.requirement.findFirst({
      where: { id: reqId, projectId },
      include: { features: { select: { id: true, code: true, title: true, status: true } } },
    });
    if (!req) throw new NotFoundException('Requirement not found');
    return req;
  }

  async update(projectId: string, reqId: string, dto: UpdateRequirementDto) {
    await this.findOne(projectId, reqId);
    return this.prisma.requirement.update({ where: { id: reqId }, data: dto });
  }

  async remove(projectId: string, reqId: string) {
    await this.findOne(projectId, reqId);
    return this.prisma.requirement.delete({ where: { id: reqId } });
  }

  async importFromExcel(projectId: string, buffer: Buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const priorityMap: Record<string, string> = { '높음': 'high', '중간': 'medium', '낮음': 'low' };
    const statusMap: Record<string, string> = { '신규': 'new', '검토중': 'review', '확정': 'confirmed', '변경': 'changed', '삭제': 'deleted' };
    let created = 0; let updated = 0; let skipped = 0; const errors: string[] = [];

    for (const [i, row] of rows.entries()) {
      const title = row['요구사항명'] || row['title'];
      if (!title) { errors.push(`Row ${i + 2}: 요구사항명 누락`); skipped++; continue; }
      const priority = row['우선순위'] || row['priority'] || 'medium';
      const status = row['상태'] || row['status'] || 'new';
      const data = {
        title,
        category: row['분류'] || row['category'] || undefined,
        description: row['상세설명'] || row['description'] || undefined,
        priority: priorityMap[priority] || priority,
        status: statusMap[status] || status,
        note: row['비고'] || row['note'] || undefined,
      };

      const rowCode = row['요구사항 ID'] || row['code'];
      if (rowCode) {
        const existing = await this.prisma.requirement.findFirst({ where: { projectId, code: String(rowCode) } });
        if (existing) {
          await this.prisma.requirement.update({ where: { id: existing.id }, data });
          updated++;
          continue;
        }
      }

      const code = await this.nextCode(projectId);
      await this.prisma.requirement.create({ data: { projectId, code, source: 'excel', ...data } });
      created++;
    }
    return { created, updated, skipped, errors };
  }

  getExcelTemplate(): Buffer {
    const ws = XLSX.utils.aoa_to_sheet([
      ['요구사항 ID', '분류', '요구사항명', '상세설명', '우선순위', '상태', '비고'],
      ['', '인증', 'SSO 로그인', '사내 AD 연동 SSO 로그인 구현', '높음', '확정', ''],
    ]);
    ws['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 40 }, { wch: 10 }, { wch: 10 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '요구사항');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }
}
