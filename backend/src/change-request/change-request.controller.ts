import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ChangeRequestService } from './change-request.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('ChangeRequest')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/change-requests')
export class ChangeRequestController {
  constructor(private svc: ChangeRequestService) {}

  @Get() findAll(@Param('projectId') pid: string) { return this.svc.findAll(pid); }
  @Post() create(@Param('projectId') pid: string, @Body() body: any) { return this.svc.create(pid, body); }
  @Get(':id') findOne(@Param('projectId') pid: string, @Param('id') id: string) { return this.svc.findOne(pid, id); }
  @Put(':id') update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }
  @Delete(':id') delete(@Param('id') id: string) { return this.svc.delete(id); }
  @Get(':id/impact') analyzeImpact(@Param('projectId') pid: string, @Param('id') id: string) { return this.svc.analyzeImpact(pid, id); }
}
