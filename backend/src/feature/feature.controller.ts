import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FeatureService } from './feature.service';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';

@ApiTags('Features')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/features')
export class FeatureController {
  constructor(private svc: FeatureService, private auditService: AuditService) {}

  @Post()
  @ApiOperation({ summary: '기능 생성' })
  async create(@Param('projectId') pid: string, @Body() dto: CreateFeatureDto) {
    const created = await this.svc.create(pid, dto);
    await this.auditService.log({ projectId: pid, entityType: 'feature', entityId: created.id, entityCode: created.code, action: 'create', changes: dto });
    return created;
  }

  @Get()
  @ApiOperation({ summary: '기능 목록' })
  @ApiQuery({ name: 'reqId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'hasNoScenarios', required: false })
  @ApiQuery({ name: 'hasNoTasks', required: false })
  findAll(
    @Param('projectId') pid: string,
    @Query('reqId') reqId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('hasNoScenarios') hasNoScenarios?: string,
    @Query('hasNoTasks') hasNoTasks?: string,
  ) {
    return this.svc.findAll(pid, {
      reqId, status, search,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
      hasNoScenarios: hasNoScenarios === 'true',
      hasNoTasks: hasNoTasks === 'true',
    });
  }

  @Get(':featureId')
  @ApiOperation({ summary: '기능 상세' })
  findOne(@Param('projectId') pid: string, @Param('featureId') fid: string) {
    return this.svc.findOne(pid, fid);
  }

  @Put(':featureId')
  @ApiOperation({ summary: '기능 수정' })
  async update(@Param('projectId') pid: string, @Param('featureId') fid: string, @Body() dto: UpdateFeatureDto) {
    const updated = await this.svc.update(pid, fid, dto);
    await this.auditService.log({ projectId: pid, entityType: 'feature', entityId: fid, entityCode: updated.code, action: 'update', changes: dto });
    if (dto.status === 'confirmed') {
      await this.auditService.log({ projectId: pid, entityType: 'feature', entityId: fid, entityCode: updated.code, action: 'update', changes: { status: 'confirmed', title: updated.title } });
    }
    await this.auditService.propagateOutdated(pid, 'feature', fid, updated.title);
    return updated;
  }

  @Delete(':featureId')
  @ApiOperation({ summary: '기능 삭제' })
  async remove(@Param('projectId') pid: string, @Param('featureId') fid: string) {
    const deleted = await this.svc.remove(pid, fid);
    await this.auditService.log({ projectId: pid, entityType: 'feature', entityId: fid, entityCode: deleted.code, action: 'delete' });
    return deleted;
  }

  @Post(':featureId/screen')
  @ApiOperation({ summary: '화면설계서 이미지 업로드 (다중)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 20))
  uploadScreens(
    @Param('projectId') pid: string,
    @Param('featureId') fid: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.svc.uploadScreenImages(pid, fid, files);
  }

  @Get(':featureId/screen')
  @ApiOperation({ summary: '화면설계서 이미지 목록' })
  listScreens(@Param('featureId') fid: string) {
    return this.svc.listScreenImages(fid);
  }

  @Delete(':featureId/screen/:imageId')
  @ApiOperation({ summary: '화면설계서 이미지 삭제' })
  deleteScreen(@Param('featureId') fid: string, @Param('imageId') imageId: string) {
    return this.svc.deleteScreenImage(fid, imageId);
  }

  @Post(':featureId/link')
  @ApiOperation({ summary: '요구사항 연결' })
  linkReq(@Param('projectId') pid: string, @Param('featureId') fid: string, @Body('reqId') reqId: string) {
    return this.svc.linkRequirement(pid, fid, reqId);
  }

  @Delete(':featureId/link')
  @ApiOperation({ summary: '요구사항 연결 해제' })
  unlinkReq(@Param('projectId') pid: string, @Param('featureId') fid: string) {
    return this.svc.unlinkRequirement(pid, fid);
  }
}
