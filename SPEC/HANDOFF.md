# PMS 구현 Handoff — 최종 완성 상태

## 전체 구현 현황 (Phase 1~6 완료, BE/FE 빌드 성공)

| Step | 내용 | BE | FE |
|------|------|----|----|
| 1-1 | 인프라+인증 (NestJS, React, JWT, Prisma v5, Docker) | ✅ | ✅ |
| 1-2 | 프로젝트+요구사항 CRUD | ✅ | ✅ |
| 1-3 | 엑셀 Import + 버전관리 + 대시보드 | ✅ | ✅ |
| 2-1 | 기능 리스트 CRUD + 요구사항 매핑 + 화면설계서 | ✅ | ✅ |
| 2-2 | Task CRUD + 이슈/리스크 + 진척율 | ✅ | ✅ |
| 2-3 | 추적성 연결 (Task→기능→요구사항 자동추적) | ✅ | ✅ |
| 3-1 | 테스트 시나리오/케이스 CRUD + 수행결과 기록 | ✅ | ✅ |
| 3-2 | RTM 매트릭스 + 커버리지/갭 분석 | ✅ | ✅ |
| 4-1 | AI Service (4개 프로바이더) + 관리자 LLM 설정 + 프롬프트 편집 + AI 버튼 비활성화 | ✅ | ✅ |
| 4-2 | 기술서 AI Import (parse-spec-upload) + diff Import + 마크다운 AI 추출 | ✅ | ✅ |
| 4-3 | 기능/Task/테스트 AI 자동생성 (AIGenerateModal) | ✅ | ✅ |
| 5-1 | Export Excel: 요구사항/WBS/RTM/테스트계획서 | ✅ | ✅ |
| 5-2 | Export PDF: jspdf+autotable (4종) + 각 페이지 버튼 + 사이드바 퀵링크 | ✅ | ✅ |
| 6-1 | 대시보드 진척율바 + 미결 이슈/리스크 집계 + Admin Guard | ✅ | ✅ |
| 6-2 | Jest 테스트 (15개 통과) + Playwright E2E (6개) + Docker 프로덕션 수정 | ✅ | ✅ |

## 실행 방법

```bash
# 개발 환경
podman start pms_db_dev
cd backend && DATABASE_URL="postgresql://pms_user:pms_password@localhost:5432/pms_db" node dist/src/main.js
cd frontend && npm run dev  # → http://localhost:5173

# 프로덕션 (Docker)
docker compose up --build  # → http://localhost
```

## 테스트

```bash
cd backend && npx jest --forceExit           # 단위 테스트 15개
cd frontend && npx playwright test --list    # E2E 목록 확인
cd frontend && npx playwright test           # E2E 실행 (서버 필요)
```

## 기술 스택
- BE: NestJS 11 + Prisma 5.22 + PostgreSQL 16 + xlsx + Jest
- FE: React 18 + Vite 8 + shadcn/ui + Tailwind v4 + TanStack Query + jspdf + Playwright
- AI: Vercel AI SDK (OpenAI/Anthropic/Gemini/Bedrock)

## Admin 계정
- admin@pms.com / Admin1234!

## DB
- podman container: pms_db_dev
- DATABASE_URL: postgresql://pms_user:pms_password@localhost:5432/pms_db
