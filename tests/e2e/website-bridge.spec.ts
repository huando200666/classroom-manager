import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { homedir } from 'node:os';
import { coursesFixture, assignmentsFixture, studentsFixture } from '../fixtures/classroom';
import { emptyState } from '../../packages/shared/types';

const website = 'https://huando200666.github.io/classroom-manager/';
function browserPath() {
  if (process.env.CM_CHROMIUM_PATH) return process.env.CM_CHROMIUM_PATH;
  if (existsSync(chromium.executablePath())) return chromium.executablePath();
  const cache = join(
    process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
    'ms-playwright',
  );
  for (const name of readdirSync(cache)
    .filter((name) => /^chromium-\d+$/.test(name))
    .sort()
    .reverse()) {
    const path = join(cache, name, 'chrome-win64', 'chrome.exe');
    if (existsSync(path)) return path;
  }
  return chromium.executablePath();
}
async function fixtures(context: BrowserContext) {
  await context.route('https://huando200666.github.io/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const name = path.startsWith('/classroom-manager/assets/')
      ? path.slice('/classroom-manager/'.length)
      : 'index.html';
    const type =
      extname(name) === '.js'
        ? 'text/javascript'
        : extname(name) === '.css'
          ? 'text/css'
          : 'text/html';
    await route.fulfill({
      contentType: type,
      body: await readFile(join(resolve('dist/site'), name)),
    });
  });
  await context.route('https://classroom.google.com/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const body =
      path === '/'
        ? coursesFixture()
        : path.endsWith('/submissions')
          ? studentsFixture('vi', 5, 3)
          : assignmentsFixture();
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body });
  });
}
test('website thật nhận dữ liệu qua tiện ích, không cần API và xóa giao diện khi ngắt', async ({}, info) => {
  test.setTimeout(120000);
  const extension = resolve('dist/extension');
  const context = await chromium.launchPersistentContext(info.outputPath('profile'), {
    executablePath: browserPath(),
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  context.setDefaultTimeout(20000);
  try {
    await fixtures(context);
    let googleApiCalls = 0;
    await context.route('https://classroom.googleapis.com/**', (route) => {
      googleApiCalls++;
      return route.abort();
    });
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    await worker.evaluate(async (state) => {
      await chrome.storage.local.set({
        'classroom-manager-v1': {
          ...state,
          account: { label: 'PRIVATE_ACCOUNT', scope: 'OTHER_ACCOUNT', tabId: 1, teacher: true },
          history: [{ account: 'OTHER_ACCOUNT', name: 'PRIVATE_HISTORY' }],
        },
      });
    }, emptyState());
    const classroom = await context.newPage();
    await classroom.goto('https://classroom.google.com/');
    const app = await context.newPage();
    await app.addInitScript(() => {
      (window as any).__bridgeMessages = [];
      window.addEventListener('message', (event) => {
        (window as any).__bridgeMessages.push(JSON.stringify(event.data));
      });
    });
    await app.goto(website);
    const connect = app.getByRole('button', { name: 'Kết nối tiện ích', exact: true });
    await expect(connect).toBeEnabled();
    await expect(app.getByText('PRIVATE_ACCOUNT')).toHaveCount(0);
    // Page script không thể tự tạo một thao tác bấm isTrusted để cấp quyền.
    await app.evaluate(() =>
      window.postMessage(
        { source: 'cm-website-v1', id: 'forged', command: 'authorize' },
        location.origin,
      ),
    );
    expect(
      await worker.evaluate(
        async () => Object.values(await chrome.storage.session.get(null)).flat().length,
      ),
    ).toBe(0);
    await connect.click();
    await expect(app.getByText(/teacher@example.test · 1 lớp/)).toBeVisible();
    const transcript = await app.evaluate(() => (window as any).__bridgeMessages.join(''));
    expect(transcript).not.toContain('PRIVATE_HISTORY');
    expect(transcript).not.toContain('PRIVATE_ACCOUNT');
    await app.getByLabel('Lớp học', { exact: true }).selectOption('COURSE');
    await expect(app.getByLabel('Bài tập', { exact: true })).toContainText('BTVN tuần 7', {
      timeout: 20000,
    });
    await app.getByLabel('Bài tập', { exact: true }).selectOption('A7');
    await app.getByRole('button', { name: 'Quét bài nộp', exact: true }).click();
    await expect(app.getByText('5 / 5 sinh viên')).toBeVisible();
    const blocked = await app.evaluate(
      () =>
        new Promise<{ ok: boolean; error?: string }>((resolve) => {
          const receive = (event: MessageEvent) => {
            if (event.data?.source === 'cm-extension-v1' && event.data.id === 'without-click') {
              window.removeEventListener('message', receive);
              resolve(event.data);
            }
          };
          window.addEventListener('message', receive);
          window.postMessage(
            { source: 'cm-website-v1', id: 'without-click', command: 'start', args: {} },
            location.origin,
          );
        }),
    );
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toContain('bấm trực tiếp');
    await app.screenshot({ path: 'docs/website-bridge-data.png', fullPage: true });
    expect(googleApiCalls).toBe(0);
    await app.getByRole('button', { name: 'Ngắt kết nối website', exact: true }).click();
    await expect(connect).toBeEnabled();
    await expect(app.getByText(/teacher@example.test · 1 lớp/)).toHaveCount(0);
    await expect(app.getByText('5 / 5 sinh viên')).toHaveCount(0);
    expect(
      await worker.evaluate(async () => {
        const state = (await chrome.storage.local.get('classroom-manager-v1'))[
          'classroom-manager-v1'
        ] as { history: { name: string }[] };
        return state.history[0].name;
      }),
    ).toBe('PRIVATE_HISTORY');
    await connect.click();
    await expect(app.getByText(/teacher@example.test · 1 lớp/)).toBeVisible();
    await app.reload();
    await expect(connect).toBeEnabled();
    await expect(app.getByText(/teacher@example.test · 1 lớp/)).toHaveCount(0);
    await connect.click();
    await expect(app.getByText(/teacher@example.test · 1 lớp/)).toBeVisible();
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await context.route('https://classroom.google.com/c/COURSE', async (route) => {
      await held;
      await route
        .fulfill({
          contentType: 'text/html; charset=utf-8',
          body: assignmentsFixture().replaceAll('BTVN tuần 7', 'LATE_PRIVATE_ASSIGNMENT'),
        })
        .catch(() => {});
    });
    const requested = context.waitForEvent(
      'request',
      (request) => request.url() === 'https://classroom.google.com/c/COURSE',
    );
    await app.getByLabel('Lớp học', { exact: true }).selectOption('COURSE');
    await requested;
    await app.getByRole('button', { name: 'Ngắt kết nối website', exact: true }).click();
    release();
    await expect
      .poll(
        () =>
          worker.evaluate(async () => {
            const state = (await chrome.storage.local.get('classroom-manager-v1'))[
              'classroom-manager-v1'
            ] as { assignments: { name: string }[] };
            return state.assignments.some((item) => item.name === 'LATE_PRIVATE_ASSIGNMENT');
          }),
        { timeout: 30000 },
      )
      .toBe(true);
    expect(await app.evaluate(() => (window as any).__bridgeMessages.join(''))).not.toContain(
      'LATE_PRIVATE_ASSIGNMENT',
    );
    await expect(app.getByText(/teacher@example.test · 1 lớp/)).toHaveCount(0);
  } finally {
    await context.close();
  }
});
test('quét bài nộp qua chuyển hướng tài khoản khi tài nguyên phụ chưa tải xong', async ({}, info) => {
  test.setTimeout(90000);
  const extension = resolve('dist/extension');
  const context = await chromium.launchPersistentContext(info.outputPath('profile'), {
    executablePath: browserPath(),
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  let releaseResource: () => void = () => {};
  const resource = new Promise<void>((resolve) => {
    releaseResource = resolve;
  });
  try {
    await fixtures(context);
    await context.route('https://classroom.google.com/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/slow-image') {
        await resource;
        await route.fulfill({ status: 204 }).catch(() => {});
        return;
      }
      if (path === '/c/COURSE' || path === '/c/COURSE/a/A7/details') {
        const location = path.endsWith('/details')
          ? '/u/1/c/COURSE/a/A7/submissions'
          : '/u/1/c/COURSE';
        await route.fulfill({ status: 302, headers: { location } });
        return;
      }
      const body =
        path === '/'
          ? coursesFixture()
          : path.endsWith('/submissions')
            ? studentsFixture('vi', 5, 3).replace(
                '</body>',
                '<img src="/slow-image" alt=""></body>',
              )
            : assignmentsFixture();
      await route.fulfill({ contentType: 'text/html; charset=utf-8', body });
    });
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const classroom = await context.newPage();
    await classroom.goto('https://classroom.google.com/');
    const app = await context.newPage();
    await app.goto(website);
    await app.getByRole('button', { name: 'Kết nối tiện ích', exact: true }).click();
    await expect(app.getByText(/teacher@example.test · 1 lớp/)).toBeVisible();
    await app.getByLabel('Lớp học', { exact: true }).selectOption('COURSE');
    await expect(app.getByLabel('Bài tập', { exact: true })).toContainText('BTVN tuần 7', {
      timeout: 20000,
    });
    await app.getByLabel('Bài tập', { exact: true }).selectOption('A7');
    await app.getByRole('button', { name: 'Quét bài nộp', exact: true }).click();
    await expect(app.getByText('5 / 5 sinh viên')).toBeVisible({ timeout: 20000 });
    await expect(app.getByRole('alert')).toHaveCount(0);
    expect(
      await worker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ url: 'https://classroom.google.com/*' });
        return tabs.find((tab) => tab.url?.endsWith('/a/A7/submissions'))?.status;
      }),
    ).toBe('loading');
  } finally {
    releaseResource();
    await context.close();
  }
});

test('website khác cùng github.io không được kết nối tiện ích', async ({}, info) => {
  const extension = resolve('dist/extension');
  const context = await chromium.launchPersistentContext(info.outputPath('profile'), {
    executablePath: browserPath(),
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    await fixtures(context);
    const app = await context.newPage();
    await app.goto('https://huando200666.github.io/another-project/');
    await expect(app.getByRole('button', { name: 'Kết nối tiện ích', exact: true })).toBeDisabled();
    await expect(app.getByText(/Chưa tìm thấy tiện ích hỗ trợ website/)).toBeVisible();
  } finally {
    await context.close();
  }
});
