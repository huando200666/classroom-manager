import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import {
  coursesFixture,
  assignmentsFixture,
  studentsFixture,
  attachmentsFixture,
  driveFixture,
  zipBytes,
  workUrl,
  courseUrl,
  studentId,
} from '../fixtures/classroom';
import type { AppState } from '../../packages/shared/types';
import { mockGoogleWeb } from '../fixtures/google-web';

function browserPath() {
  if (process.env.CM_CHROMIUM_PATH) return process.env.CM_CHROMIUM_PATH;
  const defaultPath = chromium.executablePath();
  if (existsSync(defaultPath)) return defaultPath;
  const cache = join(
    process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
    'ms-playwright',
  );
  if (existsSync(cache)) {
    const dirs = readdirSync(cache)
      .filter((n) => /^chromium-\d+$/.test(n))
      .sort()
      .reverse();
    for (const dir of dirs) {
      const exe = join(cache, dir, 'chrome-win64', 'chrome.exe');
      if (existsSync(exe)) return exe;
    }
  }
  return defaultPath;
}
test('giao diện thật, trạng thái trống, điều hướng và responsive', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mockGoogleWeb(page);
  await page.goto('http://127.0.0.1:5173');
  await expect(
    page.getByRole('heading', { name: 'Lớp học của bạn. Kết nối ngay trên web.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Đăng nhập bằng Google', exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Tải tất cả bài nộp', exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({ path: 'docs/dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('heading', { name: 'Lớp học của bạn. Kết nối ngay trên web.' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/dashboard-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('MV3: 73 sinh viên, quét và tải riêng ZIP bằng downloads của Chromium', async ({}, info) => {
  test.setTimeout(240000);
  const extension = resolve('dist/extension');
  const context = await chromium.launchPersistentContext(info.outputPath('profile'), {
    executablePath: browserPath(),
    headless: true,
    channel: 'chromium',
    acceptDownloads: true,
    downloadsPath: info.outputPath('downloads'),
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const requestedFiles: string[] = [];
  context.setDefaultTimeout(20000);
  try {
    await context.route('https://classroom.google.com/**', async (route) => {
      const u = new URL(route.request().url());
      let body: string;
      if (u.pathname === '/' || u.pathname === '/h') body = coursesFixture();
      else if (u.pathname.includes('/student/')) {
        const id = u.pathname.split('/student/')[1];
        const i = Number(id.slice(1)) - 1;
        body = attachmentsFixture(i, {
          multiple: i === 0,
          pdf: i === 1,
          empty: i === 2,
          truncated: i === 3,
        });
      } else if (u.pathname.endsWith('/submissions')) body = studentsFixture();
      else body = assignmentsFixture();
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body });
    });
    await context.route('https://drive.google.com/**', async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === '/download') {
        const id = u.searchParams.get('id')!;
        requestedFiles.push(id);
        const name = id.endsWith('_1')
          ? 'Bai_2.zip'
          : id === 'F_S01_0'
            ? 'Bai_1.zip'
            : 'Bai_tap.zip';
        await route.fulfill({
          status: 200,
          headers: {
            'content-type': 'application/zip',
            'content-disposition': `attachment; filename="${name}"`,
          },
          body: zipBytes,
        });
      } else
        await route.fulfill({
          contentType: 'text/html; charset=utf-8',
          body: driveFixture(u.pathname.split('/')[3]),
        });
    });
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    worker.on('console', (message) => console.log('WORKER:', message.text()));
    const classroom = await context.newPage();
    await classroom.goto('https://classroom.google.com/');
    const app = await context.newPage();
    await app.goto(`chrome-extension://${extensionId}/index.html`);
    const errors: string[] = [];
    app.on('pageerror', (e) => errors.push(e.message));
    await app.getByRole('button', { name: 'Làm mới tab' }).click();
    await app.getByRole('button', { name: 'Kết nối', exact: true }).click();
    await expect(app.getByText(/teacher@example.test · 1 lớp/)).toBeVisible({ timeout: 30000 });
    console.log('MV3: đã kết nối');
    await app.getByLabel('Lớp học', { exact: true }).selectOption('COURSE');
    await expect(app.getByLabel('Bài tập', { exact: true })).toContainText('BTVN tuần 7', {
      timeout: 30000,
    });
    await app.getByLabel('Bài tập', { exact: true }).selectOption('A7');
    await app.getByRole('button', { name: 'Quét bài nộp', exact: true }).click();
    await expect(app.getByText('73 / 73 sinh viên')).toBeVisible({ timeout: 40000 });
    console.log('MV3: đã quét 73 sinh viên');
    const snapshot = await app.evaluate(async () => {
      const s = await chrome.storage.local.get('classroom-manager-v1');
      return s['classroom-manager-v1'] as AppState;
    });
    expect(snapshot.run!.students.filter((s: any) => s.status === 'submitted')).toHaveLength(55);
    expect(snapshot.run!.students.filter((s: any) => s.status === 'missing')).toHaveLength(18);
    expect(snapshot.account!.teacher).toBe(true);
    expect(snapshot.run!.warnings).toEqual([]);
    await app.getByRole('button', { name: 'Tải tất cả bài nộp', exact: true }).click();
    await expect(app.getByRole('button', { name: 'Tạm dừng', exact: true })).toBeVisible();
    await app.getByRole('button', { name: 'Tạm dừng', exact: true }).click();
    await expect(app.getByRole('button', { name: 'Tiếp tục', exact: true })).toBeVisible({
      timeout: 30000,
    });
    await app.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    console.log('MV3: đã tạm dừng/tiếp tục');
    let pollCount = 0;
    await expect
      .poll(
        async () => {
          const s = await app.evaluate(async () => {
            const data = await chrome.storage.local.get('classroom-manager-v1');
            return (data['classroom-manager-v1'] as AppState).run;
          });
          if (++pollCount % 5 === 0)
            console.log(
              'MV3 état:',
              JSON.stringify({
                status: s?.status,
                checked: s?.students.filter((s) => s.checked).length,
                files: s?.files
                  .map((f) => ({
                    id: f.id,
                    status: f.status,
                    error: f.error,
                    downloadId: f.downloadId,
                  }))
                  .slice(-3),
              }),
            );
          return s?.status;
        },
        { timeout: 180000, intervals: [500, 1000, 2000] },
      )
      .toBe('complete');
    const result = await app.evaluate(async () => {
      const s = await chrome.storage.local.get('classroom-manager-v1');
      return s['classroom-manager-v1'] as AppState;
    });
    expect(result.run!.students.filter((s: any) => s.checked)).toHaveLength(55);
    expect(result.run!.files).toHaveLength(54);
    expect(result.run!.files.every((f: any) => f.status === 'complete')).toBe(true);
    expect(result.history.filter((h: any) => h.status === 'complete')).toHaveLength(54);
    expect(result.run!.students.filter((s: any) => s.noFiles)).toHaveLength(2);
    expect(requestedFiles).toHaveLength(54);
    expect(requestedFiles).not.toContain('TEACHER');
    expect(requestedFiles.some((id) => Number(id.match(/S(\d+)/)?.[1]) > 55)).toBe(false);
    await app.getByRole('button', { name: 'Xuất CSV', exact: true }).click();
    await app.screenshot({ path: 'docs/download-tested.png', fullPage: true });
    await app
      .getByRole('navigation')
      .getByRole('button', { name: 'Lịch sử tải xuống', exact: true })
      .click();
    await expect(app.locator('tbody tr')).toHaveCount(54);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
