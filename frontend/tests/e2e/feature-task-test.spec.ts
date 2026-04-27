import { test, expect } from '@playwright/test';
import { getToken, apiPost, apiGet, apiDelete, createTestProject, createTestRequirement, createTestFeature, BE_URL } from './helpers';

let token: string;
let projectId: string;

test.describe('기능 리스트 - API', () => {
  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const proj = await createTestProject(request, token, '-feat');
    projectId = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await apiDelete(request, token, `/projects/${projectId}`);
  });

  test('POST /features → F-001 코드 자동 생성', async ({ request }) => {
    const res = await request.post(`${BE_URL}/projects/${projectId}/features`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: '로그인 화면', description: '이메일/비밀번호 폼' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body.code).toMatch(/^F-\d{3}$/);
  });

  test('GET /features → 페이지네이션 응답', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/features`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
  });

  test('기능-요구사항 연결 → 상세에서 상위 요구사항 확인', async ({ request }) => {
    const req = await createTestRequirement(request, token, projectId);
    const feat = await createTestFeature(request, token, projectId, req.id);
    expect(feat.reqId).toBe(req.id);
    const detail = await apiGet(request, token, `/projects/${projectId}/features/${feat.id}`);
    expect(detail.requirement?.id).toBe(req.id);
  });
});

test.describe('Task - API', () => {
  let featureId: string;

  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const proj = await createTestProject(request, token, '-task');
    projectId = proj.id;
    const feat = await createTestFeature(request, token, projectId);
    featureId = feat.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await apiDelete(request, token, `/projects/${projectId}`);
  });

  test('POST /tasks → T-001 코드 자동 생성', async ({ request }) => {
    const res = await request.post(`${BE_URL}/projects/${projectId}/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'JWT 인증 구현', featureId, progress: 0 },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body.code).toMatch(/^T-\d{3}$/);
  });

  test('GET /tasks → 페이지네이션 응답', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/tasks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  test('Task 진척율 업데이트 (0 → 80)', async ({ request }) => {
    const task = await apiPost(request, token, `/projects/${projectId}/tasks`, {
      title: '진척율 테스트', featureId, progress: 0,
    });
    const res = await request.put(`${BE_URL}/projects/${projectId}/tasks/${task.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { progress: 80, status: 'in_progress' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.progress).toBe(80);
  });

  test('이슈 추가 → task에 이슈 연결', async ({ request }) => {
    const task = await apiPost(request, token, `/projects/${projectId}/tasks`, {
      title: '이슈 테스트 Task', featureId, progress: 0,
    });
    const issueRes = await request.post(`${BE_URL}/projects/${projectId}/tasks/${task.id}/issues`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: '성능 이슈 발생', type: 'issue', severity: 'high' },
    });
    expect([200, 201]).toContain(issueRes.status());
    const issue = await issueRes.json();
    expect(issue.taskId).toBe(task.id);
    expect(issue.type).toBe('issue');
  });

  test('리스크 추가 → type: risk', async ({ request }) => {
    const task = await apiPost(request, token, `/projects/${projectId}/tasks`, {
      title: '리스크 테스트 Task', featureId, progress: 0,
    });
    const res = await request.post(`${BE_URL}/projects/${projectId}/tasks/${task.id}/issues`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: '일정 지연 리스크', type: 'risk', severity: 'medium' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body.type).toBe('risk');
  });
});

test.describe('테스트 시나리오/케이스 - API', () => {
  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const proj = await createTestProject(request, token, '-test');
    projectId = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await apiDelete(request, token, `/projects/${projectId}`);
  });

  test('POST /test-scenarios → TS-001 코드 자동 생성', async ({ request }) => {
    const res = await request.post(`${BE_URL}/projects/${projectId}/test-scenarios`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: '정상 로그인 시나리오', type: 'integration' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body.code).toMatch(/^TS-\d{3}$/);
  });

  test('GET /test-scenarios → 페이지네이션 응답', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/test-scenarios`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  test('테스트 케이스 생성 → 시나리오에 연결', async ({ request }) => {
    const scenario = await apiPost(request, token, `/projects/${projectId}/test-scenarios`, {
      title: '케이스 테스트 시나리오', type: 'unit',
    });
    const caseRes = await request.post(`${BE_URL}/projects/${projectId}/test-scenarios/${scenario.id}/cases`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: '정상 입력 케이스', type: 'unit', expected: '200 OK 반환' },
    });
    expect([200, 201]).toContain(caseRes.status());
    const tc = await caseRes.json();
    expect(tc.scenarioId).toBe(scenario.id);
  });

  test('테스트 케이스 수행 결과 기록 (pass)', async ({ request }) => {
    const scenario = await apiPost(request, token, `/projects/${projectId}/test-scenarios`, {
      title: '수행결과 테스트', type: 'integration',
    });
    const tc = await apiPost(request, token, `/projects/${projectId}/test-scenarios/${scenario.id}/cases`, {
      title: '수행 케이스', type: 'integration',
    });
    const execRes = await request.put(`${BE_URL}/projects/${projectId}/test-cases/${tc.id}/execute`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { result: 'pass', actual: '정상 동작 확인' },
    });
    expect(execRes.status()).toBe(200);
    const body = await execRes.json();
    expect(body.result).toBe('pass');
  });
});

test.describe('추적성 (RTM) - API', () => {
  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const proj = await createTestProject(request, token, '-rtm');
    projectId = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await apiDelete(request, token, `/projects/${projectId}`);
  });

  test('RTM 매트릭스 조회 → 배열 반환', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/traceability/matrix`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('커버리지 분석 조회 → requirements 포함', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/traceability/coverage`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('requirements');
  });
});
