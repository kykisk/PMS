# PMS (Project Management System)

## 프로젝트 요약
SI/SW 프로젝트 산출물을 AI와 연계하여 자동 관리하는 웹 앱. 마크다운 SPEC 문서에서 요구사항/Use Case/User Story를 AI 추출하고, 기능→설계(DB/API)→Task→테스트까지 자동 생성. 전 단계 추적성(RTM) 관리.

## 기술 스택
- **BE**: NestJS 11 + Prisma 5.22 + PostgreSQL 16 + JWT
- **FE**: React 18 + Vite 8 + Tailwind v4 + shadcn/ui + TanStack Query v5 + Zustand
- **AI**: Vercel AI SDK (OpenAI/Anthropic/Gemini/Bedrock)
- **차트**: gantt-task-react
- **Excel**: xlsx (SheetJS), PDF: jspdf (lazy load)

## 디렉토리
```
PMS/
├── SPEC/PROJECT_STATE.md   ← 전체 상태 문서 (상세 정보는 여기 참조)
├── backend/src/            ← NestJS 모듈 (auth, project, requirement, feature, task, test-management, traceability, ai, admin, export, design, change-request, usecase)
├── frontend/src/           ← React (routes/projects/{dashboard,settings,requirements,features,design,tasks,tests,traceability,use-cases,user-stories,change-requests})
└── frontend/src/components/shared/  ← 공용 (Modal, Badge, GanttView, AIGenerateModal, MarkdownImportModal, ScreenDesignSection 등)
```

## 실행
```bash
# BE
cd backend && DATABASE_URL="postgresql://pms_user:pms_password@localhost:5432/pms_db" JWT_SECRET="pms-jwt-secret-change-in-production" JWT_EXPIRES_IN="7d" PORT=3000 node dist/src/main

# FE
cd frontend && npm run preview  # → http://localhost:4173
```

## 계정
- admin@pms.com / Admin1234!

## 핵심 규칙
- Tailwind v4 (CSS 변수 + @import "tailwindcss")
- 액센트 컬러: #5E6AD2 (인디고)
- 폰트: Inter + Pretendard Variable (letter-spacing: -0.011em)
- 컴팩트 UI: text-xs, h-7 inputs, py-1.5 table rows
- Zustand persist key: `pms-auth` (localStorage)
- API base: `/api/v1` (Vite proxy → localhost:3000)
- 이미지 서빙: `/uploads` (Vite proxy → localhost:3000)
- BE ValidationPipe: whitelist + forbidNonWhitelisted (AI controller는 whitelist:false)
- 모든 목록: 페이지네이션 {data, total, page, limit, totalPages}
- AI 모델 우선순위: 개인LLM > 승인된공용 > 글로벌활성

## 상세 정보
전체 데이터 모델, 기능 목록, API 엔드포인트, 마이그레이션 히스토리 등은 `SPEC/PROJECT_STATE.md` 참조.
