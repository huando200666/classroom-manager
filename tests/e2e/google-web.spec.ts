import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockGoogleWeb } from '../fixtures/google-web';

test('web: đăng nhập, tự tải lớp/bài nộp, CSV, đăng xuất không lưu token', async ({ page }) => {
  const { requests } = await mockGoogleWeb(page);
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Đăng nhập bằng Google', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lớp học của bạn', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Lớp A/ })).toBeVisible();
  await page.getByRole('button', { name: /Lớp A/ }).click();
  await expect(page.getByRole('cell', { name: 'Nguyễn An', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Lê Chi', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Chưa có bản ghi', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '0 / 10', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bai_lam.zip' })).toHaveAttribute(
    'href',
    'https://drive.google.com/file/d/FILE/view',
  );
  expect(
    requests.some((url) => url.pathname.endsWith('/students') && url.searchParams.has('pageToken')),
  ).toBe(true);
  await page.screenshot({ path: 'docs/web-classroom-data.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/web-classroom-mobile.png', fullPage: true });
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất CSV', exact: true }).click();
  const text = await readFile((await (await downloaded).path())!, 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  expect(text).toContain('Lê Chi');
  expect(text).toContain('Chưa có bản ghi');
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Đăng nhập bằng Google', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Nguyễn An', { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      [JSON.stringify(localStorage), JSON.stringify(sessionStorage)].join(''),
    ),
  ).not.toContain('TEST_TOKEN');
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Đăng nhập bằng Google', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lớp A', exact: true })).toHaveCount(0);
});

test('web: học viên chỉ yêu cầu bài của mình, không đọc roster', async ({ page }) => {
  const { requests } = await mockGoogleWeb(page);
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Đăng nhập bằng Google', exact: true }).click();
  await page.getByRole('button', { name: /Lớp B/ }).click();
  await expect(page.getByRole('cell', { name: 'Câu trả lời của tôi', exact: true })).toBeVisible();
  expect(
    requests
      .filter(
        (url) => url.pathname.includes('/S1/') && url.pathname.endsWith('/studentSubmissions'),
      )
      .every((url) => url.searchParams.get('userId') === 'me'),
  ).toBe(true);
  expect(requests.some((url) => url.pathname.endsWith('/students'))).toBe(false);
  await expect(page.getByText('Nguyễn An', { exact: true })).toHaveCount(0);
});

test('web: Google 401 xóa dữ liệu cũ và yêu cầu đăng nhập lại', async ({ page }) => {
  const { controls } = await mockGoogleWeb(page);
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Đăng nhập bằng Google', exact: true }).click();
  await page.getByRole('button', { name: /Lớp A/ }).click();
  await expect(page.getByRole('cell', { name: 'Nguyễn An', exact: true })).toBeVisible();
  controls.unauthorized = true;
  await page.getByRole('button', { name: 'Làm mới dữ liệu', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('hết hạn');
  await expect(
    page.getByRole('button', { name: 'Đăng nhập bằng Google', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Nguyễn An', { exact: true })).toHaveCount(0);
});

test('web: thiếu quyền không bị hiển thị thành dữ liệu bài nộp trống hợp lệ', async ({ page }) => {
  const { controls } = await mockGoogleWeb(page);
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Đăng nhập bằng Google', exact: true }).click();
  await expect(page.getByRole('button', { name: /Lớp A/ })).toBeVisible();
  controls.denied = true;
  await page.getByRole('button', { name: /Lớp A/ }).click();
  await expect(page.getByRole('alert')).toContainText('chưa cho phép');
  await expect(page.getByRole('cell', { name: 'Chưa có bản ghi', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xuất CSV', exact: true })).toBeDisabled();
});

test('web: phản hồi lớp cũ đến muộn không ghi đè lớp đang chọn', async ({ page }) => {
  await mockGoogleWeb(page);
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('https://classroom.googleapis.com/v1/courses/C1/courseWork**', async (route) => {
    await held;
    await route
      .fulfill({ json: { courseWork: [{ id: 'OLD', title: 'Dữ liệu cũ' }] } })
      .catch(() => {});
  });
  await page.goto('http://127.0.0.1:5173');
  await page.getByRole('button', { name: 'Đăng nhập bằng Google', exact: true }).click();
  const requested = page.waitForRequest((request) => request.url().includes('/C1/courseWork'));
  await page.getByRole('button', { name: /Lớp A/ }).click();
  await requested;
  await page.getByRole('button', { name: 'Tất cả lớp', exact: true }).click();
  await page.getByRole('button', { name: /Lớp B/ }).click();
  await expect(page.getByRole('cell', { name: 'Câu trả lời của tôi', exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('heading', { name: 'Lớp B', exact: true })).toBeVisible();
  await expect(page.getByText('Dữ liệu cũ', { exact: true })).toHaveCount(0);
});
