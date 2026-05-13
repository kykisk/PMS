# PMS (Project Management System)

## 프로젝트 요약
SI/SW 프로젝트 산출물을 AI와 연계하여 자동 관리하는 웹 앱. 마크다운 SPEC 문서에서 요구사항/Use Case/User Story를 AI 추출하고, 기능→설계(DB/API)→Task→테스트까지 자동 생성. 전 단계 추적성(RTM) 관리.

## 기술 스택
- **BE**: NestJS 11 + Prisma 5.22 + PostgreSQL 16 + JWT
- **FE**: React 18 + Vite 8 + Tailwind v4 + shadcn/ui + TanStack Query v5 + Zustand
- **AI**: Vercel AI SDK (OpenAI/Anthropic/Gemini/Bedrock) - 현재 모델: us.anthropic.claude-opus-4-6-v1
- **차트**: gantt-task-react
- **Excel**: xlsx (SheetJS), PDF: jspdf (lazy load)

## 디렉토리
```
PMS/
├── SPEC/PROJECT_STATE.md        ← 전체 상태 문서
├── SPEC/TEST_REFORM_PLAN.md     ← 테스트 시스템 개편 계획 (완료)
├── SPEC/TEST_EXECUTION_PLAN.md  ← 테스트 수행 시스템 계획 (진행중)
├── backend/src/                 ← NestJS 모듈
│   ├── auth, project, requirement, feature, task
│   ├── test-management          ← 시나리오/케이스 설계 + 기존 Cycle/Execution/Defect
│   ├── test-execution           ← 신규: 테스트 수행 (Phase/Round/Result + Excel Import/Export)
│   ├── ai, admin, export, design, change-request, usecase
│   └── common/
├── frontend/src/
│   ├── routes/projects/{dashboard,settings,requirements,features,design,tasks,tests,test-execution,traceability,use-cases,user-stories,change-requests,defects}
│   └── components/shared/       ← Modal, GanttView, AI모달들, TesterAutocomplete 등
└── restart-all.sh, restart-be.sh, restart-fe.sh  ← 서버 재시작 스크립트
```

## 실행
```bash
# BE (빌드 없이 재시작)
pkill -f "node dist/src/main" 2>/dev/null; sleep 2
cd backend && DATABASE_URL="postgresql://pms_user:pms_password@localhost:5432/pms_db" JWT_SECRET="pms-jwt-secret-change-in-production" JWT_EXPIRES_IN="7d" PORT=3000 node dist/src/main.js &

# FE (빌드 없이 재시작)
pkill -f "vite" 2>/dev/null; sleep 1
cd frontend && npx vite preview &

# 빌드 포함 재시작
./restart-all.sh
```

## 계정
- admin@pms.com / Admin1234!

## 핵심 규칙
- Tailwind v4 (CSS 변수 + @import "tailwindcss")
- 액센트 컬러: #5E6AD2 (인디고)
- 컴팩트 UI: text-xs, h-7 inputs, py-1.5 table rows
- API base: `/api/v1` (Vite proxy → localhost:3000)
- BE ValidationPipe: whitelist + forbidNonWhitelisted (AI controller는 whitelist:false)
- 목록: 그룹핑 있는 페이지(테스트/기능) = useQuery(limit:2000), Task = useInfiniteQuery(무한스크롤)
- AI 모달: forbidNonWhitelisted 때문에 createScenario/createTask 호출 시 필요 필드만 명시적 추출 필수 (_selected, _featureCode 등 전송 금지)
- AI 모델 우선순위: 개인LLM > 승인된공용 > 글로벌활성
- AI parseJSON: "A".repeat(N) 같은 JS 표현식 치환 처리 있음
- 코드 자동채번: nextScenarioCode는 전체 조회 후 숫자 max 계산 (문자열 정렬 버그 방지)

## 주요 기능 (Phase별)
1. 마크다운 AI분석 → 요구사항/UseCase/UserStory 추출
2. 요구사항 → AI → 기능리스트 (확정 건만, 중복 제외)
3. 기능리스트 → AI → Task / 테스트 시나리오 (레벨별: unit/integration/system/acceptance)
4. 테스트 시나리오 → AI → 케이스 자동 생성
5. 상위 변경 → outdated 전파 → AI 업데이트 제안
6. 결함 관리 (상태 전이 7단계)
7. 테스트 수행 (프로젝트 회차 → 수행 회차 → Excel Import/Export) ← 구현 중
8. Gantt 차트 (접기/펼치기, Dependency FS/FF/SS/SF)
9. 전체 추적성(RTM) 관리

## 상세 정보
- 전체 데이터 모델, API 엔드포인트 → `SPEC/PROJECT_STATE.md`
- 테스트 개편 상세 → `SPEC/TEST_REFORM_PLAN.md`
- 테스트 수행 시스템 상세 → `SPEC/TEST_EXECUTION_PLAN.md`
