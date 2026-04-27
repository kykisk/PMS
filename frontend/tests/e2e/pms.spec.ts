import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'admin@pms.com';
const ADMIN_PASSWORD = 'Admin1234!';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('#email').fill(ADMIN_EMAIL);
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /로그인|Login/i }).click();
  await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });
}

test.describe('인증', () => {
  test('로그인 성공 → /projects 이동', async ({ page }) => {
    await login(page);
    await expect(page.getByText('PMS')).toBeVisible();
  });

  test('잘못된 비밀번호 → 에러 표시', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill(ADMIN_EMAIL);
    await page.locator('#password').fill('wrongpassword');
    await page.getByRole('button', { name: /로그인|Login/i }).click();
    await expect(page.locator('.text-red-500').first()).toBeVisible({ timeout: 5000 });
  });

  test('로그인 없이 /projects 접근 → /login 리다이렉트', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

test.describe('프로젝트 관리', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('프로젝트 목록 페이지 로드', async ({ page }) => {
    await expect(page).toHaveURL(/\/projects/);
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('프로젝트 생성 버튼 존재', async ({ page }) => {
    const createBtn = page.getByRole('button', { name: /생성|Create|\+/i }).first();
    await expect(createBtn).toBeVisible();
  });
});

test.describe('관리자', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('관리자 페이지 접근', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText('관리자 페이지')).toBeVisible({ timeout: 5000 });
  });

  test('LLM 설정 탭 존재', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByRole('button', { name: 'LLM 설정' })).toBeVisible();
  });

  test('산출물 템플릿 탭 존재', async ({ page }) => {
    await page.goto('/admin');
    await page.getByText('산출물 템플릿').click();
    await expect(page.getByText('산출물 템플릿 설정')).toBeVisible({ timeout: 5000 });
  });
});
