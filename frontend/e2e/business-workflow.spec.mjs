import { test, expect } from '@playwright/test';

const API = process.env.E2E_API_BASE_URL || process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

async function login(request, login, password) {
  const r = await request.post(`${API}/api/auth/login`, { data: { login, password } });
  expect(r.ok(), `login failed for ${login}: ${await r.text()}`).toBeTruthy();
  const body = await r.json();
  return body;
}

async function api(request, token, method, path, data) {
  const r = await request.fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
  return r;
}

async function jsonOk(request, token, method, path, data) {
  const r = await api(request, token, method, path, data);
  expect(r.ok(), `${method} ${path}: ${await r.text()}`).toBeTruthy();
  return r.status() === 204 ? null : await r.json();
}

test.describe('Jornal core business workflow', () => {
  test('Admin creates academic structure, teacher creates homework, student submits, parent reads result', async ({ request, page }) => {
    const adminLogin = process.env.E2E_ADMIN_LOGIN;
    const adminPassword = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!adminLogin || !adminPassword, 'E2E_ADMIN_LOGIN/E2E_ADMIN_PASSWORD are not configured');

    const stamp = Date.now();
    const teacherLogin = `e2e_teacher_${stamp}`;
    const studentLogin = `e2e_student_${stamp}`;
    const parentLogin = `e2e_parent_${stamp}`;
    const password = process.env.E2E_TEST_PASSWORD || 'E2E-Test-Password-123!';

    const admin = await login(request, adminLogin, adminPassword);
    let groupId;
    let subjectId;
    let teacherId;
    let studentId;
    let parentId;
    let lessonId;
    let homeworkId;
    let submissionId;

    try {
      const group = await jsonOk(request, admin.accessToken, 'POST', '/api/admin/academic/groups', { name: `E2E Group ${stamp}` });
      groupId = group.id;

      const teacher = await jsonOk(request, admin.accessToken, 'POST', '/api/admin/users', {
        login: teacherLogin, fullName: `E2E Teacher ${stamp}`, role: 'Teacher', password,
      });
      teacherId = teacher.id;

      const student = await jsonOk(request, admin.accessToken, 'POST', '/api/admin/users', {
        login: studentLogin, fullName: `E2E Student ${stamp}`, role: 'Student', password, studyGroupId: groupId,
      });
      studentId = student.id;

      const parent = await jsonOk(request, admin.accessToken, 'POST', '/api/admin/users', {
        login: parentLogin, fullName: `E2E Parent ${stamp}`, role: 'Parent', password,
      });
      parentId = parent.id;

      const subject = await jsonOk(request, admin.accessToken, 'POST', '/api/admin/academic/subjects', { name: `E2E Subject ${stamp}` });
      subjectId = subject.id;
      await jsonOk(request, admin.accessToken, 'PUT', `/api/admin/academic/subjects/${subjectId}/teacher`, { teacherId });
      await jsonOk(request, admin.accessToken, 'POST', `/api/admin/users/parents/${parentId}/students/${studentId}`);

      const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
      start.setSeconds(0, 0);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const lesson = await jsonOk(request, admin.accessToken, 'POST', '/api/admin/academic/schedule', {
        groupId, subjectId, teacherId, startAt: start.toISOString(), endAt: end.toISOString(), lessonNumber: 1, room: 'E2E-01',
      });
      lessonId = lesson.id;

      const teacherAuth = await login(request, teacherLogin, password);
      const teacherLesson = await jsonOk(request, teacherAuth.accessToken, 'GET', `/api/assessment/lesson/${lessonId}`);
      expect(teacherLesson.lessonId).toBe(lessonId);

      const homework = await jsonOk(request, teacherAuth.accessToken, 'POST', `/api/assessment/lesson/${lessonId}/homework`, {
        title: `E2E Homework ${stamp}`, description: 'Explain the core idea and provide an example.', deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      });
      homeworkId = homework.id;

      const studentAuth = await login(request, studentLogin, password);
      const studentHomework = await jsonOk(request, studentAuth.accessToken, 'GET', '/api/assessment/student');
      expect(studentHomework.some(x => x.homeworkId === homeworkId)).toBeTruthy();

      await jsonOk(request, studentAuth.accessToken, 'POST', `/api/assessment/homework/${homeworkId}/submit`, {
        answer: 'This is the E2E student answer with a concrete example.',
      });

      const submissions = await jsonOk(request, teacherAuth.accessToken, 'GET', `/api/assessment/submissions/${lessonId}`);
      const submission = submissions.find(x => x.homeworkId === homeworkId && x.studentId === studentId);
      expect(submission).toBeTruthy();
      submissionId = submission.submissionId;

      // The final grade must be blocked until the mandatory teacher quiz is completed.
      const blocked = await api(request, teacherAuth.accessToken, 'PUT', `/api/assessment/submissions/${submissionId}/review`, {
        teacherScore: 8, teacherComment: 'Must not be accepted before AI quiz.',
      });
      expect(blocked.status()).toBe(409);

      const parentAuth = await login(request, parentLogin, password);
      const parentHomework = await jsonOk(request, parentAuth.accessToken, 'GET', `/api/parent/${studentId}/homework`);
      expect(parentHomework.some(x => x.id === homeworkId)).toBeTruthy();

      // Also verify the real UI routes for all three non-admin roles.
      await page.goto('/login');
      await page.getByLabel('Логин').fill(teacherLogin);
      await page.getByLabel('Пароль').fill(password);
      await page.getByRole('button', { name: 'Войти' }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto('/teacher/lessons');
      await expect(page.getByRole('heading', { name: /Мои занятия|занятия|пары/i }).first()).toBeVisible();

      await page.evaluate(() => localStorage.clear());
      await page.goto('/login');
      await page.getByLabel('Логин').fill(studentLogin);
      await page.getByLabel('Пароль').fill(password);
      await page.getByRole('button', { name: 'Войти' }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto('/homework');
      await expect(page.getByRole('heading', { name: /Домашние задания/i }).first()).toBeVisible();

      await page.evaluate(() => localStorage.clear());
      await page.goto('/login');
      await page.getByLabel('Логин').fill(parentLogin);
      await page.getByLabel('Пароль').fill(password);
      await page.getByRole('button', { name: 'Войти' }).click();
      await expect(page).toHaveURL(/\/dashboard$/);
      await page.goto('/parent');
      await expect(page.getByRole('heading', { name: /Родитель|ребён|ребен/i }).first()).toBeVisible();

      // Final teacher grade (no AI pre-check required).
      await jsonOk(request, teacherAuth.accessToken, 'PUT', `/api/assessment/submissions/${submissionId}/review`, { teacherScore: 8, teacherComment: 'E2E final teacher decision.' });
    } finally {
      if (lessonId) await api(request, admin.accessToken, 'DELETE', `/api/admin/academic/schedule/${lessonId}?force=true`);
      if (parentId && studentId) await api(request, admin.accessToken, 'DELETE', `/api/admin/users/parents/${parentId}/students/${studentId}`);
      if (parentId) await api(request, admin.accessToken, 'DELETE', `/api/admin/users/${parentId}`);
      if (studentId) await api(request, admin.accessToken, 'DELETE', `/api/admin/users/${studentId}`);
      if (teacherId) await api(request, admin.accessToken, 'DELETE', `/api/admin/users/${teacherId}`);
      if (subjectId) await api(request, admin.accessToken, 'DELETE', `/api/admin/academic/subjects/${subjectId}`);
      if (groupId) await api(request, admin.accessToken, 'DELETE', `/api/admin/academic/groups/${groupId}`);
    }
  });
});
