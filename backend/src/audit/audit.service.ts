import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: { projectId: string; entityType: string; entityId: string; entityCode?: string; action: 'create' | 'update' | 'delete'; changes?: any; userId?: string; userName?: string }) {
    return (this.prisma as any).auditLog.create({ data: params });
  }

  async getHistory(projectId: string, entityType?: string, entityId?: string, limit = 50) {
    const where: any = { projectId };
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    return (this.prisma as any).auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
  }

  async propagateOutdated(projectId: string, entityType: string, entityId: string, reason: string) {
    if (entityType === 'requirement') {
      await this.prisma.feature.updateMany({
        where: { projectId, reqId: entityId },
        data: { outdated: true, outdatedReason: `상위 요구사항 변경: ${reason}` },
      });
      const features = await this.prisma.feature.findMany({ where: { projectId, reqId: entityId }, select: { id: true } });
      const featureIds = features.map(f => f.id);
      if (featureIds.length > 0) {
        await this.prisma.task.updateMany({
          where: { projectId, featureId: { in: featureIds } },
          data: { outdated: true, outdatedReason: `상위 요구사항 변경: ${reason}` },
        });
        await this.prisma.testScenario.updateMany({
          where: { projectId, featureId: { in: featureIds } },
          data: { outdated: true, outdatedReason: `상위 요구사항 변경: ${reason}` },
        });
      }
    } else if (entityType === 'feature') {
      await this.prisma.task.updateMany({
        where: { projectId, featureId: entityId },
        data: { outdated: true, outdatedReason: `상위 기능 변경: ${reason}` },
      });
      await this.prisma.testScenario.updateMany({
        where: { projectId, featureId: entityId },
        data: { outdated: true, outdatedReason: `상위 기능 변경: ${reason}` },
      });
    }
  }

  async clearOutdatedByFeature(projectId: string, featureId: string) {
    return this.prisma.task.updateMany({
      where: { projectId, featureId },
      data: { outdated: false, outdatedReason: null },
    });
  }

  async clearOutdatedScenariosByFeature(projectId: string, featureId: string) {
    return this.prisma.testScenario.updateMany({
      where: { projectId, featureId },
      data: { outdated: false, outdatedReason: null },
    });
  }

  async clearOutdatedByRequirement(projectId: string, reqId: string) {
    return this.prisma.feature.updateMany({
      where: { projectId, reqId },
      data: { outdated: false, outdatedReason: null },
    });
  }

  async clearOutdated(entityType: string, entityId: string) {
    if (entityType === 'feature') {
      return this.prisma.feature.update({ where: { id: entityId }, data: { outdated: false, outdatedReason: null } });
    } else if (entityType === 'task') {
      return this.prisma.task.update({ where: { id: entityId }, data: { outdated: false, outdatedReason: null } });
    } else if (entityType === 'testScenario') {
      return this.prisma.testScenario.update({ where: { id: entityId }, data: { outdated: false, outdatedReason: null } });
    }
  }
}
