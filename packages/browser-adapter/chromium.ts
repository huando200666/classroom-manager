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
    return a.origin === b.origin && a.pathname.replace(/\/$/, '') === b.pathname.replace(/\/$/, '');
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
    await retry(() => chrome.tabs.update(tabId, { url }), { retryIf: tabLocked });
    await this.ready(tabId, url);
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
      if (tab.status === 'complete' && (!url || sameDestination(tab.url, url))) {
        try {
          await this.dom(tabId, 'ping');
          return;
        } catch (error) {
          if (/Google từ chối|Cần đăng nhập|xác nhận bảo mật/.test(String(error))) throw error;
        }
      }
      await delay(250);
    }
    throw new Error(
      'Tab chưa sẵn sàng sau 22 giây. Kiểm tra kết nối, đăng nhập hoặc quyền truy cập.',
    );
  }
  async dom<T = any>(tabId: number, command: string, args: object = {}): Promise<T> {
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
