# PMS 구현 Handoff — 세션 6 추가 작업 내역

---

## 세션 6 주요 변경사항

### 1. Export 401 인증 오류 전체 수정
- `export.api.ts`의 `testResultPivot`, `testResult`, `defectReport` 3개가 `window.open()` 방식이라 Authorization 헤더 미전송 → 401
- 기존 `fetchExcel()` 패턴 (fetch + Bearer 토큰 + Blob 다운로드)으로 전면 교체
- **규칙**: 모든 Excel/파일 다운로드는 반드시 `fetchExcel()` 사용, `window.open()` 절대 금지

### 2. AI 결함 자동 생성 (AIDefectGenerateModal)
- 테스트 수행 상세 페이지에서 Fail/Blocked 결과 존재 시 `[🤖 AI 결함 생성]` 버튼 노출
- 3단계 모달: 설정 → 검토/편집 → 완료
- BE 신규 엔드포인트:
  - `POST /projects/:pid/ai/generate-defects-from-results` — phase Fail/Blocked 결과 + snapshot join → AI 결함 제안
  - `POST /projects/:pid/ai/save-generated-defects` — 결함 저장 + `TestRoundResult.defectId` 자동 연결
- 중복 방지: `defectId` 미연결 건만 생성 대상
- 파일: `frontend/src/components/shared/AIDefectGenerateModal.tsx` (신규)

### 3. AI 기능별 모델 매핑 설정
- **배경**: 기능마다 최적 모델이 다름 (시나리오생성=Opus, Task분해=Haiku 등)
- **DB**: `ProjectAiModelMapping` 테이블 신규 (projectId + featureKey unique)
- **BE 우선순위**: featureKey 매핑 → 수동 modelId → 개인 기본 → 공용
- **FE**: 프로젝트 설정 → "AI 모델 설정" 탭 신규
  - 7개 기능 각각 등록된 프로바이더 드롭다운 + 추천 모델 배지
  - 미설정 시 기존 방식 폴백
- **API**: `GET/PUT /projects/:pid/ai/model-mappings`
- **featureKey**: `parse-spec`, `generate-features`, `generate-tasks`, `generate-test-scenarios`, `generate-test-cases`, `classify-defect`, `generate-defects`
- 파일:
  - `backend/prisma/schema.prisma` — ProjectAiModelMapping 모델 추가
  - `backend/src/ai/ai.service.ts` — getModel() featureKey 지원, resolveModelId/getAiModelMappings/saveAiModelMappings 추가
  - `backend/src/ai/ai.controller.ts` — GET/PUT model-mappings 엔드포인트, 주요 생성 엔드포인트에 mid() 헬퍼 적용
  - `frontend/src/routes/projects/settings/SettingsPage.tsx` — AI 모델 설정 탭 추가
  - `frontend/src/api/project.api.ts` — getAiModelMappings/saveAiModelMappings 추가

---

## 세션 5 주요 변경사항

### 1. Gantt 차트 드래그 가로 스크롤
- 빈 공간을 마우스로 잡고 드래그하면 타임라인이 가로 스크롤
- 구현: `document` 레벨 mousemove 리스너 + `_CZjuD.scrollLeft` 직접 조작
- task 바 위에서는 드래그 스크롤 비활성 (라이브러리 바 드래그와 충돌 방지)
- `_2k9Ys` (HorizontalScroll) scrollLeft 동기화로 라이브러리 내부 상태 연동

### 2. Gantt 차트 헤더(년월일 컬럼) 틀고정
- `ganttHeight` prop 추가 → 캘린더 헤더 SVG 상단 고정, 차트 body만 세로 스크롤
- 높이: `window.innerHeight - 280` 동적 계산 (resize 이벤트 대응)

### 3. 파일 변경 목록
- `frontend/src/components/shared/GanttView.tsx` — 드래그 스크롤 + 헤더 고정

---

## 세션 4 주요 변경사항

### 1. 테스트 시나리오 상세(TestDetailPage) 수행 기능 제거
- 케이스 "수행" 버튼, 회차 선택 드롭다운, 결과 기록 모달 제거
- 케이스 테이블: 결과 컬럼 → 우선순위 컬럼으로 교체
- 테스트 시나리오 = **설계 전용**, 수행은 테스트 수행 메뉴에서만

### 2. 테스트 수행(TestPhaseDetailPage) 단순화
- "수행 회차 추가" 버튼 + 모달 제거 (Import가 자동 생성)
- 플로우: Template 다운로드 → Excel 작성 → Import → 회차 자동 생성
- 빈 상태 메시지: "Template을 다운받아 작성 후 Import하세요."

### 3. Excel Export 인증 오류 수정
- `window.open()` → `fetch() + Authorization Bearer` + Blob 다운로드
- test-execution.api.ts의 `exportTemplate`, `exportResult` 모두 수정

### 4. 테스트 목록 뷰 개선
- [요구사항별 | 테스트 시나리오] 토글 추가
- 테스트 시나리오 탭: 플랫 테이블 (시나리오ID | 시나리오명 | Test Case 목록)
- 케이스는 번호+우선순위배지+제목 줄바꿈 표시
- Test Case JSON 입력값 파싱 표시 (key: value 형태)

### 5. AI 시나리오 생성 컨텍스트 강화
- 요구사항으로 시나리오 생성 시 **연결된 기능리스트 + Task 목록**도 AI에 전달
- 더 구체적이고 실행 가능한 시나리오 생성

### 6. 테스트 수행 회차 클릭 시 스냅샷 초기화 수정
- 기존: 저장된 결과만 표시 (새 회차는 빈 화면)
- 수정: TestPhase 스냅샷에서 전체 시나리오/케이스 초기화 후 기존 결과 오버레이

### 7. 테스트 시나리오 사이드바 패널 개선
- 테스트 케이스 목록 표시 (번호+우선순위배지+제목)
- 케이스 수 숫자 → 실제 목록으로 변경

### 8. 목록 페이지 스크롤 구조
- 툴바/필터 고정, 테이블만 스크롤
- `max-h-[calc(100vh-140px)] overflow-y-auto` 적용

### 9. 테스트 수행 카드 수정/삭제
- ✏️ 수정 (Admin만), 🗑️ 삭제 (전체)
- 상태 변경 드롭다운 목록 캐시 무효화 수정

### 10. MultiCaseGenerateModal 신규
- 테스트 목록에서 다중 시나리오 선택 → AI 케이스 일괄 생성
- `generate-test-cases-multi` 엔드포인트 추가

---

## 현재 상태

### 테스트 수행 플로우 (확정)
```
1. 테스트 수행 메뉴 → 프로젝트 회차 카드 클릭
2. [Template 다운로드] → Excel 파일 저장
3. 수행자들에게 배포 → Pass/Fail/Blocked/N/A 작성
4. [결과 Import] → 수행자 자동 추출 → 회차 자동 생성
5. 회차 클릭 → 결과 조회/수정 가능
6. [결과서 Export] → 사용자별 시트로 Excel 생성
```

### 미완성 / 다음 작업 후보
- 테스트 수행 Template 형식 확인 및 개선 필요 여부
- 결과 수정 UI (TestRoundDetailPage) 사용성 검토
- 다른 목록 페이지 사이드 패널 추가 (UseCase, UserStory 등)

---

## 실행 방법
```bash
pkill -f "node dist/src/main" 2>/dev/null
fuser -k 3000/tcp 2>/dev/null; sleep 2
cd /home/ec2-user/workspace/PMS/backend
DATABASE_URL="postgresql://pms_user:pms_password@localhost:5432/pms_db" \
JWT_SECRET="pms-jwt-secret-change-in-production" JWT_EXPIRES_IN="7d" PORT=3000 \
node dist/src/main.js &

pkill -f "vite" 2>/dev/null; sleep 1
cd /home/ec2-user/workspace/PMS/frontend && npx vite preview &
```

## 계정 / AI 모델
- admin@pms.com / Admin1234!
- AI: us.anthropic.claude-opus-4-6-v1 (Bedrock)

## 이전 HANDOFF (세션 2) 내용은 유지되며, 아래는 세션 3 추가사항

---

## 세션 3 주요 변경사항

### 1. 테스트 구조 최종 확정
- **레벨(unit/integration/system/acceptance) 완전 제거** — TestScenario.type에서 삭제
- **테스트 상위 = 요구사항** (기능리스트 기반 → 요구사항 기반)
- **AI 시나리오 생성도 요구사항 기반** (기능 상세에서 제거, 요구사항 상세로 이동)
- **테스트 수행 TestPhase에 phaseType** 추가 (integration/system/acceptance)
- 메뉴명: "테스트" → "테스트 시나리오"
- 기능리스트별 그룹핑 토글 제거 (요구사항별 고정)
- 수동 시나리오 생성 폼: 기능 연결 필드 제거

### 2. AI 시나리오 상세도 조절 기능
- 슬라이더 1~20개 + 프리셋 버튼 (간략/보통/상세)
- MultiScenarioGenerateModal + 요구사항 상세 AIGenerateModal에 적용
- BE: `generateTestScenarios`에 `detailLevel` 파라미터 추가

### 3. 사이드 패널 UX (4개 목록 페이지)
- 요구사항/기능리스트/Task/테스트 시나리오 목록에서 행 클릭 → 우측 사이드 패널
- **오버레이 방식**: 테이블을 shrink하지 않고 위에 덮음
- **position: fixed** (스크롤 위치 무관, 뷰포트 기준)
- 너비: 기본 50%, ½/¾/⊡ 프리셋 + 좌측 엣지 드래그 리사이즈 (20~95%)
- 인라인 편집 지원
- "상세 페이지로 이동" 버튼으로 기존 DetailPage 유지
- Escape 키 닫기

### 4. AI 다중 생성 모달 레이아웃 개편
- `max-w-4xl` 좌우 2패널 구조
- Step 1: 왼쪽(55%)=선택목록+검색, 오른쪽=설정(상세도/모델/추가정보)
- Step 3: 왼쪽=결과목록, 오른쪽=선택통계+버튼
- 결과 뷰 그룹 헤더 `z-10` (겹침 방지)
- `h-[520px]` 고정 → `flex-1 min-h-0` (모달 높이에 맞게 동적)

### 5. BE 신규 엔드포인트
- `POST ai/generate-test-scenarios-multi-for-requirements` — 요구사항 기반 다중 시나리오
- `POST ai/generate-test-scenarios-by-level-for-requirements` — 요구사항 기반 레벨별
- TestPhase에 `phaseType` 필드 추가 (DB push 완료)

---

## 현재 상태

### 완료된 것
- 테스트 구조 개편 (요구사항 기반, 레벨 제거)
- 4개 목록 페이지 사이드 패널 (fixed 오버레이 + 드래그 리사이즈)
- AI 다중 생성 모달 2패널 레이아웃
- AI 시나리오 상세도 조절 슬라이더

### 미완성 / 다음 작업 후보
- 테스트 수행 TestPhase 생성 시 phaseType 선택 UI 반영 필요
- Use Case, User Story, 변경요청 등 다른 목록도 사이드 패널 적용 가능
- 사이드 패널에서 하위 항목 생성 기능 (현재는 조회/편집만)

---

## 실행 방법
```bash
# 빠른 재시작 (빌드 없이)
pkill -f "node dist/src/main" 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
sleep 2
cd /home/ec2-user/workspace/PMS/backend
DATABASE_URL="postgresql://pms_user:pms_password@localhost:5432/pms_db" JWT_SECRET="pms-jwt-secret-change-in-production" JWT_EXPIRES_IN="7d" PORT=3000 node dist/src/main.js &

pkill -f "vite" 2>/dev/null; sleep 1
cd /home/ec2-user/workspace/PMS/frontend && npx vite preview &
```

## 계정
- admin@pms.com / Admin1234!
- AI 모델: us.anthropic.claude-opus-4-6-v1 (Bedrock)

## 이전 세션 대비 변경사항 요약

### 1. 요구사항/기능/Task 개선
- 요구사항 확정 후 수정 시 자동 상태복귀 제거 → 상태는 수동 변경만
- 확정 항목 편집 시 하위 outdated 전파 유지
- 모든 항목에 일괄 상태변경 + 그룹 체크박스 추가
- 모든 상세 페이지 mutation에 관련 queryKey 무효화 추가
- Task 무한스크롤 적용, 테스트/기능은 전체 로드(limit:2000)

### 2. AI 기능 대폭 확장
- 모든 AI 모달에 "추가정보" textarea + 📋 템플릿 추가
- 기능리스트 다중 AI 생성 (확정 요구사항 기준)
- Task 다중 AI 생성 (확정 기능리스트 기준)
- 테스트 시나리오 AI 생성 → **요구사항 기반으로 변경** (기능 기반에서 이동)
- 테스트 시나리오 상세도 조절 (슬라이더 1~20 + 프리셋 간략/보통/상세)
- AI 케이스 자동 생성 (시나리오 → 정상/예외/경계값/에러)
- AI 결함 분류 제안 (Fail 시 심각도/우선순위 제안)
- AI parseJSON: `"A".repeat(N)` JS 표현식 치환 처리
- `forbidNonWhitelisted` 대응: 모든 AI 모달에서 필요 필드만 명시적 추출

### 3. Gantt 차트 개선
- 그룹 접기/펼치기 (바 클릭 + 전체 접기/펼치기 버튼)
- 바 색상 통일 (#5E6AD2 파란색, 그룹은 다크)
- Dependency 기능 (FS/FF/SS/SF, 슬라이드 패널에서 추가/삭제)
- 슬라이드 패널 인라인 편집 (제목/상태/진척율/일정)

### 4. 테스트 시스템 전면 개편
- **레벨 구분 제거**: unit/integration/system/acceptance → 테스트 수행(회차)에서 유형 구분
- **상위 기준 변경**: 기능리스트 → **요구사항** 기반 (테스트 = 요구사항 검증)
- **메뉴명 변경**: "테스트" → "테스트 시나리오"
- **기능 상세에서 AI 테스트생성 제거**, 요구사항 상세로 이동
- **기능리스트별 그룹핑 토글 제거** (요구사항별 고정)
- TestCycle/TestExecution/Defect 모델 추가
- Defect 관리 페이지 (7단계 상태전이)
- 테스트 결과서 Excel (피벗: 요구사항 × 회차)

### 5. 테스트 수행 시스템 (신규)
- `TestPhase` (프로젝트 회차 - phaseType: integration/system/acceptance)
- `TestRound` (수행 회차 - 수행자 이름/부서, 무제한)
- `TestRoundResult` (결과 기록)
- 프로젝트 회차 카드 UI
- 수행 회차 직접 입력 / Excel Import / Export
- 시나리오 스냅샷 (회차 시작 시 동결)
- Import 유효성 검증 리포트
- TesterAutocomplete (이전 수행자 자동완성)

### 6. 기타
- 서버 재시작 스크립트 (restart-all/be/fe.sh)
- 코드 자동채번 버그 수정 (문자열 정렬 → 숫자 max 계산)
- Limit 캡 상향 (BE 2000)
- 시나리오 쿼리에서 testCases JOIN 제거 (성능 개선)
- DB 인덱스 추가 (TestScenario: projectId+type, projectId+testType, projectId+featureId, projectId+reqId)

---

## 현재 진행 중 / 다음 작업

### 테스트 수행 시스템 (미완성 부분)
- `TEST_EXECUTION_PLAN.md` 참조
- FE Excel Import/Export는 구현됨, 실 테스트 미완
- phaseType이 프로젝트 회차 생성 모달에 반영 필요

### 논의됐으나 미구현
- **사이드 패널 상세**: 모든 목록에서 행 클릭 → 우측 슬라이드 패널로 상세 표시 (Gantt 패턴)
  - Hybrid 방식 권장: 패널(요약+빠른편집) + "상세 열기" 버튼(전체 페이지)
  - 기술적으로 가능, 공수가 큰 작업
  - URL: 쿼리파라미터 `?selected=id`로 상태 유지

---

## 주요 설계 결정사항 (컨텍스트)

| 결정 | 이유 |
|------|------|
| 테스트 상위 = 요구사항 | 고객 관점 검증, SI 산출물 목적 |
| 레벨 구분은 수행 회차에서 | 같은 시나리오를 통합/시스템/인수 목적으로 반복 수행 |
| 단위 테스트 제외 | 개발자가 코드에서 직접 하는 것, 이 시스템의 범위 아님 |
| 상태 자동복귀 제거 | 업계 표준 (Jira 등) 따름, AuditLog로 이력 추적 충분 |
| 전체 로드 vs 무한 스크롤 | 그룹핑 있는 목록 = 전체 로드, Task만 무한 스크롤 |
| 테스트 수행 수행자 = 수동 입력 | 고객/외부인력이 시스템 계정 없음 |

---

## 파일 경로 참고

| 기능 | 파일 |
|------|------|
| 테스트 시나리오 목록 | `frontend/src/routes/projects/tests/TestListPage.tsx` |
| 테스트 수행 | `frontend/src/routes/projects/test-execution/` |
| 결함 관리 | `frontend/src/routes/projects/defects/` |
| AI 시나리오 다중생성 | `frontend/src/components/shared/MultiScenarioGenerateModal.tsx` |
| AI 모달 공용 | `frontend/src/components/shared/AIGenerateModal.tsx` |
| 테스트 BE (시나리오) | `backend/src/test-management/` |
| 테스트 수행 BE | `backend/src/test-execution/` |
| Plan 문서 | `SPEC/TEST_EXECUTION_PLAN.md`, `SPEC/TEST_REFORM_PLAN.md` |

---

## 실행 방법

```bash
# 빌드 없이 빠른 재시작
pkill -f "node dist/src/main" 2>/dev/null
fuser -k 3000/tcp 2>/dev/null
sleep 2
cd backend && DATABASE_URL="postgresql://pms_user:pms_password@localhost:5432/pms_db" JWT_SECRET="pms-jwt-secret-change-in-production" JWT_EXPIRES_IN="7d" PORT=3000 node dist/src/main.js &

pkill -f "vite" 2>/dev/null
cd frontend && npx vite preview &

# 빌드 포함
./restart-all.sh
```

## 계정
- admin@pms.com / Admin1234!
- AI 모델: us.anthropic.claude-opus-4-6-v1 (Bedrock)
