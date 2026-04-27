import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const EXPORT_TEMPLATES = [
  { type: 'requirements', title: '요구사항 정의서', columns: [
    { key: 'code', label: 'ID', visible: true, width: 8 },
    { key: 'category', label: '분류', visible: true, width: 12 },
    { key: 'title', label: '요구사항명', visible: true, width: 30 },
    { key: 'description', label: '상세설명', visible: true, width: 40 },
    { key: 'priority', label: '우선순위', visible: true, width: 8 },
    { key: 'status', label: '상태', visible: true, width: 8 },
    { key: 'source', label: '입력경로', visible: false, width: 10 },
    { key: 'createdAt', label: '등록일', visible: false, width: 12 },
  ]},
  { type: 'wbs', title: 'WBS', columns: [
    { key: 'code', label: 'Task ID', visible: true, width: 8 },
    { key: 'featureTitle', label: '상위 기능', visible: true, width: 20 },
    { key: 'requirementTitle', label: '상위 요구사항', visible: true, width: 20 },
    { key: 'title', label: 'Task명', visible: true, width: 25 },
    { key: 'assigneeId', label: '담당자', visible: true, width: 12 },
    { key: 'progress', label: '진척율(%)', visible: true, width: 8 },
    { key: 'startDate', label: '시작일', visible: true, width: 10 },
    { key: 'endDate', label: '종료일', visible: true, width: 10 },
    { key: 'status', label: '상태', visible: true, width: 8 },
    { key: 'issueCount', label: '이슈수', visible: false, width: 6 },
  ]},
  { type: 'rtm', title: '요구사항 추적표 (RTM)', columns: [
    { key: 'reqCode', label: '요구사항 ID', visible: true, width: 8 },
    { key: 'reqTitle', label: '요구사항명', visible: true, width: 25 },
    { key: 'priority', label: '우선순위', visible: true, width: 8 },
    { key: 'status', label: '상태', visible: true, width: 8 },
    { key: 'featCode', label: '기능 ID', visible: true, width: 8 },
    { key: 'featTitle', label: '기능명', visible: true, width: 20 },
    { key: 'taskCode', label: 'Task ID', visible: true, width: 8 },
    { key: 'taskTitle', label: 'Task명', visible: true, width: 20 },
    { key: 'scenarioCode', label: '시나리오 ID', visible: true, width: 10 },
    { key: 'scenarioTitle', label: '시나리오명', visible: true, width: 25 },
  ]},
  { type: 'test-plan', title: '테스트 계획서', columns: [
    { key: 'code', label: '시나리오 ID', visible: true, width: 8 },
    { key: 'title', label: '시나리오명', visible: true, width: 30 },
    { key: 'type', label: '유형', visible: true, width: 8 },
    { key: 'feature', label: '연결기능', visible: true, width: 20 },
    { key: 'status', label: '상태', visible: true, width: 8 },
    { key: 'caseCount', label: '케이스수', visible: true, width: 6 },
  ]},
];

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: 'admin@pms.com' } });
  if (!existing) {
    const hashed = await bcrypt.hash('Admin1234!', 10);
    await prisma.user.create({ data: { email: 'admin@pms.com', name: 'System Admin', password: hashed, role: 'ADMIN' } });
    console.log('Admin user created: admin@pms.com / Admin1234!');
  } else {
    console.log('Admin user already exists');
  }

  for (const tmpl of EXPORT_TEMPLATES) {
    await (prisma as any).exportTemplate.upsert({
      where: { type: tmpl.type },
      update: {},
      create: tmpl,
    });
  }
  console.log('Export templates seeded');
}

main().catch(console.error).finally(() => prisma.$disconnect());
