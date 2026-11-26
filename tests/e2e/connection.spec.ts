import { test, expect, chromium } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { cp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { coursesFixture } from '../fixtures/classroom';

function browserPath() {
  if (process.env.CM_CHROMIUM_PATH) return process.env.CM_CHROMIUM_PATH;
  const defaultPath = chromium.executablePath();
  if (existsSync(defaultPath)) return defaultPath;
  const cache = join(
    process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
    'ms-playwright',
  );
  for (const name of readdirSync(cache)
    .filter((n) => /^chromium-\d+$/.test(n))
    .sort()
    .reverse()) {
    const exe = join(cache, name, 'chrome-win64', 'chrome.exe');
    if (existsSync(exe)) return exe;
  }
  return defaultPath;
}

test('kết nối tab nền thiếu content script, khôi phục dashboard và không nhân đôi nút tải', async ({}, info) => {
  const extension = info.outputPath('extension');
  await cp(resolve('dist/extension'), extension, { recursive: true });
  const manifest = JSON.parse(await readFile(join(extension, 'manifest.json'), 'utf8'));
  // Mô phỏng tab cũ không có script bằng bản sao test tắt auto-injection.
  manifest.content_scripts = [];
  await writeFile(join(extension, 'manifest.json'), JSON.stringify(manifest));
  const context = await chromium.launchPersistentContext(info.outputPath('profile'), {
    executablePath: browserPath(),
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  context.setDefaultTimeout(15000);
  try {
    await context.route('https://classroom.google.com/**', (route) =>
      route.fulfill({ contentType: 'text/html; charset=utf-8', body: coursesFixture() }),
    );
    await context.route('https://drive.google.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<main><button aria-label="Download" onclick="document.body.dataset.clicks=String(Number(document.body.dataset.clicks||0)+1)">Download</button></main>',
      }),
    );
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const classroom = await context.newPage();
    await classroom.goto('https://classroom.google.com/');
    await classroom.evaluate(() => {
      document.body.dataset.preserved = 'yes';
    });
    const tabId = await worker.evaluate(
      async () => (await chrome.tabs.query({ url: 'https://classroom.google.com/*' }))[0].id!,
    );
    const initialError = await worker.evaluate(async (id) => {
      try {
        await chrome.tabs.sendMessage(id, { channel: 'cm-dom', command: 'ping' });
        return '';
      } catch (error) {
        return String(error);
      }
    }, tabId);
    expect(initialError).toContain('Receiving end does not exist');
    const app = await context.newPage();
    await app.goto(`chrome-extension://${extensionId}/index.html`);
    const appId = await app.evaluate(async () => (await chrome.tabs.getCurrent())!.id!);
    await worker.evaluate(
      async ({ classroomId, appId }) => {
        const classroomTab = await chrome.tabs.get(classroomId);
        const appTab = await chrome.tabs.get(appId);
        if (appTab.windowId !== classroomTab.windowId)
          await chrome.tabs.move(appId, { windowId: classroomTab.windowId, index: -1 });
        await chrome.tabs.update(appId, { active: true });
        const send = chrome.tabs.sendMessage.bind(chrome.tabs);
        // Headless Chromium có thể giữ mọi document ở trạng thái visible.
        // Kiểm tra tab thực bằng Chrome API ngay trước lệnh đọc, không giả dữ liệu lớp.
        Object.defineProperty(chrome.tabs, 'sendMessage', {
          value: async (id: number, message: { command?: string }) => {
            if (message.command === 'courses' && !(await chrome.tabs.get(id)).active)
              throw new Error('Kiểm thử: lệnh đọc lớp chạy trong tab nền');
            return send(id, message);
          },
        });
      },
      { classroomId: tabId, appId },
    );
    expect(await worker.evaluate(async (id) => (await chrome.tabs.get(id)).active, tabId)).toBe(
      false,
    );
    await app.getByRole('button', { name: 'Làm mới tab' }).click();
    await app.getByRole('button', { name: 'Kết nối', exact: true }).click();
    await expect(app.getByText(/teacher@example.test · 1 lớp/)).toBeVisible();
    expect(await worker.evaluate(async (id) => (await chrome.tabs.get(id)).active, appId)).toBe(
      true,
    );
    expect(await classroom.evaluate(() => document.body.dataset.preserved)).toBe('yes');
    await expect(app.getByRole('alert')).toHaveCount(0);

    const drive = await context.newPage();
    await drive.goto('https://drive.google.com/file/d/TEST/view');
    const driveId = await worker.evaluate(
      async () => (await chrome.tabs.query({ url: 'https://drive.google.com/*' }))[0].id!,
    );
    await worker.evaluate(async (id) => {
      await chrome.scripting.executeScript({ target: { tabId: id }, files: ['content.js'] });
      await chrome.scripting.executeScript({ target: { tabId: id }, files: ['content.js'] });
      await chrome.tabs.sendMessage(id, { channel: 'cm-dom', command: 'driveDownload' });
    }, driveId);
    expect(await drive.evaluate(() => document.body.dataset.clicks)).toBe('1');
  } finally {
    await context.close();
  }
});
