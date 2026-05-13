import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateIssueDto } from './dto/create-issue.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/tasks')
export class TaskController {
  constructor(private svc: TaskService, private auditService: AuditService) {}

  @Post()
  @ApiOperation({ summary: 'Task 생성' })
  async create(@Param('projectId') pid: string, @Body() dto: CreateTaskDto) {
    const created = await this.svc.create(pid, dto);
    await this.auditService.log({ projectId: pid, entityType: 'task', entityId: created.id, entityCode: created.code, action: 'create' });
    return created;
  }

  @Get()
  @ApiOperation({ summary: 'Task 목록' })
  @ApiQuery({ name: 'featureId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'assigneeId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Param('projectId') pid: string,
    @Query('featureId') featureId?: string,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findAll(pid, { featureId, status, assigneeId, search, page: page ? +page : undefined, limit: limit ? +limit : undefined });
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Task 상세' })
  findOne(@Param('projectId') pid: string, @Param('taskId') tid: string) {
    return this.svc.findOne(pid, tid);
  }

  @Put(':taskId')
  @ApiOperation({ summary: 'Task 수정 (진척율, 일정, 상태 등)' })
  async update(@Param('projectId') pid: string, @Param('taskId') tid: string, @Body() dto: UpdateTaskDto) {
    const updated = await this.svc.update(pid, tid, dto);
    await this.auditService.log({ projectId: pid, entityType: 'task', entityId: tid, entityCode: updated.code, action: 'update', changes: dto as any });
    if (dto.status === 'completed') {
      await this.auditService.log({ projectId: pid, entityType: 'task', entityId: tid, entityCode: updated.code, action: 'update', changes: { status: 'completed', title: updated.title } });
    }
    return updated;
  }

  @Delete(':taskId')
  @ApiOperation({ summary: 'Task 삭제' })
  async remove(@Param('projectId') pid: string, @Param('taskId') tid: string) {
    const result = await this.svc.remove(pid, tid);
    await this.auditService.log({ projectId: pid, entityType: 'task', entityId: tid, action: 'delete' });
    return result;
  }

  @Get('dependencies')
  @ApiOperation({ summary: 'Task 의존성 목록' })
  listDependencies(@Param('projectId') pid: string) {
    return this.svc.listDependencies(pid);
  }

  @Post('dependencies')
  @ApiOperation({ summary: 'Task 의존성 추가' })
  createDependency(@Param('projectId') pid: string, @Body() body: { fromTaskId: string; toTaskId: string; type: string }) {
    return this.svc.createDependency(pid, body.fromTaskId, body.toTaskId, body.type);
  }

  @Delete('dependencies/:depId')
  @ApiOperation({ summary: 'Task 의존성 삭제' })
  removeDependency(@Param('depId') depId: string) {
    return this.svc.removeDependency(depId);
  }

  @Post(':taskId/issues')
  @ApiOperation({ summary: '이슈/리스크 추가' })
  addIssue(@Param('taskId') tid: string, @Body() dto: CreateIssueDto) {
    return this.svc.addIssue(tid, dto);
  }

  @Put(':taskId/issues/:issueId')
  @ApiOperation({ summary: '이슈/리스크 수정' })
  updateIssue(@Param('issueId') iid: string, @Body() dto: Partial<CreateIssueDto>) {
    return this.svc.updateIssue(iid, dto);
  }

  @Delete(':taskId/issues/:issueId')
  @ApiOperation({ summary: '이슈/리스크 삭제' })
  removeIssue(@Param('issueId') iid: string) {
    return this.svc.removeIssue(iid);
  }
}
