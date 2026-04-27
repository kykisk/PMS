import { test, expect } from '@playwright/test';
import { login, getToken, apiPost, apiGet, apiDelete, createTestProject, createTestRequirement, BE_URL } from './helpers';

let token: string;
let projectId: string;

test.describe('요구사항 - API CRUD', () => {
  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const proj = await createTestProject(request, token, '-req');
    projectId = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await apiDelete(request, token, `/projects/${projectId}`);
  });

  test('POST /requirements → REQ-001 코드 자동 생성', async ({ request }) => {
    const res = await request.post(`${BE_URL}/projects/${projectId}/requirements`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: '로그인 기능 요구사항', category: '기능', priority: 'high', status: 'new' },
    });
    expect([200,201]).toContain(res.status());
    const body = await res.json();
    expect(body.code).toMatch(/^REQ-\d{3}$/);
    expect(body.title).toBe('로그인 기능 요구사항');
  });

  test('GET /requirements → 페이지네이션 응답 { data, total, page, totalPages }', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/requirements`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200,201]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('totalPages');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /requirements?status=new → status 필터 동작', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/requirements?status=new`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    body.data.forEach((r: any) => expect(r.status).toBe('new'));
  });

  test('GET /requirements?page=1&limit=5 → 5개 이하 반환', async ({ request }) => {
    await Promise.all(Array.from({ length: 6 }, (_, i) =>
      apiPost(request, token, `/projects/${projectId}/requirements`, {
        title: `페이지 테스트 ${i}`, priority: 'medium', status: 'new',
      })
    ));
    const res = await request.get(`${BE_URL}/projects/${projectId}/requirements?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(5);
    expect(body.data.length).toBeLessThanOrEqual(5);
  });

  test('PUT /requirements/:id → 상태/우선순위 수정', async ({ request }) => {
    const req = await createTestRequirement(request, token, projectId);
    const res = await request.put(`${BE_URL}/projects/${projectId}/requirements/${req.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status: 'confirmed', priority: 'low' },
    });
    expect([200,201]).toContain(res.status());
    const body = await res.json();
    expect(body.status).toBe('confirmed');
    expect(body.priority).toBe('low');
  });

  test('DELETE /requirements/:id → 삭제 후 404', async ({ request }) => {
    const req = await createTestRequirement(request, token, projectId);
    const delRes = await request.delete(`${BE_URL}/projects/${projectId}/requirements/${req.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200,201,204]).toContain(delRes.status());
    const getRes = await request.get(`${BE_URL}/projects/${projectId}/requirements/${req.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(getRes.status()).toBe(404);
  });
});

test.describe('요구사항 - 버전 관리 API', () => {
  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const proj = await createTestProject(request, token, '-ver');
    projectId = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await apiDelete(request, token, `/projects/${projectId}`);
  });

  test('버전 스냅샷 저장 → 버전 목록 조회', async ({ request }) => {
    const saveRes = await request.post(`${BE_URL}/projects/${projectId}/versions/requirement`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { version: 'v1.0', label: '초기 버전', reason: 'E2E 테스트' },
    });
    expect([200,201]).toContain(saveRes.status());

    const listRes = await request.get(`${BE_URL}/projects/${projectId}/versions/requirement`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.status()).toBe(200);
    const list = await listRes.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });
});

test.describe('요구사항 - UI', () => {
  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const proj = await createTestProject(request, token, '-req-ui');
    projectId = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await apiDelete(request, token, `/projects/${projectId}`);
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/requirements`);
  });

  test('요구사항 목록 페이지 로드', async ({ page }) => {
    await expect(page.locator('table, [data-testid="requirement-list"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('생성 버튼 클릭 → 모달 표시', async ({ page }) => {
    await page.getByRole('button', { name: /생성|Create|\+/i }).first().click();
    await expect(page.locator('[role="dialog"]').first()).toBeVisible();
  });

  test('요구사항 생성 → 목록에 나타남', async ({ page }) => {
    const title = `UI 요구사항 ${Date.now()}`;
    await page.getByRole('button', { name: /생성|Create|\+/i }).first().click();
    await page.locator('[role="dialog"] input').first().fill(title);
    await page.getByRole('button', { name: /저장|Save/i }).last().click();
    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 });
  });

  test('내보내기 - Excel 버튼 존재', async ({ page }) => {
    await expect(page.getByRole('main').getByRole('button', { name: 'Excel', exact: true })).toBeVisible();
  });

  test('내보내기 - PDF 버튼 존재', async ({ page }) => {
    await expect(page.getByRole('main').getByRole('button', { name: 'PDF', exact: true })).toBeVisible();
  });

  test('AI 기술서 Import 버튼 존재', async ({ page }) => {
    await expect(page.getByRole('button', { name: /AI 기술서|AI Import/i })).toBeVisible();
  });
});
