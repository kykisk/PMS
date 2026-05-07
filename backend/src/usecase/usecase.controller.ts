import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsecaseService } from './usecase.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('UseCase')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId')
export class UsecaseController {
  constructor(private svc: UsecaseService) {}

  @Get('use-cases') listUseCases(@Param('projectId') pid: string) { return this.svc.listUseCases(pid); }
  @Post('use-cases') createUseCase(@Param('projectId') pid: string, @Body() body: any) { return this.svc.createUseCase(pid, body); }
  @Put('use-cases/:id') updateUseCase(@Param('id') id: string, @Body() body: any) { return this.svc.updateUseCase(id, body); }
  @Delete('use-cases/:id') deleteUseCase(@Param('id') id: string) { return this.svc.deleteUseCase(id); }

  @Get('user-stories') listUserStories(@Param('projectId') pid: string) { return this.svc.listUserStories(pid); }
  @Post('user-stories') createUserStory(@Param('projectId') pid: string, @Body() body: any) { return this.svc.createUserStory(pid, body); }
  @Put('user-stories/:id') updateUserStory(@Param('id') id: string, @Body() body: any) { return this.svc.updateUserStory(id, body); }
  @Delete('user-stories/:id') deleteUserStory(@Param('id') id: string) { return this.svc.deleteUserStory(id); }
}
