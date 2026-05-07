import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TestManagementService } from './test-management.service';
import { CreateScenarioDto } from './dto/create-scenario.dto';
import { CreateTestCaseDto } from './dto/create-testcase.dto';
import { ExecuteTestCaseDto } from './dto/execute-testcase.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Tests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }))
@Controller('projects/:projectId')
export class TestManagementController {
  constructor(private svc: TestManagementService) {}

  @Post('test-scenarios')
  @ApiOperation({ summary: '테스트 시나리오 생성' })
  createScenario(@Param('projectId') pid: string, @Body() dto: CreateScenarioDto) {
    return this.svc.createScenario(pid, dto);
  }

  @Get('test-scenarios')
  @ApiOperation({ summary: '테스트 시나리오 목록' })
  @ApiQuery({ name: 'reqId', required: false })
  @ApiQuery({ name: 'featureId', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAllScenarios(
    @Param('projectId') pid: string,
    @Query('reqId') reqId?: string,
    @Query('featureId') featureId?: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.findAllScenarios(pid, { reqId, featureId, type, search });
  }

  @Get('test-scenarios/:sId')
  @ApiOperation({ summary: '테스트 시나리오 상세' })
  findOneScenario(@Param('projectId') pid: string, @Param('sId') sId: string) {
    return this.svc.findOneScenario(pid, sId);
  }

  @Put('test-scenarios/:sId')
  @ApiOperation({ summary: '테스트 시나리오 수정' })
  updateScenario(@Param('projectId') pid: string, @Param('sId') sId: string, @Body() dto: Partial<CreateScenarioDto>) {
    return this.svc.updateScenario(pid, sId, dto);
  }

  @Delete('test-scenarios/:sId')
  @ApiOperation({ summary: '테스트 시나리오 삭제' })
  removeScenario(@Param('projectId') pid: string, @Param('sId') sId: string) {
    return this.svc.removeScenario(pid, sId);
  }

  @Post('test-scenarios/:sId/cases')
  @ApiOperation({ summary: '테스트 케이스 생성' })
  createCase(@Param('sId') sId: string, @Body() dto: CreateTestCaseDto) {
    return this.svc.createTestCase(sId, dto);
  }

  @Get('test-scenarios/:sId/cases')
  @ApiOperation({ summary: '테스트 케이스 목록' })
  findCases(@Param('sId') sId: string) {
    return this.svc.findAllTestCases(sId);
  }

  @Get('test-cases/:cId')
  @ApiOperation({ summary: '테스트 케이스 상세' })
  findCase(@Param('cId') cId: string) {
    return this.svc.findOneTestCase(cId);
  }

  @Put('test-cases/:cId')
  @ApiOperation({ summary: '테스트 케이스 수정' })
  updateCase(@Param('cId') cId: string, @Body() dto: Partial<CreateTestCaseDto>) {
    return this.svc.updateTestCase(cId, dto);
  }

  @Put('test-cases/:cId/execute')
  @ApiOperation({ summary: '테스트 결과 기록' })
  executeCase(@Param('cId') cId: string, @Body() dto: ExecuteTestCaseDto, @CurrentUser() user: any) {
    return this.svc.executeTestCase(cId, dto, user.id);
  }

  @Delete('test-cases/:cId')
  @ApiOperation({ summary: '테스트 케이스 삭제' })
  removeCase(@Param('cId') cId: string) {
    return this.svc.removeTestCase(cId);
  }
}
