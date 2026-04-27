import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLLMConfigDto } from './dto/llm-config.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listLLMConfigs() {
    return this.prisma.lLMConfig.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, provider: true, model: true, region: true, isActive: true, createdAt: true, updatedAt: true, promptTemplates: true },
    });
  }

  async createLLMConfig(dto: CreateLLMConfigDto) {
    return this.prisma.lLMConfig.create({ data: { ...dto, promptTemplates: dto.promptTemplates ?? {} } });
  }

  async updateLLMConfig(id: string, dto: Partial<CreateLLMConfigDto>) {
    return this.prisma.lLMConfig.update({ where: { id }, data: dto });
  }

  async deleteLLMConfig(id: string) {
    return this.prisma.lLMConfig.delete({ where: { id } });
  }

  async getActiveLLMConfig() {
    return this.prisma.lLMConfig.findFirst({ where: { isActive: true } });
  }

  async listUsers() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, language: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUser(id: string, data: { role?: string; name?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { name: data.name, role: data.role as any },
      select: { id: true, email: true, name: true, role: true, language: true },
    });
  }

  async deleteUser(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async getExportTemplates() {
    return (this.prisma as any).exportTemplate.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async updateExportTemplate(id: string, data: { title?: string; columns?: any[] }) {
    return (this.prisma as any).exportTemplate.update({ where: { id }, data });
  }
}
