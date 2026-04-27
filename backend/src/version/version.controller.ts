import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VersionService } from './version.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirementService } from '../requirement/requirement.service';

import { IsString, IsOptional } from "class-validator";

class SaveVersionDto {
  @IsString()
  version: string;
  @IsString()
  label: string;
  @IsOptional()
  @IsString()
  reason?: string;
}

@ApiTags('Versions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/versions')
export class VersionController {
  constructor(
    private versionService: VersionService,
    private requirementService: RequirementService,
  ) {}

  @Post(':entityType')
  @ApiOperation({ summary: '버전 저장 (스냅샷 생성)' })
  async save(
    @Param('projectId') projectId: string,
    @Param('entityType') entityType: string,
    @Body() dto: SaveVersionDto,
    @CurrentUser() user: any,
  ) {
    let snapshot: any = {};
    if (entityType === 'requirement') {
      snapshot = await this.requirementService.findAll(projectId, {});
    }
    return this.versionService.save(projectId, entityType, dto.version, dto.label, dto.reason || '', snapshot, user.id);
  }

  @Get(':entityType')
  @ApiOperation({ summary: '버전 목록' })
  list(@Param('projectId') projectId: string, @Param('entityType') entityType: string) {
    return this.versionService.list(projectId, entityType);
  }

  @Get(':entityType/:versionId')
  @ApiOperation({ summary: '특정 버전 상세' })
  get(@Param('versionId') versionId: string) {
    return this.versionService.get(versionId);
  }

  @Get(':entityType/diff/compare')
  @ApiOperation({ summary: '두 버전 비교' })
  @ApiQuery({ name: 'v1', required: true })
  @ApiQuery({ name: 'v2', required: true })
  diff(@Query('v1') v1: string, @Query('v2') v2: string) {
    return this.versionService.diff(v1, v2);
  }

  @Post(':entityType/restore')
  @ApiOperation({ summary: '특정 버전 복원' })
  restore(
    @Param('projectId') projectId: string,
    @Param('entityType') entityType: string,
    @Body('versionId') versionId: string,
    @CurrentUser() user: any,
  ) {
    return this.versionService.restore(projectId, entityType, versionId, user.id);
  }
}
