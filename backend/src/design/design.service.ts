import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DesignService {
  constructor(private prisma: PrismaService) {}

  async listDbTables(projectId: string) {
    return this.prisma.dbTable.findMany({
      where: { projectId },
      include: { feature: { select: { id: true, code: true, title: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createDbTable(projectId: string, data: { name: string; description?: string; featureId?: string; columns: any[]; indexes?: any[] }) {
    return this.prisma.dbTable.create({
      data: {
        projectId,
        name: data.name,
        description: data.description ?? null,
        featureId: data.featureId ?? null,
        columns: (data.columns ?? []) as any,
        indexes: (data.indexes ?? []) as any,
      },
    });
  }

  async updateDbTable(id: string, data: Partial<{ name: string; description: string; featureId: string; columns: any[]; indexes: any[] }>) {
    return this.prisma.dbTable.update({ where: { id }, data });
  }

  async deleteDbTable(id: string) {
    return this.prisma.dbTable.delete({ where: { id } });
  }

  async listApiSpecs(projectId: string) {
    return this.prisma.apiSpec.findMany({
      where: { projectId },
      include: { feature: { select: { id: true, code: true, title: true } } },
      orderBy: { path: 'asc' },
    });
  }

  async createApiSpec(projectId: string, data: { method: string; path: string; summary: string; description?: string; featureId?: string; requestBody?: any; responseBody?: any; parameters?: any[]; statusCodes?: any[] }) {
    return this.prisma.apiSpec.create({
      data: {
        projectId,
        method: data.method,
        path: data.path,
        summary: data.summary,
        description: data.description ?? null,
        featureId: data.featureId ?? null,
        requestBody: (data.requestBody ?? null) as any,
        responseBody: (data.responseBody ?? null) as any,
        parameters: (data.parameters ?? []) as any,
        statusCodes: (data.statusCodes ?? []) as any,
      },
    });
  }

  async updateApiSpec(id: string, data: any) {
    return this.prisma.apiSpec.update({ where: { id }, data });
  }

  async deleteApiSpec(id: string) {
    return this.prisma.apiSpec.delete({ where: { id } });
  }

  async getProjectContext(projectId: string) {
    const [features, requirements] = await Promise.all([
      this.prisma.feature.findMany({
        where: { projectId },
        include: { requirement: { select: { title: true, category: true } } },
        orderBy: { code: 'asc' },
      }),
      this.prisma.requirement.findMany({
        where: { projectId },
        select: { code: true, title: true, category: true, description: true },
        orderBy: { code: 'asc' },
      }),
    ]);
    return { features, requirements };
  }
}
