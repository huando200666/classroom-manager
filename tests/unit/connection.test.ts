import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChromiumAdapter, sameDestination } from '../../packages/browser-adapter/chromium';
import { connectionError } from '../../packages/shared/connection-errors';

const lost = () => new Error('Could not establish connection. Receiving end does not exist.');
let send: ReturnType<typeof vi.fn>;
let inject: ReturnType<typeof vi.fn>;
let get: ReturnType<typeof vi.fn>;
let query: ReturnType<typeof vi.fn>;
let update: ReturnType<typeof vi.fn>;
beforeEach(() => {
  send = vi.fn();
  inject = vi.fn().mockResolvedValue([]);
  get = vi
    .fn()
    .mockResolvedValue({ id: 42, url: 'https://classroom.google.com/', active: true, windowId: 1 });
  query = vi.fn();
  update = vi.fn().mockResolvedValue({});
  vi.stubGlobal('chrome', {
    tabs: { sendMessage: send, get, query, update },
    scripting: { executeScript: inject },
  });
});

describe('chờ đúng trang Classroom khi quét bài nộp', () => {
  const details = 'https://classroom.google.com/c/COURSE/a/A7/details';
  const submissions = 'https://classroom.google.com/u/1/c/COURSE/a/A7/submissions';
  it('chấp nhận URL tài khoản và chuyển hướng trong cùng bài tập', () => {
    expect(sameDestination(submissions, details)).toBe(true);
    expect(
      sameDestination(
        'https://classroom.google.com/u/0/c/COURSE',
        'https://classroom.google.com/c/COURSE',
      ),
    ).toBe(true);
  });
  it('không chấp nhận bài, lớp, tài khoản hoặc sinh viên khác', () => {
    expect(sameDestination(submissions.replace('/A7/', '/OTHER/'), details)).toBe(false);
    expect(sameDestination(submissions.replace('/COURSE/', '/OTHER/'), details)).toBe(false);
    expect(sameDestination(submissions, details.replace('/c/', '/u/0/c/'))).toBe(false);
    expect(sameDestination(details + '/student/S2', details + '/student/S1')).toBe(false);
  });
  it('đọc được tài liệu dù một tài nguyên phụ khiến tab còn loading', async () => {
    vi.useFakeTimers();
    get.mockResolvedValue({ id: 42, url: submissions, status: 'loading' });
    send.mockResolvedValue({ ok: true, data: { url: submissions } });
    const result = new ChromiumAdapter().ready(42, details).then(
      () => 'ready',
      (e) => e.message,
    );
    await vi.advanceTimersByTimeAsync(23000);
    expect(await result).toBe('ready');
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('hiển thị tab trước khi chờ và không tải lại tab vừa tạo cùng URL', async () => {
    get.mockResolvedValue({ id: 42, url: details, status: 'loading', active: false, windowId: 1 });
    query.mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([{ id: 42 }]);
    send.mockImplementation(async () => {
      expect(update).toHaveBeenCalledWith(42, { active: true });
      return { ok: true, data: { url: details } };
    });
    const browser = new ChromiumAdapter();
    vi.useFakeTimers();
    const result = browser.navigate(42, details).then(
      () => 'ready',
      (e) => e.message,
    );
    await vi.advanceTimersByTimeAsync(23000);
    expect(await result).toBe('ready');
    expect(update.mock.calls).toEqual([
      [42, { active: true }],
      [7, { active: true }],
    ]);
  });
  it('không dùng ping của tài liệu cũ khi đang chuyển trang', async () => {
    vi.useFakeTimers();
    get.mockResolvedValue({ id: 42, url: details, status: 'loading' });
    send
      .mockResolvedValueOnce({ ok: true, data: { url: 'https://classroom.google.com/c/OTHER' } })
      .mockResolvedValue({ ok: true, data: { url: details } });
    const result = new ChromiumAdapter().ready(42, details).then(() => 'ready');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toBe('ready');
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('giới hạn cả ping bị treo trong thời gian chờ 22 giây', async () => {
    vi.useFakeTimers();
    get.mockResolvedValue({ id: 42, url: details, status: 'complete' });
    send.mockImplementation(() => new Promise(() => {}));
    const result = new ChromiumAdapter().ready(42, details).catch((e) => e.message);
    let finished = false;
    void result.then(() => {
      finished = true;
    });
    await vi.advanceTimersByTimeAsync(22500);
    expect(finished).toBe(true);
    expect(await result).toContain('22 giây');
  });
  it('báo lỗi quyền truy cập từ trang ngay, không đổi thành timeout', async () => {
    get.mockResolvedValue({ id: 42, url: details, status: 'complete' });
    send.mockResolvedValue({ ok: false, error: 'Google từ chối quyền truy cập.' });
    await expect(new ChromiumAdapter().ready(42, details)).rejects.toThrow('Google từ chối');
  });
});

describe('đọc Classroom khi tab nền bị làm chậm', () => {
  function backgroundTab() {
    get.mockResolvedValue({
      id: 42,
      url: 'https://classroom.google.com/',
      active: false,
      windowId: 1,
    });
    query.mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([{ id: 42 }]);
  }
  it('hiển thị tab Classroom trước khi đọc, rồi trở lại dashboard', async () => {
    backgroundTab();
    send.mockImplementation(async () => {
      expect(update).toHaveBeenCalledWith(42, { active: true });
      return { ok: true, data: { courses: ['c'] } };
    });
    expect(await new ChromiumAdapter().dom(42, 'courses')).toEqual({ courses: ['c'] });
    expect(query).toHaveBeenCalledWith({ active: true, windowId: 1 });
    expect(update.mock.calls).toEqual([
      [42, { active: true }],
      [7, { active: true }],
    ]);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('không giành lại tiêu điểm nếu người dùng đã chọn một tab khác', async () => {
    backgroundTab();
    query
      .mockReset()
      .mockResolvedValueOnce([{ id: 7 }])
      .mockResolvedValueOnce([{ id: 99 }]);
    send.mockResolvedValue({ ok: true, data: [] });
    await new ChromiumAdapter().dom(42, 'students');
    expect(update.mock.calls).toEqual([[42, { active: true }]]);
  });
  it('giữ nguyên lỗi đọc và khôi phục dashboard sau lỗi', async () => {
    backgroundTab();
    send.mockResolvedValue({ ok: false, error: 'Không nhận diện được lớp học' });
    await expect(new ChromiumAdapter().dom(42, 'assignments')).rejects.toThrow(
      'Không nhận diện được lớp học',
    );
    expect(update).toHaveBeenLastCalledWith(7, { active: true });
  });
  it('dashboard đã đóng không làm mất kết quả đọc thành công', async () => {
    backgroundTab();
    update.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('No tab with id: 7'));
    send.mockResolvedValue({ ok: true, data: ['c'] });
    expect(await new ChromiumAdapter().dom(42, 'courses')).toEqual(['c']);
  });
  it('lệnh tải tệp không tự chuyển tab hoặc phát lại', async () => {
    send.mockResolvedValue({ ok: true, data: { clicked: true } });
    await new ChromiumAdapter().dom(42, 'driveDownload');
    expect(update).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
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
