import { test, expect } from '@playwright/test';
import { login, getToken, apiPost, apiDelete, createTestProject, createTestRequirement, createTestFeature, BE_URL } from './helpers';

let token: string;
let projectId: string;

test.describe('Export - API (Excel 다운로드)', () => {
  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const proj = await createTestProject(request, token, '-export');
    projectId = proj.id;
    await createTestRequirement(request, token, projectId);
    const feat = await createTestFeature(request, token, projectId);
    await apiPost(request, token, `/projects/${projectId}/tasks`, {
      title: 'WBS 테스트 Task', featureId: feat.id, status: 'pending', progress: 0,
    });
    await apiPost(request, token, `/projects/${projectId}/test-scenarios`, {
      title: 'Export 테스트 시나리오', type: 'integration', status: 'draft',
    });
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await apiDelete(request, token, `/projects/${projectId}`);
  });

  test('GET /export/requirements → 200 + xlsx Content-Type', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/export/requirements`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('spreadsheetml');
  });

  test('GET /export/wbs → 200 + xlsx Content-Type', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/export/wbs`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('spreadsheetml');
  });

  test('GET /export/rtm → 200 + xlsx Content-Type', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/export/rtm`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('spreadsheetml');
  });

  test('GET /export/test-plan → 200 + xlsx Content-Type', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/export/test-plan`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('spreadsheetml');
  });

  test('GET /export/requirements-json → 배열 반환 (PDF용)', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/export/requirements-json`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('GET /export/wbs-json → Task 배열 반환', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/export/wbs-json`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /export/rtm-json → RTM 배열 반환', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/export/rtm-json`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('GET /export/test-plan-json → { scenarios } 반환', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/export/test-plan-json`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('scenarios');
    expect(Array.isArray(body.scenarios)).toBe(true);
  });

  test('인증 없이 export → 401', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/export/requirements`);
    expect(res.status()).toBe(401);
  });
});

test.describe('Export - UI 버튼 존재 확인', () => {
  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const proj = await createTestProject(request, token, '-export-ui');
    projectId = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await apiDelete(request, token, `/projects/${projectId}`);
  });

  test('요구사항 목록 - Excel/PDF 버튼', async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/requirements`);
    await expect(page.getByRole('main').getByRole('button', { name: 'Excel', exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'PDF', exact: true })).toBeVisible();
  });

  test('Task 목록 - WBS Excel/PDF 버튼', async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/tasks`);
    await expect(page.getByRole('main').getByRole('button', { name: 'WBS Excel', exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'WBS PDF', exact: true })).toBeVisible();
  });

  test('RTM 페이지 - RTM Excel/PDF 버튼', async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/traceability`);
    await expect(page.getByRole('main').getByRole('button', { name: 'RTM Excel', exact: true })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: 'RTM PDF', exact: true })).toBeVisible();
  });

  test('테스트 목록 - 계획서 Excel/PDF 버튼', async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/tests`);
    await expect(page.getByRole('button', { name: /계획서 Excel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /계획서 PDF/i })).toBeVisible();
  });

  test('사이드바 - 산출물 내보내기 퀵링크 표시', async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/requirements`);
    await expect(page.getByText('산출물 내보내기')).toBeVisible();
  });
});
