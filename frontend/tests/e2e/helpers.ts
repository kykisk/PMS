import type { Page, APIRequestContext } from '@playwright/test';

export const ADMIN = { email: 'admin@pms.com', password: 'Admin1234!' };
export const BE_URL = 'http://localhost:3000/api/v1';

export async function login(page: Page, email = ADMIN.email, password = ADMIN.password) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /로그인|Login/i }).click();
  await page.waitForURL(/\/projects/, { timeout: 10000 });
}

export async function getToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BE_URL}/auth/login`, {
    data: { email: ADMIN.email, password: ADMIN.password },
  });
  const body = await res.json();
  return body.accessToken as string;
}

export async function apiPost(request: APIRequestContext, token: string, path: string, data: object) {
  const res = await request.post(`${BE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  return res.json();
}

export async function apiGet(request: APIRequestContext, token: string, path: string) {
  const res = await request.get(`${BE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function apiDelete(request: APIRequestContext, token: string, path: string) {
  return request.delete(`${BE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createTestProject(request: APIRequestContext, token: string, suffix = '') {
  return apiPost(request, token, '/projects', {
    name: `E2E 테스트 프로젝트${suffix} ${Date.now()}`,
    description: 'Playwright E2E 테스트용',
    
  });
}

export async function createTestRequirement(request: APIRequestContext, token: string, projectId: string) {
  return apiPost(request, token, `/projects/${projectId}/requirements`, {
    title: `E2E 요구사항 ${Date.now()}`,
    category: '기능',
    priority: 'high',
    status: 'new',
    description: 'E2E 테스트용 요구사항',
  });
}

export async function createTestFeature(request: APIRequestContext, token: string, projectId: string, reqId?: string) {
  return apiPost(request, token, `/projects/${projectId}/features`, {
    title: `E2E 기능 ${Date.now()}`,
    description: 'E2E 테스트용 기능',
    status: 'new',
    ...(reqId ? { reqId } : {}),
  });
}
