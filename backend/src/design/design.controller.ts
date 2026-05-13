import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DesignService } from './design.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AIService } from '../ai/ai.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';

@ApiTags('Design')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/design')
export class DesignController {
  constructor(private svc: DesignService, private aiService: AIService, private auditService: AuditService) {}

  @Get('db-tables') listDbTables(@Param('projectId') pid: string) { return this.svc.listDbTables(pid); }

  @Post('db-tables')
  async createDbTable(@Param('projectId') pid: string, @Body() body: any) {
    const created = await this.svc.createDbTable(pid, body);
    await this.auditService.log({ projectId: pid, entityType: 'dbTable', entityId: created.id, entityCode: created.name, action: 'create' });
    return created;
  }

  @Put('db-tables/:id')
  async updateDbTable(@Param('projectId') pid: string, @Param('id') id: string, @Body() body: any) {
    const updated = await this.svc.updateDbTable(id, body);
    await this.auditService.log({ projectId: pid, entityType: 'dbTable', entityId: id, entityCode: updated.name, action: 'update', changes: body });
    return updated;
  }

  @Delete('db-tables/:id')
  async deleteDbTable(@Param('projectId') pid: string, @Param('id') id: string) {
    const result = await this.svc.deleteDbTable(id);
    await this.auditService.log({ projectId: pid, entityType: 'dbTable', entityId: id, action: 'delete' });
    return result;
  }

  @Get('api-specs') listApiSpecs(@Param('projectId') pid: string) { return this.svc.listApiSpecs(pid); }

  @Post('api-specs')
  async createApiSpec(@Param('projectId') pid: string, @Body() body: any) {
    const created = await this.svc.createApiSpec(pid, body);
    await this.auditService.log({ projectId: pid, entityType: 'apiSpec', entityId: created.id, entityCode: created.path, action: 'create' });
    return created;
  }

  @Put('api-specs/:id')
  async updateApiSpec(@Param('projectId') pid: string, @Param('id') id: string, @Body() body: any) {
    const updated = await this.svc.updateApiSpec(id, body);
    await this.auditService.log({ projectId: pid, entityType: 'apiSpec', entityId: id, entityCode: updated.path, action: 'update', changes: body });
    return updated;
  }

  @Delete('api-specs/:id')
  async deleteApiSpec(@Param('projectId') pid: string, @Param('id') id: string) {
    const result = await this.svc.deleteApiSpec(id);
    await this.auditService.log({ projectId: pid, entityType: 'apiSpec', entityId: id, action: 'delete' });
    return result;
  }

  @Post('ai/generate-db')
  @ApiOperation({ summary: '기능 목록으로 DB 설계 AI 자동생성' })
  async generateDb(@Param('projectId') pid: string, @Body() body: { modelId?: string }, @CurrentUser() user: any) {
    const ctx = await this.svc.getProjectContext(pid);
    return this.aiService.generateDbDesign(ctx.features, ctx.requirements, user?.id, body.modelId);
  }

  @Post('ai/generate-api')
  @ApiOperation({ summary: '기능 목록으로 API 설계 AI 자동생성' })
  async generateApi(@Param('projectId') pid: string, @Body() body: { modelId?: string }, @CurrentUser() user: any) {
    const ctx = await this.svc.getProjectContext(pid);
    return this.aiService.generateApiDesign(ctx.features, ctx.requirements, user?.id, body.modelId);
  }
}
