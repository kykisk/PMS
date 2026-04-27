import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreateIssueDto } from './dto/create-issue.dto';

@Injectable()
export class TaskService {
  constructor(private prisma: PrismaService) {}

  private async nextCode(projectId: string): Promise<string> {
    const count = await this.prisma.task.count({ where: { projectId } });
    return `T-${String(count + 1).padStart(3, '0')}`;
  }

  async create(projectId: string, dto: CreateTaskDto) {
    const code = await this.nextCode(projectId);
    return this.prisma.task.create({
      data: {
        projectId,
        code,
        featureId: dto.featureId,
        title: dto.title,
        description: dto.description,
        assigneeId: dto.assigneeId,
        progress: dto.progress ?? 0,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status ?? 'pending',
      },
      include: {
        feature: {
          select: { id: true, code: true, title: true, reqId: true,
            requirement: { select: { id: true, code: true, title: true } } },
        },
        issues: true,
      },
    });
  }

  async findAll(projectId: string, query: { featureId?: string; status?: string; assigneeId?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 50);
    const skip = (page - 1) * limit;
    const where: any = { projectId };
    if (query.featureId) where.featureId = query.featureId;
    if (query.status) where.status = query.status;
    if (query.assigneeId) where.assigneeId = query.assigneeId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          feature: { select: { id: true, code: true, title: true, reqId: true,
            requirement: { select: { id: true, code: true, title: true } } } },
          issues: true,
          _count: { select: { issues: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(projectId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: {
        feature: {
          select: { id: true, code: true, title: true, status: true,
            requirement: { select: { id: true, code: true, title: true, status: true } } },
        },
        issues: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async update(projectId: string, taskId: string, dto: UpdateTaskDto) {
    await this.findOne(projectId, taskId);
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: {
        feature: { select: { id: true, code: true, title: true } },
        issues: true,
      },
    });
  }

  async remove(projectId: string, taskId: string) {
    await this.findOne(projectId, taskId);
    return this.prisma.task.delete({ where: { id: taskId } });
  }

  async addIssue(taskId: string, dto: CreateIssueDto) {
    return this.prisma.taskIssue.create({
      data: {
        taskId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        severity: dto.severity ?? 'medium',
        status: dto.status ?? 'open',
      },
    });
  }

  async updateIssue(issueId: string, dto: Partial<CreateIssueDto>) {
    return this.prisma.taskIssue.update({ where: { id: issueId }, data: dto });
  }

  async removeIssue(issueId: string) {
    return this.prisma.taskIssue.delete({ where: { id: issueId } });
  }
}
