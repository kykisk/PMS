# PMS 구현 Handoff — 세션 2 작업 내역

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
