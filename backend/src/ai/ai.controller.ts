import { Controller, Post, Get, Body, Param, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import * as XLSX from 'xlsx';
import { AIService } from './ai.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/ai')
export class AIController {
  constructor(private aiService: AIService, private prisma: PrismaService) {}

  @Get('status')
  @ApiOperation({ summary: 'LLM 설정 여부 확인' })
  async status() {
    return { configured: await this.aiService.isConfigured() };
  }

  @Post('parse-spec')
  @ApiOperation({ summary: '요구사항 기술서 AI 정제 (최초 Import)' })
  async parseSpec(@Body() body: { rows: any[] }) {
    return this.aiService.parseSpec(body.rows);
  }

  @Post('parse-markdown')
  @ApiOperation({ summary: '마크다운 → 요구사항 AI 추출' })
  async parseMarkdown(@Body() body: { content: string }) {
    return this.aiService.parseMarkdown(body.content);
  }

  @Post('generate-features')
  @ApiOperation({ summary: '요구사항 → 기능 리스트 AI 자동생성' })
  async generateFeatures(@Body() body: { requirementId: string }, @Param('projectId') pid: string) {
    const req = await this.prisma.requirement.findFirst({ where: { id: body.requirementId, projectId: pid } });
    if (!req) return { error: '요구사항을 찾을 수 없습니다.' };
    return this.aiService.generateFeatures({ title: req.title, description: req.description ?? undefined, category: req.category ?? undefined });
  }

  @Post('generate-tasks')
  @ApiOperation({ summary: '기능 → Task AI 자동분해' })
  async generateTasks(@Body() body: { featureId: string }, @Param('projectId') pid: string) {
    const feat = await this.prisma.feature.findFirst({ where: { id: body.featureId, projectId: pid } });
    if (!feat) return { error: '기능을 찾을 수 없습니다.' };
    return this.aiService.generateTasks({ title: feat.title, description: feat.description ?? undefined });
  }

  @Post('generate-test-scenarios')
  @ApiOperation({ summary: '요구사항+기능 → 테스트 시나리오 AI 자동생성' })
  async generateTestScenarios(@Body() body: { requirementId?: string; featureId?: string }, @Param('projectId') pid: string) {
    const [req, feat] = await Promise.all([
      body.requirementId ? this.prisma.requirement.findFirst({ where: { id: body.requirementId, projectId: pid } }) : null,
      body.featureId ? this.prisma.feature.findFirst({ where: { id: body.featureId, projectId: pid } }) : null,
    ]);
    return this.aiService.generateTestScenarios({
      requirement: req ? { title: req.title, description: req.description ?? undefined } : undefined,
      feature: feat ? { title: feat.title, description: feat.description ?? undefined } : undefined,
    });
  }

  @Post('suggest')
  @ApiOperation({ summary: '수동 작성 시 AI 보조 제안' })
  suggest(@Body() body: { context: string; type: string }) {
    return this.aiService.suggest(body.context, body.type);
  }

  @Get('spec-template')
  @ApiOperation({ summary: '요구사항 기술서 엑셀 템플릿 다운로드' })
  getSpecTemplate(@Res() res: Response) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['요구사항구분', '요청사항', '상세내용'],
      ['기능', '로그인 기능', 'SSO 기반 로그인을 지원해야 함'],
      ['성능', '응답 속도', '3초 이내 응답 보장'],
    ]);
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws, '요구사항기술서');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="spec-template.xlsx"' });
    res.send(buf);
  }

  @Post('parse-spec-upload')
  @ApiOperation({ summary: '요구사항 기술서 엑셀 업로드 → AI 정제 (미리보기)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  async parseSpecUpload(@UploadedFile() file: Express.Multer.File) {
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
    return this.aiService.parseSpec(raw);
  }

  @Post('diff-spec-upload')
  @ApiOperation({ summary: '요구사항 기술서 재업로드 → diff 분석 (기존 대비 신규/변경/삭제)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  async diffSpecUpload(@Param('projectId') pid: string, @UploadedFile() file: Express.Multer.File) {
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
    const newItems = await this.aiService.parseSpec(raw);
    const existing = await this.prisma.requirement.findMany({
      where: { projectId: pid },
      select: { id: true, title: true, description: true, category: true, status: true },
    });
    return this.aiService.diffSpec(existing, newItems);
  }
}
