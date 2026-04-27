import { test, expect } from '@playwright/test';
import { login, getToken, apiPost, apiDelete, createTestProject, BE_URL } from './helpers';

test.describe('관리자 - UI', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/admin');
  });

  test('관리자 페이지 정상 로드', async ({ page }) => {
    await expect(page.getByText('관리자 페이지')).toBeVisible();
  });

  test('LLM 설정 탭 - 프로바이더 추가 버튼 존재', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'LLM 설정' })).toBeVisible();
    await expect(page.getByRole('button', { name: /프로바이더 추가|Add/i })).toBeVisible();
  });

  test('사용자 관리 탭 - 사용자 목록 표시', async ({ page }) => {
    await page.getByText('사용자 관리').click();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();
  });

  test('산출물 템플릿 탭 - 4종 템플릿 표시', async ({ page }) => {
    await page.getByText('산출물 템플릿').click();
    await expect(page.getByText('산출물 템플릿 설정')).toBeVisible({ timeout: 5000 });
    const types = ['요구사항 정의서', 'WBS', 'RTM', '테스트 계획서'];
    for (const t of types) {
      await expect(page.getByText(t).first()).toBeVisible();
    }
  });

  test('산출물 템플릿 탭 - 저장 버튼 존재', async ({ page }) => {
    await page.getByText('산출물 템플릿').click();
    await expect(page.getByText('산출물 템플릿 설정')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: '저장' }).first()).toBeVisible({ timeout: 5000 });
  });

  test('LLM 미설정 경고 배너 표시', async ({ page }) => {
    await expect(page.getByText(/LLM 설정이 없습니다/)).toBeVisible();
  });
});

const ADMIN_EMAIL = 'admin@pms.com';

test.describe('관리자 - API', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await getToken(request);
  });

  test('GET /admin/users → 사용자 목록 반환', async ({ request }) => {
    const res = await request.get(`${BE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((u: any) => u.email === ADMIN_EMAIL)).toBe(true);
  });

  test('GET /admin/llm → LLM 설정 목록 반환', async ({ request }) => {
    const res = await request.get(`${BE_URL}/admin/llm`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('POST /admin/llm → LLM 설정 생성', async ({ request }) => {
    const res = await request.post(`${BE_URL}/admin/llm`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { provider: 'openai', model: 'gpt-4o', apiKey: 'sk-test-key', isActive: false },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body.provider).toBe('openai');
    await request.delete(`${BE_URL}/admin/llm/${body.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });

  test('GET /admin/templates → 4종 템플릿 반환', async ({ request }) => {
    const res = await request.get(`${BE_URL}/admin/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(4);
    const types = body.map((t: any) => t.type);
    expect(types).toContain('requirements');
    expect(types).toContain('wbs');
    expect(types).toContain('rtm');
    expect(types).toContain('test-plan');
  });

  test('PUT /admin/templates/:id → 템플릿 제목/컬럼 수정', async ({ request }) => {
    const templates = await (await request.get(`${BE_URL}/admin/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json();
    const tmpl = templates[0];
    const res = await request.put(`${BE_URL}/admin/templates/${tmpl.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: 'API 수정된 제목', columns: tmpl.columns },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('API 수정된 제목');
    await request.put(`${BE_URL}/admin/templates/${tmpl.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { title: tmpl.title, columns: tmpl.columns },
    });
  });

  test('비어있는 관리자 접근 시도 (일반유저) → 403', async ({ request }) => {
    const regRes = await request.post(`${BE_URL}/auth/register`, {
      data: { email: `testuser_${Date.now()}@test.com`, name: 'Test', password: 'Test1234!' },
    });
    const { accessToken: userToken } = await regRes.json();
    const res = await request.get(`${BE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(res.status()).toBe(403);
  });

  test('GET /projects/:id/ai/status → configured 필드 반환', async ({ request }) => {
    const proj = await apiPost(request, token, '/projects', { name: 'AI Status 테스트', status: 'active' });
    const res = await request.get(`${BE_URL}/projects/${proj.id}/ai/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('configured');
    expect(typeof body.configured).toBe('boolean');
    await request.delete(`${BE_URL}/projects/${proj.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  });
});
