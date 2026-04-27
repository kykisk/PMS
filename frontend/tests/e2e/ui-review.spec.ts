import { test } from '@playwright/test';
import { login, getToken, apiPost, createTestProject, createTestRequirement, createTestFeature } from './helpers';

const DIR = 'ui-review';

test('UI Review - 전체 페이지 캡처', async ({ page, request }) => {
  const token = await getToken(request);
  const proj = await createTestProject(request, token, '-ui-review');
  const pid = proj.id;

  const req = await createTestRequirement(request, token, pid);
  const feat = await createTestFeature(request, token, pid, req.id);
  await apiPost(request, token, `/projects/${pid}/tasks`, { title: 'UI 리뷰 Task', featureId: feat.id, progress: 60 });
  await apiPost(request, token, `/projects/${pid}/test-scenarios`, { title: 'UI 리뷰 시나리오', type: 'integration' });

  await login(page);

  await page.screenshot({ path: `${DIR}/01-project-list.png`, fullPage: true });

  await page.goto(`/projects/${pid}/dashboard`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${DIR}/02-dashboard.png`, fullPage: true });

  await page.goto(`/projects/${pid}/requirements`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/03-requirements.png`, fullPage: true });

  await page.goto(`/projects/${pid}/requirements/${req.id}`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/04-requirement-detail.png`, fullPage: true });

  await page.goto(`/projects/${pid}/features`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/05-features.png`, fullPage: true });

  await page.goto(`/projects/${pid}/features/${feat.id}`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/06-feature-detail.png`, fullPage: true });

  await page.goto(`/projects/${pid}/tasks`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/07-tasks.png`, fullPage: true });

  await page.goto(`/projects/${pid}/tests`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/08-tests.png`, fullPage: true });

  await page.goto(`/projects/${pid}/traceability`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/09-rtm.png`, fullPage: true });

  await page.goto('/admin');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${DIR}/10-admin-llm.png`, fullPage: true });

  await page.getByText('사용자 관리').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/11-admin-users.png`, fullPage: true });

  await page.getByText('산출물 템플릿').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/12-admin-templates.png`, fullPage: true });

  await page.goto('/login');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/13-login.png`, fullPage: true });
});
