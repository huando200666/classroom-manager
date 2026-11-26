import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChromiumAdapter } from '../../packages/browser-adapter/chromium';
import { connectionError } from '../../packages/shared/connection-errors';

const lost = () => new Error('Could not establish connection. Receiving end does not exist.');
let send: ReturnType<typeof vi.fn>;
let inject: ReturnType<typeof vi.fn>;
let get: ReturnType<typeof vi.fn>;
beforeEach(() => {
  send = vi.fn();
  inject = vi.fn().mockResolvedValue([]);
  get = vi.fn().mockResolvedValue({ id: 42, url: 'https://classroom.google.com/' });
  vi.stubGlobal('chrome', {
    tabs: { sendMessage: send, get },
    scripting: { executeScript: inject },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('thời hạn đọc Classroom', () => {
  it.each(['courses', 'assignments', 'students'])(
    '%s nhận kết quả chậm sau khi trang tải và thu thập danh sách',
    async (command) => {
      vi.useFakeTimers();
      send.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true, data: { complete: true } }), 32000);
          }),
      );
      const result = new ChromiumAdapter().dom(42, command).then(
        (data) => ({ data }),
        (error) => ({ error }),
      );
      await vi.advanceTimersByTimeAsync(32000);
      expect(await result).toEqual({ data: { complete: true } });
      expect(send).toHaveBeenCalledTimes(1);
      expect(inject).not.toHaveBeenCalled();
    },
  );
  it('lệnh đọc bị treo vẫn có giới hạn và báo rõ bước cần kiểm tra', async () => {
    vi.useFakeTimers();
    send.mockImplementation(() => new Promise(() => {}));
    const result = new ChromiumAdapter().dom(42, 'courses').catch((error) => error);
    await vi.advanceTimersByTimeAsync(45000);
    expect(await result).toBeInstanceOf(Error);
    expect((await result).message).toContain('Đọc danh sách lớp quá 45 giây');
    expect(send).toHaveBeenCalledTimes(1);
    expect(inject).not.toHaveBeenCalled();
  });
  it('lệnh tải quá thời gian không tự bấm lại và hướng dẫn kiểm tra Downloads', async () => {
    vi.useFakeTimers();
    send.mockImplementation(() => new Promise(() => {}));
    const result = new ChromiumAdapter().dom(42, 'driveDownload').catch((error) => error);
    await vi.advanceTimersByTimeAsync(26000);
    expect(await result).toBeInstanceOf(Error);
    expect((await result).message).toContain('Kiểm tra Downloads');
    expect(send).toHaveBeenCalledTimes(1);
    expect(inject).not.toHaveBeenCalled();
  });
});

describe('phục hồi content script chưa có trong tab', () => {
  it('giữ kết nối đang hoạt động, không nạp script thừa', async () => {
    send.mockResolvedValue({ ok: true, data: { connected: true } });
    expect(await new ChromiumAdapter().dom(42, 'ping')).toEqual({ connected: true });
    expect(inject).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('tự nạp script nội bộ trên tab Classroom đang mở và gửi lại đúng lệnh', async () => {
    send.mockRejectedValueOnce(lost()).mockResolvedValueOnce({ ok: true, data: { courses: [] } });
    expect(await new ChromiumAdapter().dom(42, 'courses')).toEqual({ courses: [] });
    expect(inject).toHaveBeenCalledWith({
      target: { tabId: 42, frameIds: [0] },
      files: ['content.js'],
      world: 'ISOLATED',
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]).toEqual(send.mock.calls[1]);
  });
  it('không nạp script nếu tab đã chuyển sang website khác', async () => {
    send.mockRejectedValue(lost());
    get.mockResolvedValue({ url: 'https://example.test/' });
    await expect(new ChromiumAdapter().dom(42, 'ping')).rejects.toThrow('Chỉ có thể kết nối');
    expect(inject).not.toHaveBeenCalled();
  });
  it('chỉ dẫn cấp quyền khi browser chặn việc nạp script', async () => {
    send.mockRejectedValue(lost());
    inject.mockRejectedValue(new Error('Cannot access contents of the page'));
    await expect(new ChromiumAdapter().dom(42, 'ping')).rejects.toThrow(
      'cho phép truy cập Google Classroom',
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('không bấm tải lại nếu cổng đóng khi lệnh có thể đã chạy', async () => {
    send.mockRejectedValue(new Error('The message port closed before a response was received.'));
    await expect(new ChromiumAdapter().dom(42, 'driveDownload')).rejects.toThrow(
      'kiểm tra Downloads',
    );
    expect(inject).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('không lặp vô hạn nếu vẫn không có bộ nhận sau khi nạp script', async () => {
    send.mockRejectedValue(lost());
    await expect(new ChromiumAdapter().dom(42, 'ping')).rejects.toThrow('Nhấn F5');
    expect(send).toHaveBeenCalledTimes(2);
    expect(inject).toHaveBeenCalledTimes(1);
  });
  it('giữ nguyên lỗi quyền từ Google, không coi là lỗi script', async () => {
    send.mockResolvedValue({ ok: false, error: 'Google từ chối quyền truy cập.' });
    await expect(new ChromiumAdapter().dom(42, 'courses')).rejects.toThrow('Google từ chối');
    expect(inject).not.toHaveBeenCalled();
  });
  it('hai yêu cầu đồng thời chỉ nạp một script', async () => {
    let injected = false;
    send.mockImplementation(async () => {
      if (!injected) throw lost();
      return { ok: true, data: true };
    });
    inject.mockImplementation(async () => {
      injected = true;
      return [];
    });
    const browser = new ChromiumAdapter();
    expect(await Promise.all([browser.dom(42, 'ping'), browser.dom(42, 'ping')])).toEqual([
      true,
      true,
    ]);
    expect(inject).toHaveBeenCalledTimes(1);
  });
  it('hướng dẫn mở lại dashboard sau khi extension context bị hủy', () => {
    expect(connectionError(new Error('Extension context invalidated.'), 'app')).toContain(
      'Đóng trang Classroom Manager',
    );
    expect(connectionError(lost(), 'app')).not.toContain('Receiving end');
  });
});
