import { test, expect } from '@playwright/test';

test.describe('Jornal browser smoke', () => {
  test('login page renders and protected dashboard redirects unauthenticated users', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('backend health is reachable through the frontend proxy', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
  });
});

async function login(page, login, password) {
  await page.goto('/login');
  await page.getByLabel('Логин').fill(login);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test('admin can log in and open the admin dashboard', async ({ page }) => {
  const loginValue = process.env.E2E_ADMIN_LOGIN;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!loginValue || !password, 'E2E_ADMIN_LOGIN/E2E_ADMIN_PASSWORD are not configured');

  await login(page, loginValue, password);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /Панель администратора/i })).toBeVisible();
});

const optionalRoles = [
  ['teacher', 'E2E_TEACHER_LOGIN', 'E2E_TEACHER_PASSWORD', '/teacher/lessons', /Занятия|пары/i],
  ['student', 'E2E_STUDENT_LOGIN', 'E2E_STUDENT_PASSWORD', '/homework', /Домашние задания/i],
  ['parent', 'E2E_PARENT_LOGIN', 'E2E_PARENT_PASSWORD', '/parent', /Родитель|ребён|ребен/i],
];

for (const [name, loginEnv, passwordEnv, path, heading] of optionalRoles) {
  test(`${name} can authenticate and open its role area`, async ({ page }) => {
    const loginValue = process.env[loginEnv];
    const password = process.env[passwordEnv];
    test.skip(!loginValue || !password, `${loginEnv}/${passwordEnv} are not configured`);

    await login(page, loginValue, password);
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
  });
}
