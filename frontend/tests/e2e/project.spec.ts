import { test, expect } from '@playwright/test';
import { login, getToken, apiPost, apiDelete, createTestProject, BE_URL } from './helpers';

test.describe('프로젝트 - UI', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('프로젝트 목록 페이지 로드', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('프로젝트 생성 버튼 클릭 → 모달 오픈', async ({ page }) => {
    await page.getByRole('button', { name: /생성|Create|\+/i }).first().click();
    await expect(page.locator('[role="dialog"]').first()).toBeVisible({ timeout: 5000 });
  });

  test.fixme('새 프로젝트 생성 → 프로젝트 페이지로 이동', async ({ page }) => {
    await page.getByRole('button', { name: /생성|Create|\+/i }).first().click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ timeout: 5000 });
    const nameInput = dialog.locator('input').first();
    await nameInput.waitFor({ timeout: 5000 });
    await nameInput.fill(`테스트 ${Date.now()}`);
    await nameInput.press('Enter');
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+/, { timeout: 15000 });
  });
});

test.describe('프로젝트 - API', () => {
  let token: string;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await apiDelete(request, token, `/projects/${projectId}`);
  });

  test('POST /projects → 프로젝트 생성', async ({ request }) => {
    const res = await request.post(`${BE_URL}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'API 테스트 프로젝트', description: '테스트용' },
    });
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('id');
    projectId = body.id;
  });

  test('GET /projects → 목록 반환', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('PUT /projects/:id → 수정', async ({ request }) => {
    const res = await request.put(`${BE_URL}/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: '수정된 프로젝트명' },
    });
    expect([200, 201]).toContain(res.status());
    expect((await res.json()).name).toBe('수정된 프로젝트명');
  });

  test('GET /projects/:id/dashboard → taskProgress 포함', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${projectId}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('taskProgress');
  });

  test('POST /projects/:id/members → 중복 허용', async ({ request }) => {
    const { id: userId } = await (await request.get(`${BE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    const res = await request.post(`${BE_URL}/projects/${projectId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { userId },
    });
    expect([200, 201, 400, 409]).toContain(res.status());
  });

  test('DELETE /projects/:id → 삭제', async ({ request }) => {
    const proj = await apiPost(request, token, '/projects', { name: '삭제용' });
    const res = await request.delete(`${BE_URL}/projects/${proj.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 201, 204]).toContain(res.status());
  });
});
