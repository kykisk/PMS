import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashed,
      },
    });
    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.generateTokens(user);
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, nameEn: true, role: true,
        language: true, phone: true, department: true, position: true,
        avatarUrl: true, createdAt: true,
      },
    });
  }

  async updateProfile(userId: string, dto: { name?: string; nameEn?: string; email?: string; phone?: string; department?: string; position?: string }) {
    if (dto.email) {
      const existing = await this.prisma.user.findFirst({ where: { email: dto.email, id: { not: userId } } });
      if (existing) throw new ConflictException('이미 사용 중인 이메일입니다');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true, email: true, name: true, nameEn: true, role: true,
        language: true, phone: true, department: true, position: true,
        avatarUrl: true, createdAt: true,
      },
    });
  }

  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('현재 비밀번호가 일치하지 않습니다');
    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return { message: '비밀번호가 변경되었습니다' };
  }

  async listPersonalLLMs(userId: string) {
    return this.prisma.userLLMConfig.findMany({
      where: { userId },
      select: { id: true, provider: true, model: true, region: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPersonalLLM(userId: string, data: { provider: string; model: string; apiKey: string; region?: string }) {
    return this.prisma.userLLMConfig.create({ data: { ...data, userId } });
  }

  async updatePersonalLLM(userId: string, id: string, data: { provider?: string; model?: string; apiKey?: string; region?: string; isActive?: boolean }) {
    return this.prisma.userLLMConfig.updateMany({ where: { id, userId }, data });
  }

  async deletePersonalLLM(userId: string, id: string) {
    return this.prisma.userLLMConfig.deleteMany({ where: { id, userId } });
  }

  private generateTokens(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN') || '7d',
    });
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '30d',
    });
    return { accessToken, refreshToken };
  }

  async refresh(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.generateTokens(user);
  }
}
