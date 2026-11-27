import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  allowedWebsite,
  validWebSender,
  websiteState,
  WEB_COMMANDS,
} from '../../packages/web-bridge/policy';
import { WebGrants } from '../../apps/extension/web-grants';
import { emptyState, type HistoryEntry, type Run } from '../../packages/shared/types';

const sender = (documentId = 'DOC', tabId = 5) =>
  ({
    id: 'EXT',
    url: 'https://huando200666.github.io/classroom-manager/',
    frameId: 0,
    documentId,
    tab: { id: tabId, url: 'https://huando200666.github.io/classroom-manager/' },
  }) as chrome.runtime.MessageSender;
afterEach(() => vi.unstubAllGlobals());
describe('giới hạn website được kết nối', () => {
  it('chỉ cho phép trang chính HTTPS của đúng dự án', () => {
    expect(allowedWebsite('https://huando200666.github.io/classroom-manager/')).toBe(true);
    expect(allowedWebsite('https://huando200666.github.io/classroom-manager/index.html?x=1')).toBe(
      true,
    );
    for (const url of [
      'http://huando200666.github.io/classroom-manager/',
      'https://huando200666.github.io/other/',
      'https://evil.test/classroom-manager/',
      'https://huando200666.github.io/classroom-manager/privacy.html',
      'https://huando200666.github.io.evil.test/classroom-manager/',
      'https://user:password@huando200666.github.io/classroom-manager/',
    ])
      expect(allowedWebsite(url)).toBe(false);
  });
  it('từ chối iframe, context khác extension và document không xác định', () => {
    expect(validWebSender(sender(), 'EXT')).toBe(true);
    expect(validWebSender({ ...sender(), frameId: 1 }, 'EXT')).toBe(false);
    expect(validWebSender({ ...sender(), id: 'OTHER' }, 'EXT')).toBe(false);
    expect(validWebSender({ ...sender(), documentId: undefined }, 'EXT')).toBe(false);
    expect(validWebSender({ ...sender(), url: 'https://evil.test/' }, 'EXT')).toBe(false);
    expect(validWebSender({ ...sender(), tab: undefined }, 'EXT')).toBe(false);
  });
  it('không mở lệnh cấp quyền và xóa toàn bộ dữ liệu cho request từ trang', () => {
    expect(WEB_COMMANDS.has('authorize')).toBe(false);
    expect(WEB_COMMANDS.has('clear')).toBe(false);
    expect(WEB_COMMANDS.has('scan')).toBe(true);
  });
});
describe('lọc dữ liệu theo tài khoản đã kết nối', () => {
  it('không trả dữ liệu lưu sẵn trước khi xác minh tài khoản', () => {
    const state = emptyState();
    state.account = { scope: 'A', label: 'Private A', tabId: 1, teacher: true };
    state.courses = [{ id: 'C', name: 'Private C', url: '' }];
    expect(websiteState(state)).toEqual(emptyState());
    expect(websiteState(state, 'B')).toEqual(emptyState());
  });
  it('chỉ gửi lịch sử cùng tài khoản và không lộ phiên của tài khoản khác', () => {
    const state = emptyState();
    state.account = { scope: 'A', label: 'A', tabId: 1, teacher: true };
    state.history = [
      { account: 'A', name: 'mine.zip' },
      { account: 'B', name: 'secret.zip' },
    ] as HistoryEntry[];
    state.run = { account: 'B', id: 'private-run' } as Run;
    const result = websiteState(state, 'A');
    expect(result.history.map((entry) => entry.name)).toEqual(['mine.zip']);
    expect(result.run).toBeUndefined();
    expect(state.history).toHaveLength(2);
  });
});
describe('quyền kết nối theo tab/document trong Chrome session', () => {
  function storage() {
    let data: Record<string, unknown> = {};
    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: vi.fn(async () => structuredClone(data)),
          set: vi.fn(async (value: object) => {
            data = { ...data, ...structuredClone(value) };
          }),
        },
      },
    });
  }
  it('cấp quyền, giữ sau worker restart, nhưng không dùng cho document/tab khác', async () => {
    storage();
    const grants = new WebGrants();
    expect(await grants.get(sender())).toBeUndefined();
    await grants.authorize(sender());
    const grant = (await grants.get(sender()))!;
    await grants.account(sender(), grant.nonce, 'ACCOUNT');
    expect((await new WebGrants().get(sender()))?.account).toBe('ACCOUNT');
    expect(await grants.get(sender('OTHER'))).toBeUndefined();
    expect(await grants.get(sender('DOC', 6))).toBeUndefined();
  });
  it('thu hồi trước khi tác vụ cũ trả kết quả không khôi phục được quyền', async () => {
    storage();
    const grants = new WebGrants();
    await grants.authorize(sender());
    const grant = (await grants.get(sender()))!;
    await grants.revoke(sender());
    await expect(grants.account(sender(), grant.nonce, 'LATE')).rejects.toThrow(
      'Kết nối website đã ngắt',
    );
    expect(await grants.get(sender())).toBeUndefined();
  });
  it('cấp lại quyền đổi nonce, tác vụ của phiên cũ không ghi đè tài khoản mới', async () => {
    storage();
    const grants = new WebGrants();
    await grants.authorize(sender());
    const old = (await grants.get(sender()))!;
    await grants.authorize(sender());
    const current = (await grants.get(sender()))!;
    expect(current.nonce).not.toBe(old.nonce);
    await expect(grants.account(sender(), old.nonce, 'OLD')).rejects.toThrow();
    await grants.account(sender(), current.nonce, 'NEW');
    expect((await grants.get(sender()))?.account).toBe('NEW');
  });
  it('đóng tab chỉ xóa quyền của tab đó', async () => {
    storage();
    const grants = new WebGrants();
    await grants.authorize(sender());
    await grants.authorize(sender('DOC2', 6));
    await grants.removeTab(5);
    expect(await grants.get(sender())).toBeUndefined();
    expect(await grants.get(sender('DOC2', 6))).toBeDefined();
  });
});
