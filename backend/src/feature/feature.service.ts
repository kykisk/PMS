import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeatureDto } from './dto/create-feature.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FeatureService {
  constructor(private prisma: PrismaService) {}

  private async nextCode(projectId: string): Promise<string> {
    const count = await this.prisma.feature.count({ where: { projectId } });
    return `F-${String(count + 1).padStart(3, '0')}`;
  }

  async create(projectId: string, dto: CreateFeatureDto) {
    const code = await this.nextCode(projectId);
    return this.prisma.feature.create({
      data: {
        projectId,
        code,
        title: dto.title,
        description: dto.description,
        status: dto.status ?? 'new',
        reqId: dto.reqId || undefined,
      },
      include: { requirement: { select: { id: true, code: true, title: true } } },
    });
  }

  async findAll(projectId: string, query: { reqId?: string; status?: string; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 50);
    const skip = (page - 1) * limit;
    const where: any = { projectId };
    if (query.reqId) where.reqId = query.reqId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.feature.findMany({
        where,
        include: {
          requirement: { select: { id: true, code: true, title: true, status: true } },
          tasks: { select: { id: true, code: true, title: true, progress: true, status: true, assigneeId: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.feature.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(projectId: string, featureId: string) {
    const feature = await this.prisma.feature.findFirst({
      where: { id: featureId, projectId },
      include: {
        requirement: { select: { id: true, code: true, title: true, status: true, priority: true } },
        tasks: { select: { id: true, code: true, title: true, progress: true, status: true, assigneeId: true } },
        testScenarios: { select: { id: true, code: true, title: true, status: true } },
      },
    });
    if (!feature) throw new NotFoundException('Feature not found');
    return feature;
  }

  async update(projectId: string, featureId: string, dto: UpdateFeatureDto) {
    await this.findOne(projectId, featureId);
    return this.prisma.feature.update({
      where: { id: featureId },
      data: dto,
      include: { requirement: { select: { id: true, code: true, title: true } } },
    });
  }

  async remove(projectId: string, featureId: string) {
    await this.findOne(projectId, featureId);
    return this.prisma.feature.delete({ where: { id: featureId } });
  }

  async uploadScreenImages(projectId: string, featureId: string, files: Express.Multer.File[]) {
    await this.findOne(projectId, featureId);
    const uploadDir = path.join(process.cwd(), 'uploads', projectId, featureId);
    fs.mkdirSync(uploadDir, { recursive: true });
    const saved: any[] = [];
    for (const file of files) {
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.originalname}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, file.buffer);
      const url = `/uploads/${projectId}/${featureId}/${filename}`;
      const img = await this.prisma.screenImage.create({
        data: { featureId, filename, originalName: file.originalname, url, size: file.size, mimeType: file.mimetype },
      });
      saved.push(img as any);
    }
    return saved;
  }

  async listScreenImages(featureId: string) {
    return this.prisma.screenImage.findMany({ where: { featureId }, orderBy: { createdAt: 'asc' } });
  }

  async deleteScreenImage(featureId: string, imageId: string) {
    const img = await this.prisma.screenImage.findFirst({ where: { id: imageId, featureId } });
    if (!img) return;
    const fullPath = path.join(process.cwd(), img.url.replace(/^\//, ''));
    try { fs.unlinkSync(fullPath); } catch {}
    return this.prisma.screenImage.delete({ where: { id: imageId } });
  }

  async linkRequirement(projectId: string, featureId: string, reqId: string) {
    await this.findOne(projectId, featureId);
    return this.prisma.feature.update({
      where: { id: featureId },
      data: { reqId },
      include: { requirement: { select: { id: true, code: true, title: true } } },
    });
  }

  async unlinkRequirement(projectId: string, featureId: string) {
    await this.findOne(projectId, featureId);
    return this.prisma.feature.update({
      where: { id: featureId },
      data: { reqId: null },
    });
  }
}
