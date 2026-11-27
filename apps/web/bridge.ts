import { WEB_SOURCE, EXTENSION_SOURCE } from '../../packages/web-bridge/policy';
export interface BridgeStatus {
  available: boolean;
  authorized: boolean;
  version?: string;
}
let status: BridgeStatus = { available: false, authorized: false };
let initialized = false;
const listeners = new Set<() => void>();
const pending = new Map<
  string,
  {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
const authorizers = new Set<{ resolve: () => void; reject: (error: Error) => void }>();
const changed = () => listeners.forEach((listener) => listener());
export const bridgeStatus = () => ({ ...status });
function forget() {
  status = { ...status, authorized: false };
  authorizers.forEach((item) => item.reject(new Error('Kết nối website đã ngắt.')));
  authorizers.clear();
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(new Error('Kết nối website đã ngắt.'));
  }
  pending.clear();
  changed();
}
function initialize() {
  if (initialized) return;
  initialized = true;
  window.addEventListener('message', (event) => {
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      event.data?.source !== EXTENSION_SOURCE
    )
      return;
    const data = event.data;
    if (data.event === 'ready') {
      const different = !status.available || status.version !== data.version;
      status = { ...status, available: true, version: String(data.version || '') };
      if (different) changed();
    } else if (data.event === 'authorized') {
      status = { ...status, authorized: true };
      authorizers.forEach((item) => item.resolve());
      authorizers.clear();
      changed();
    } else if (data.event === 'authorization-error') {
      authorizers.forEach((item) =>
        item.reject(new Error(data.error || 'Không kết nối được tiện ích.')),
      );
      authorizers.clear();
    } else if (data.event === 'revoked') forget();
    else if (data.event === 'changed' && status.authorized) changed();
    if (typeof data.id !== 'string') return;
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    clearTimeout(request.timer);
    if (data.ok) request.resolve(data.data);
    else {
      request.reject(new Error(data.error || 'Tiện ích chưa phản hồi.'));
      if (data.code === 'AUTH_REQUIRED') forget();
    }
  });
}
export function subscribeBridge(listener: () => void) {
  initialize();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export async function probeBridge() {
  initialize();
  for (let count = 0; count < 12; count++) {
    window.postMessage(
      { source: WEB_SOURCE, id: crypto.randomUUID(), command: 'probe' },
      location.origin,
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (status.available) break;
  }
  return bridgeStatus();
}
export function authorizeBridge(): Promise<void> {
  initialize();
  if (!status.available)
    return Promise.reject(
      new Error(
        'Chưa tìm thấy tiện ích hỗ trợ website. Cập nhật tiện ích rồi nhấn F5 tại website.',
      ),
    );
  // Chỉ content script nhận click isTrusted trên nút data-cm-connect mới cấp quyền.
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      authorizers.delete(waiter);
      reject(new Error('Chưa cho phép kết nối. Bấm trực tiếp nút Kết nối tiện ích để thử lại.'));
    }, 8000);
    const waiter = {
      resolve: () => {
        clearTimeout(timer);
        resolve();
      },
      reject: (error: Error) => {
        clearTimeout(timer);
        reject(error);
      },
    };
    authorizers.add(waiter);
  });
}
export function websiteRequest<T>(command: string, args: object = {}): Promise<T> {
  initialize();
  if (!status.authorized)
    return Promise.reject(new Error('Bấm Kết nối tiện ích trước khi đọc dữ liệu.'));
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(
        new Error(
          'Tiện ích chưa trả kết quả. Kiểm tra tab Classroom; nếu đang tải tệp, kiểm tra Downloads trước khi thử lại.',
        ),
      );
    }, 180000);
    pending.set(id, { resolve, reject, timer });
    window.postMessage({ source: WEB_SOURCE, id, command, args }, location.origin);
  });
}
export function disconnectBridge() {
  initialize();
  window.postMessage(
    { source: WEB_SOURCE, id: crypto.randomUUID(), command: 'revoke' },
    location.origin,
  );
  forget();
}
