import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FeatureService } from './feature.service';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Features')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/features')
export class FeatureController {
  constructor(private svc: FeatureService) {}

  @Post()
  @ApiOperation({ summary: '기능 생성' })
  create(@Param('projectId') pid: string, @Body() dto: CreateFeatureDto) {
    return this.svc.create(pid, dto);
  }

  @Get()
  @ApiOperation({ summary: '기능 목록' })
  @ApiQuery({ name: 'reqId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Param('projectId') pid: string,
    @Query('reqId') reqId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.findAll(pid, { reqId, status, search });
  }

  @Get(':featureId')
  @ApiOperation({ summary: '기능 상세' })
  findOne(@Param('projectId') pid: string, @Param('featureId') fid: string) {
    return this.svc.findOne(pid, fid);
  }

  @Put(':featureId')
  @ApiOperation({ summary: '기능 수정' })
  update(@Param('projectId') pid: string, @Param('featureId') fid: string, @Body() dto: UpdateFeatureDto) {
    return this.svc.update(pid, fid, dto);
  }

  @Delete(':featureId')
  @ApiOperation({ summary: '기능 삭제' })
  remove(@Param('projectId') pid: string, @Param('featureId') fid: string) {
    return this.svc.remove(pid, fid);
  }

  @Post(':featureId/screen')
  @ApiOperation({ summary: '화면설계서 이미지 업로드 (다중)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 20))
  uploadScreens(
    @Param('projectId') pid: string,
    @Param('featureId') fid: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.svc.uploadScreenImages(pid, fid, files);
  }

  @Get(':featureId/screen')
  @ApiOperation({ summary: '화면설계서 이미지 목록' })
  listScreens(@Param('featureId') fid: string) {
    return this.svc.listScreenImages(fid);
  }

  @Delete(':featureId/screen/:imageId')
  @ApiOperation({ summary: '화면설계서 이미지 삭제' })
  deleteScreen(@Param('featureId') fid: string, @Param('imageId') imageId: string) {
    return this.svc.deleteScreenImage(fid, imageId);
  }

  @Post(':featureId/link')
  @ApiOperation({ summary: '요구사항 연결' })
  linkReq(@Param('projectId') pid: string, @Param('featureId') fid: string, @Body('reqId') reqId: string) {
    return this.svc.linkRequirement(pid, fid, reqId);
  }

  @Delete(':featureId/link')
  @ApiOperation({ summary: '요구사항 연결 해제' })
  unlinkReq(@Param('projectId') pid: string, @Param('featureId') fid: string) {
    return this.svc.unlinkRequirement(pid, fid);
  }
}
