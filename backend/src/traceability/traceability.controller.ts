import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TraceabilityService } from './traceability.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Traceability')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/traceability')
export class TraceabilityController {
  constructor(private svc: TraceabilityService) {}

  @Get('matrix')
  @ApiOperation({ summary: 'RTM 매트릭스 조회' })
  getMatrix(@Param('projectId') pid: string) {
    return this.svc.getMatrix(pid);
  }

  @Get('coverage')
  @ApiOperation({ summary: '커버리지/갭 분석' })
  getCoverage(@Param('projectId') pid: string) {
    return this.svc.getCoverage(pid);
  }

  @Post('links')
  @ApiOperation({ summary: '추적성 링크 생성' })
  createLink(@Param('projectId') pid: string, @Body() body: { sourceType: string; sourceId: string; targetType: string; targetId: string; linkType?: string }) {
    return this.svc.createLink(pid, body.sourceType, body.sourceId, body.targetType, body.targetId, body.linkType);
  }

  @Delete('links')
  @ApiOperation({ summary: '추적성 링크 삭제' })
  deleteLink(@Body() body: { sourceType: string; sourceId: string; targetType: string; targetId: string }) {
    return this.svc.deleteLink(body.sourceType, body.sourceId, body.targetType, body.targetId);
  }
}
