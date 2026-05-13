import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

const EXCEL_HEADERS = {
  'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

@ApiTags('Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/export')
export class ExportController {
  constructor(private svc: ExportService) {}

  @Get('requirements')
  @ApiOperation({ summary: '요구사항 정의서 Excel 다운로드' })
  async requirements(@Param('projectId') pid: string, @Res() res: Response) {
    const buf = await this.svc.requirementsExcel(pid);
    res.set({ ...EXCEL_HEADERS, 'Content-Disposition': 'attachment; filename="requirements.xlsx"' });
    res.send(buf);
  }

  @Get('wbs')
  @ApiOperation({ summary: 'WBS (Task) Excel 다운로드' })
  async wbs(@Param('projectId') pid: string, @Res() res: Response) {
    const buf = await this.svc.wbsExcel(pid);
    res.set({ ...EXCEL_HEADERS, 'Content-Disposition': 'attachment; filename="wbs.xlsx"' });
    res.send(buf);
  }

  @Get('rtm')
  @ApiOperation({ summary: 'RTM Excel 다운로드' })
  async rtm(@Param('projectId') pid: string, @Res() res: Response) {
    const buf = await this.svc.rtmExcel(pid);
    res.set({ ...EXCEL_HEADERS, 'Content-Disposition': 'attachment; filename="rtm.xlsx"' });
    res.send(buf);
  }

  @Get('test-plan')
  @ApiOperation({ summary: '테스트 계획서 Excel 다운로드' })
  async testPlan(@Param('projectId') pid: string, @Res() res: Response) {
    const buf = await this.svc.testPlanExcel(pid);
    res.set({ ...EXCEL_HEADERS, 'Content-Disposition': 'attachment; filename="test-plan.xlsx"' });
    res.send(buf);
  }

  @Get('requirements-json')
  @ApiOperation({ summary: '요구사항 JSON (PDF용)' })
  requirementsJson(@Param('projectId') pid: string) { return this.svc.requirementsJson(pid); }

  @Get('wbs-json')
  @ApiOperation({ summary: 'WBS JSON (PDF용)' })
  wbsJson(@Param('projectId') pid: string) { return this.svc.wbsJson(pid); }

  @Get('rtm-json')
  @ApiOperation({ summary: 'RTM JSON (PDF용)' })
  rtmJson(@Param('projectId') pid: string) { return this.svc.rtmJson(pid); }

  @Get('test-plan-json')
  @ApiOperation({ summary: '테스트 계획서 JSON (PDF용)' })
  testPlanJson(@Param('projectId') pid: string) { return this.svc.testPlanJson(pid); }

  @Get('db-design')
  @ApiOperation({ summary: 'DB 정의서 Excel 다운로드' })
  async dbDesign(@Param('projectId') pid: string, @Res() res: Response) {
    const buf = await this.svc.dbDesignExcel(pid);
    res.set({ ...EXCEL_HEADERS, 'Content-Disposition': 'attachment; filename="db-design.xlsx"' });
    res.send(buf);
  }

  @Get('api-design')
  @ApiOperation({ summary: 'API 명세서 Excel 다운로드' })
  async apiDesign(@Param('projectId') pid: string, @Res() res: Response) {
    const buf = await this.svc.apiDesignExcel(pid);
    res.set({ ...EXCEL_HEADERS, 'Content-Disposition': 'attachment; filename="api-design.xlsx"' });
    res.send(buf);
  }

  @Get('use-cases')
  @ApiOperation({ summary: 'Use Case Excel 다운로드' })
  async useCases(@Param('projectId') pid: string, @Res() res: Response) {
    const buf = await this.svc.useCasesExcel(pid);
    res.set({ ...EXCEL_HEADERS, 'Content-Disposition': 'attachment; filename="use-cases.xlsx"' });
    res.send(buf);
  }

  @Get('user-stories')
  @ApiOperation({ summary: 'User Story Excel 다운로드' })
  async userStories(@Param('projectId') pid: string, @Res() res: Response) {
    const buf = await this.svc.userStoriesExcel(pid);
    res.set({ ...EXCEL_HEADERS, 'Content-Disposition': 'attachment; filename="user-stories.xlsx"' });
    res.send(buf);
  }

  @Get('test-result')
  @ApiOperation({ summary: '회차별 테스트 실행 결과 Excel 다운로드' })
  async testResult(@Param('projectId') pid: string, @Query('cycleId') cycleId: string, @Res() res: Response) {
    const buf = await this.svc.testResultExcel(pid, cycleId);
    res.set({ ...EXCEL_HEADERS, 'Content-Disposition': 'attachment; filename="test-result.xlsx"' });
    res.send(buf);
  }

  @Get('test-result-pivot')
  @ApiOperation({ summary: '테스트 결과서 Excel (피벗 형식 - 회차별 컬럼)' })
  async testResultPivot(@Param('projectId') pid: string, @Res() res: Response) {
    const buf = await this.svc.testResultPivotExcel(pid);
    res.set({ ...EXCEL_HEADERS, 'Content-Disposition': 'attachment; filename="test-result-report.xlsx"' });
    res.send(buf);
  }

  @Get('defect-report')
  @ApiOperation({ summary: '결함 리포트 Excel 다운로드' })
  async defectReport(@Param('projectId') pid: string, @Res() res: Response) {
    const buf = await this.svc.defectReportExcel(pid);
    res.set({ ...EXCEL_HEADERS, 'Content-Disposition': 'attachment; filename="defect-report.xlsx"' });
    res.send(buf);
  }
}
