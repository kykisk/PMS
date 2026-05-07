import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsecaseService {
  constructor(private prisma: PrismaService) {}

  async listUseCases(projectId: string) {
    return this.prisma.useCase.findMany({
      where: { projectId },
      include: { requirement: { select: { id: true, code: true, title: true } } },
      orderBy: { code: 'asc' },
    });
  }
  async createUseCase(projectId: string, data: any) {
    const count = await this.prisma.useCase.count({ where: { projectId } });
    const code = `UC-${String(count + 1).padStart(3, '0')}`;
    return this.prisma.useCase.create({ data: { projectId, code, ...data } });
  }
  async updateUseCase(id: string, data: any) {
    return this.prisma.useCase.update({ where: { id }, data });
  }
  async deleteUseCase(id: string) {
    return this.prisma.useCase.delete({ where: { id } });
  }

  async listUserStories(projectId: string) {
    return this.prisma.userStory.findMany({
      where: { projectId },
      include: { requirement: { select: { id: true, code: true, title: true } } },
      orderBy: { code: 'asc' },
    });
  }
  async createUserStory(projectId: string, data: any) {
    const count = await this.prisma.userStory.count({ where: { projectId } });
    const code = `US-${String(count + 1).padStart(3, '0')}`;
    return this.prisma.userStory.create({ data: { projectId, code, ...data } });
  }
  async updateUserStory(id: string, data: any) {
    return this.prisma.userStory.update({ where: { id }, data });
  }
  async deleteUserStory(id: string) {
    return this.prisma.userStory.delete({ where: { id } });
  }
}
