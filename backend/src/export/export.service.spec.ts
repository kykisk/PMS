import { Test, TestingModule } from '@nestjs/testing';
import { ExportService } from './export.service';
import { PrismaService } from '../prisma/prisma.service';

const mockRequirements = [
  { id: 'r1', code: 'REQ-001', category: '인증', title: '로그인', description: null, priority: 'high', status: 'confirmed', source: 'manual', createdAt: new Date() },
];

const mockTasks = [
  {
    id: 't1', code: 'TASK-001', title: 'JWT 구현', description: null,
    assigneeId: null, progress: 80, status: 'in_progress',
    startDate: null, endDate: null, createdAt: new Date(),
    feature: { code: 'FEAT-001', title: '로그인 기능', requirement: { code: 'REQ-001', title: '로그인' } },
    issues: [],
  },
];

const mockPrisma = {
  requirement: {
    findMany: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  testScenario: {
    findMany: jest.fn(),
  },
};

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<ExportService>(ExportService);
  });

  describe('requirementsExcel', () => {
    it('Buffer를 반환한다', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue(mockRequirements);

      const result = await service.requirementsExcel('proj-1');

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('requirementsJson', () => {
    it('요구사항 배열을 반환한다', async () => {
      mockPrisma.requirement.findMany.mockResolvedValue(mockRequirements);

      const result = await service.requirementsJson('proj-1');

      expect(Array.isArray(result)).toBe(true);
      expect(mockPrisma.requirement.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { projectId: 'proj-1' },
      }));
    });
  });

  describe('wbsExcel', () => {
    it('Task 데이터로 WBS Buffer를 반환한다', async () => {
      mockPrisma.task.findMany.mockResolvedValue(mockTasks);

      const result = await service.wbsExcel('proj-1');

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('wbsJson', () => {
    it('Task 데이터를 가공하여 배열로 반환한다', async () => {
      mockPrisma.task.findMany.mockResolvedValue(mockTasks);

      const result = await service.wbsJson('proj-1');

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('code', 'TASK-001');
      expect(result[0]).toHaveProperty('issueCount', 0);
    });
  });
});
