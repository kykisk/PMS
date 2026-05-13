# PMS 테스트 수행 시스템 구현 계획

## 개요

SI 프로젝트 현장의 Excel 기반 테스트 수행 워크플로우를 시스템화.
PM이 프로젝트 회차를 생성 → 수행자(고객/외부인력 포함)가 Excel로 결과 제출 → PM이 Import → 결과서 자동 생성.

---

## 핵심 구조

```
프로젝트
└─ 테스트 수행 메뉴
    └─ 프로젝트 회차 (Admin 생성: "중간 테스트", "최종 테스트")
         ├─ 상태: planned → in_progress → completed → closed
         ├─ 시나리오 스냅샷 (생성 시 동결)
         └─ 수행 회차 (무제한)
              ├─ 회차 1: 수행자 "김철수/개발팀" — Import or 직접 입력
              ├─ 회차 2: 수행자 "박영희/QA팀" — Import
              ├─ 회차 3: 수행자 "이고객/발주처" — Import
              └─ ...
```

---

## DB 모델

### TestPhase (프로젝트 회차)
```
id, projectId, code(TP-001), title, description,
status(planned|in_progress|completed|closed),
startDate, endDate, snapshotData(JSON), snapshotAt, outdated,
createdAt, updatedAt
```

### TestRound (수행 회차)
```
id, phaseId, roundNumber, testerName, testerDept,
executedAt, scope(full|partial), sourceRoundId,
totalCases, passCount, failCount, blockedCount, naCount,
importedAt, createdAt, updatedAt
```

### TestRoundResult (수행 결과)
```
id, roundId, scenarioCode, caseTitle, caseIndex,
result(pass|fail|blocked|na), actual, stepResults(JSON), defectId,
createdAt
```

---

## snapshotData JSON 구조

```json
{
  "createdAt": "2026-05-13T...",
  "scenarios": [{
    "id": "원본ID", "code": "TS-001", "title": "로그인", "type": "integration",
    "cases": [{
      "id": "원본ID", "index": 0, "title": "정상 로그인",
      "priority": "high", "steps": [...], "testData": "...", "expected": "..."
    }]
  }]
}
```

---

## API 엔드포인트

| Method | Path | 기능 |
|--------|------|------|
| POST | /test-phases | 프로젝트 회차 생성 (스냅샷 자동) |
| GET | /test-phases | 목록 |
| GET | /test-phases/:phaseId | 상세 |
| PUT | /test-phases/:phaseId | 수정 (상태 전이) |
| DELETE | /test-phases/:phaseId | 삭제 |
| POST | /test-phases/:phaseId/snapshot | 스냅샷 갱신 |
| POST | /test-phases/:phaseId/rounds | 수행 회차 추가 |
| GET | /test-phases/:phaseId/rounds | 수행 회차 목록 |
| GET | /test-phases/:phaseId/rounds/:roundId | 수행 회차 상세 |
| DELETE | /test-phases/:phaseId/rounds/:roundId | 수행 회차 삭제 |
| POST | /test-rounds/:roundId/results | 결과 저장 (직접 입력) |
| PUT | /test-rounds/:roundId/results/:id | 결과 수정 |
| GET | /test-rounds/:roundId/results | 결과 조회 |
| GET | /test-phases/testers | 수행자 Autocomplete |
| GET | /test-phases/:phaseId/dashboard | 현황 통계 |
| GET | /test-phases/:phaseId/export-template | Template Excel |
| POST | /test-phases/:phaseId/import | Excel Import |
| GET | /test-phases/:phaseId/export-result | 결과서 Excel |

---

## Excel Template 형식

```
[A1] 수행자:  [B1] (입력)
[A2] 부서:    [B2] (입력)
[A3] 수행일:  [B3] (입력)

[5행~] No│시나리오ID│시나리오명│케이스명│입력값│기대결과│결과│비고
```

Import 매칭: 시나리오ID + 케이스명 → 스냅샷 데이터와 매칭
결과 값: P/Pass/F/Fail/B/Blocked/N/N/A 인식

---

## Import 유효성 검증 리포트

```json
{
  "roundId": "생성된 회차 ID",
  "totalRows": 50,
  "matched": 48,
  "unmatched": [
    {"scenarioCode": "TS-099", "caseTitle": "없는케이스", "reason": "케이스 미매칭"}
  ],
  "invalidValues": [
    {"row": 15, "value": "패스", "reason": "잘못된 결과 값"}
  ],
  "testerName": "이고객",
  "testerDept": "발주처"
}
```

---

## 결과서 Export 형식

```
[시트1: 요약]
프로젝트 회차, 수행 회차별 통계 테이블

[시트2~N: 수행자별]
시트명: "김철수_개발팀_1회차"
내용: No│시나리오ID│시나리오명│케이스명│입력값│기대결과│결과│비고
```

---

## FE 페이지

| 경로 | 페이지 | 내용 |
|------|--------|------|
| /test-execution | TestExecutionPage | 프로젝트 회차 카드 목록 |
| /test-execution/:phaseId | TestPhaseDetailPage | 수행 현황 + 대시보드 |
| /test-execution/:phaseId/:roundId | TestRoundDetailPage | 직접 수행 UI |

---

## 구현 Wave

| Wave | 작업 | 복잡도 |
|------|------|--------|
| 1 | DB 스키마 추가 + migrate | S |
| 2 | BE 모듈/DTO 생성 | S |
| 3 | BE Service (CRUD + 스냅샷 + 통계) | L |
| 4 | BE Controller | M |
| 5 | BE Excel Service (Template/Import/Export) | XL |
| 6 | FE API 레이어 | S |
| 7 | FE 라우트 + 사이드바 | S |
| 8 | FE 3개 페이지 | XL |
| 9 | FE Autocomplete 컴포넌트 | S |
| 10 | FE Excel 연동 (Import Modal) | M |
| 11 | 결함 연동 + Fail 재수행 | M |
| 12 | 기존 회차관리 탭 제거 + 정리 | S |

총 예상: ~28시간

---

## 주의사항

1. snapshotData는 목록 API에서 제외 (크기 이슈)
2. 기존 TestCycle/TestExecution 완전 유지 (독립 모듈)
3. 시나리오 변경 시 TestPhase.outdated 플래그만 설정 (기존 코드 최소 변경)
4. 수행자 Autocomplete: 프로젝트 내 이전 입력 이름/부서 distinct 조회
5. Import 인코딩: xlsx 라이브러리가 자동 처리
