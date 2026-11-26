import { it, expect, afterEach } from 'vitest';
import { collectDynamic, waitFor } from '../../packages/classroom-adapter/dynamic';
afterEach(() => {
  document.body.innerHTML = '';
});
it('MutationObserver chờ nội dung xuất hiện chậm', async () => {
  setTimeout(() => {
    document.body.innerHTML = '<h1>Đã tải</h1>';
  }, 30);
  const h = await waitFor(() => document.querySelector('h1') ?? undefined, 1000);
  expect(h.textContent).toBe('Đã tải');
});
it('thu thập hợp nhất các hàng trong virtual list và khôi phục vị trí cuộn', async () => {
  document.body.innerHTML = '<aside role="list"></aside>';
  const list = document.querySelector('aside')!;
  let top = 0;
  const render = (page: number) => {
    list.innerHTML = Array.from(
      { length: 10 },
      (_, i) => `<div data-id="${page * 10 + i}">Sinh viên</div>`,
    ).join('');
  };
  render(0);
  Object.defineProperties(list, {
    clientHeight: { value: 200 },
    scrollHeight: { value: 600 },
    scrollTop: {
      get: () => top,
      set: (value: number) => {
        top = Math.min(value, 400);
        render(Math.min(2, Math.floor(top / 150)));
      },
    },
  });
  const rows = await collectDynamic(
    () =>
      [...document.querySelectorAll('[data-id]')].map((e) => ({ id: e.getAttribute('data-id')! })),
    { expected: 30, maxMs: 4000 },
  );
  expect(rows).toHaveLength(30);
  expect(list.scrollTop).toBe(0);
});
