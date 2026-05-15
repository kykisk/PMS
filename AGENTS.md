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
├── SPEC/TEST_EXECUTION_PLAN.md  ← 테스트 수행 시스템 계획
├── SPEC/HANDOFF.md              ← 세션 작업 인계 문서
├── backend/src/                 ← NestJS 모듈
│   ├── auth, project, requirement, feature, task
│   ├── test-management          ← 시나리오/케이스 설계 + Cycle/Execution/Defect
│   ├── test-execution           ← 테스트 수행 (Phase/Round/Result + Excel)
│   ├── ai, admin, export, design, change-request, usecase
│   └── common/
├── frontend/src/
│   ├── routes/projects/{dashboard,settings,requirements,features,design,
│   │   tasks,tests,test-execution,traceability,use-cases,user-stories,
│   │   change-requests,defects}
│   └── components/shared/       ← Modal, GanttView, AI모달들, TesterAutocomplete,
│                                   MultiFeatureGenerateModal, MultiTaskGenerateModal,
│                                   MultiScenarioGenerateModal 등
└── restart-all.sh, restart-be.sh, restart-fe.sh
```

## 실행
```bash
# BE (빌드 없이 재시작)
pkill -f "node dist/src/main" 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
sleep 2
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
- AI 모달: forbidNonWhitelisted 때문에 createScenario/createTask 호출 시 필요 필드만 명시적 추출 필수
- AI parseJSON: "A".repeat(N) 같은 JS 표현식 치환 처리 있음
- 코드 자동채번: nextScenarioCode는 전체 조회 후 숫자 max 계산 (문자열 정렬 버그 방지)
- AI 모델 우선순위: 개인LLM > 승인된공용 > 글로벌활성

## 주요 기능
1. 마크다운 AI분석 → 요구사항/UseCase/UserStory 추출
2. 요구사항 → AI → 기능리스트 (확정 건만)
3. 기능리스트 → AI → Task
4. **요구사항** → AI → 테스트 시나리오 (기능 기반 아님)
5. 테스트 시나리오 → AI → 케이스 자동 생성 (상세도 조절 가능)
6. 상위 변경 → outdated 전파 → AI 업데이트 제안
7. 결함 관리 (7단계 상태전이)
8. 테스트 수행 (프로젝트 회차 → 수행 회차 → Excel Import/Export)
9. Gantt 차트 (접기/펼치기, Dependency FS/FF/SS/SF)
10. 추적성(RTM) 관리

## 테스트 시스템 구조 (중요)
- **테스트 시나리오 메뉴** = 시나리오/케이스 설계 (레벨 구분 없음, 요구사항 기준)
- **테스트 수행 메뉴** = 실행 관리 (TestPhase에 phaseType: integration/system/acceptance)
- 레벨(unit/integration/system/acceptance)은 수행 회차(TestPhase)에서 구분
- AI 시나리오 생성: 요구사항 기준, 상세도 슬라이더(1~20개) + 프리셋(간략/보통/상세)

## 사이드 패널 (목록 UX)
- 요구사항/기능리스트/Task/테스트 시나리오 목록에서 **행 클릭 → 우측 사이드 패널**
- 패널: `position: fixed right-0 top-0 bottom-0 z-50` (뷰포트 기준, 스크롤 무관)
- 너비: `panelWidthPct` state (기본 50%), ½/¾/⊡ 프리셋 버튼 + 좌측 엣지 드래그 리사이즈
- 패널 내 인라인 편집 → 저장 → 목록 자동 갱신
- "상세 페이지로 이동" 버튼으로 기존 DetailPage 접근 유지

## AI 다중 생성 모달 레이아웃
- `max-w-4xl` 2패널 구조
- 왼쪽(55%): 선택 목록 (검색 + 체크박스)
- 오른쪽: 설정 (상세도/모델/추가정보/버튼)
- Step 3 결과: 왼쪽=결과목록, 오른쪽=선택통계+액션버튼

## 상세 정보
- `SPEC/PROJECT_STATE.md` — 데이터 모델, API
- `SPEC/HANDOFF.md` — 최신 작업 내역 및 인계사항
