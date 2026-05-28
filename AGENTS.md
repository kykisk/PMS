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
├── SPEC/HANDOFF.md              ← 최신 작업 인계사항
├── SPEC/TEST_EXECUTION_PLAN.md  ← 테스트 수행 시스템 계획
├── backend/src/
│   ├── test-management/         ← 시나리오/케이스 설계
│   ├── test-execution/          ← 테스트 수행 (Phase/Round/Result)
│   ├── ai/                      ← AI 생성 엔드포인트
│   └── ...
├── frontend/src/
│   ├── routes/projects/tests/        ← 테스트 시나리오 메뉴
│   ├── routes/projects/test-execution/ ← 테스트 수행 메뉴
│   ├── routes/projects/settings/     ← 프로젝트 설정 (AI 모델 매핑 포함)
│   └── components/shared/            ← AI모달, 공용 컴포넌트
└── restart-all/be/fe.sh
```

## 실행
```bash
pkill -f "node dist/src/main" 2>/dev/null
fuser -k 3000/tcp 2>/dev/null; sleep 2
cd backend && DATABASE_URL="postgresql://pms_user:pms_password@localhost:5432/pms_db" \
  JWT_SECRET="pms-jwt-secret-change-in-production" JWT_EXPIRES_IN="7d" PORT=3000 \
  node dist/src/main.js &
pkill -f "vite" 2>/dev/null; sleep 1
cd frontend && npx vite preview &
```

## 계정 / AI 모델
- admin@pms.com / Admin1234!
- AI 모델: us.anthropic.claude-opus-4-6-v1 (Bedrock)

## 핵심 규칙
- Tailwind v4, 액센트 #5E6AD2, text-xs 컴팩트 UI
- BE ValidationPipe: whitelist + forbidNonWhitelisted → AI 모달 저장 시 **필요 필드만 명시적 추출** 필수
- AI parseJSON: `"A".repeat(N)` JS 표현식 치환 처리
- 코드 자동채번: 문자열 정렬 버그 → 전체 조회 후 숫자 max 계산
- Export 인증: `window.open()` 금지 → `fetch() + Authorization` + Blob 다운로드 (`export.api.ts`의 `fetchExcel()` 사용)
- 목록: 그룹핑 페이지(테스트/기능) = useQuery(limit:2000), Task = useInfiniteQuery

## 주요 기능
1. 마크다운 AI분석 → 요구사항/UseCase/UserStory 추출
2. 요구사항 → AI → 기능리스트 (확정 건만)
3. 기능리스트 → AI → Task
4. **요구사항** → AI → 테스트 시나리오 (기능리스트+Task 컨텍스트 포함)
5. 테스트 시나리오 → AI → 케이스 (상세도 조절 1~20개)
6. 상위 변경 → outdated 전파 → AI 업데이트 제안
7. 결함 관리 (7단계 상태전이)
8. **테스트 수행**: Excel Template 다운로드 → 결과 작성 → Import → 회차 자동 생성
9. **AI 결함 자동 생성**: 테스트 수행 Fail/Blocked → AI → 결함 일괄 등록 + TestRoundResult.defectId 연결
10. Gantt 차트 (접기/펼치기, Dependency FS/FF/SS/SF, 드래그 스크롤, 헤더 고정)
11. 추적성(RTM) 관리

## 테스트 시스템 (중요)
- **테스트 시나리오 메뉴** = 시나리오/케이스 설계 + AI 생성 (수행 기능 없음)
- **테스트 수행 메뉴** = Excel Import 중심 실행 관리
  - Template 다운로드 → Excel 작성 → Import → 수행 회차 자동 생성
  - 수동 회차 추가 없음 (Import가 자동 생성)
  - 회차 클릭 → 결과 조회/수정 가능
  - TestPhase.phaseType: integration/system/acceptance
  - **Fail/Blocked 결과 존재 시 [🤖 AI 결함 생성] 버튼 노출** → AIDefectGenerateModal
- AI 시나리오 생성: 요구사항 기준, **연결된 기능리스트+Task 컨텍스트 포함**

## AI 기능별 모델 매핑
- **DB**: `ProjectAiModelMapping` (projectId + featureKey → llmConfigId)
- **설정 위치**: 프로젝트 설정 → "AI 모델 설정" 탭
- **우선순위**: featureKey 매핑 → 수동 modelId → 개인 기본 → 공용
- **featureKey 목록**:
  - `parse-spec` — SPEC 파싱 (추천: Sonnet)
  - `generate-features` — 기능리스트 생성 (추천: Sonnet)
  - `generate-tasks` — Task 생성 (추천: Haiku)
  - `generate-test-scenarios` — 테스트 시나리오 생성 (추천: Opus)
  - `generate-test-cases` — 테스트 케이스 생성 (추천: Sonnet)
  - `classify-defect` — 결함 분류 제안 (추천: Haiku)
  - `generate-defects` — 결함 자동 생성 (추천: Sonnet)
- **API**: `GET/PUT /projects/:pid/ai/model-mappings`

## 사이드 패널 (목록 UX)
- 요구사항/기능/Task/테스트 목록 행 클릭 → `position: fixed` 우측 패널
- 너비: 기본 50%, ½/¾/⊡ 프리셋 + 좌측 엣지 드래그 리사이즈
- 인라인 편집 + "상세 페이지로 이동" 버튼

## AI 다중 생성 모달
- `max-w-4xl` 좌우 2패널 구조 (왼쪽: 선택, 오른쪽: 설정+버튼)
- Step 3 결과: 왼쪽=결과목록, 오른쪽=통계+저장버튼

## Gantt 차트
- 라이브러리: `gantt-task-react`
- 컴포넌트: `frontend/src/components/shared/GanttView.tsx`
- 그룹 접기/펼치기, Dependency (FS/FF/SS/SF), 슬라이드 패널 인라인 편집
- **드래그 가로 스크롤**: 빈 공간 mousedown → document mousemove → `_CZjuD.scrollLeft` 직접 조작
  - task 바(`_KxSXS`, `_1KJ6x`, `.handleGroup`) 위에서는 드래그 스크롤 비활성
  - `_2k9Ys` (HorizontalScroll) scrollLeft 동기화로 라이브러리 상태 연동
- **헤더 틀고정**: `ganttHeight` prop 사용 → 캘린더 SVG 상단 고정, `_2B2zv`만 세로 스크롤
  - 높이: `window.innerHeight - 280` 동적 계산

## 사용 포트
| 포트 | 용도 |
|------|------|
| 3000 | PMS Backend (NestJS) |
| 4173 | PMS Frontend (Vite Preview) |
| 5432 | PostgreSQL (pms_db_dev container) |

## 상세 정보
- `SPEC/HANDOFF.md` — 최신 세션 작업 내역
