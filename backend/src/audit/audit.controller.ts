import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/audit')
export class AuditController {
  constructor(private svc: AuditService) {}

  @Get('history')
  @ApiOperation({ summary: '변경 이력 조회' })
  getHistory(
    @Param('projectId') pid: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getHistory(pid, entityType, entityId, limit ? +limit : 50);
  }

  @Post('clear-outdated')
  @ApiOperation({ summary: 'outdated 플래그 해제' })
  clearOutdated(@Body() body: { entityType: string; entityId: string }) {
    return this.svc.clearOutdated(body.entityType, body.entityId);
  }

  @Post('clear-outdated-by-requirement')
  @ApiOperation({ summary: '요구사항 기준 기능 outdated 일괄 해제' })
  clearOutdatedByRequirement(@Param('projectId') pid: string, @Body() body: { reqId: string }) {
    return this.svc.clearOutdatedByRequirement(pid, body.reqId);
  }

  @Post('clear-outdated-by-feature')
  @ApiOperation({ summary: '기능 기준 Task outdated 일괄 해제' })
  clearOutdatedByFeature(@Param('projectId') pid: string, @Body() body: { featureId: string }) {
    return this.svc.clearOutdatedByFeature(pid, body.featureId);
  }

  @Post('clear-outdated-scenarios-by-feature')
  @ApiOperation({ summary: '기능 기준 TestScenario outdated 일괄 해제' })
  clearOutdatedScenariosByFeature(@Param('projectId') pid: string, @Body() body: { featureId: string }) {
    return this.svc.clearOutdatedScenariosByFeature(pid, body.featureId);
  }
}
