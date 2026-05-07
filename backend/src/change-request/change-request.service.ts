import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChangeRequestService {
  constructor(private prisma: PrismaService) {}

  async findAll(projectId: string) {
    return this.prisma.changeRequest.findMany({
      where: { projectId },
      include: { requirements: { include: { requirement: { select: { id: true, code: true, title: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(projectId: string, data: { title: string; description?: string; reason?: string; priority?: string; requirementIds?: string[] }) {
    const count = await this.prisma.changeRequest.count({ where: { projectId } });
    const code = `CR-${String(count + 1).padStart(3, '0')}`;
    const { requirementIds, ...rest } = data;
    const cr = await this.prisma.changeRequest.create({
      data: { projectId, code, ...rest },
    });
    if (requirementIds?.length) {
      await this.prisma.changeRequestRequirement.createMany({
        data: requirementIds.map(rid => ({ changeRequestId: cr.id, requirementId: rid })),
        skipDuplicates: true,
      });
    }
    return this.findOne(projectId, cr.id);
  }

  async findOne(projectId: string, id: string) {
    return this.prisma.changeRequest.findFirst({
      where: { id, projectId },
      include: { requirements: { include: { requirement: { select: { id: true, code: true, title: true, status: true } } } } },
    });
  }

  async update(id: string, data: { title?: string; description?: string; reason?: string; status?: string; priority?: string; approvedBy?: string; aiAnalysis?: string; requirementIds?: string[] }) {
    const { requirementIds, ...rest } = data;
    await this.prisma.changeRequest.update({ where: { id }, data: rest });
    if (requirementIds !== undefined) {
      await this.prisma.changeRequestRequirement.deleteMany({ where: { changeRequestId: id } });
      if (requirementIds.length) {
        await this.prisma.changeRequestRequirement.createMany({
          data: requirementIds.map(rid => ({ changeRequestId: id, requirementId: rid })),
          skipDuplicates: true,
        });
      }
    }
    return this.prisma.changeRequest.findUnique({
      where: { id },
      include: { requirements: { include: { requirement: { select: { id: true, code: true, title: true, status: true } } } } },
    });
  }

  async delete(id: string) { return this.prisma.changeRequest.delete({ where: { id } }); }

  async analyzeImpact(projectId: string, crId: string) {
    const cr = await this.findOne(projectId, crId);
    if (!cr) return { affected: [] };
    const reqIds = cr.requirements.map((r: any) => r.requirementId);
    const [features, tasks, tests] = await Promise.all([
      this.prisma.feature.findMany({ where: { reqId: { in: reqIds } }, select: { id: true, code: true, title: true, status: true } }),
      this.prisma.task.findMany({ where: { feature: { reqId: { in: reqIds } } }, select: { id: true, code: true, title: true, status: true } }),
      this.prisma.testScenario.findMany({ where: { reqId: { in: reqIds } }, select: { id: true, code: true, title: true, status: true } }),
    ]);
    return { requirements: cr.requirements.map((r: any) => r.requirement), features, tasks, tests };
  }
}
