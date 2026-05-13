import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChangeRequestService } from './change-request.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';

@ApiTags('ChangeRequest')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/change-requests')
export class ChangeRequestController {
  constructor(private svc: ChangeRequestService, private auditService: AuditService) {}

  @Get() findAll(@Param('projectId') pid: string) { return this.svc.findAll(pid); }

  @Post()
  async create(@Param('projectId') pid: string, @Body() body: any) {
    const created = await this.svc.create(pid, body);
    if (created) await this.auditService.log({ projectId: pid, entityType: 'changeRequest', entityId: created.id, entityCode: created.code, action: 'create' });
    return created;
  }

  @Get(':id') findOne(@Param('projectId') pid: string, @Param('id') id: string) { return this.svc.findOne(pid, id); }

  @Put(':id')
  async update(@Param('projectId') pid: string, @Param('id') id: string, @Body() body: any) {
    const updated = await this.svc.update(id, body);
    if (updated) {
      await this.auditService.log({ projectId: pid, entityType: 'changeRequest', entityId: id, entityCode: updated.code, action: 'update', changes: body });
      if (body.status === 'approved') {
        await this.auditService.log({ projectId: pid, entityType: 'changeRequest', entityId: id, entityCode: updated.code, action: 'update', changes: { status: 'approved', title: updated.title } });
      }
    }
    return updated;
  }

  @Delete(':id')
  async delete(@Param('projectId') pid: string, @Param('id') id: string) {
    const result = await this.svc.delete(id);
    await this.auditService.log({ projectId: pid, entityType: 'changeRequest', entityId: id, action: 'delete' });
    return result;
  }

  @Get(':id/impact') analyzeImpact(@Param('projectId') pid: string, @Param('id') id: string) { return this.svc.analyzeImpact(pid, id); }
}
