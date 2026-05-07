import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DesignService } from './design.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AIService } from '../ai/ai.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Design')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/design')
export class DesignController {
  constructor(private svc: DesignService, private aiService: AIService) {}

  @Get('db-tables') listDbTables(@Param('projectId') pid: string) { return this.svc.listDbTables(pid); }
  @Post('db-tables') createDbTable(@Param('projectId') pid: string, @Body() body: any) { return this.svc.createDbTable(pid, body); }
  @Put('db-tables/:id') updateDbTable(@Param('id') id: string, @Body() body: any) { return this.svc.updateDbTable(id, body); }
  @Delete('db-tables/:id') deleteDbTable(@Param('id') id: string) { return this.svc.deleteDbTable(id); }

  @Get('api-specs') listApiSpecs(@Param('projectId') pid: string) { return this.svc.listApiSpecs(pid); }
  @Post('api-specs') createApiSpec(@Param('projectId') pid: string, @Body() body: any) { return this.svc.createApiSpec(pid, body); }
  @Put('api-specs/:id') updateApiSpec(@Param('id') id: string, @Body() body: any) { return this.svc.updateApiSpec(id, body); }
  @Delete('api-specs/:id') deleteApiSpec(@Param('id') id: string) { return this.svc.deleteApiSpec(id); }

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
