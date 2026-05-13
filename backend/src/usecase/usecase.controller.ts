import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { UsecaseService } from './usecase.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuditService } from '../audit/audit.service';

@ApiTags('UseCase')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId')
export class UsecaseController {
  constructor(private svc: UsecaseService, private auditService: AuditService) {}

  @Get('use-cases') listUseCases(@Param('projectId') pid: string) { return this.svc.listUseCases(pid); }

  @Post('use-cases')
  async createUseCase(@Param('projectId') pid: string, @Body() body: any) {
    const created = await this.svc.createUseCase(pid, body);
    if (created) await this.auditService.log({ projectId: pid, entityType: 'useCase', entityId: created.id, entityCode: created.code, action: 'create' });
    return created;
  }

  @Put('use-cases/:id')
  async updateUseCase(@Param('projectId') pid: string, @Param('id') id: string, @Body() body: any) {
    const updated = await this.svc.updateUseCase(id, body);
    await this.auditService.log({ projectId: pid, entityType: 'useCase', entityId: id, entityCode: updated.code, action: 'update', changes: body });
    if (body.status === 'confirmed') {
      await this.auditService.log({ projectId: pid, entityType: 'useCase', entityId: id, entityCode: updated.code, action: 'update', changes: { status: 'confirmed', title: updated.title } });
    }
    return updated;
  }

  @Delete('use-cases/:id')
  async deleteUseCase(@Param('projectId') pid: string, @Param('id') id: string) {
    const result = await this.svc.deleteUseCase(id);
    await this.auditService.log({ projectId: pid, entityType: 'useCase', entityId: id, action: 'delete' });
    return result;
  }

  @Get('use-cases/template/excel')
  @ApiOperation({ summary: 'Use Case 엑셀 템플릿 다운로드' })
  getUseCaseTemplate(@Res() res: Response) {
    const buf = this.svc.getUseCaseExcelTemplate();
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="usecase-template.xlsx"' });
    res.send(buf);
  }

  @Post('use-cases/import/excel')
  @ApiOperation({ summary: 'Use Case 엑셀 Import' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importUseCases(@Param('projectId') pid: string, @UploadedFile() file: Express.Multer.File) {
    return this.svc.importUseCasesFromExcel(pid, file.buffer);
  }

  @Get('user-stories/template/excel')
  @ApiOperation({ summary: 'User Story 엑셀 템플릿 다운로드' })
  getUserStoryTemplate(@Res() res: Response) {
    const buf = this.svc.getUserStoryExcelTemplate();
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="userstory-template.xlsx"' });
    res.send(buf);
  }

  @Post('user-stories/import/excel')
  @ApiOperation({ summary: 'User Story 엑셀 Import' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importUserStories(@Param('projectId') pid: string, @UploadedFile() file: Express.Multer.File) {
    return this.svc.importUserStoriesFromExcel(pid, file.buffer);
  }

  @Get('user-stories') listUserStories(@Param('projectId') pid: string) { return this.svc.listUserStories(pid); }

  @Post('user-stories')
  async createUserStory(@Param('projectId') pid: string, @Body() body: any) {
    const created = await this.svc.createUserStory(pid, body);
    if (created) await this.auditService.log({ projectId: pid, entityType: 'userStory', entityId: created.id, entityCode: created.code, action: 'create' });
    return created;
  }

  @Put('user-stories/:id')
  async updateUserStory(@Param('projectId') pid: string, @Param('id') id: string, @Body() body: any) {
    const updated = await this.svc.updateUserStory(id, body);
    await this.auditService.log({ projectId: pid, entityType: 'userStory', entityId: id, entityCode: updated.code, action: 'update', changes: body });
    if (body.status === 'confirmed') {
      await this.auditService.log({ projectId: pid, entityType: 'userStory', entityId: id, entityCode: updated.code, action: 'update', changes: { status: 'confirmed', title: updated.title } });
    }
    return updated;
  }

  @Delete('user-stories/:id')
  async deleteUserStory(@Param('projectId') pid: string, @Param('id') id: string) {
    const result = await this.svc.deleteUserStory(id);
    await this.auditService.log({ projectId: pid, entityType: 'userStory', entityId: id, action: 'delete' });
    return result;
  }
}
