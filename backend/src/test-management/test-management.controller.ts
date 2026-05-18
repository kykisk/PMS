import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TestManagementService } from './test-management.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { CreateTestCaseDto } from './dto/create-testcase.dto';
import { ExecuteTestCaseDto } from './dto/execute-testcase.dto';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { CreateDefectDto, UpdateDefectDto } from './dto/defect.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

@ApiTags('Tests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }))
@Controller('projects/:projectId')
export class TestManagementController {
  constructor(private svc: TestManagementService, private auditService: AuditService) {}

  @Post('test-scenarios')
  @ApiOperation({ summary: '테스트 시나리오 생성' })
  async createScenario(@Param('projectId') pid: string, @Body() dto: CreateScenarioDto) {
    const created = await this.svc.createScenario(pid, dto);
    if (created) await this.auditService.log({ projectId: pid, entityType: 'testScenario', entityId: created.id, entityCode: created.code, action: 'create' });
    return created;
  }

  @Get('test-scenarios')
  @ApiOperation({ summary: '테스트 시나리오 목록' })
  @ApiQuery({ name: 'reqId', required: false })
  @ApiQuery({ name: 'featureId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'testType', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'withCases', required: false })
  findAllScenarios(
    @Param('projectId') pid: string,
    @Query('reqId') reqId?: string,
    @Query('featureId') featureId?: string,
    @Query('type') type?: string,
    @Query('testType') testType?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('withCases') withCases?: string,
  ) {
    return this.svc.findAllScenarios(pid, { reqId, featureId, type, testType, search, page: page ? +page : undefined, limit: limit ? +limit : undefined, withCases: withCases === 'true' });
  }

  @Get('test-scenarios/:sId')
  @ApiOperation({ summary: '테스트 시나리오 상세' })
  findOneScenario(@Param('projectId') pid: string, @Param('sId') sId: string) {
    return this.svc.findOneScenario(pid, sId);
  }

  @Put('test-scenarios/:sId')
  @ApiOperation({ summary: '테스트 시나리오 수정' })
  async updateScenario(@Param('projectId') pid: string, @Param('sId') sId: string, @Body() dto: Partial<CreateScenarioDto>) {
    const updated = await this.svc.updateScenario(pid, sId, dto);
    await this.auditService.log({ projectId: pid, entityType: 'testScenario', entityId: sId, entityCode: updated.code, action: 'update', changes: dto as any });
    return updated;
  }

  @Delete('test-scenarios/:sId')
  @ApiOperation({ summary: '테스트 시나리오 삭제' })
  async removeScenario(@Param('projectId') pid: string, @Param('sId') sId: string) {
    const result = await this.svc.removeScenario(pid, sId);
    await this.auditService.log({ projectId: pid, entityType: 'testScenario', entityId: sId, action: 'delete' });
    return result;
  }

  @Post('test-scenarios/:sId/cases')
  @ApiOperation({ summary: '테스트 케이스 생성' })
  async createCase(@Param('projectId') pid: string, @Param('sId') sId: string, @Body() dto: CreateTestCaseDto) {
    const created = await this.svc.createTestCase(sId, dto);
    await this.auditService.log({ projectId: pid, entityType: 'testCase', entityId: created.id, action: 'create' });
    return created;
  }

  @Get('test-scenarios/:sId/cases')
  @ApiOperation({ summary: '테스트 케이스 목록' })
  findCases(@Param('sId') sId: string) {
    return this.svc.findAllTestCases(sId);
  }

  @Get('test-cases/:cId')
  @ApiOperation({ summary: '테스트 케이스 상세' })
  findCase(@Param('cId') cId: string) {
    return this.svc.findOneTestCase(cId);
  }

  @Put('test-cases/:cId')
  @ApiOperation({ summary: '테스트 케이스 수정' })
  updateCase(@Param('cId') cId: string, @Body() dto: Partial<CreateTestCaseDto>) {
    return this.svc.updateTestCase(cId, dto);
  }

  @Put('test-cases/:cId/execute')
  @ApiOperation({ summary: '테스트 결과 기록' })
  async executeCase(@Param('projectId') pid: string, @Param('cId') cId: string, @Body() dto: ExecuteTestCaseDto, @CurrentUser() user: any) {
    const result = await this.svc.executeTestCase(cId, dto, user.id);
    await this.auditService.log({ projectId: pid, entityType: 'testCase', entityId: cId, action: 'update', changes: dto as any });
    return result;
  }

  @Delete('test-cases/:cId')
  @ApiOperation({ summary: '테스트 케이스 삭제' })
  removeCase(@Param('cId') cId: string) {
    return this.svc.removeTestCase(cId);
  }

  // ─── Wave 2: Cycle endpoints ────────────────────────────────────

  @Post('test-cycles')
  @ApiOperation({ summary: '테스트 사이클 생성' })
  async createCycle(@Param('projectId') pid: string, @Body() dto: CreateCycleDto) {
    return this.svc.createCycle(pid, dto);
  }

  @Get('test-cycles')
  @ApiOperation({ summary: '테스트 사이클 목록' })
  findAllCycles(@Param('projectId') pid: string) {
    return this.svc.findAllCycles(pid);
  }

  @Get('test-cycles/:cycleId')
  @ApiOperation({ summary: '테스트 사이클 상세' })
  findOneCycle(@Param('projectId') pid: string, @Param('cycleId') cycleId: string) {
    return this.svc.findOneCycle(pid, cycleId);
  }

  @Put('test-cycles/:cycleId')
  @ApiOperation({ summary: '테스트 사이클 수정' })
  updateCycle(@Param('projectId') pid: string, @Param('cycleId') cycleId: string, @Body() dto: Partial<CreateCycleDto>) {
    return this.svc.updateCycle(pid, cycleId, dto);
  }

  @Delete('test-cycles/:cycleId')
  @ApiOperation({ summary: '테스트 사이클 삭제' })
  removeCycle(@Param('projectId') pid: string, @Param('cycleId') cycleId: string) {
    return this.svc.removeCycle(pid, cycleId);
  }

  @Get('test-cycles/:cycleId/stats')
  @ApiOperation({ summary: '사이클 통계' })
  getCycleStats(@Param('projectId') pid: string, @Param('cycleId') cycleId: string) {
    return this.svc.getCycleStats(pid, cycleId);
  }

  // ─── Wave 2: Execution endpoints ───────────────────────────────

  @Post('test-cycles/:cycleId/executions')
  @ApiOperation({ summary: '테스트 실행 기록' })
  createExecution(@Param('cycleId') cycleId: string, @Body() dto: CreateExecutionDto, @CurrentUser() user: any) {
    return this.svc.createExecution(cycleId, dto, user.id);
  }

  @Get('test-cycles/:cycleId/executions')
  @ApiOperation({ summary: '사이클별 실행 목록' })
  findExecutionsByCycle(@Param('cycleId') cycleId: string) {
    return this.svc.findExecutionsByCycle(cycleId);
  }

  @Get('test-cases/:caseId/executions')
  @ApiOperation({ summary: '케이스별 실행 이력' })
  findExecutionsByCase(@Param('caseId') caseId: string) {
    return this.svc.findExecutionsByCase(caseId);
  }

  // ─── Wave 2: Defect endpoints ──────────────────────────────────

  @Post('defects')
  @ApiOperation({ summary: '결함 등록' })
  createDefect(@Param('projectId') pid: string, @Body() dto: CreateDefectDto, @CurrentUser() user: any) {
    return this.svc.createDefect(pid, dto, user.id);
  }

  @Get('defects')
  @ApiOperation({ summary: '결함 목록' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAllDefects(
    @Param('projectId') pid: string,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findAllDefects(pid, {
      status, severity, priority, search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('defects/:defectId')
  @ApiOperation({ summary: '결함 상세' })
  findOneDefect(@Param('projectId') pid: string, @Param('defectId') defectId: string) {
    return this.svc.findOneDefect(pid, defectId);
  }

  @Put('defects/:defectId')
  @ApiOperation({ summary: '결함 수정' })
  updateDefect(@Param('projectId') pid: string, @Param('defectId') defectId: string, @Body() dto: UpdateDefectDto) {
    return this.svc.updateDefect(pid, defectId, dto);
  }

  @Delete('defects/:defectId')
  @ApiOperation({ summary: '결함 삭제' })
  removeDefect(@Param('projectId') pid: string, @Param('defectId') defectId: string) {
    return this.svc.removeDefect(pid, defectId);
  }

  // ─── Wave 2: Stats endpoint ────────────────────────────────────

  @Get('test-stats/summary')
  @ApiOperation({ summary: '테스트 통계 요약' })
  getTestSummary(@Param('projectId') pid: string) {
    return this.svc.getTestSummary(pid);
  }
}
