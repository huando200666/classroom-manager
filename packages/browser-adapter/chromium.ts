import { retry, tabLocked, timeout, delay } from './retry';
import { missingReceiver, connectionError } from '../shared/connection-errors';
import { CLASSROOM_RESPONSE_MS, DOM_RESPONSE_MS } from '../shared/timeouts';
export interface BrowserAdapter {
  listClassroomTabs(): Promise<{ id: number; title: string; url: string }[]>;
  openClassroom(): Promise<number>;
  navigate(tabId: number, url: string): Promise<void>;
  createWorkTab(url: string): Promise<number>;
  dom<T = any>(tabId: number, command: string, args?: object): Promise<T>;
}
export function allowedNavigation(url: string) {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' && ['classroom.google.com', 'drive.google.com'].includes(u.hostname)
    );
  } catch {
    return false;
  }
}
export function sameDestination(actual: string | undefined, expected: string) {
  if (!actual) return false;
  try {
    const a = new URL(actual);
    const b = new URL(expected);
    if (a.origin !== b.origin) return false;
    let actualPath = a.pathname.replace(/\/$/, '');
    let expectedPath = b.pathname.replace(/\/$/, '');
    if (a.origin === 'https://classroom.google.com') {
      const account = (u: URL) =>
        u.pathname.match(/^\/u\/(\d+)(?:\/|$)/)?.[1] || u.searchParams.get('authuser');
      if (account(a) && account(b) && account(a) !== account(b)) return false;
      actualPath = actualPath.replace(/^\/u\/\d+(?=\/|$)/, '');
      expectedPath = expectedPath.replace(/^\/u\/\d+(?=\/|$)/, '');
      // Classroom có thể đổi chế độ xem theo vai trò. Chỉ coi hai trang tổng
      // quan của cùng lớp/bài tập là tương đương; không gộp trang từng học viên.
      const overview = /^(\/c\/[^/]+\/a\/[^/]+)\/(?:details|submissions)$/;
      actualPath = actualPath.replace(overview, '$1');
      expectedPath = expectedPath.replace(overview, '$1');
    }
    return actualPath === expectedPath;
  } catch {
    return false;
  }
}
export class ChromiumAdapter implements BrowserAdapter {
  private connecting = new Map<number, Promise<void>>();

  private async installBridge(tabId: number) {
    const existing = this.connecting.get(tabId);
    if (existing) return existing;
    const work = (async () => {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.url || !allowedNavigation(tab.url)) {
        throw new Error(
          'Chỉ có thể kết nối với tab Google Classroom hoặc Google Drive được cho phép.',
        );
      }
      try {
        await chrome.scripting.executeScript({
          target: { tabId, frameIds: [0] },
          files: ['content.js'],
          world: 'ISOLATED',
        });
      } catch {
        throw new Error(
          'Không thể bật kết nối trong tab. Vào Chi tiết tiện ích, cho phép truy cập Google Classroom và Google Drive, nhấn Tải lại tiện ích rồi mở lại Classroom Manager.',
        );
      }
    })();
    this.connecting.set(tabId, work);
    try {
      await work;
    } finally {
      this.connecting.delete(tabId);
    }
  }
  async listClassroomTabs() {
    const tabs = await chrome.tabs.query({ url: 'https://classroom.google.com/*' });
    return tabs
      .filter((t) => t.id !== undefined)
      .map((t) => ({ id: t.id!, title: t.title || 'Google Classroom', url: t.url || '' }));
  }
  async openClassroom() {
    const t = await retry(
      () => chrome.tabs.create({ url: 'https://classroom.google.com/', active: true }),
      { retryIf: tabLocked },
    );
    return t.id!;
  }
  async createWorkTab(url: string) {
    if (!allowedNavigation(url)) throw new Error('Địa chỉ ngoài phạm vi Classroom/Drive.');
    const t = await retry(() => chrome.tabs.create({ url, active: false }), { retryIf: tabLocked });
    return t.id!;
  }
  async navigate(tabId: number, url: string) {
    if (!allowedNavigation(url)) throw new Error('Địa chỉ ngoài phạm vi Classroom/Drive.');
    const navigate = async () => {
      const tab = await chrome.tabs.get(tabId);
      // createWorkTab đã bắt đầu mở URL. Không khởi động lại lần tải đó.
      if (tab.url !== url && tab.pendingUrl !== url)
        await retry(() => chrome.tabs.update(tabId, { url }), { retryIf: tabLocked });
      await this.ready(tabId, url);
    };
    if (new URL(url).hostname === 'classroom.google.com')
      await this.withVisibleTab(tabId, navigate);
    else await navigate();
  }
  async ready(tabId: number, url?: string) {
    const started = Date.now();
    while (Date.now() - started < 22000) {
      const tab = await chrome.tabs.get(tabId);
      if (tab.url?.startsWith('https://accounts.google.com/')) {
        await chrome.tabs.update(tabId, { active: true });
        throw new Error(
          'Google yêu cầu đăng nhập/xác nhận bảo mật. Hoàn thành trong tab Google rồi thử lại.',
        );
      }
      if (!tab.pendingUrl && (!url || sameDestination(tab.url, url))) {
        try {
          const remaining = 22000 - (Date.now() - started);
          if (remaining <= 0) break;
          // Tài liệu có thể đọc được trước khi tài nguyên phụ tải xong.
          // Ping tài liệu thật thay vì chỉ dựa vào trạng thái complete của tab.
          const actual = await timeout(
            this.dom<{ url: string }>(tabId, 'ping'),
            Math.min(1500, remaining),
            'Chờ tài liệu phản hồi.',
          );
          if (actual.url && (!url || sameDestination(actual.url, url))) return;
        } catch (error) {
          if (/Google từ chối|Cần đăng nhập|xác nhận bảo mật/.test(String(error))) throw error;
        }
      }
      await delay(Math.min(250, Math.max(0, 22000 - (Date.now() - started))));
    }
    throw new Error(
      'Tab chưa sẵn sàng sau 22 giây. Mở tab bài tập vừa được tạo, kiểm tra trang đã tải và đúng tài khoản/quyền truy cập rồi thử lại.',
    );
  }
  async dom<T = any>(tabId: number, command: string, args: object = {}): Promise<T> {
    if (!['courses', 'assignments', 'students', 'studentWork'].includes(command))
      return this.requestDom<T>(tabId, command, args);
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url?.startsWith('https://classroom.google.com/'))
      throw new Error('Tab không còn ở Google Classroom. Mở Classroom rồi kết nối lại.');
    return this.withVisibleTab(tabId, () => this.requestDom<T>(tabId, command, args));
  }
  private async withVisibleTab<T>(tabId: number, work: () => Promise<T>): Promise<T> {
    const tab = await chrome.tabs.get(tabId);
    if (tab.active) return work();
    const [previous] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    // Timer trong trang nền có thể bị Chrome trì hoãn. Đọc danh sách khi tab hiển thị.
    await retry(() => chrome.tabs.update(tabId, { active: true }), { retryIf: tabLocked });
    try {
      return await work();
    } finally {
      try {
        const [current] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
        // Không giành lại tiêu điểm nếu người dùng đã chuyển sang một tab khác.
        if (current?.id === tabId && previous?.id !== undefined && previous.id !== tabId)
          await chrome.tabs.update(previous.id, { active: true });
      } catch {
        // Tab dashboard có thể đã đóng; vẫn giữ kết quả hoặc lỗi đọc ban đầu.
      }
    }
  }
  private async requestDom<T>(tabId: number, command: string, args: object): Promise<T> {
    const listNames: Record<string, string> = {
      courses: 'danh sách lớp',
      assignments: 'danh sách bài tập',
      students: 'danh sách bài nộp',
    };
    const list = listNames[command];
    const deadline = list ? CLASSROOM_RESPONSE_MS : DOM_RESPONSE_MS;
    const timeoutMessage = list
      ? `Đọc ${list} quá ${deadline / 1000} giây. Mở tab Classroom, chờ trang tải xong rồi thử lại. Nếu vẫn lỗi, giao diện Classroom có thể chưa được nhận diện.`
      : command === 'driveDownload'
        ? 'Chờ Drive phản hồi quá thời gian. Kiểm tra Downloads trước khi thử lại để tránh tải trùng.'
        : 'Trang Classroom/Drive chưa phản hồi kịp. Mở tab đó, chờ trang tải xong rồi thử lại.';
    const send = () =>
      timeout(
        chrome.tabs.sendMessage(tabId, { channel: 'cm-dom', command, ...args }),
        deadline,
        timeoutMessage,
      );
    let response;
    try {
      response = await send();
    } catch (error) {
      // Chỉ phát lại khi Chrome xác nhận không có bộ nhận, tức lệnh chưa được thực thi.
      // Không phát lại khi đóng cổng giữa chừng: lệnh tải có thể đã chạy.
      if (!missingReceiver(error)) throw new Error(connectionError(error));
      await this.installBridge(tabId);
      try {
        response = await send();
      } catch (retryError) {
        throw new Error(connectionError(retryError));
      }
    }
    if (!response?.ok)
      throw new Error(
        response?.error || 'Không nhận được phản hồi từ trang Classroom. Hãy tải lại tab.',
      );
    return response.data;
  }
}
