import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
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
}
