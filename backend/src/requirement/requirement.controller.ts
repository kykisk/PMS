import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirementService } from './requirement.service';
import { CreateRequirementDto } from './dto/create-requirement.dto';
import { UpdateRequirementDto } from './dto/update-requirement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';

@ApiTags('Requirements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/requirements')
export class RequirementController {
  constructor(private svc: RequirementService, private auditService: AuditService) {}

  @Post()
  @ApiOperation({ summary: '요구사항 수동 생성' })
  async create(@Param('projectId') pid: string, @Body() dto: CreateRequirementDto) {
    const created = await this.svc.create(pid, dto);
    await this.auditService.log({ projectId: pid, entityType: 'requirement', entityId: created.id, entityCode: created.code, action: 'create', changes: dto });
    return created;
  }

  @Get()
  @ApiOperation({ summary: '요구사항 목록' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Param('projectId') pid: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findAll(pid, { status, priority, category, search, page: page ? +page : undefined, limit: limit ? +limit : undefined });
  }

  @Get('template/excel')
  @ApiOperation({ summary: '엑셀 템플릿 다운로드' })
  downloadTemplate(@Res() res: Response) {
    const buf = this.svc.getExcelTemplate();
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="requirement-template.xlsx"' });
    res.send(buf);
  }

  @Post('import/excel')
  @ApiOperation({ summary: '엑셀 Import' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file'))
  importExcel(@Param('projectId') pid: string, @UploadedFile() file: Express.Multer.File) {
    return this.svc.importFromExcel(pid, file.buffer);
  }

  @Get(':reqId')
  @ApiOperation({ summary: '요구사항 상세' })
  findOne(@Param('projectId') pid: string, @Param('reqId') reqId: string) {
    return this.svc.findOne(pid, reqId);
  }

  @Put(':reqId')
  @ApiOperation({ summary: '요구사항 수정' })
  async update(@Param('projectId') pid: string, @Param('reqId') reqId: string, @Body() dto: UpdateRequirementDto) {
    const current = await this.svc.findOne(pid, reqId);
    const updated = await this.svc.update(pid, reqId, dto);
    if (dto.status === 'confirmed') {
      await this.auditService.log({ projectId: pid, entityType: 'requirement', entityId: reqId, entityCode: updated.code, action: 'update', changes: { status: 'confirmed', title: updated.title } });
    }
    if (current.status === 'confirmed') {
      await this.auditService.propagateOutdated(pid, 'requirement', reqId, updated.title);
    }
    return updated;
  }

  @Delete(':reqId')
  @ApiOperation({ summary: '요구사항 삭제' })
  async remove(@Param('projectId') pid: string, @Param('reqId') reqId: string) {
    const deleted = await this.svc.remove(pid, reqId);
    await this.auditService.log({ projectId: pid, entityType: 'requirement', entityId: reqId, entityCode: deleted.code, action: 'delete' });
    return deleted;
  }
}
