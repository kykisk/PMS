import { test, expect } from '@playwright/test';
import { login, getToken, apiPost, ADMIN, BE_URL } from './helpers';

test.describe('인증 - 로그인/로그아웃', () => {
  test('유효한 자격증명으로 로그인 성공 후 /projects 이동', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(ADMIN.email);
    await page.locator('#password').fill(ADMIN.password);
    await page.getByRole('button', { name: /로그인|Login/i }).click();
    await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });
  });

  test('잘못된 비밀번호 → 에러 메시지 표시, 페이지 이동 없음', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(ADMIN.email);
    await page.locator('#password').fill('wrong1234');
    await page.getByRole('button', { name: /로그인|Login/i }).click();
    await expect(page.locator('.text-red-500').first()).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('이메일 형식 오류 → 폼 제출 불가', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('notanemail');
    await page.locator('#password').fill('password');
    await page.getByRole('button', { name: /로그인|Login/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('로그인 없이 보호된 경로 접근 → /login 리다이렉트', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test('로그인 후 로그아웃 → /login 이동', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: /로그아웃|Logout/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

test.describe('인증 - 회원가입', () => {
  test('회원가입 페이지 접근', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('#email, [name="email"]').first()).toBeVisible();
  });

  test('이미 존재하는 이메일로 가입 시도 → 에러', async ({ page }) => {
    await page.goto('/register');
    const nameField = page.locator('[name="name"], #name').first();
    if (await nameField.isVisible()) await nameField.fill('Test User');
    await page.locator('#email, [name="email"]').first().fill(ADMIN.email);
    await page.locator('#password, [name="password"]').first().fill('TestPass123!');
    await page.getByRole('button', { name: /가입|Register/i }).click();
    await expect(page.locator('.text-red-500, [class*="error"]').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('인증 - API', () => {
  test('POST /auth/login → accessToken + refreshToken 반환', async ({ request }) => {
    const res = await request.post(`${BE_URL}/auth/login`, {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    expect([200,201]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('accessToken');
    expect(body).toHaveProperty('refreshToken');
  });

  test('GET /auth/me → 유저 정보 반환 (토큰 유효)', async ({ request }) => {
    const loginRes = await request.post(`${BE_URL}/auth/login`, {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
    const { accessToken } = await loginRes.json();
    const meRes = await request.get(`${BE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(meRes.status()).toBe(200);
    const user = await meRes.json();
    expect(user.email).toBe(ADMIN.email);
    expect(user.role).toBe('ADMIN');
  });

  test('GET /auth/me → 401 (토큰 없음)', async ({ request }) => {
    const res = await request.get(`${BE_URL}/auth/me`);
    expect(res.status()).toBe(401);
  });
});
