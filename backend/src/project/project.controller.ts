import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectController {
  constructor(private projectService: ProjectService) {}

  @Post()
  @ApiOperation({ summary: '프로젝트 생성' })
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: any) {
    return this.projectService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: '프로젝트 목록' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  findAll(
    @CurrentUser() user: any,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.projectService.findAll(user.id, { search, status, from, to });
  }

  @Get(':id')
  @ApiOperation({ summary: '프로젝트 상세' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectService.findOne(id, user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: '프로젝트 수정' })
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @CurrentUser() user: any) {
    return this.projectService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: '프로젝트 삭제' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectService.remove(id, user.id);
  }

  @Get(':id/dashboard')
  @ApiOperation({ summary: '대시보드 통계' })
  getDashboard(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectService.getDashboard(id, user.id);
  }

  @Get(':id/members')
  @ApiOperation({ summary: '멤버 목록' })
  getMembers(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectService.getMembers(id, user.id);
  }

  @Post(':id/members')
  @ApiOperation({ summary: '멤버 배정' })
  addMember(@Param('id') id: string, @Body('userId') userId: string, @CurrentUser() user: any) {
    return this.projectService.addMember(id, userId, user.id);
  }

  @Delete(':id/members/:userId')
  @ApiOperation({ summary: '멤버 제거' })
  removeMember(@Param('id') id: string, @Param('userId') userId: string, @CurrentUser() user: any) {
    return this.projectService.removeMember(id, userId, user.id);
  }

  @Get(':id/settings')
  @ApiOperation({ summary: '프로젝트 설정 조회 (개요 + 전체 멤버)' })
  getSettings(@Param('id') id: string, @CurrentUser() user: any) {
    return this.projectService.getSettings(id, user.id);
  }

  @Put(':id/members/:userId/role')
  @ApiOperation({ summary: '시스템 멤버 역할/비고 수정' })
  updateMemberRole(
    @Param('id') pid: string,
    @Param('userId') uid: string,
    @Body() body: { role: string; note?: string },
  ) {
    return this.projectService.updateMemberRole(pid, uid, body.role, body.note);
  }

  @Post(':id/external-members')
  @ApiOperation({ summary: '외부 멤버 추가' })
  createExternalMember(@Param('id') pid: string, @Body() body: any) {
    return this.projectService.createExternalMember(pid, body);
  }

  @Put(':id/external-members/:eid')
  @ApiOperation({ summary: '외부 멤버 수정' })
  updateExternalMember(@Param('eid') eid: string, @Body() body: any) {
    return this.projectService.updateExternalMember(eid, body);
  }

  @Delete(':id/external-members/:eid')
  @ApiOperation({ summary: '외부 멤버 삭제' })
  deleteExternalMember(@Param('eid') eid: string) {
    return this.projectService.deleteExternalMember(eid);
  }
}
