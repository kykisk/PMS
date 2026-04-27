import { test, expect } from '@playwright/test';
import { login, getToken, apiPost, apiDelete, createTestProject, BE_URL } from './helpers';

let token: string;
let projectId: string;

test.describe('대시보드 - UI', () => {
  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const proj = await createTestProject(request, token, '-dash');
    projectId = proj.id;
    const feat = await apiPost(request, token, `/projects/${projectId}/features`, { title: '기능' });
    await apiPost(request, token, `/projects/${projectId}/tasks`, { title: 'Task', featureId: feat.id, progress: 50 });
    await apiPost(request, token, `/projects/${projectId}/requirements`, { title: '요구사항', priority: 'high', status: 'new' });
  });

  test.afterAll(async ({ request }) => {
    if (projectId) await apiDelete(request, token, `/projects/${projectId}`);
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${projectId}/dashboard`);
  });

  test('대시보드 페이지 로드', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/dashboard`));
    await expect(page.locator('body')).not.toContainText('404');
  });

  test('총 건 텍스트 또는 숫자 표시', async ({ page }) => {
    await expect(page.getByText(/총|건|개/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('프로젝트 멤버 섹션', async ({ page }) => {
    await expect(page.getByText(/멤버|member/i).first()).toBeVisible({ timeout: 20000 });
  });
});

test.describe('대시보드 - API', () => {
  let pid: string;

  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const proj = await createTestProject(request, token, '-dash-api');
    pid = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (pid) await apiDelete(request, token, `/projects/${pid}`);
  });

  test('빈 프로젝트 - taskProgress 포함', async ({ request }) => {
    const res = await request.get(`${BE_URL}/projects/${pid}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    expect(body.taskProgress.total).toBe(0);
    expect(body.taskProgress.avgProgress).toBe(0);
  });

  test('Task 추가 후 진척율 반영', async ({ request }) => {
    const feat = await apiPost(request, token, `/projects/${pid}/features`, { title: '기능' });
    await apiPost(request, token, `/projects/${pid}/tasks`, { title: 'Task', featureId: feat.id, progress: 60 });
    const res = await request.get(`${BE_URL}/projects/${pid}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect((await res.json()).taskProgress.avgProgress).toBe(60);
  });

  test('이슈 등록 후 issues 반영', async ({ request }) => {
    const feat = await apiPost(request, token, `/projects/${pid}/features`, { title: '기능2' });
    const task = await apiPost(request, token, `/projects/${pid}/tasks`, { title: 'Task2', featureId: feat.id, progress: 0 });
    await apiPost(request, token, `/projects/${pid}/tasks/${task.id}/issues`, {
      title: '이슈', type: 'issue', severity: 'high',
    });
    const res = await request.get(`${BE_URL}/projects/${pid}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect((await res.json()).issues.length).toBeGreaterThan(0);
  });
});

test.describe.skip('사이드바 네비게이션 - UI', () => {
  let navPid: string;

  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
    const proj = await createTestProject(request, token, '-nav');
    navPid = proj.id;
  });

  test.afterAll(async ({ request }) => {
    if (navPid) await apiDelete(request, token, `/projects/${navPid}`);
  });

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`/projects/${navPid}/dashboard`);
  });

  test.fixme('요구사항 메뉴 클릭 → /requirements 이동', async ({ page }) => {
    await page.getByRole('link', { name: '요구사항', exact: true }).first().click();
    await expect(page).toHaveURL(/\/requirements/);
  });

  test('기능 리스트 메뉴 클릭 → /features 이동', async ({ page }) => {
    await page.getByRole('link', { name: '기능 리스트' }).first().click();
    await expect(page).toHaveURL(/\/features/);
  });

  test('Admin 관리자 링크 표시', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.getByRole('link', { name: /관리자|admin/i })).toBeVisible();
  });
});
