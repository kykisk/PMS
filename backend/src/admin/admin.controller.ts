import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateLLMConfigDto } from './dto/llm-config.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private svc: AdminService) {}

  @Get('llm')
  @ApiOperation({ summary: 'LLM 설정 목록' })
  listLLM() { return this.svc.listLLMConfigs(); }

  @Post('llm')
  @ApiOperation({ summary: 'LLM 설정 추가' })
  createLLM(@Body() dto: CreateLLMConfigDto) { return this.svc.createLLMConfig(dto); }

  @Put('llm/:id')
  @ApiOperation({ summary: 'LLM 설정 수정' })
  updateLLM(@Param('id') id: string, @Body() dto: Partial<CreateLLMConfigDto>) { return this.svc.updateLLMConfig(id, dto); }

  @Delete('llm/:id')
  @ApiOperation({ summary: 'LLM 설정 삭제' })
  deleteLLM(@Param('id') id: string) { return this.svc.deleteLLMConfig(id); }

  @Get('users')
  @ApiOperation({ summary: '사용자 목록' })
  listUsers() { return this.svc.listUsers(); }

  @Put('users/:id')
  @ApiOperation({ summary: '사용자 수정' })
  updateUser(@Param('id') id: string, @Body() body: { role?: string; name?: string }) { return this.svc.updateUser(id, body); }

  @Delete('users/:id')
  @ApiOperation({ summary: '사용자 삭제' })
  deleteUser(@Param('id') id: string) { return this.svc.deleteUser(id); }

  @Get('templates')
  @ApiOperation({ summary: '산출물 템플릿 목록' })
  getTemplates() { return this.svc.getExportTemplates(); }

  @Put('templates/:id')
  @ApiOperation({ summary: '산출물 템플릿 수정' })
  updateTemplate(@Param('id') id: string, @Body() body: any) { return this.svc.updateExportTemplate(id, body); }

  @Get('llm-access')
  @ApiOperation({ summary: 'LLM 접근 권한 목록' })
  listLLMAccess() { return this.svc.listLLMAccess(); }

  @Post('llm-access')
  @ApiOperation({ summary: 'LLM 접근 권한 부여' })
  grantLLMAccess(@Body() body: { userId: string; llmConfigId: string }) {
    return this.svc.grantLLMAccess(body.userId, body.llmConfigId);
  }

  @Delete('llm-access/:userId/:llmConfigId')
  @ApiOperation({ summary: 'LLM 접근 권한 회수' })
  revokeLLMAccess(@Param('userId') userId: string, @Param('llmConfigId') llmConfigId: string) {
    return this.svc.revokeLLMAccess(userId, llmConfigId);
  }
}
