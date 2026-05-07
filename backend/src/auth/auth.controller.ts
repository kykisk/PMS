import { Controller, Post, Get, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: '회원가입' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '로그인' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'JWT 토큰 갱신' })
  refresh(@CurrentUser() user: any) {
    return this.authService.refresh(user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '현재 사용자 정보' })
  getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.id);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 정보 수정' })
  updateProfile(@CurrentUser() user: any, @Body() body: { name?: string; nameEn?: string; email?: string; phone?: string; department?: string; position?: string }) {
    return this.authService.updateProfile(user.id, body);
  }

  @Put('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '비밀번호 변경' })
  changePassword(@CurrentUser() user: any, @Body() body: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(user.id, body);
  }

  @Get('llm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 개인 LLM 목록' })
  listPersonalLLMs(@CurrentUser() user: any) {
    return this.authService.listPersonalLLMs(user.id);
  }

  @Post('llm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '개인 LLM 추가' })
  createPersonalLLM(@CurrentUser() user: any, @Body() body: { provider: string; model: string; apiKey: string; region?: string }) {
    return this.authService.createPersonalLLM(user.id, body);
  }

  @Put('llm/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '개인 LLM 수정' })
  updatePersonalLLM(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.authService.updatePersonalLLM(user.id, id, body);
  }

  @Delete('llm/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '개인 LLM 삭제' })
  deletePersonalLLM(@CurrentUser() user: any, @Param('id') id: string) {
    return this.authService.deletePersonalLLM(user.id, id);
  }
}
