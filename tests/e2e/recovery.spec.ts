import { test, expect, chromium } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {
  coursesFixture,
  assignmentsFixture,
  studentsFixture,
  attachmentsFixture,
  driveFixture,
  zipBytes,
} from '../fixtures/classroom';
import type { AppState } from '../../packages/shared/types';
function browserPath() {
  if (process.env.CM_CHROMIUM_PATH) return process.env.CM_CHROMIUM_PATH;
  const p = chromium.executablePath();
  if (existsSync(p)) return p;
  const cache = join(
    process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
    'ms-playwright',
  );
  for (const dir of readdirSync(cache)
    .filter((n) => /^chromium-\d+$/.test(n))
    .sort()
    .reverse()) {
    const exe = join(cache, dir, 'chrome-win64', 'chrome.exe');
    if (existsSync(exe)) return exe;
  }
  return p;
}
test('MV3 phục hồi: tiếng Anh, gián đoạn, Drive từ chối, HTML giả ZIP và chỉ thử lại lỗi', async ({}, info) => {
  test.setTimeout(180000);
  const extension = resolve('dist/extension');
  const context = await chromium.launchPersistentContext(info.outputPath('profile'), {
    executablePath: browserPath(),
    headless: true,
    channel: 'chromium',
    acceptDownloads: true,
    downloadsPath: info.outputPath('downloads'),
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  context.setDefaultTimeout(20000);
  let recovered = false;
  const requests: string[] = [];
  try {
    await context.route('https://classroom.google.com/**', async (route) => {
      const u = new URL(route.request().url());
      let body: string;
      if (u.pathname === '/') body = coursesFixture();
      else if (u.pathname.includes('/student/')) {
        const i = Number(u.pathname.split('/student/S')[1]) - 1;
        body = attachmentsFixture(i, { multiple: i === 0 });
      } else if (u.pathname.endsWith('/submissions')) body = studentsFixture('en', 5, 4);
      else body = assignmentsFixture();
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body });
    });
    await context.route('https://drive.google.com/**', async (route) => {
      const u = new URL(route.request().url());
      if (u.pathname === '/download') {
        const id = u.searchParams.get('id')!;
        requests.push(id);
        if (!recovered && id === 'F_S01_1') {
          await route.abort('connectionreset');
          return;
        }
        if (!recovered && id === 'F_S03_0') {
          await route.fulfill({
            headers: {
              'content-type': 'text/html',
              'content-disposition': 'attachment; filename="Bai_tap.zip"',
            },
            body: '<html>Google sign in</html>',
          });
          return;
        }
        await route.fulfill({
          headers: {
            'content-type': 'application/zip',
            'content-disposition': `attachment; filename="${id === 'F_S01_1' ? 'Bai_2.zip' : id === 'F_S01_0' ? 'Bai_1.zip' : 'Bai_tap.zip'}"`,
          },
          body: zipBytes,
        });
        return;
      }
      const id = u.pathname.split('/')[3];
      if (!recovered && id === 'F_S02_0') {
        await route.fulfill({
          contentType: 'text/html',
          body: '<main><h1>You need access</h1></main>',
        });
        return;
      }
      await route.fulfill({ contentType: 'text/html', body: driveFixture(id) });
    });
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const classroom = await context.newPage();
    await classroom.goto('https://classroom.google.com/');
    const app = await context.newPage();
    await app.goto(`chrome-extension://${extensionId}/index.html`);
    await app.getByRole('button', { name: 'Làm mới tab' }).click();
    await app.getByRole('button', { name: 'Kết nối', exact: true }).click();
    await expect(app.getByText(/teacher@example.test · 1 lớp/)).toBeVisible();
    await app.getByLabel('Lớp học', { exact: true }).selectOption('COURSE');
    await expect(app.getByLabel('Bài tập', { exact: true })).toContainText('BTVN tuần 7');
    await app.getByLabel('Bài tập', { exact: true }).selectOption('A7');
    await app.getByRole('button', { name: 'Quét bài nộp', exact: true }).click();
    await expect(app.getByText('5 / 5 sinh viên')).toBeVisible();
    await app.getByRole('button', { name: 'Tải tất cả bài nộp', exact: true }).click();
    async function state() {
      return app.evaluate(async () => {
        const data = await chrome.storage.local.get('classroom-manager-v1');
        return data['classroom-manager-v1'] as AppState;
      });
    }
    await expect
      .poll(async () => (await state()).run?.status, { timeout: 90000, intervals: [1000] })
      .toBe('complete');
    const first = await state();
    expect(first.run!.files.filter((f) => f.status === 'complete')).toHaveLength(2);
    expect(first.run!.files.filter((f) => f.status === 'failed')).toHaveLength(3);
    expect(first.run!.files.find((f) => f.id === 'F_S02_0')?.error).toMatch(/quyền truy cập/);
    expect(first.run!.files.find((f) => f.id === 'F_S03_0')?.status).toBe('failed');
    expect(first.run!.students.find((s) => s.id === 'S05')?.checked).toBe(false);
    expect(requests.filter((id) => id === 'F_S01_0')).toHaveLength(1);
    recovered = true;
    await app.getByRole('button', { name: 'Tải lại lỗi', exact: true }).click();
    await expect
      .poll(async () => (await state()).run?.status, { timeout: 60000, intervals: [500, 1000] })
      .toBe('complete');
    const second = await state();
    expect(second.run!.files.every((f) => f.status === 'complete')).toBe(true);
    expect(second.history.filter((h) => h.status === 'complete')).toHaveLength(5);
    expect(requests.filter((id) => id === 'F_S01_0')).toHaveLength(1);
    expect(requests.filter((id) => id === 'F_S04_0')).toHaveLength(1);
    expect(requests.some((id) => id.includes('S05') || id === 'TEACHER')).toBe(false);
    const csvDownload = app.waitForEvent('download', (d) => d.suggestedFilename().endsWith('.csv'));
    await app.getByRole('button', { name: 'Xuất CSV', exact: true }).click();
    const csvFile = await (await csvDownload).path();
    const csvText = await readFile(csvFile!, 'utf8');
    expect(csvText.charCodeAt(0)).toBe(0xfeff);
    expect(csvText).toContain('Sinh viên 05');
    const xlsxDownload = app.waitForEvent('download', (d) =>
      d.suggestedFilename().endsWith('.xlsx'),
    );
    await app.getByRole('button', { name: 'Excel', exact: true }).click();
    const xlsxFile = await (await xlsxDownload).path();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(xlsxFile!);
    expect(workbook.worksheets[0].rowCount).toBe(7);
    await expect(app.getByRole('alert')).toHaveCount(0);
    await app.getByRole('button', { name: 'Quét bài nộp', exact: true }).click();
    await expect.poll(async () => (await state()).run?.status).toBe('idle');
    expect((await state()).run!.workTabId).toBe(second.run!.workTabId);
  } finally {
    await context.close();
  }
});
