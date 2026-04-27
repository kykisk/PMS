# PMS 구현 계획서 (Implementation Plan)

## 1. 기술 스택

### 1.1 Frontend (SPA)

| 영역 | 기술 | 선정 사유 |
|------|------|----------|
| **프레임워크** | React 18 + Vite + TypeScript | 빠른 HMR, 순수 SPA, FE/BE 분리에 적합 |
| **UI 라이브러리** | shadcn/ui + Tailwind CSS | 커스터마이징 용이, 일관된 디자인 시스템 |
| **상태관리** | Zustand (전역) + TanStack Query (서버) | 경량 전역상태 + API 캐싱/동기화 |
| **라우팅** | React Router v6 | SPA 라우팅 표준 |
| **다국어** | react-i18next | 한국어/영어 + 확장 가능 |
| **폼 관리** | React Hook Form + Zod | 타입 안전 폼 검증 |
| **HTTP 클라이언트** | Axios (interceptor) | JWT 자동 첨부, 에러 핸들링 |
| **테스트** | Vitest + Playwright | 단위 + E2E |

### 1.2 Backend (REST API)

| 영역 | 기술 | 선정 사유 |
|------|------|----------|
| **프레임워크** | NestJS + TypeScript | 모듈 구조, DI, 엔터프라이즈 패턴 |
| **Database** | PostgreSQL | 관계형 데이터 + JSON, 추적성 쿼리에 강점 |
| **ORM** | Prisma | 타입 안전 쿼리, 마이그레이션 관리 |
| **인증** | Passport (JWT Strategy) | 이메일+비밀번호, JWT 토큰 기반 |
| **API 문서** | Swagger (OpenAPI) | 자동 API 문서 생성, FE 연동 참조 |
| **AI 통합** | Vercel AI SDK (@ai-sdk) | 멀티 프로바이더 (OpenAI, Anthropic, Gemini, Bedrock) |
| **파일 처리** | xlsx (SheetJS) + markdown-it | 엑셀 파싱/생성, 마크다운 파싱 |
| **PDF 생성** | Puppeteer | HTML → PDF 변환 |
| **검증** | class-validator + class-transformer | 요청 DTO 검증 |
| **테스트** | Jest + Supertest | 단위 + 통합 테스트 |

### 1.3 인프라

| 영역 | 기술 |
|------|------|
| **컨테이너** | Docker + Docker Compose |
| **DB** | PostgreSQL 16 (Docker) |
| **리버스 프록시** | Nginx (정적 파일 서빙 + API 프록시) |

---

## 2. 시스템 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│                     Client (Browser)                      │
│            React SPA (Vite + TypeScript)                   │
│   ┌──────────┐  ┌──────────┐  ┌────────────────────────┐ │
│   │ Pages    │  │Components│  │ TanStack Query + Zustand│ │
│   │ (Router) │  │ (shadcn) │  │ (상태관리 + API 캐싱)   │ │
│   └──────────┘  └──────────┘  └────────────────────────┘ │
│                    react-i18next (다국어)                   │
└──────────────────────┬───────────────────────────────────┘
                       │ REST API (JSON) + JWT
                       │
┌──────────────────────▼───────────────────────────────────┐
│                       Nginx                                │
│         ┌──────────────────┬────────────────┐             │
│         │ /              → │ React 정적 파일  │             │
│         │ /api/*         → │ NestJS Backend  │             │
│         └──────────────────┴────────────────┘             │
└──────────────────────┬───────────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────────┐
│                 NestJS Backend                              │
│                                                            │
│  ┌─── Controller Layer ──────────────────────────────┐    │
│  │ AuthController   │ ProjectController               │    │
│  │ RequirementCtrl  │ FeatureController                │    │
│  │ TaskController   │ TestController                   │    │
│  │ TraceCtrl        │ AIController                     │    │
│  │ AdminController  │ ExportController                 │    │
│  └────────────────────────────┬──────────────────────┘    │
│                               │                            │
│  ┌─── Service Layer ──────────▼──────────────────────┐    │
│  │ AuthService      │ ProjectService                  │    │
│  │ RequirementSvc   │ FeatureService                  │    │
│  │ TaskService      │ TestService                     │    │
│  │ TraceService     │ AIService (LLM Gateway)         │    │
│  │ ExportService    │ FileService                     │    │
│  └────────────────────────────┬──────────────────────┘    │
│                               │                            │
│  ┌─── AI Provider Layer ──────▼──────────────────────┐    │
│  │ OpenAI   │ Anthropic │ Gemini  │ AWS Bedrock       │    │
│  │ (GPT)    │ (Claude)  │         │                   │    │
│  └───────────────────────────────────────────────────┘    │
│                               │                            │
│  ┌────────────────────────────▼──────────────────────┐    │
│  │                    Prisma ORM                      │    │
│  └────────────────────────────┬──────────────────────┘    │
└───────────────────────────────┼────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │     PostgreSQL 16     │
                    └──────────────────────┘
```

---

## 3. 데이터베이스 스키마 (핵심 엔티티)

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Project   │────<│  Requirement    │────<│   Feature   │
│─────────────│     │─────────────────│     │─────────────│
│ id (UUID)   │     │ id (UUID)       │     │ id (UUID)   │
│ name        │     │ projectId (FK)  │     │ reqId (FK)  │
│ description │     │ code (REQ-001)  │     │ projectId   │
│ status      │     │ title           │     │ code        │
│ startDate   │     │ description     │     │ title       │
│ endDate     │     │ category        │     │ description │
│ createdBy   │     │ priority        │     │ screenDesign│
│ createdAt   │     │ status          │     │ (파일 경로)  │
│ updatedAt   │     │ source (excel/  │     │ status      │
└─────────────┘     │  manual/md_ai/  │     │ createdAt   │
                    │  spec_ai)       │     └──────┬──────┘
                    │ note (nullable) │            │
                    │ createdAt       │     ┌──────▼──────┐
                                            │    Task     │
┌─────────────────┐                         │─────────────│
│  TestScenario   │                         │ id (UUID)   │
│─────────────────│                         │ featureId   │
│ id (UUID)       │                         │ projectId   │
│ projectId (FK)  │                         │ code        │
│ reqId (FK)      │                         │ title       │
│ featureId (FK)  │                         │ description │
│ code            │     ┌─────────────┐     │ assigneeId  │
│ title           │────<│  TestCase   │     │ progress (%)│
│ description     │     │─────────────│     │ startDate   │
│ type            │     │ id (UUID)   │     │ endDate     │
│ testData        │     │ scenarioId  │     │ status      │
│ (nullable)      │     │ type (unit/ │     │ createdAt   │
│ status          │     │  integration)│     └──────┬──────┘
│ createdAt       │     │ title       │            │
└─────────────────┘     │ steps (JSON)│     ┌──────▼──────┐
                        │ testData    │     │ TaskIssue   │
                        │ (nullable)  │     │─────────────│
                        │ expected    │     │ id (UUID)   │
                        │ actual      │     │ taskId (FK) │
                        │ result      │     │ type (issue/│
                        │ executedBy  │     │  risk)      │
                        │ executedAt  │     │ title       │
                        │ status      │     │ description │
                        └─────────────┘     │ severity    │
                                            │ status      │
                                            └─────────────┘

┌──────────────────────────────────────────┐
│  TraceabilityLink (추적성 연결 테이블)     │
│──────────────────────────────────────────│
│ id (UUID)                                │
│ sourceType (requirement/feature/task/    │
│             testScenario/testCase)       │
│ sourceId                                 │
│ targetType                               │
│ targetId                                 │
│ linkType (derives/implements/verifies)   │
│ createdAt                                │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│  VersionSnapshot (버전 관리)              │
│──────────────────────────────────────────│
│ id (UUID)                                │
│ projectId (FK)                           │
│ entityType (requirement/feature/task/    │
│             testScenario/testCase)       │
│ version (v1.0, v1.1, v2.0 ...)          │
│ label (버전명/제목)                       │
│ reason (변경 사유)                        │
│ snapshot (JSON - 해당 시점 전체 데이터)    │
│ createdBy (FK → User)                    │
│ createdAt (timestamp)                    │
└──────────────────────────────────────────┘

┌─────────────┐     ┌─────────────────────┐
│    User     │     │  LLMConfig          │
│─────────────│     │─────────────────────│
│ id (UUID)   │     │ id (UUID)           │
│ email       │     │ provider (openai/   │
│ name        │     │  anthropic/gemini/  │
│ role (admin/│     │  bedrock)           │
│  user)      │     │ model               │
│ password    │     │ apiKey (암호화)      │
│ language    │     │ region (bedrock용)   │
│ createdAt   │     │ promptTemplates     │
│ updatedAt   │     │ isActive            │
└─────────────┘     │ createdAt           │
                    │ updatedAt           │
                    └─────────────────────┘

┌──────────────────────────────┐
│  ProjectMember (멤버 배정)    │
│──────────────────────────────│
│ id (UUID)                    │
│ projectId (FK → Project)     │
│ userId (FK → User)           │
│ createdAt                    │
└──────────────────────────────┘
```

---

## 4. API 설계 (REST 엔드포인트)

Base URL: `/api/v1`

### 4.1 인증
```
POST   /auth/login           - 로그인 (JWT 발급)
POST   /auth/register        - 회원가입
POST   /auth/refresh         - 토큰 갱신
GET    /auth/me               - 현재 사용자 정보
```

### 4.2 프로젝트
```
GET    /projects              - 프로젝트 목록
POST   /projects              - 프로젝트 생성
GET    /projects/:id          - 프로젝트 상세
PUT    /projects/:id          - 프로젝트 수정
DELETE /projects/:id          - 프로젝트 삭제
GET    /projects/:id/dashboard - 대시보드 통계
GET    /projects/:id/members   - 멤버 목록
POST   /projects/:id/members   - 멤버 배정 (userId)
DELETE /projects/:id/members/:userId - 멤버 제거
```

### 4.3 요구사항
```
GET    /projects/:id/requirements          - 목록 (필터/정렬/페이징)
POST   /projects/:id/requirements          - 수동 생성
GET    /projects/:id/requirements/:reqId   - 상세
PUT    /projects/:id/requirements/:reqId   - 수정
DELETE /projects/:id/requirements/:reqId   - 삭제
POST   /projects/:id/requirements/import/excel    - 엑셀 Import (정제된 템플릿)
POST   /projects/:id/requirements/import/markdown - 마크다운 AI Import
POST   /projects/:id/requirements/import/spec     - 요구사항 기술서 AI Import (최초)
PUT    /projects/:id/requirements/import/spec     - 요구사항 기술서 재Import (업데이트 diff)
GET    /projects/:id/requirements/template/excel  - 엑셀 템플릿 다운로드 (정제용)
GET    /projects/:id/requirements/template/spec   - 요구사항 기술서 템플릿 다운로드 (기술서용)
GET    /projects/:id/requirements/export          - 내보내기 (Excel/PDF)
```

### 4.4 기능 리스트
```
GET    /projects/:id/features              - 목록
POST   /projects/:id/features              - 생성
GET    /projects/:id/features/:fId         - 상세
PUT    /projects/:id/features/:fId         - 수정
DELETE /projects/:id/features/:fId         - 삭제
POST   /projects/:id/features/:fId/screen  - 화면설계서 업로드
GET    /projects/:id/features/export       - 내보내기
```

### 4.5 Task
```
GET    /projects/:id/tasks                 - 목록
POST   /projects/:id/tasks                 - 생성
GET    /projects/:id/tasks/:tId            - 상세
PUT    /projects/:id/tasks/:tId            - 수정 (진척율, 일정 등)
DELETE /projects/:id/tasks/:tId            - 삭제
POST   /projects/:id/tasks/:tId/issues     - 이슈/리스크 추가
PUT    /projects/:id/tasks/:tId/issues/:iId - 이슈/리스크 수정
DELETE /projects/:id/tasks/:tId/issues/:iId - 이슈/리스크 삭제
GET    /projects/:id/tasks/export/wbs      - WBS 내보내기
```

### 4.6 테스트
```
GET    /projects/:id/test-scenarios               - 시나리오 목록
POST   /projects/:id/test-scenarios               - 시나리오 생성
GET    /projects/:id/test-scenarios/:sId          - 시나리오 상세
PUT    /projects/:id/test-scenarios/:sId          - 시나리오 수정
DELETE /projects/:id/test-scenarios/:sId          - 시나리오 삭제
GET    /projects/:id/test-cases                    - 케이스 목록
POST   /projects/:id/test-cases                    - 케이스 생성
GET    /projects/:id/test-cases/:cId              - 케이스 상세
PUT    /projects/:id/test-cases/:cId              - 케이스 수정
DELETE /projects/:id/test-cases/:cId              - 케이스 삭제
PUT    /projects/:id/test-cases/:cId/execute      - 테스트 결과 기록
GET    /projects/:id/tests/export                  - 테스트 문서 내보내기
```

### 4.7 AI
```
POST   /projects/:id/ai/generate-features         - 요구사항 → 기능 리스트
POST   /projects/:id/ai/generate-tasks             - 기능 → Task 분해
POST   /projects/:id/ai/generate-test-scenarios    - 테스트 시나리오 생성
POST   /projects/:id/ai/parse-spec              - 요구사항 기술서 → 요구사항 정의서 (AI 정제, 최초)
POST   /projects/:id/ai/diff-spec              - 요구사항 기술서 → 변경분 분석 (AI diff, 업데이트)
POST   /projects/:id/ai/parse-markdown             - 마크다운 → 요구사항 추출
POST   /projects/:id/ai/suggest                    - 수동 작성 시 AI 제안
```

### 4.8 추적성
```
GET    /projects/:id/traceability/matrix           - RTM 매트릭스
GET    /projects/:id/traceability/coverage         - 커버리지/갭 분석
GET    /projects/:id/traceability/export           - RTM 내보내기
POST   /projects/:id/traceability/links            - 추적성 링크 생성 (연결)
DELETE /projects/:id/traceability/links/:linkId    - 추적성 링크 삭제 (해제)
```

### 4.9 버전 관리
```
POST   /projects/:id/versions/:entityType            - 버전 저장 (스냅샷 생성)
GET    /projects/:id/versions/:entityType            - 버전 목록 (타임라인)
GET    /projects/:id/versions/:entityType/:versionId - 특정 버전 상세 (스냅샷 조회)
GET    /projects/:id/versions/:entityType/diff       - 두 버전 비교 (?v1=...&v2=...)
POST   /projects/:id/versions/:entityType/restore    - 특정 버전으로 복원
```

### 4.10 관리자 (Admin only)
```
GET    /admin/llm                    - LLM 설정 목록
POST   /admin/llm                    - LLM 설정 추가
PUT    /admin/llm/:id                - LLM 설정 수정
DELETE /admin/llm/:id                - LLM 설정 삭제
GET    /admin/users                  - 사용자 목록
POST   /admin/users                  - 사용자 생성
PUT    /admin/users/:id              - 사용자 수정 (역할 변경 등)
DELETE /admin/users/:id              - 사용자 삭제
GET    /admin/templates              - 산출물 템플릿 목록
PUT    /admin/templates/:id          - 템플릿 수정
```

---

## 5. 단계별 구현 계획

> **실행 원칙**: 모든 Phase는 Step 단위로 분리. 각 Step 완료 시 사용자 확인 후 다음 진행.

---

### Phase 1: 기반 구축 + 요구사항 관리 (4주)

> **목표**: FE/BE 분리 구조 구축, 인증, 프로젝트/요구사항 관리

#### Step 1-1: 인프라 + 인증 (1주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 1-1-1 | Backend 초기화 (NestJS + Prisma + PostgreSQL + Docker) | 2일 | - |
| 1-1-2 | Frontend 초기화 (React + Vite + shadcn/ui + Tailwind) | 2일 | - |
| 1-1-3 | Docker Compose 구성 (FE + BE + DB + Nginx) | 1일 | 1-1-1, 1-1-2 |
| 1-1-4 | DB 스키마 설계 (User, Project, Requirement, VersionSnapshot) | 1일 | 1-1-1 |
| 1-1-5 | 인증 API (Passport JWT, 로그인/회원가입/토큰갱신) | 2일 | 1-1-4 |
| 1-1-6 | 인증 UI (로그인/회원가입 페이지) | 2일 | 1-1-2, 1-1-5 |
| 1-1-7 | 다국어(i18n) 기반 설정 (react-i18next, ko/en) | 1일 | 1-1-2 |
| 1-1-8 | 공통 레이아웃/네비게이션 (사이드바, 헤더, 언어 전환) | 2일 | 1-1-6, 1-1-7 |

**확인 포인트**: Docker Compose로 띄워서 로그인/회원가입 동작, 한국어/영어 전환, Swagger 확인
- [ ] `docker compose up` → FE+BE+DB+Nginx 실행
- [ ] 로그인/회원가입 화면 동작
- [ ] JWT 토큰 발급/갱신
- [ ] 사이드바+헤더 레이아웃 표시
- [ ] 한국어/영어 전환
- [ ] Swagger API 문서 접근

#### Step 1-2: 프로젝트 + 요구사항 CRUD (1.5주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 1-2-1 | 프로젝트 CRUD API | 2일 | Step 1-1 |
| 1-2-2 | 프로젝트 CRUD UI (목록, 생성, 수정, 삭제) + 멤버 배정/제거 | 2일 | 1-2-1 |
| 1-2-3 | 요구사항 CRUD API (상태/우선순위/분류 포함) | 2일 | 1-2-1 |
| 1-2-4 | 요구사항 CRUD UI (목록, 생성, 상세 — 섹션 레이아웃) | 3일 | 1-2-2, 1-2-3 |

**확인 포인트**: 프로젝트 만들고 요구사항 수동 생성/수정/삭제 동작
- [ ] 프로젝트 생성 → 목록에 표시
- [ ] 프로젝트 멤버 배정/제거 동작
- [ ] 프로젝트 선택 → 요구사항 목록 화면
- [ ] 요구사항 수동 생성/수정/삭제
- [ ] 요구사항 상세 화면 (섹션 레이아웃) 표시
- [ ] 상태/우선순위/분류 필터 동작

#### Step 1-3: 엑셀 Import + 버전 관리 + 대시보드 (1.5주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 1-3-1 | 버전 관리 공통 모듈 API (저장/목록/비교/복원) | 2일 | Step 1-2 |
| 1-3-2 | 버전 관리 UI (요구사항 상세 내 버전 섹션) | 1일 | 1-3-1 |
| 1-3-3 | 엑셀 템플릿 다운로드 + Import API (xlsx 파싱) | 2일 | Step 1-2 |
| 1-3-4 | 엑셀 Import UI (업로드 → 미리보기 → 확정) | 2일 | 1-3-3 |
| 1-3-5 | 프로젝트 대시보드 (기본 통계) | 1일 | Step 1-2 |

**확인 포인트**: 엑셀 Import → 요구사항 생성 → 버전 저장 → 전체 흐름 동작
- [ ] 엑셀 템플릿 다운로드 → 작성 → 업로드 → 미리보기 → 요구사항 생성
- [ ] 버전 저장 → 버전 목록 표시
- [ ] 두 버전 비교 (diff 뷰)
- [ ] 특정 버전 복원
- [ ] 대시보드 기본 통계 표시

---

### Phase 2: 기능 리스트 + Task 관리 (3주)

> **목표**: 요구사항으로부터 기능/Task 관리 + 추적성 연결

#### Step 2-1: 기능 리스트 CRUD + 매핑 (1주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 2-1-1 | DB 스키마 확장 (Feature, Task, TaskIssue, TraceabilityLink) | 1일 | Phase 1 |
| 2-1-2 | 기능 리스트 CRUD API | 2일 | 2-1-1 |
| 2-1-3 | 기능 리스트 CRUD UI (목록, 상세 — 섹션 레이아웃) | 3일 | 2-1-2 |
| 2-1-4 | 요구사항 ↔ 기능 매핑 API + UI (연결/해제) | 2일 | 2-1-3 |
| 2-1-5 | 화면설계서 파일 업로드 API + UI (기능 단위) | 2일 | 2-1-3 |

**확인 포인트**: 요구사항에서 기능 생성/연결, 화면설계서 첨부, 객체 링크 확인
- [ ] 기능 리스트 CRUD 동작
- [ ] 요구사항 상세 → 연결 항목 섹션에 기능 표시
- [ ] 기능 상세 → 상위 요구사항 링크 표시
- [ ] 화면설계서 파일 첨부/조회

#### Step 2-2: Task CRUD + 이슈/리스크 (1주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 2-2-1 | Task CRUD API | 2일 | Step 2-1 |
| 2-2-2 | Task CRUD UI (목록 테이블, 상세 — 섹션 레이아웃) | 3일 | 2-2-1 |
| 2-2-3 | Task 진척율/일정/상태 관리 UI | 2일 | 2-2-2 |
| 2-2-4 | Task 이슈/리스크 CRUD API + UI (상세 내 섹션) | 2일 | 2-2-2 |
| 2-2-5 | Task 담당자 배정 API + UI | 1일 | 2-2-2 |

**확인 포인트**: Task 생성/관리, 이슈/리스크 첨부, 진척율 동작
- [ ] Task 생성/수정/삭제
- [ ] 진척율 슬라이더 동작
- [ ] 이슈/리스크 추가/수정/삭제
- [ ] 담당자 배정

#### Step 2-3: 추적성 연결 + 대시보드 (1주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 2-3-1 | 기능 ↔ Task 매핑 API + UI | 1일 | Step 2-2 |
| 2-3-2 | 요구사항 상세 → 경유 Task 펼쳐서 표시 | 2일 | 2-3-1 |
| 2-3-3 | Task 상세 → 원본 요구사항 자동 추적 표시 | 1일 | 2-3-1 |
| 2-3-4 | 기능/Task 버전 관리 연동 | 1일 | Step 2-2 |
| 2-3-5 | 프로젝트 대시보드 확장 (진행현황, 일정, 리스크 집계) | 2일 | 2-3-1 |

**확인 포인트**: 요구사항→기능→Task 전체 추적 체인, 객체 링크 양방향 동작
- [ ] 요구사항 상세 → 기능 + 경유 Task 트리 표시
- [ ] Task 상세 → 상위 기능 + 원본 요구사항 표시
- [ ] 기능/Task 버전 저장 동작
- [ ] 대시보드 진행현황/일정/리스크 집계

---

### Phase 3: 테스트 관리 + 추적성 매트릭스 (3주)

> **목표**: 테스트 시나리오/케이스 관리 + RTM 시각화

#### Step 3-1: 테스트 시나리오 + 케이스 (1.5주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 3-1-1 | DB 스키마 확장 (TestScenario, TestCase) | 1일 | Phase 2 |
| 3-1-2 | 테스트 시나리오 CRUD API | 2일 | 3-1-1 |
| 3-1-3 | 테스트 시나리오 CRUD UI (상세 내 케이스 섹션 포함) | 3일 | 3-1-2 |
| 3-1-4 | 테스트 케이스 CRUD API (단위/통합, 테스트 데이터 포함) | 2일 | 3-1-2 |
| 3-1-5 | 테스트 케이스 CRUD UI + 수행 결과 기록 | 3일 | 3-1-4 |

**확인 포인트**: 테스트 시나리오/케이스 생성, 수행 결과 기록 동작
- [ ] 테스트 시나리오 CRUD
- [ ] 시나리오 상세 → 하위 테스트 케이스 목록 표시
- [ ] 테스트 케이스 생성 (테스트 데이터 선택 입력)
- [ ] 수행 결과 기록 (Pass/Fail/미수행)

#### Step 3-2: 추적성 매핑 + RTM (1.5주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 3-2-1 | 요구사항/기능 ↔ 테스트 시나리오 매핑 API + UI | 2일 | Step 3-1 |
| 3-2-2 | 테스트 시나리오 상세 → 원본 요구사항 자동 추적 표시 | 1일 | 3-2-1 |
| 3-2-3 | 추적성 매트릭스(RTM) API | 2일 | 3-2-1 |
| 3-2-4 | 추적성 매트릭스(RTM) UI (매트릭스 뷰 + 갭 하이라이트) | 3일 | 3-2-3 |
| 3-2-5 | 커버리지/갭 분석 UI (커버리지 요약 바) | 2일 | 3-2-4 |
| 3-2-6 | 테스트 시나리오/결과 버전 관리 연동 | 1일 | Step 3-1 |

**확인 포인트**: 전체 추적 체인 완성, RTM 매트릭스에서 갭 확인
- [ ] 요구사항 → 테스트 시나리오 직접 연결 동작
- [ ] 기능 → 테스트 시나리오 연결 동작
- [ ] RTM 매트릭스 화면 표시 (rowspan 병합)
- [ ] 갭 하이라이트 (⚠️) 표시
- [ ] 커버리지 요약 퍼센트 바

---

### Phase 4: AI 통합 (3주)

> **목표**: 멀티 LLM 프로바이더 기반 자동 생성 + AI 보조

#### Step 4-1: AI 기반 + 관리자 설정 (1주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 4-1-1 | AI Service 기반 구축 (Vercel AI SDK + Provider Adapter) | 2일 | Phase 3 |
| 4-1-2 | LLM Provider 연결 (OpenAI, Anthropic, Gemini, Bedrock) | 3일 | 4-1-1 |
| 4-1-3 | 관리자 LLM 설정 API + UI (프로바이더별 Key/모델/활성화) | 2일 | 4-1-2 |
| 4-1-4 | 프롬프트 템플릿 관리 API + UI (관리자 커스터마이징) | 2일 | 4-1-3 |
| 4-1-5 | LLM 미설정 시 AI 버튼 비활성화 + 툴팁 처리 | 1일 | 4-1-3 |

**확인 포인트**: 관리자 페이지에서 LLM 설정/테스트, AI 버튼 활성화/비활성화 동작
- [ ] 관리자 LLM 설정 화면 (4개 프로바이더)
- [ ] API Key 입력 → 연결 테스트
- [ ] 프롬프트 템플릿 조회/수정
- [ ] LLM 미설정 시 AI 버튼 비활성화 + 툴팁

#### Step 4-2: 요구사항 AI Import (1주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 4-2-1 | 요구사항 기술서 → 요구사항 정의서 AI 정제 (최초 Import) | 3일 | Step 4-1 |
| 4-2-2 | 요구사항 기술서 업데이트 Import (AI diff + 변경분 미리보기 + 선택 반영) | 3일 | 4-2-1 |
| 4-2-3 | 마크다운 → 요구사항 AI 자동 추출 | 2일 | Step 4-1 |
| 4-2-4 | AI 에러 처리 (파싱 실패 → 원본 표시, 토큰 초과 → 안내) | 1일 | 4-2-1 |

**확인 포인트**: 기술서/마크다운 Import → AI 정제 → 미리보기 → 확정 전체 흐름
- [ ] 기술서 엑셀 업로드 → AI 정제 → 미리보기 → 확정
- [ ] 기술서 재업로드 → diff 분석 → 신규/변경/삭제 표시 → 선택 반영
- [ ] 마크다운 업로드 → AI 추출 → 미리보기 → 확정
- [ ] 에러 시 원본 텍스트 표시 / 토큰 초과 안내

#### Step 4-3: 기능/Task/테스트 AI 생성 + 보조 (1주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 4-3-1 | 요구사항 → 기능 리스트 AI 자동생성 API + UI | 3일 | Step 4-1 |
| 4-3-2 | 기능 → Task AI 자동분해 API + UI | 2일 | Step 4-1 |
| 4-3-3 | 요구사항+기능 → 테스트 시나리오 AI 자동생성 API + UI | 3일 | Step 4-1 |
| 4-3-4 | 수동 작성 시 AI 보조 (인라인 제안/자동완성) | 3일 | Step 4-1 |

**확인 포인트**: 각 AI 자동생성 → 미리보기 → 확정, 인라인 AI 보조 동작
- [ ] 요구사항 → "AI 기능생성" → 미리보기 → 확정
- [ ] 기능 → "AI Task생성" → 미리보기 → 확정
- [ ] "AI 테스트생성" → 미리보기 → 확정
- [ ] 수동 입력 중 AI 제안 표시

---

### Phase 5: 산출물 내보내기 (2주)

> **목표**: 6종 산출물 Excel/PDF 내보내기 + 템플릿 관리

#### Step 5-1: Export 엔진 + 핵심 산출물 (1주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 5-1-1 | Export Service 기반 구축 (Excel/PDF 엔진) | 2일 | Phase 4 |
| 5-1-2 | 요구사항 정의서 내보내기 (Excel/PDF) | 2일 | 5-1-1 |
| 5-1-3 | WBS 내보내기 (Excel/PDF) | 2일 | 5-1-1 |
| 5-1-4 | 요구사항 추적표(RTM) 내보내기 (Excel/PDF) | 2일 | 5-1-1 |

**확인 포인트**: 핵심 산출물 3종 다운로드 확인
- [ ] 요구사항 정의서 Excel/PDF 다운로드
- [ ] WBS Excel/PDF 다운로드
- [ ] RTM Excel/PDF 다운로드

#### Step 5-2: 나머지 산출물 + 템플릿 관리 (1주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 5-2-1 | 테스트 계획서 내보내기 (Excel/PDF) | 2일 | Step 5-1 |
| 5-2-2 | 테스트 케이스 문서 내보내기 (Excel/PDF) | 1일 | Step 5-1 |
| 5-2-3 | 화면설계서 내보내기 (PDF) | 1일 | Step 5-1 |
| 5-2-4 | 관리자 산출물 템플릿 커스터마이징 API + UI | 2일 | Step 5-1 |

**확인 포인트**: 전체 6종 다운로드 + 템플릿 커스터마이징
- [ ] 테스트 계획서/케이스 Excel/PDF 다운로드
- [ ] 화면설계서 PDF 다운로드
- [ ] 관리자 템플릿 수정 → 내보내기에 반영

---

### Phase 6: 마무리 + 품질 (2주)

> **목표**: 권한 강화, UI 개선, 테스트, 배포 최종화

#### Step 6-1: 권한 + UI 개선 (1주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 6-1-1 | 권한 관리 강화 (Admin Guard, 역할별 접근제어) | 2일 | Phase 5 |
| 6-1-2 | 프로젝트 대시보드 최종 완성 | 2일 | Phase 5 |
| 6-1-3 | 전체 UI/UX 리뷰 및 개선 | 3일 | Phase 5 |

**확인 포인트**: 권한 동작 + UI 최종 확인
- [ ] Admin/User 역할별 메뉴/기능 접근제어
- [ ] 대시보드 전체 위젯 동작
- [ ] UI 전반 깔끔한지 확인

#### Step 6-2: 테스트 + 배포 (1주)

| # | 작업 | 예상 공수 | 의존성 |
|---|------|----------|--------|
| 6-2-1 | Backend 단위/통합 테스트 (Jest) | 2일 | Step 6-1 |
| 6-2-2 | E2E 테스트 (Playwright) | 2일 | Step 6-1 |
| 6-2-3 | 성능 최적화 (페이징, 쿼리, 번들) | 1일 | Step 6-1 |
| 6-2-4 | Docker 프로덕션 빌드 최종화 | 1일 | 6-2-1 |

**확인 포인트**: 테스트 통과 + 프로덕션 배포 준비 완료
- [ ] Backend 테스트 통과
- [ ] E2E 전체 시나리오 통과
- [ ] Docker Compose 프로덕션 빌드 실행

---

## 6. 전체 일정 요약

```
Phase 1 (4주)
  Step 1-1: 인프라+인증        ████░░░░░░░░  1주    → 확인 ✅
  Step 1-2: 프로젝트+요구사항   ░░░█████░░░░  1.5주  → 확인 ✅
  Step 1-3: 엑셀+버전+대시보드  ░░░░░░██████  1.5주  → 확인 ✅

Phase 2 (3주)
  Step 2-1: 기능 CRUD+매핑      ████░░░░░░░  1주    → 확인 ✅
  Step 2-2: Task CRUD+이슈      ░░░████░░░░  1주    → 확인 ✅
  Step 2-3: 추적성+대시보드     ░░░░░░█████  1주    → 확인 ✅

Phase 3 (3주)
  Step 3-1: 테스트 시나리오+케이스  ███████░░░  1.5주  → 확인 ✅
  Step 3-2: 추적성 매핑+RTM       ░░░░░░████  1.5주  → 확인 ✅

Phase 4 (3주)
  Step 4-1: AI 기반+관리자설정  ████░░░░░░░  1주    → 확인 ✅
  Step 4-2: 요구사항 AI Import  ░░░████░░░░  1주    → 확인 ✅
  Step 4-3: 기능/Task/테스트 AI ░░░░░░█████  1주    → 확인 ✅

Phase 5 (2주)
  Step 5-1: Export 엔진+핵심3종  █████░░░░░  1주    → 확인 ✅
  Step 5-2: 나머지+템플릿 관리   ░░░░░█████  1주    → 확인 ✅

Phase 6 (2주)
  Step 6-1: 권한+UI 개선        █████░░░░░  1주    → 확인 ✅
  Step 6-2: 테스트+배포         ░░░░░█████  1주    → 확인 ✅

───────────────────────────────────────────────────────────
총 약 17주 / 16 Steps / Step마다 사용자 확인
```

---

## 7. AI 통합 상세 계획

### 7.1 LLM Gateway 구조
```
AIService (NestJS)
  ├── LLM Provider Adapter (Vercel AI SDK @ai-sdk)
  │     ├── @ai-sdk/openai      → GPT-4o, GPT-4o-mini
  │     ├── @ai-sdk/anthropic   → Claude 3.5 Sonnet, Claude 3 Haiku
  │     ├── @ai-sdk/google      → Gemini 1.5 Pro, Gemini 1.5 Flash
  │     └── @ai-sdk/amazon-bedrock → Bedrock 모델들
  ├── Prompt Template Engine
  │     ├── 요구사항 기술서 → 요구사항 정의서 정제 프롬프트
  │     ├── 요구사항 기술서 업데이트 diff 분석 프롬프트
  │     ├── 마크다운 → 요구사항 추출 프롬프트
  │     ├── 요구사항 → 기능 생성 프롬프트
  │     ├── 기능 → Task 분해 프롬프트
  │     ├── 테스트 시나리오 생성 프롬프트
  │     └── 인라인 보조 프롬프트
  └── Response Parser
        └── Structured Output (JSON) 파싱
```

### 7.2 프롬프트 전략
- **구조화된 출력**: Zod 스키마 기반 JSON 응답 강제 → 파싱 안정성
- **컨텍스트 주입**: 프로젝트 정보 + 기존 데이터를 프롬프트에 포함
- **관리자 커스터마이징**: 기본 프롬프트 제공 + 관리자가 도메인별 수정 가능
- **스트리밍**: 긴 생성 작업 시 실시간 스트리밍 표시

---

## 8. 산출물 내보내기 상세 계획

### 8.1 Excel 내보내기
- **라이브러리**: xlsx (SheetJS)
- **방식**: BE에서 데이터 조회 → 워크시트 생성 → .xlsx 파일 응답
- **템플릿**: 관리자가 컬럼 순서, 헤더명, 시트 구성 설정 가능

### 8.2 PDF 내보내기
- **라이브러리**: Puppeteer (Headless Chrome)
- **방식**: HTML 템플릿 렌더링 → PDF 변환 → 파일 응답
- **템플릿**: 관리자가 로고, 헤더/푸터, 스타일 설정 가능

---

## 9. 프로젝트 디렉토리 구조

```
PMS/
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
│
├── frontend/                          # React SPA
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── public/
│   │   └── locales/                   # i18n 번역 파일
│   │       ├── ko/
│   │       │   └── translation.json
│   │       └── en/
│   │           └── translation.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── routes/                    # 페이지 라우팅
│       │   ├── auth/
│       │   │   ├── LoginPage.tsx
│       │   │   └── RegisterPage.tsx
│       │   ├── projects/
│       │   │   ├── ProjectListPage.tsx
│       │   │   ├── ProjectDashboard.tsx
│       │   │   ├── requirements/
│       │   │   ├── features/
│       │   │   ├── tasks/
│       │   │   ├── tests/
│       │   │   └── traceability/
│       │   └── admin/
│       │       ├── LLMSettingsPage.tsx
│       │       ├── UserManagePage.tsx
│       │       └── TemplateManagePage.tsx
│       ├── components/                # 공통 UI 컴포넌트
│       │   ├── ui/                    # shadcn/ui
│       │   ├── layout/               # 레이아웃 (사이드바, 헤더)
│       │   └── shared/               # 공용 컴포넌트
│       ├── hooks/                     # 커스텀 훅
│       ├── api/                       # API 호출 함수 (Axios)
│       ├── stores/                    # Zustand 스토어
│       ├── lib/                       # 유틸리티
│       ├── i18n/                      # i18n 설정
│       └── types/                     # 타입 정의
│
├── backend/                           # NestJS API
│   ├── Dockerfile
│   ├── package.json
│   ├── nest-cli.json
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts                    # 초기 Admin 계정 시드
│   ├── test/                          # 테스트
│   │   ├── unit/
│   │   └── e2e/
│   └── src/
│       ├── main.ts
│       ├── app.module.ts
│       ├── common/                    # 공통 (Guard, Filter, Decorator)
│       │   ├── guards/
│       │   │   ├── jwt-auth.guard.ts
│       │   │   └── admin.guard.ts
│       │   ├── filters/
│       │   ├── decorators/
│       │   └── interceptors/
│       ├── auth/                      # 인증 모듈
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   └── strategies/
│       │       └── jwt.strategy.ts
│       ├── project/                   # 프로젝트 모듈
│       │   ├── project.module.ts
│       │   ├── project.controller.ts
│       │   └── project.service.ts
│       ├── requirement/               # 요구사항 모듈
│       │   ├── requirement.module.ts
│       │   ├── requirement.controller.ts
│       │   ├── requirement.service.ts
│       │   └── dto/
│       ├── feature/                   # 기능 모듈
│       ├── task/                      # Task 모듈
│       ├── test-management/           # 테스트 모듈
│       ├── traceability/              # 추적성 모듈
│       ├── version/                    # 버전 관리 모듈
│       │   ├── version.module.ts
│       │   ├── version.controller.ts
│       │   └── version.service.ts
│       ├── ai/                        # AI 모듈
│       │   ├── ai.module.ts
│       │   ├── ai.controller.ts
│       │   ├── ai.service.ts
│       │   └── providers/
│       │       ├── openai.provider.ts
│       │       ├── anthropic.provider.ts
│       │       ├── gemini.provider.ts
│       │       └── bedrock.provider.ts
│       ├── export/                    # 산출물 내보내기 모듈
│       │   ├── export.module.ts
│       │   ├── export.controller.ts
│       │   ├── export.service.ts
│       │   └── templates/
│       └── admin/                     # 관리자 모듈
│
├── SPEC/
│   ├── SPEC.md
│   └── PLAN.md
│
└── tests/                             # E2E (Playwright)
    └── e2e/
```
