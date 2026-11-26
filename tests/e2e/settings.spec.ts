import { test, expect } from '@playwright/test';
import { emptyState } from '../../packages/shared/types';

test('giữ cài đặt đang sửa khi trạng thái nền thay đổi và lưu được sau đó', async ({ page }) => {
  await page.addInitScript((initial) => {
    let state = initial;
    let refreshes = 0;
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        runtime: {
          id: 'settings-test',
          sendMessage: async (message: {
            command: string;
            args: { settings?: typeof initial.settings };
          }) => {
            if (message.command === 'tabs') return { ok: true, data: [] };
            if (message.command === 'state')
              state.account = {
                label: `Đồng bộ ${++refreshes}`,
                scope: 'test',
                tabId: 1,
                teacher: false,
              };
            if (message.command === 'settings') state.settings = message.args.settings!;
            return { ok: true, data: structuredClone(state) };
          },
        },
        storage: {
          onChanged: {
            addListener: (listener: EventListener) =>
              window.addEventListener('test-storage-change', listener),
            removeListener: (listener: EventListener) =>
              window.removeEventListener('test-storage-change', listener),
          },
        },
      },
    });
  }, emptyState());
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByText(/Đồng bộ 1 · 0 lớp/)).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Cài đặt', exact: true }).click();
  const folder = page.getByLabel('Thư mục con trong Downloads');
  await expect(folder).toHaveValue('Classroom_Downloads');
  await folder.fill('Bai_nop_2026');
  await page.getByLabel('PDF', { exact: true }).check();
  await page.evaluate(() => window.dispatchEvent(new Event('test-storage-change')));
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Tổng quan', exact: true })
    .click();
  await expect(page.getByText(/Đồng bộ 2 · 0 lớp/)).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Cài đặt', exact: true }).click();
  await expect(folder).toHaveValue('Bai_nop_2026');
  await expect(page.getByLabel('PDF', { exact: true })).toBeChecked();
  await page.getByRole('button', { name: 'Lưu cài đặt', exact: true }).click();
  await expect(page.getByText('Đã lưu cấu hình trên thiết bị.')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('test-storage-change')));
  await expect(folder).toHaveValue('Bai_nop_2026');
});
