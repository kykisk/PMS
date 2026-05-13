# PMS 테스트 관리 시스템 전면 개편 계획

## 개요

SI 프로젝트 정석 테스트 프로세스를 완전 지원하도록 테스트 시스템 개편.

```
테스트 계획 → 레벨별 시나리오 작성(AI) → 케이스 작성(AI)
→ 1차 실행 → Fail시 결함 등록 → 수정 → 2차 실행(재테스트+회귀)
→ 반복 → 최종 결과서 자동 생성
```

---

## Wave 1: 데이터 모델 확장 + 마이그레이션 (선행 필수)

### 1-1. Prisma 스키마 확장 [M] ~2h

**파일**: `backend/prisma/schema.prisma`

**TestScenario 변경 (기존 필드 유지 + 추가)**:
- `type` 확장: `unit | integration | system | acceptance`
- `testType` 추가: `functional | performance | security | usability | compatibility`

**TestCase 변경**:
- `priority` 추가: `high | medium | low`
- 기존 `actual`, `result`, `executedBy`, `executedAt`, `status` 필드 유지 (하위호환)
- `executions TestExecution[]` relation 추가

**신규 모델 - TestCycle**:
```prisma
model TestCycle {
  id          String   @id @default(uuid())
  projectId   String
  code        String           // CY-001, CY-002
  title       String           // "1차 통합테스트", "2차 회귀테스트"
  description String?
  scope       String   @default("full")  // full | partial | regression
  status      String   @default("planned")  // planned | in_progress | completed | cancelled
  startDate   DateTime?
  endDate     DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  executions  TestExecution[]
  @@unique([projectId, code])
}
```

**신규 모델 - TestExecution**:
```prisma
model TestExecution {
  id          String    @id @default(uuid())
  testCaseId  String
  cycleId     String
  result      String    // pass | fail | blocked | skipped
  actual      String?
  note        String?
  executedBy  String?
  executedAt  DateTime  @default(now())
  createdAt   DateTime  @default(now())
  testCase    TestCase  @relation(fields: [testCaseId], references: [id], onDelete: Cascade)
  cycle       TestCycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  defects     Defect[]
  @@index([testCaseId, cycleId])
}
```

**신규 모델 - Defect**:
```prisma
model Defect {
  id           String   @id @default(uuid())
  projectId    String
  code         String          // DF-001
  title        String
  description  String?
  severity     String   @default("major")    // critical | major | minor | trivial
  priority     String   @default("medium")   // high | medium | low
  status       String   @default("open")     // open | assigned | in_progress | resolved | verified | closed | reopened
  assigneeId   String?
  reportedBy   String?
  executionId  String?
  resolution   String?
  resolvedAt   DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  execution    TestExecution? @relation(fields: [executionId], references: [id])
  @@unique([projectId, code])
}
```

**Project 모델에 추가**: `testCycles TestCycle[]`, `defects Defect[]`

**주의사항**:
- TestCase의 기존 실행 필드 삭제하지 않음 (하위호환)
- 새 실행은 TestExecution에 기록, 기존 API도 계속 동작

---

### 1-2. 데이터 마이그레이션 [M] ~3h

**파일**: `backend/prisma/migrations/migrate-test-executions.ts`

전략:
1. `npx prisma db push`로 새 모델 추가 (기존 데이터 영향 없음)
2. 기존 TestCase 중 `result`가 있는 것 → "레거시" TestCycle(CY-000) 자동 생성 → TestExecution 레코드 복사
3. TestCase의 기존 필드는 그대로 유지 (하위호환)

---

### 1-3. DTO 추가 [S] ~1h

**파일들**:
- `backend/src/test-management/dto/create-cycle.dto.ts` — 신규
- `backend/src/test-management/dto/create-execution.dto.ts` — 신규
- `backend/src/test-management/dto/create-defect.dto.ts` — 신규
- `backend/src/test-management/dto/update-defect.dto.ts` — 신규
- 기존 DTO에 `testType`, `priority` optional 추가

---

## Wave 2: Backend API 구현

### 2-1. TestCycle CRUD [M] ~3h

**파일**: `backend/src/test-management/test-management.controller.ts`, `test-management.service.ts`

| Method | Path | 기능 |
|--------|------|------|
| POST | `/projects/:pid/test-cycles` | 회차 생성 (코드 자동생성) |
| GET | `/projects/:pid/test-cycles` | 회차 목록 |
| GET | `/projects/:pid/test-cycles/:cycleId` | 회차 상세 (통계 포함) |
| PUT | `/projects/:pid/test-cycles/:cycleId` | 회차 수정 |
| DELETE | `/projects/:pid/test-cycles/:cycleId` | 회차 삭제 |

통계 응답: `{ ...cycle, stats: { total, pass, fail, blocked, skipped, notExecuted, passRate } }`

---

### 2-2. TestExecution API [M] ~3h

| Method | Path | 기능 |
|--------|------|------|
| POST | `/projects/:pid/test-cycles/:cycleId/executions` | 실행 기록 |
| GET | `/projects/:pid/test-cycles/:cycleId/executions` | 회차별 실행 목록 |
| GET | `/projects/:pid/test-cases/:caseId/executions` | 케이스별 이력 |

**핵심**: 실행 기록 시 TestCase.result도 동시 업데이트 (하위호환 이중 기록)

---

### 2-3. Defect CRUD + 상태전이 [L] ~5h

| Method | Path | 기능 |
|--------|------|------|
| POST | `/projects/:pid/defects` | 결함 등록 |
| GET | `/projects/:pid/defects` | 결함 목록 (필터) |
| GET | `/projects/:pid/defects/:defectId` | 결함 상세 |
| PUT | `/projects/:pid/defects/:defectId` | 결함 수정/상태변경 |
| DELETE | `/projects/:pid/defects/:defectId` | 결함 삭제 |

**상태 전이 규칙**:
```
open → assigned → in_progress → resolved → verified → closed
                                    ↑                      ↓
                                    └──── reopened ←────────┘
```

유효 전이 맵:
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['assigned', 'closed'],
  assigned: ['in_progress', 'open'],
  in_progress: ['resolved'],
  resolved: ['verified', 'reopened'],
  verified: ['closed', 'reopened'],
  closed: ['reopened'],
  reopened: ['assigned', 'in_progress'],
};
```

---

### 2-4. 결과 통계 API [S] ~2h

| Method | Path |
|--------|------|
| GET | `/projects/:pid/test-cycles/:cycleId/stats` |
| GET | `/projects/:pid/test-stats/summary` |

---

### 2-5. 기존 executeCase 하위호환 [S] ~1h

기존 `PUT /test-cases/:cId/execute` 유지. cycleId 없으면 레거시 동작.

---

## Wave 3: Frontend 구현

### 3-1. FE API 레이어 확장 [S] ~1.5h

**파일**: `frontend/src/api/test.api.ts`

Cycle, Execution, Defect, Stats 함수 모두 추가.

---

### 3-2. TestListPage 리뉴얼 [M] ~3h

**파일**: `frontend/src/routes/projects/tests/TestListPage.tsx`

- type 필터에 `system`, `acceptance` 추가
- testType 필터 추가 (기능/성능/보안/사용성/호환성)
- 유형 배지 색상 확장 (unit:purple, integration:blue, system:green, acceptance:orange)
- **상단 탭**: `시나리오 | 회차관리` 추가

---

### 3-3. TestDetailPage 리뉴얼 [L] ~6h

**파일**: `frontend/src/routes/projects/tests/TestDetailPage.tsx`

- **회차 선택 드롭다운** 추가 (상단)
- 케이스 테이블에 **회차별 결과 컬럼** 추가
- "수행" 모달: 결과 입력 → 현재 회차에 기록
- **Fail 시 "결함 등록" 체크박스** + 간이 폼 (제목/심각도)
- 케이스별 **실행 이력** accordion 펼치기

**UX 플로우**:
```
진입 → 상단 "현재 회차: [CY-002 2차 ▼]"
→ 케이스 목록에 해당 회차 결과 표시
→ "수행" 클릭 → 결과 입력 모달 → 현재 회차에 기록
→ Fail → 모달 하단에 "결함 등록" 옵션
```

---

### 3-4. TestCycle 관리 UI [M] ~4h

TestListPage 내 "회차관리" 탭:
- 회차 목록 테이블 (코드, 제목, 범위, 상태, 기간, pass율 바)
- 회차 생성 모달
- 회차 클릭 → 전체 케이스 실행 현황 대시보드

---

### 3-5. Defect 관리 페이지 [L] ~6h

**신규 파일**:
- `frontend/src/routes/projects/defects/DefectListPage.tsx`
- `frontend/src/routes/projects/defects/DefectDetailPage.tsx`
- `frontend/src/api/defect.api.ts` (또는 test.api.ts에 통합)

**라우트 추가**: `frontend/src/App.tsx`에 `/projects/:projectId/defects` 추가
**사이드바**: "결함" 메뉴 추가

DefectListPage: 필터(상태/심각도/우선순위/담당자), 테이블, 상태별 카운트 바
DefectDetailPage: 기본정보, 상태 전이 버튼, 연결 TC 링크, 해결 내용

---

### 3-6. 결과서 Export 확장 [M] ~4h

**BE 파일**: `backend/src/export/export.service.ts`, `export.controller.ts`
**FE 파일**: `frontend/src/api/export.api.ts`

| 엔드포인트 | 산출물 |
|------------|--------|
| `GET /export/test-result?cycleId=xxx` | 회차별 결과서 Excel |
| `GET /export/test-result-json?cycleId=xxx` | 결과서 PDF용 JSON |
| `GET /export/test-comparison` | 회차 비교 리포트 |
| `GET /export/defect-report` | 결함 현황 리포트 |

---

## Wave 4: AI 자동화 확장

### 4-1. 레벨별 시나리오 AI 생성 [M] ~3h

**BE**: `ai.controller.ts`, `ai.service.ts`

```
POST /projects/:pid/ai/generate-test-scenarios-by-level
Body: { featureIds: string[], levels: string[], testType?: string, modelId?, additionalInfo? }
```

각 레벨별 프롬프트 분기:
- unit: 함수/메서드 단위 테스트 관점
- integration: 모듈 간 연동/API 관점
- system: E2E 사용자 워크플로우 관점
- acceptance: 비즈니스 요구사항 충족 관점

---

### 4-2. 케이스 AI 자동 생성 [M] ~3h

**BE**: `ai.controller.ts`, `ai.service.ts`

```
POST /projects/:pid/ai/generate-test-cases
Body: { scenarioId: string, modelId?, additionalInfo? }
```

시나리오 기반으로 정상/예외/경계값/에러 케이스 4-8개 생성.
결과: `[{ title, priority, steps, testData, expected }]`

**FE**: TestDetailPage에 "AI 케이스 생성" 버튼 → 기존 AI 모달 패턴

---

### 4-3. 결함 자동 분류 제안 [S] ~2h

```
POST /projects/:pid/ai/classify-defect
Body: { testCaseTitle, expected, actual, modelId? }
```

Fail 기록 시 → AI가 severity/priority 제안 → 결함 등록 폼 자동 채움

---

### 4-4. AI 시나리오 생성 모달 확장 [M] ~3h

**파일**: `frontend/src/components/shared/MultiScenarioGenerateModal.tsx`

- 레벨 선택 체크박스 (unit/integration/system/acceptance)
- testType 선택 (functional/performance 등)
- 선택된 레벨별 AI 호출 → 결과 합산 프리뷰

---

## 의존성 그래프

```
Wave 1 (필수 선행)
  1-1 Schema ──→ 1-2 Migration ──→ 1-3 DTO
       │
       ▼
Wave 2 (1-1, 1-3 완료 후)
  2-1 Cycle API ─┐
  2-2 Execution ─┼──→ 2-4 Stats
  2-3 Defect API ┘
  2-5 하위호환
       │
       ▼
Wave 3 (대응 BE API 완료 후)
  3-1 API Layer ──→ 3-2 ListPage 리뉴얼
                 ──→ 3-3 DetailPage 리뉴얼 (2-1, 2-2 필요)
                 ──→ 3-4 Cycle UI (2-1 필요)
                 ──→ 3-5 Defect Page (2-3 필요)
                 ──→ 3-6 Export (2-4 필요)

Wave 4 (Wave 2 완료 후, Wave 3과 병렬 가능)
  4-1 레벨별 시나리오 AI
  4-2 케이스 AI 생성
  4-3 결함 분류 AI
  4-4 AI 모달 확장 (4-1 완료 후)
```

---

## 병렬 실행 가능 그룹

| 그룹 | 작업 | 조건 |
|------|------|------|
| A (BE) | 2-1, 2-2, 2-3 동시 | Wave 1 완료 후 |
| B (FE) | 3-1 인터페이스만 | Wave 1 완료 시점 |
| C (AI BE) | 4-1, 4-2, 4-3 동시 | Wave 2 완료 후 |
| D (FE 독립) | 3-2, 3-4, 3-5 각각 | 대응 BE API 완료 후 |

---

## 복잡도 요약

| # | 작업 | 복잡도 | 예상 |
|---|------|:------:|------|
| 1-1 | Schema 확장 | M | 2h |
| 1-2 | 마이그레이션 | M | 3h |
| 1-3 | DTO 추가 | S | 1h |
| 2-1 | Cycle CRUD | M | 3h |
| 2-2 | Execution API | M | 3h |
| 2-3 | Defect CRUD + 상태전이 | L | 5h |
| 2-4 | 통계 API | S | 2h |
| 2-5 | 하위호환 유지 | S | 1h |
| 3-1 | FE API 레이어 | S | 1.5h |
| 3-2 | TestListPage 리뉴얼 | M | 3h |
| 3-3 | TestDetailPage 리뉴얼 | L | 6h |
| 3-4 | Cycle 관리 UI | M | 4h |
| 3-5 | Defect 페이지 | L | 6h |
| 3-6 | 결과서 Export | M | 4h |
| 4-1 | 레벨별 시나리오 AI | M | 3h |
| 4-2 | 케이스 AI 생성 | M | 3h |
| 4-3 | 결함 분류 AI | S | 2h |
| 4-4 | AI 모달 확장 | M | 3h |
| **합계** | | | **~56h** |

---

## Watch Out

1. **마이그레이션**: 기존 TestCase.result 데이터는 Legacy Cycle로 복사하되 원본 필드도 유지. 기존 UI가 `testCases[].result` 직접 읽으므로 이중 기록 필수.

2. **Defect 상태 전이**: Controller에서 `VALID_TRANSITIONS` 검증. 잘못된 전이 시 400. FE에서도 현재 상태 기반 가능 버튼만 렌더링.

3. **TestCycle 삭제**: TestExecution cascade 삭제됨. Defect의 `executionId`는 SetNull 처리. 삭제 전 confirm 경고 필수.

4. **RTM 확장**: 기존 RTM에 결함까지 추적 가능하도록 확장 (Optional, 추후 고려).

5. **대시보드**: 테스트 진행률 차트 + 결함 현황 위젯 추가 (Optional, 추후 고려).
