import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateIssueDto } from './dto/create-issue.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/tasks')
export class TaskController {
  constructor(private svc: TaskService) {}

  @Post()
  @ApiOperation({ summary: 'Task 생성' })
  create(@Param('projectId') pid: string, @Body() dto: CreateTaskDto) {
    return this.svc.create(pid, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Task 목록' })
  @ApiQuery({ name: 'featureId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'assigneeId', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Param('projectId') pid: string,
    @Query('featureId') featureId?: string,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.findAll(pid, { featureId, status, assigneeId, search });
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Task 상세' })
  findOne(@Param('projectId') pid: string, @Param('taskId') tid: string) {
    return this.svc.findOne(pid, tid);
  }

  @Put(':taskId')
  @ApiOperation({ summary: 'Task 수정 (진척율, 일정, 상태 등)' })
  update(@Param('projectId') pid: string, @Param('taskId') tid: string, @Body() dto: UpdateTaskDto) {
    return this.svc.update(pid, tid, dto);
  }

  @Delete(':taskId')
  @ApiOperation({ summary: 'Task 삭제' })
  remove(@Param('projectId') pid: string, @Param('taskId') tid: string) {
    return this.svc.remove(pid, tid);
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
