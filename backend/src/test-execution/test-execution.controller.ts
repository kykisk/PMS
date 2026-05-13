import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Res, UseGuards, UsePipes, ValidationPipe,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { TestExecutionService } from './test-execution.service';
import { TestExecutionExcelService } from './test-execution-excel.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateRoundDto } from './dto/create-round.dto';
import { UpdateRoundDto } from './dto/update-round.dto';
import { SaveResultDto, BulkSaveResultDto } from './dto/save-result.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Test Execution')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false }))
@Controller('projects/:projectId')
export class TestExecutionController {
  constructor(
    private svc: TestExecutionService,
    private excelSvc: TestExecutionExcelService,
  ) {}

  @Post('test-phases')
  @ApiOperation({ summary: '테스트 단계 생성' })
  createPhase(@Param('projectId') pid: string, @Body() dto: CreatePhaseDto) {
    return this.svc.createPhase(pid, dto);
  }

  @Get('test-phases')
  @ApiOperation({ summary: '테스트 단계 목록' })
  listPhases(@Param('projectId') pid: string) {
    return this.svc.listPhases(pid);
  }

  @Get('test-phases/testers')
  @ApiOperation({ summary: '수행자 목록' })
  getTesters(@Param('projectId') pid: string) {
    return this.svc.getTesters(pid);
  }

  @Get('test-phases/:phaseId')
  @ApiOperation({ summary: '테스트 단계 상세' })
  getPhase(@Param('projectId') pid: string, @Param('phaseId') phaseId: string) {
    return this.svc.getPhase(pid, phaseId);
  }

  @Put('test-phases/:phaseId')
  @ApiOperation({ summary: '테스트 단계 수정' })
  updatePhase(@Param('projectId') pid: string, @Param('phaseId') phaseId: string, @Body() dto: UpdatePhaseDto) {
    return this.svc.updatePhase(pid, phaseId, dto);
  }

  @Delete('test-phases/:phaseId')
  @ApiOperation({ summary: '테스트 단계 삭제' })
  deletePhase(@Param('projectId') pid: string, @Param('phaseId') phaseId: string) {
    return this.svc.deletePhase(pid, phaseId);
  }

  @Post('test-phases/:phaseId/snapshot')
  @ApiOperation({ summary: '스냅샷 갱신' })
  createSnapshot(@Param('projectId') pid: string, @Param('phaseId') phaseId: string) {
    return this.svc.createSnapshot(pid, phaseId);
  }

  @Post('test-phases/:phaseId/rounds')
  @ApiOperation({ summary: '회차 생성' })
  createRound(@Param('projectId') pid: string, @Param('phaseId') phaseId: string, @Body() dto: CreateRoundDto) {
    return this.svc.createRound(pid, phaseId, dto);
  }

  @Get('test-phases/:phaseId/rounds')
  @ApiOperation({ summary: '회차 목록' })
  listRounds(@Param('projectId') pid: string, @Param('phaseId') phaseId: string) {
    return this.svc.listRounds(pid, phaseId);
  }

  @Get('test-phases/:phaseId/rounds/:roundId')
  @ApiOperation({ summary: '회차 상세' })
  getRound(@Param('projectId') pid: string, @Param('phaseId') phaseId: string, @Param('roundId') roundId: string) {
    return this.svc.getRound(pid, phaseId, roundId);
  }

  @Put('test-phases/:phaseId/rounds/:roundId')
  @ApiOperation({ summary: '회차 수정' })
  updateRound(@Param('projectId') pid: string, @Param('phaseId') phaseId: string, @Param('roundId') roundId: string, @Body() dto: UpdateRoundDto) {
    return this.svc.updateRound(pid, phaseId, roundId, dto);
  }

  @Delete('test-phases/:phaseId/rounds/:roundId')
  @ApiOperation({ summary: '회차 삭제' })
  deleteRound(@Param('projectId') pid: string, @Param('phaseId') phaseId: string, @Param('roundId') roundId: string) {
    return this.svc.deleteRound(pid, phaseId, roundId);
  }

  @Post('test-rounds/:roundId/results')
  @ApiOperation({ summary: '결과 일괄 저장' })
  saveResults(@Param('roundId') roundId: string, @Body() dto: BulkSaveResultDto) {
    return this.svc.saveResults(roundId, dto.results);
  }

  @Put('test-rounds/:roundId/results/:id')
  @ApiOperation({ summary: '결과 단건 수정' })
  updateResult(@Param('roundId') roundId: string, @Param('id') id: string, @Body() dto: SaveResultDto) {
    return this.svc.updateResult(roundId, id, dto);
  }

  @Get('test-rounds/:roundId/results')
  @ApiOperation({ summary: '결과 목록' })
  getResults(@Param('roundId') roundId: string) {
    return this.svc.getResults(roundId);
  }

  @Get('test-phases/:phaseId/dashboard')
  @ApiOperation({ summary: '단계 대시보드' })
  getDashboard(@Param('projectId') pid: string, @Param('phaseId') phaseId: string) {
    return this.svc.getDashboard(pid, phaseId);
  }

  @Get('test-phases/:phaseId/export-template')
  @ApiOperation({ summary: '수행 템플릿 엑셀 다운로드' })
  async exportTemplate(@Param('projectId') pid: string, @Param('phaseId') phaseId: string, @Res() res: Response) {
    const buffer = await this.excelSvc.exportTemplate(pid, phaseId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="test-template-${phaseId}.xlsx"`,
    });
    res.send(buffer);
  }

  @Post('test-phases/:phaseId/import')
  @ApiOperation({ summary: '엑셀 결과 업로드' })
  @UseInterceptors(FileInterceptor('file'))
  async importResults(
    @Param('projectId') pid: string,
    @Param('phaseId') phaseId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.excelSvc.importResults(pid, phaseId, file.buffer);
  }

  @Get('test-phases/:phaseId/export-result')
  @ApiOperation({ summary: '수행 결과 엑셀 다운로드' })
  async exportResult(@Param('projectId') pid: string, @Param('phaseId') phaseId: string, @Res() res: Response) {
    const buffer = await this.excelSvc.exportResult(pid, phaseId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="test-result-${phaseId}.xlsx"`,
    });
    res.send(buffer);
  }
}
