import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class VersionService {
  constructor(private prisma: PrismaService) {}

  async save(projectId: string, entityType: string, version: string, label: string, reason: string, snapshot: any, userId: string) {
    return this.prisma.versionSnapshot.create({
      data: { projectId, entityType, version, label, reason, snapshot, createdBy: userId },
    });
  }

  async list(projectId: string, entityType: string) {
    return this.prisma.versionSnapshot.findMany({
      where: { projectId, entityType },
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(versionId: string) {
    const v = await this.prisma.versionSnapshot.findUnique({
      where: { id: versionId },
      include: { creator: { select: { id: true, name: true } } },
    });
    if (!v) throw new NotFoundException('Version not found');
    return v;
  }

  async diff(versionId1: string, versionId2: string) {
    const [v1, v2] = await Promise.all([this.get(versionId1), this.get(versionId2)]);
    return { v1: { version: v1.version, label: v1.label, snapshot: v1.snapshot }, v2: { version: v2.version, label: v2.label, snapshot: v2.snapshot } };
  }

  async restore(projectId: string, entityType: string, versionId: string, userId: string) {
    const v = await this.get(versionId);
    const newVersion = `restored-${v.version}-${Date.now()}`;
    return this.save(projectId, entityType, newVersion, `복원: ${v.label}`, `v${v.version}으로 복원`, v.snapshot, userId);
  }
}
