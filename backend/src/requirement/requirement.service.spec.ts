import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RequirementService } from './requirement.service';
import { PrismaService } from '../prisma/prisma.service';

const mockRequirement = {
  id: 'req-1', projectId: 'proj-1', code: 'REQ-001',
  title: '로그인 기능', description: null, category: '인증',
  priority: 'high', status: 'new', source: 'manual', note: null,
  createdAt: new Date(), updatedAt: new Date(),
};

const mockPrisma = {
  requirement: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('RequirementService', () => {
  let service: RequirementService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequirementService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<RequirementService>(RequirementService);
  });

  describe('create', () => {
    it('REQ-001 코드로 요구사항을 생성한다', async () => {
      mockPrisma.requirement.count.mockResolvedValue(0);
      mockPrisma.requirement.create.mockResolvedValue(mockRequirement);

      const result = await service.create('proj-1', { title: '로그인 기능', priority: 'high', status: 'new' });

      expect(result.code).toBe('REQ-001');
      expect(mockPrisma.requirement.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ code: 'REQ-001', projectId: 'proj-1' }),
      }));
    });

    it('기존 요구사항이 2개일 때 REQ-003 코드를 생성한다', async () => {
      mockPrisma.requirement.count.mockResolvedValue(2);
      mockPrisma.requirement.create.mockResolvedValue({ ...mockRequirement, code: 'REQ-003' });

      const result = await service.create('proj-1', { title: '결제 기능', priority: 'medium', status: 'new' });

      expect(result.code).toBe('REQ-003');
    });
  });

  describe('findAll', () => {
    it('프로젝트의 요구사항 목록을 반환한다', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([mockRequirement]);

      const result = await service.findAll('proj-1', {});

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('로그인 기능');
    });

    it('상태 필터가 적용된다', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue([]);

      await service.findAll('proj-1', { status: 'confirmed' });

      expect(mockPrisma.requirement.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: 'confirmed' }),
      }));
    });
  });

  describe('findOne', () => {
    it('요구사항을 찾아서 반환한다', async () => {
      mockPrisma.requirement.findFirst.mockResolvedValue(mockRequirement);

      const result = await service.findOne('proj-1', 'req-1');

      expect(result.id).toBe('req-1');
    });

    it('없는 요구사항이면 NotFoundException을 던진다', async () => {
      mockPrisma.requirement.findFirst.mockResolvedValue(null);

      await expect(service.findOne('proj-1', 'not-exist'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
