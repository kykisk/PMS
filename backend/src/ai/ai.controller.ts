import { Controller, Post, Get, Put, Body, Param, UseGuards, UseInterceptors, UploadedFile, Res, Req, UsePipes, ValidationPipe } from '@nestjs/common';
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
@UsePipes(new ValidationPipe({ whitelist: false }))
@Controller('projects/:projectId/ai')
export class AIController {
  constructor(private aiService: AIService, private prisma: PrismaService) {}

  private async mid(pid: string, featureKey: string, bodyModelId?: string): Promise<string | undefined> {
    if (bodyModelId) return bodyModelId;
    return this.aiService.resolveModelId(pid, featureKey);
  }

  @Get('status')
  @ApiOperation({ summary: 'LLM 설정 여부 + 사용 가능 모델 목록' })
  async status(@Req() req: any) {
    const userId = req.user?.id;
    const models = await this.aiService.getAvailableModels(userId);
    return { configured: models.length > 0, models };
  }

  @Get('model-mappings')
  @ApiOperation({ summary: '프로젝트 기능별 AI 모델 매핑 조회' })
  async getModelMappings(@Param('projectId') pid: string) {
    return this.aiService.getAiModelMappings(pid);
  }

  @Put('model-mappings')
  @ApiOperation({ summary: '프로젝트 기능별 AI 모델 매핑 저장' })
  async saveModelMappings(
    @Param('projectId') pid: string,
    @Body() body: { mappings: { featureKey: string; llmConfigId?: string; userLlmConfigId?: string }[] },
  ) {
    return this.aiService.saveAiModelMappings(pid, body.mappings);
  }

  @Post('parse-spec')
  @ApiOperation({ summary: '요구사항 기술서 AI 정제 (최초 Import)' })
  async parseSpec(@Body() body: { rows: any[]; modelId?: string }, @Param('projectId') pid: string, @Req() req: any) {
    return this.aiService.parseSpec(body.rows, req.user?.id, await this.mid(pid, 'parse-spec', body.modelId));
  }

  @Post('parse-markdown')
  @ApiOperation({ summary: '마크다운 SPEC 분석 (최초 or diff 기반 업데이트)' })
  async parseMarkdown(
    @Body() body: { content: string; modelId?: string },
    @Param('projectId') pid: string,
    @Req() req: any,
  ) {
    const [existingSpec, existingReqs, existingUCs, existingUSs] = await Promise.all([
      (this.prisma as any).specDocument.findFirst({ where: { projectId: pid }, orderBy: { version: 'desc' } }),
      this.prisma.requirement.findMany({ where: { projectId: pid }, select: { id: true, code: true, title: true, description: true }, orderBy: { code: 'asc' } }),
      this.prisma.useCase.findMany({ where: { projectId: pid }, select: { id: true, code: true, title: true, description: true }, orderBy: { code: 'asc' } }),
      this.prisma.userStory.findMany({ where: { projectId: pid }, select: { id: true, code: true, title: true, iWantTo: true }, orderBy: { code: 'asc' } }),
    ]);

    const existingData = { requirements: existingReqs, useCases: existingUCs, userStories: existingUSs };

    let analysisContent = body.content;
    let diffMeta: { mode: 'first' | 'update'; changedSections: string[]; unchangedSections: string[]; deletedSections: string[] } = {
      mode: 'first', changedSections: [], unchangedSections: [], deletedSections: [],
    };

    if (existingSpec) {
      const diff = this.computeSpecDiff(existingSpec.content, body.content);
      diffMeta = { mode: 'update', ...diff };
      if (diff.changedSections.length === 0) {
        await (this.prisma as any).specDocument.create({ data: { projectId: pid, content: body.content, version: existingSpec.version + 1 } });
        return { requirements: [], useCases: [], userStories: [], _diffMeta: diffMeta };
      }
      analysisContent = diff.changedSections.join('\n\n');
    }

    const result = await this.aiService.parseMarkdown(analysisContent, req.user?.id, await this.mid(pid, 'parse-spec', body.modelId), existingData, (body as any).additionalInfo);

    const version = existingSpec ? existingSpec.version + 1 : 1;
    await (this.prisma as any).specDocument.create({ data: { projectId: pid, content: body.content, version } });

    return { ...result, _diffMeta: diffMeta };
  }

  @Post('generate-features')
  @ApiOperation({ summary: '요구사항 → 기능 리스트 AI 자동생성 (단일/다중, 기존 기능 대비 분석)' })
  async generateFeatures(@Body() body: { requirementId?: string; requirementIds?: string[]; modelId?: string }, @Param('projectId') pid: string, @Req() req: any) {
    const ids = body.requirementIds ?? (body.requirementId ? [body.requirementId] : []);
    if (ids.length === 0) return { error: '요구사항을 선택하세요.' };

    const requirements = await this.prisma.requirement.findMany({
      where: { id: { in: ids }, projectId: pid },
      select: { id: true, code: true, title: true, description: true, category: true },
    });
    if (requirements.length === 0) return { error: '요구사항을 찾을 수 없습니다.' };

    const existingFeatures = await this.prisma.feature.findMany({
      where: { projectId: pid },
      select: { id: true, code: true, title: true, description: true, reqId: true },
    });

    return this.aiService.generateFeaturesWithContext(requirements, existingFeatures, req.user?.id, await this.mid(pid, 'generate-features', body.modelId), (body as any).additionalInfo);
  }

  @Post('generate-tasks')
  @ApiOperation({ summary: '기능 → Task AI 자동분해' })
  async generateTasks(@Body() body: { featureId: string; modelId?: string }, @Param('projectId') pid: string, @Req() req: any) {
    const feat = await this.prisma.feature.findFirst({ where: { id: body.featureId, projectId: pid } });
    if (!feat) return { error: '기능을 찾을 수 없습니다.' };
    return this.aiService.generateTasks({ title: feat.title, description: feat.description ?? undefined }, req.user?.id, await this.mid(pid, 'generate-tasks', body.modelId), (body as any).additionalInfo);
  }

  @Post('generate-tasks-multi')
  @ApiOperation({ summary: '확정 기능 → Task 다중 AI 자동생성' })
  async generateTasksMulti(@Body() body: { featureIds: string[]; modelId?: string }, @Param('projectId') pid: string, @Req() req: any) {
    if (!body.featureIds?.length) return { error: '기능을 선택하세요.' };
    const features = await this.prisma.feature.findMany({
      where: { id: { in: body.featureIds }, projectId: pid },
      select: { id: true, code: true, title: true, description: true },
    });
    if (!features.length) return { error: '기능을 찾을 수 없습니다.' };
    const results = await Promise.all(features.map(async feat => {
      const items = await this.aiService.generateTasks({ title: feat.title, description: feat.description ?? undefined }, req.user?.id, await this.mid(pid, 'generate-tasks', body.modelId), (body as any).additionalInfo).catch(() => []);
      return (items as any[]).map(item => ({ ...item, _featureCode: feat.code, _featureTitle: feat.title, _featureId: feat.id }));
    }));
    return results.flat();
  }

  @Post('generate-test-scenarios-multi-for-requirements')
  @ApiOperation({ summary: '확정 요구사항 → 테스트 시나리오 다중 AI 자동생성' })
  async generateTestScenariosMultiForRequirements(
    @Body() body: { requirementIds: string[]; modelId?: string; additionalInfo?: string; detailLevel?: number },
    @Param('projectId') pid: string,
    @Req() req: any,
  ) {
    if (!body.requirementIds?.length) return { error: '요구사항을 선택하세요.' };
    const reqs = await this.prisma.requirement.findMany({
      where: { id: { in: body.requirementIds }, projectId: pid },
      select: { id: true, code: true, title: true, description: true },
    });
    if (!reqs.length) return { error: '요구사항을 찾을 수 없습니다.' };
    const results = await Promise.all(reqs.map(async r => {
      const features = await this.prisma.feature.findMany({
        where: { projectId: pid, reqId: r.id },
        select: { code: true, title: true, description: true },
      });
      const tasks = await this.prisma.task.findMany({
        where: { projectId: pid, feature: { reqId: r.id } },
        select: { code: true, title: true, description: true },
      });
      const items = await this.aiService.generateTestScenarios(
        {
          requirement: { title: r.title, description: r.description ?? undefined },
          features: features.map(f => ({ code: f.code, title: f.title, description: f.description ?? undefined })),
          tasks: tasks.map(t => ({ code: t.code, title: t.title, description: t.description ?? undefined })),
        },
        req.user?.id, await this.mid(pid, 'generate-test-scenarios', body.modelId), (body as any).additionalInfo, body.detailLevel,
      ).catch(() => []);
      return (items as any[]).map(item => ({
        ...item,
        _requirementCode: r.code,
        _requirementTitle: r.title,
        _requirementId: r.id,
      }));
    }));
    return results.flat();
  }

  @Post('generate-test-scenarios-by-level-for-requirements')
  @ApiOperation({ summary: '요구사항 기준 레벨별 테스트 시나리오 AI 생성' })
  async generateTestScenariosByLevelForRequirements(
    @Body() body: { requirementIds: string[]; levels: string[]; testType?: string; modelId?: string; additionalInfo?: string },
    @Param('projectId') pid: string,
    @Req() req: any,
  ) {
    if (!body.requirementIds?.length) return { error: '요구사항을 선택하세요.' };
    const reqs = await this.prisma.requirement.findMany({
      where: { id: { in: body.requirementIds }, projectId: pid },
      select: { id: true, code: true, title: true, description: true },
    });
    if (!reqs.length) return { error: '요구사항을 찾을 수 없습니다.' };
    const results = await Promise.all(reqs.map(async r => {
      const items = await this.aiService.generateTestScenariosByLevel(
        { title: r.title, description: r.description ?? undefined },
        body.levels ?? ['system'],
        body.testType ?? 'functional',
        req.user?.id, body.modelId, (body as any).additionalInfo,
      ).catch(() => []);
      return (items as any[]).map(item => ({
        ...item,
        _requirementCode: r.code,
        _requirementTitle: r.title,
        _requirementId: r.id,
      }));
    }));
    return results.flat();
  }

  @Post('generate-test-scenarios-multi')
  @ApiOperation({ summary: '확정 기능 → 테스트 시나리오 다중 AI 자동생성' })
  async generateTestScenariosMulti(@Body() body: { featureIds: string[]; modelId?: string }, @Param('projectId') pid: string, @Req() req: any) {
    if (!body.featureIds?.length) return { error: '기능을 선택하세요.' };
    const features = await this.prisma.feature.findMany({
      where: { id: { in: body.featureIds }, projectId: pid },
      select: { id: true, code: true, title: true, description: true },
    });
    if (!features.length) return { error: '기능을 찾을 수 없습니다.' };
    const results = await Promise.all(features.map(async feat => {
      const items = await this.aiService.generateTestScenarios({ feature: { title: feat.title, description: feat.description ?? undefined } }, req.user?.id, body.modelId, (body as any).additionalInfo).catch(() => []);
      return (items as any[]).map(item => ({ ...item, _featureCode: feat.code, _featureTitle: feat.title, _featureId: feat.id }));
    }));
    return results.flat();
  }

  @Post('generate-test-scenarios')
  @ApiOperation({ summary: '요구사항+기능 → 테스트 시나리오 AI 자동생성' })
  async generateTestScenarios(@Body() body: { requirementId?: string; featureId?: string; modelId?: string; detailLevel?: number }, @Param('projectId') pid: string, @Req() req: any) {
    const [requirement, feat] = await Promise.all([
      body.requirementId ? this.prisma.requirement.findFirst({ where: { id: body.requirementId, projectId: pid } }) : null,
      body.featureId ? this.prisma.feature.findFirst({ where: { id: body.featureId, projectId: pid } }) : null,
    ]);
    const reqId = body.requirementId || (feat as any)?.reqId;
    const features = reqId ? await this.prisma.feature.findMany({
      where: { projectId: pid, reqId },
      select: { code: true, title: true, description: true },
    }) : [];
    const tasks = reqId ? await this.prisma.task.findMany({
      where: { projectId: pid, feature: { reqId } },
      select: { code: true, title: true, description: true },
    }) : [];
    return this.aiService.generateTestScenarios({
      requirement: requirement ? { title: requirement.title, description: requirement.description ?? undefined } : undefined,
      feature: feat ? { title: feat.title, description: feat.description ?? undefined } : undefined,
      features: features.map(f => ({ code: f.code, title: f.title, description: f.description ?? undefined })),
      tasks: tasks.map(t => ({ code: t.code, title: t.title, description: t.description ?? undefined })),
    }, req.user?.id, body.modelId, (body as any).additionalInfo, body.detailLevel);
  }

  @Post('update-features-for-requirement')
  @ApiOperation({ summary: '요구사항 변경에 따른 기능 AI 업데이트' })
  async updateFeaturesForRequirement(
    @Body() body: { requirementId: string; modelId?: string },
    @Param('projectId') pid: string,
    @Req() req: any,
  ) {
    const requirement = await this.prisma.requirement.findFirst({ where: { id: body.requirementId, projectId: pid } });
    if (!requirement) return { error: '요구사항을 찾을 수 없습니다.' };

    const allLogs = await (this.prisma as any).auditLog.findMany({
      where: { projectId: pid, entityType: 'requirement', entityId: body.requirementId, action: 'update' },
      orderBy: { createdAt: 'asc' },
    });
    const previousLog = allLogs.length > 1 ? allLogs[allLogs.length - 2] : null;
    const previousData = previousLog?.changes as any;

    const existingFeatures = await this.prisma.feature.findMany({
      where: { projectId: pid, reqId: body.requirementId },
      select: { id: true, code: true, title: true, description: true },
    });

    return this.aiService.generateFeaturesUpdate(requirement, previousData, existingFeatures, req.user?.id, body.modelId, (body as any).additionalInfo);
  }

  @Post('update-scenarios-for-feature')
  @ApiOperation({ summary: '기능 변경에 따른 테스트 시나리오 AI 업데이트' })
  async updateScenariosForFeature(
    @Body() body: { featureId: string; modelId?: string },
    @Param('projectId') pid: string,
    @Req() req: any,
  ) {
    const feature = await this.prisma.feature.findFirst({ where: { id: body.featureId, projectId: pid } });
    if (!feature) return { error: '기능을 찾을 수 없습니다.' };
    const allLogs = await (this.prisma as any).auditLog.findMany({
      where: { projectId: pid, entityType: 'feature', entityId: body.featureId, action: 'update' },
      orderBy: { createdAt: 'asc' },
    });
    const previousLog = allLogs.length > 1 ? allLogs[allLogs.length - 2] : null;
    const previousData = previousLog?.changes as any;
    const existingScenarios = await this.prisma.testScenario.findMany({
      where: { projectId: pid, featureId: body.featureId },
      select: { id: true, code: true, title: true, description: true },
    });
    return this.aiService.generateScenariosUpdate(feature, previousData, existingScenarios, req.user?.id, body.modelId, (body as any).additionalInfo);
  }

  @Post('update-tasks-for-feature')
  @ApiOperation({ summary: '기능 변경에 따른 Task AI 업데이트' })
  async updateTasksForFeature(
    @Body() body: { featureId: string; modelId?: string },
    @Param('projectId') pid: string,
    @Req() req: any,
  ) {
    const feature = await this.prisma.feature.findFirst({ where: { id: body.featureId, projectId: pid } });
    if (!feature) return { error: '기능을 찾을 수 없습니다.' };
    const allLogs = await (this.prisma as any).auditLog.findMany({
      where: { projectId: pid, entityType: 'feature', entityId: body.featureId, action: 'update' },
      orderBy: { createdAt: 'asc' },
    });
    const previousLog = allLogs.length > 1 ? allLogs[allLogs.length - 2] : null;
    const previousData = previousLog?.changes as any;
    const existingTasks = await this.prisma.task.findMany({
      where: { projectId: pid, featureId: body.featureId },
      select: { id: true, code: true, title: true, description: true },
    });
    return this.aiService.generateTasksUpdate(feature, previousData, existingTasks, req.user?.id, body.modelId, (body as any).additionalInfo);
  }

  @Post('suggest')
  @ApiOperation({ summary: '수동 작성 시 AI 보조 제안' })
  suggest(@Body() body: { context: string; type: string; modelId?: string }, @Req() req: any) {
    return this.aiService.suggest(body.context, body.type, req.user?.id, body.modelId);
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

  private computeSpecDiff(oldContent: string, newContent: string): {
    changedSections: string[];
    unchangedSections: string[];
    deletedSections: string[];
  } {
    const splitSections = (content: string): Map<string, string> => {
      const map = new Map<string, string>();
      const parts = content.split(/(?=^## )/m);
      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split('\n');
        const heading = lines[0].trim();
        map.set(heading, part.trim());
      }
      if (map.size === 0) map.set('__full__', content);
      return map;
    };

    const oldSections = splitSections(oldContent);
    const newSections = splitSections(newContent);

    const changedSections: string[] = [];
    const unchangedSections: string[] = [];
    const deletedSections: string[] = [];

    for (const [heading, newBody] of newSections) {
      const oldBody = oldSections.get(heading);
      if (!oldBody) {
        changedSections.push(newBody);
      } else if (oldBody.trim() !== newBody.trim()) {
        changedSections.push(newBody);
      } else {
        unchangedSections.push(heading);
      }
    }

    for (const heading of oldSections.keys()) {
      if (!newSections.has(heading)) {
        deletedSections.push(heading);
      }
    }

    return { changedSections, unchangedSections, deletedSections };
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

  @Post('generate-test-scenarios-by-level')
  @ApiOperation({ summary: '레벨별 테스트 시나리오 AI 생성' })
  async generateTestScenariosByLevel(
    @Body() body: { featureIds: string[]; levels: string[]; testType?: string; modelId?: string; additionalInfo?: string },
    @Param('projectId') pid: string,
    @Req() req: any,
  ) {
    if (!body.featureIds?.length) return { error: '기능을 선택하세요.' };
    const features = await this.prisma.feature.findMany({
      where: { id: { in: body.featureIds }, projectId: pid },
      select: { id: true, code: true, title: true, description: true },
    });
    if (!features.length) return { error: '기능을 찾을 수 없습니다.' };
    const results = await Promise.all(features.map(async feat => {
      const items = await this.aiService.generateTestScenariosByLevel(
        { title: feat.title, description: feat.description ?? undefined },
        body.levels ?? ['integration'],
        body.testType ?? 'functional',
        req.user?.id,
        body.modelId,
        body.additionalInfo,
      ).catch(() => []);
      return (items as any[]).map(item => ({ ...item, _featureCode: feat.code, _featureTitle: feat.title, _featureId: feat.id }));
    }));
    return results.flat();
  }

  @Post('generate-test-cases')
  @ApiOperation({ summary: '테스트 시나리오 → 케이스 AI 자동 생성' })
  async generateTestCases(
    @Body() body: { scenarioId: string; modelId?: string; additionalInfo?: string; detailLevel?: number },
    @Param('projectId') pid: string,
    @Req() req: any,
  ) {
    const scenario = await this.prisma.testScenario.findFirst({ where: { id: body.scenarioId, projectId: pid } });
    if (!scenario) return { error: '시나리오를 찾을 수 없습니다.' };
    return this.aiService.generateTestCases(
      { title: scenario.title, description: scenario.description ?? undefined, type: scenario.type },
      req.user?.id, await this.mid(pid, 'generate-test-cases', body.modelId), body.additionalInfo, body.detailLevel,
    );
  }

  @Post('generate-test-cases-multi')
  @ApiOperation({ summary: '여러 시나리오 → 케이스 다중 AI 자동 생성' })
  async generateTestCasesMulti(
    @Body() body: { scenarioIds: string[]; modelId?: string; additionalInfo?: string; detailLevel?: number },
    @Param('projectId') pid: string,
    @Req() req: any,
  ) {
    if (!body.scenarioIds?.length) return { error: '시나리오를 선택하세요.' };
    const scenarios = await this.prisma.testScenario.findMany({
      where: { id: { in: body.scenarioIds }, projectId: pid },
      select: { id: true, code: true, title: true, description: true, type: true },
    });
    if (!scenarios.length) return { error: '시나리오를 찾을 수 없습니다.' };
    const results = await Promise.all(scenarios.map(async s => {
      const items = await this.aiService.generateTestCases(
        { title: s.title, description: s.description ?? undefined, type: s.type },
        req.user?.id, body.modelId, body.additionalInfo, body.detailLevel,
      ).catch(() => []);
      return (items as any[]).map(item => ({
        ...item,
        _scenarioId: s.id,
        _scenarioCode: s.code,
        _scenarioTitle: s.title,
      }));
    }));
    return results.flat();
  }

  @Post('classify-defect')
  @ApiOperation({ summary: '테스트 실패 → 결함 심각도/우선순위 AI 제안' })
  async classifyDefect(
    @Body() body: { testCaseTitle: string; expected?: string; actual?: string; modelId?: string },
    @Param('projectId') pid: string,
    @Req() req: any,
  ) {
    return this.aiService.classifyDefect(
      { testCaseTitle: body.testCaseTitle, expected: body.expected, actual: body.actual },
      req.user?.id,
      await this.mid(pid, 'classify-defect', body.modelId),
    );
  }

  @Post('generate-defects-from-results')
  @ApiOperation({ summary: '테스트 수행 실패/차단 결과 → AI 결함 일괄 생성 제안' })
  async generateDefectsFromResults(
    @Body() body: { phaseId: string; roundId?: string; resultIds?: string[]; modelId?: string; additionalInfo?: string },
    @Param('projectId') pid: string,
    @Req() req: any,
  ) {
    const phase = await this.prisma.testPhase.findFirst({ where: { id: body.phaseId, projectId: pid } });
    if (!phase) return { error: '테스트 회차를 찾을 수 없습니다.' };

    const snapshot = phase.snapshotData as any;
    const snapshotMap = new Map<string, any>();
    if (snapshot?.scenarios) {
      for (const sc of snapshot.scenarios) {
        for (const c of sc.cases ?? []) {
          snapshotMap.set(`${sc.code}::${c.title}`, { ...c, scenarioTitle: sc.title, scenarioCode: sc.code });
        }
      }
    }

    const where: any = { round: { phaseId: body.phaseId }, result: { in: ['fail', 'blocked'] }, defectId: null };
    if (body.roundId) where.roundId = body.roundId;
    if (body.resultIds?.length) where.id = { in: body.resultIds };

    const failedResults = await this.prisma.testRoundResult.findMany({
      where,
      include: { round: { select: { testerName: true, roundNumber: true } } },
      orderBy: [{ scenarioCode: 'asc' }, { caseIndex: 'asc' }],
    });

    if (failedResults.length === 0) return [];

    const enriched = failedResults.map(r => {
      const snap = snapshotMap.get(`${r.scenarioCode}::${r.caseTitle}`) ?? {};
      return {
        id: r.id,
        scenarioCode: r.scenarioCode,
        scenarioTitle: snap.scenarioTitle ?? r.scenarioCode,
        caseTitle: r.caseTitle,
        casePriority: snap.priority ?? 'medium',
        expected: snap.expected ?? '',
        actual: r.actual ?? '',
        steps: snap.steps ?? [],
        testData: snap.testData ?? '',
        result: r.result ?? 'fail',
        testerName: (r.round as any)?.testerName,
      };
    });

    const generated = await this.aiService.generateDefectsFromResults(
      enriched,
      { title: phase.title, phaseType: phase.phaseType, testerName: enriched[0]?.testerName },
      req.user?.id,
      body.modelId,
      body.additionalInfo,
    );

    return generated.map((g, i) => ({
      ...g,
      _resultId: enriched[i]?.id,
      _roundId: body.roundId,
    }));
  }

  @Post('save-generated-defects')
  @ApiOperation({ summary: 'AI 생성 결함 저장 + TestRoundResult.defectId 연결' })
  async saveGeneratedDefects(
    @Body() body: {
      defects: { title: string; description?: string; severity?: string; priority?: string; _resultId?: string }[];
      projectId?: string;
    },
    @Param('projectId') pid: string,
    @Req() req: any,
  ) {
    const saved: any[] = [];
    for (const d of body.defects) {
      const existing = await this.prisma.defect.findMany({ where: { projectId: pid }, select: { code: true } });
      const nums = existing.map(e => parseInt(e.code.replace('DF-', ''), 10)).filter(n => !isNaN(n));
      const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
      const code = `DF-${String(nextNum).padStart(3, '0')}`;

      const defect = await this.prisma.defect.create({
        data: {
          projectId: pid,
          code,
          title: d.title,
          description: d.description,
          severity: d.severity ?? 'major',
          priority: d.priority ?? 'medium',
          status: 'open',
          reportedBy: req.user?.email ?? req.user?.id,
        },
      });

      if (d._resultId) {
        await this.prisma.testRoundResult.update({
          where: { id: d._resultId },
          data: { defectId: defect.id },
        });
      }

      saved.push(defect);
    }
    return saved;
  }
}
