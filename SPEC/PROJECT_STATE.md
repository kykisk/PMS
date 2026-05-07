# PMS (Project Management System) — 프로젝트 전체 상태 문서

> 이 문서는 AI가 프로젝트를 처음부터 재구축하거나, 이어서 작업할 때 읽고 이해할 수 있도록 작성된 기술 문서입니다.

---

## 1. 프로젝트 개요

**프로젝트명**: PMS (Project Management System)
**목적**: SI/SW 프로젝트에서 요구사항 → 설계 → 개발 → 테스트까지 전 과정의 산출물을 AI와 연계하여 자동으로 관리하는 웹 애플리케이션

**핵심 가치**:
- 마크다운 SPEC 문서 1개로 요구사항/유스케이스/사용자스토리를 AI가 자동 추출
- 추출된 요구사항에서 기능 → 설계(DB/API) → Task → 테스트까지 AI 자동생성
- 전 단계간 양방향 추적성(RTM) 매트릭스 자동 관리
- Excel/PDF 산출물 자동 내보내기

---

## 2. 기술 스택

| 레이어 | 기술 | 버전 |
|--------|------|------|
| **Backend** | NestJS + TypeScript | 11 |
| **ORM** | Prisma | 5.22 |
| **Database** | PostgreSQL | 16 |
| **Frontend** | React + TypeScript | 18 |
| **빌드** | Vite | 8 |
| **CSS** | Tailwind CSS | v4 |
| **UI 컴포넌트** | shadcn/ui | - |
| **상태관리** | Zustand (auth) + TanStack Query (server) | v5 |
| **AI** | Vercel AI SDK (@ai-sdk/openai, anthropic, google, amazon-bedrock) | - |
| **인증** | JWT (Access + Refresh Token) | - |
| **테스트 BE** | Jest | 30 |
| **테스트 E2E** | Playwright | - |
| **차트** | gantt-task-react (Gantt Chart) | - |
| **Excel** | xlsx (SheetJS) | - |
| **PDF** | jspdf + jspdf-autotable (dynamic import) | - |
| **인프라** | Docker + Docker Compose + Nginx | - |
| **서버** | AWS EC2 (RHEL 9) | - |

---

## 3. 디렉토리 구조

```
PMS/
├── docker-compose.yml          # 프로덕션 Docker 구성
├── docker-compose.dev.yml      # 개발용 Docker (DB만)
├── SPEC/                       # 프로젝트 명세 문서
│   ├── SPEC.md                 # 원본 기능 명세
│   ├── PLAN.md                 # 구현 계획
│   ├── HANDOFF.md              # 세션 이어가기 문서
│   ├── UIUX.md                 # UI/UX 디자인 가이드
│   └── PROJECT_STATE.md        # ★ 이 파일
├── ref/                        # 레퍼런스 이미지
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # DB 스키마 (전체 모델 정의)
│   │   ├── migrations/         # 마이그레이션 SQL
│   │   └── seed.ts             # 시드 데이터 (admin + export templates)
│   ├── src/
│   │   ├── main.ts             # 엔트리포인트 (CORS, ValidationPipe, Static Assets)
│   │   ├── app.module.ts       # 루트 모듈
│   │   ├── auth/               # 인증 (login, register, me, profile, password, personal LLM)
│   │   ├── project/            # 프로젝트 CRUD + 대시보드 + 멤버 + 설정
│   │   ├── requirement/        # 요구사항 CRUD + 엑셀 Import + 페이지네이션
│   │   ├── feature/            # 기능 CRUD + 화면설계서 이미지 업로드
│   │   ├── task/               # Task CRUD + 이슈/리스크
│   │   ├── test-management/    # 테스트 시나리오/케이스 CRUD + 수행결과
│   │   ├── traceability/       # RTM 매트릭스 + 커버리지 분석
│   │   ├── version/            # 버전 스냅샷
│   │   ├── ai/                 # AI Service (5개 프로바이더 + 모든 AI 생성 메서드)
│   │   ├── admin/              # 관리자 (LLM설정 + 사용자관리 + 템플릿 + LLM권한)
│   │   ├── export/             # 산출물 Excel 내보내기 (6종)
│   │   ├── design/             # 설계 (DB테이블/API명세 CRUD + AI 생성)
│   │   ├── change-request/     # 변경요청 CRUD + 영향분석
│   │   ├── usecase/            # Use Case / User Story CRUD
│   │   ├── common/             # Guards, Decorators, Filters
│   │   └── prisma/             # PrismaService (Global)
│   ├── test/                   # E2E 테스트 설정
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx            # React 엔트리
│   │   ├── App.tsx             # 라우팅 (Lazy import + PrivateRoute)
│   │   ├── index.css           # 글로벌 CSS (Pretendard + Inter 폰트, 카드 그림자 등)
│   │   ├── api/                # API 클라이언트 (auth, project, requirement, feature, task, test, admin, export, design, usecase, change-request)
│   │   ├── stores/             # Zustand auth store (pms-auth persist key)
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui (Button, Input, Label)
│   │   │   ├── layout/         # AppLayout (사이드바 + 상단바 통합 + 프로필)
│   │   │   └── shared/         # 공용 컴포넌트 (Modal, Badge, Pagination, EmptyState, Skeleton, AIProgressBar, AIGenerateModal, MarkdownImportModal, SpecImportModal, ExcelImportModal, ScreenDesignSection, GanttView, AISuggestButton, TraceIndicator, AncestorTags, RequirementPickerModal)
│   │   ├── routes/
│   │   │   ├── auth/           # Login, Register
│   │   │   ├── admin/          # AdminPage (LLM설정, 사용자관리, 산출물템플릿, LLM권한)
│   │   │   └── projects/       # 모든 프로젝트 하위 페이지
│   │   │       ├── ProjectListPage.tsx
│   │   │       ├── dashboard/
│   │   │       ├── settings/       # ★ 프로젝트 개요 (정보 + 멤버관리)
│   │   │       ├── requirements/
│   │   │       ├── features/
│   │   │       ├── design/
│   │   │       ├── tasks/
│   │   │       ├── tests/
│   │   │       ├── traceability/
│   │   │       ├── use-cases/
│   │   │       ├── user-stories/
│   │   │       └── change-requests/
│   │   ├── i18n/               # i18n 설정
│   │   └── lib/                # 유틸리티 (cn)
│   ├── public/locales/         # ko/en 번역 파일
│   ├── tests/e2e/              # Playwright E2E 테스트
│   ├── playwright.config.ts
│   ├── vite.config.ts          # proxy: /api + /uploads → localhost:3000
│   ├── Dockerfile
│   └── package.json
```

---

## 4. 데이터 모델 (핵심)

```
User ──────────────────────────────────────────
  ├─ ProjectMember (role, note)
  ├─ UserLLMConfig (개인 LLM 설정)
  └─ UserLLMAccess (공용 LLM 접근 권한)

Project ───────────────────────────────────────
  ├─ ProjectMember ─→ User
  ├─ ExternalProjectMember (비시스템 멤버)
  ├─ Requirement ─→ UseCase, UserStory, Feature
  │     └─ Feature ─→ Task, TestScenario, DbTable, ApiSpec, ScreenImage
  │           └─ Task ─→ TaskIssue
  ├─ ChangeRequest ─→ ChangeRequestRequirement
  ├─ TraceabilityLink
  ├─ VersionSnapshot
  └─ ExportTemplate (산출물 레이아웃 설정)

LLMConfig (공용 AI 설정, Admin 관리)
```

### 추적성 연결 체계
```
User Story ──┐
              ├──→ 요구사항 ──→ 기능 ──→ DB설계/API설계 ──→ Task ──→ 테스트
Use Case   ──┘                         └──→ 화면설계서(이미지)
```

---

## 5. 사이드바 메뉴 (네비게이션 순서)

```
프로젝트 개요 (settings)
대시보드 (dashboard)
User Story (user-stories)
Use Case (use-cases)
요구사항 (requirements)
기능 리스트 (features)
설계 (design)
Task (tasks)
테스트 (tests)
변경요청 (change-requests)
추적성 (traceability)
```

---

## 6. 주요 기능 상세

### 6.1 AI 연동
- **마크다운 AI 분석**: SPEC.md → 요구사항 + Use Case + User Story 동시 추출
- **AI 모델 선택**: 생성 시 모델 드롭다운 (개인LLM > 승인된공용 > 글로벌 순 자동선택)
- **4개 프로바이더**: OpenAI, Anthropic, Google Gemini, AWS Bedrock
- **AI 생성 대상**: 기능, Task, 테스트 시나리오, DB설계, API설계
- **인라인 AI 제안**: 입력 폼에서 실시간 AI 자동완성

### 6.2 산출물 내보내기
- **Excel**: 요구사항정의서, WBS, RTM, 테스트계획서, DB정의서, API명세서
- **PDF**: 요구사항, WBS, RTM, 테스트계획서 (jspdf lazy load)

### 6.3 추적성(RTM)
- **추적성 트리**: 요구사항 기준 펼침/접기 트리 (UC/US/기능/DB/API/Task/테스트 모두 표시)
- **매트릭스 테이블**: 기준 항목 선택 + 추적 항목 N개 선택 → 교차 연결 매트릭스

### 6.4 Gantt Chart
- **위치**: Task 메뉴 → "간트" 탭
- **라이브러리**: gantt-task-react
- **기능**: 기능별 그룹핑, 드래그 일정 변경, 진척율 드래그, 클릭→사이드패널, 더블클릭→상세 이동

### 6.5 화면설계서
- **Ctrl+V 붙여넣기** + 드래그앤드롭 + 클릭 업로드
- **다중 이미지** 지원 (ScreenImage 테이블)
- **라이트박스 뷰어** (좌우 화살표 + ESC 닫기)

### 6.6 프로젝트 개요
- **프로젝트 정보**: 코드, 유형, 명칭, 상태, 일정, 상세내용
- **시스템 멤버**: 등록된 사용자 추가 + 역할/비고 관리
- **외부 멤버**: 미등록 사용자 직접 입력 (이름/이메일/전화/역할/비고)

### 6.7 변경요청(CR)
- CR 등록 (연결 요구사항 선택)
- 영향 분석 (연결된 기능/Task/테스트 자동 표시)
- 상태 관리 (draft → review → approved/rejected → implemented)

---

## 7. UI/UX 특징

- **액센트 컬러**: #5E6AD2 (인디고)
- **폰트**: Inter + Pretendard Variable (-0.011em tracking)
- **레이아웃**: 상단바 통합 (PMS로고 + 프로젝트명 + 현재메뉴) + 접이식 사이드바
- **테이블**: compact (text-xs, py-1.5), 행 hover, 기능별 그룹핑(접기/펼치기)
- **상태 배지**: 상태별 자동 색상 매핑 (25+ variants)
- **비활성 버튼**: hover 시 사유 tooltip
- **마이크로 인터랙션**: 200ms expo-out, active scale(0.98), 인디고 글로우
- **추적성 표시**: TraceIndicator (↑상위 / ↓하위), AncestorTags (클릭 가능 pill)

---

## 8. 인증/권한 체계

- **JWT**: accessToken + refreshToken
- **역할**: ADMIN / USER
- **프로젝트 멤버 역할**: OWNER/PM/DEVELOPER/DESIGNER/TESTER/ANALYST/VIEWER/EXTERNAL
- **Admin 전용**: 관리자 설정, 사용자 관리, LLM 설정, 산출물 템플릿
- **LLM 접근 제어**: Admin이 사용자별 LLM 승인, 사용자는 개인 LLM 추가 가능

---

## 9. 실행 방법

### 개발 환경
```bash
# DB 컨테이너 시작
podman start pms_db_dev
# 또는 docker-compose -f docker-compose.dev.yml up -d

# BE
cd backend
DATABASE_URL="postgresql://pms_user:pms_password@localhost:5432/pms_db" \
JWT_SECRET="pms-jwt-secret-change-in-production" \
JWT_EXPIRES_IN="7d" PORT=3000 \
nohup node dist/src/main > /tmp/be.log 2>&1 &

# FE
cd frontend
npm run build && nohup npm run preview > /tmp/fe.log 2>&1 &
# → http://localhost:4173 (외부: http://<IP>:4173)
```

### 프로덕션 (Docker)
```bash
docker compose up --build
# → http://localhost (Nginx → FE + API proxy)
```

---

## 10. 계정

| 역할 | 이메일 | 비밀번호 |
|------|--------|----------|
| Admin | admin@pms.com | Admin1234! |

---

## 11. 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| DATABASE_URL | PostgreSQL 연결 | postgresql://pms_user:pms_password@localhost:5432/pms_db |
| JWT_SECRET | JWT 서명 키 | pms-jwt-secret-change-in-production |
| JWT_EXPIRES_IN | 토큰 만료 시간 | 7d |
| PORT | BE 포트 | 3000 |

---

## 12. 마이그레이션 히스토리

모든 마이그레이션 SQL은 `backend/prisma/migrations/` 에 순서대로 저장.
새 환경에서 `npx prisma migrate deploy` 실행 시 자동 적용.
시드: `npx prisma db seed` (admin 계정 + 4종 export template 생성)

---

## 13. 향후 과제 (미구현)

- ERD 다이어그램 시각화 (React Flow)
- 화면설계서 PDF 내보내기
- LLM 연결 테스트 버튼
- 다크모드
- CI/CD 파이프라인
- 운영 모니터링
- E2E 테스트 완전 커버리지
