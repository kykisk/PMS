import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProjectDto, userId: string) {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        createdBy: userId,
        members: { create: { userId } },
      },
      include: { members: { include: { user: { select: { id: true, name: true, email: true } } } } },
    });
    return project;
  }

  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { requirements: true, tasks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        _count: { select: { requirements: true, features: true, tasks: true, testScenarios: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(id: string, userId: string) {
    const project = await this.findOne(id, userId);
    if (project.createdBy !== userId) {
      throw new ForbiddenException('Only project creator can delete');
    }
    return this.prisma.project.delete({ where: { id } });
  }

  async addMember(projectId: string, targetUserId: string, requesterId: string) {
    await this.findOne(projectId, requesterId);
    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (existing) return existing;
    return this.prisma.projectMember.create({
      data: { projectId, userId: targetUserId },
    });
  }

  async removeMember(projectId: string, targetUserId: string, requesterId: string) {
    await this.findOne(projectId, requesterId);
    return this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: targetUserId } },
    });
  }

  async getMembers(projectId: string, userId: string) {
    await this.findOne(projectId, userId);
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  async getDashboard(projectId: string, userId: string) {
    await this.findOne(projectId, userId);
    const [reqCount, featureCount, taskCount, testCount, taskProgress, issueCount] = await Promise.all([
      this.prisma.requirement.groupBy({ by: ['status'], where: { projectId }, _count: true }),
      this.prisma.feature.groupBy({ by: ['status'], where: { projectId }, _count: true }),
      this.prisma.task.groupBy({ by: ['status'], where: { projectId }, _count: true }),
      this.prisma.testScenario.groupBy({ by: ['status'], where: { projectId }, _count: true }),
      this.prisma.task.aggregate({ where: { projectId }, _avg: { progress: true }, _count: true }),
      this.prisma.taskIssue.groupBy({ by: ['type', 'status'], where: { task: { projectId } }, _count: true }),
    ]);
    return {
      requirements: reqCount,
      features: featureCount,
      tasks: taskCount,
      tests: testCount,
      taskProgress: {
        avgProgress: Math.round(taskProgress._avg.progress ?? 0),
        total: taskProgress._count,
        completed: taskCount.find(t => t.status === 'completed')?._count ?? 0,
      },
      issues: issueCount,
    };
  }
}
