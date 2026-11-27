import {
  WEB_SOURCE,
  EXTENSION_SOURCE,
  allowedWebsite,
  WEB_COMMANDS,
  CLICK_COMMANDS,
} from '../../packages/web-bridge/policy';
import { STATE_KEY } from '../../packages/storage';

if (window === window.top && allowedWebsite(location.href)) {
  const context = globalThis as typeof globalThis & { __cmWebsiteDispose?: () => void };
  context.__cmWebsiteDispose?.();
  let authorized = false;
  let epoch = 0;
  let granting = false;
  let action = '';
  let actionUntil = 0;
  const emit = (data: object) => {
    if (allowedWebsite(location.href))
      window.postMessage({ source: EXTENSION_SOURCE, ...data }, location.origin);
  };
  const send = (command: string, args: object = {}) =>
    chrome.runtime.sendMessage({ channel: 'cm-web', command, args });
  const ready = () => emit({ event: 'ready', version: chrome.runtime.getManifest().version });
  const clicked = (event: MouseEvent) => {
    if (!event.isTrusted || !allowedWebsite(location.href) || !(event.target instanceof Element))
      return;
    const button = event.target.closest<HTMLElement>('[data-cm-connect],[data-cm-action]');
    if (!button) return;
    action = button.dataset.cmAction || '';
    actionUntil = Date.now() + 5000;
    if (!button.hasAttribute('data-cm-connect') || granting) return;
    granting = true;
    authorized = false;
    const grantEpoch = ++epoch;
    void send('authorize')
      .then((result) => {
        if (grantEpoch !== epoch) return;
        if (!result?.ok) throw new Error(result?.error || 'Chưa cho phép kết nối website.');
        authorized = true;
        emit({ event: 'authorized' });
      })
      .catch((error) => {
        if (grantEpoch === epoch)
          emit({ event: 'authorization-error', error: String(error.message || error) });
      })
      .finally(() => {
        granting = false;
      });
  };
  const message = (event: MessageEvent) => {
    if (
      event.source !== window ||
      event.origin !== location.origin ||
      !allowedWebsite(location.href)
    )
      return;
    const request = event.data;
    if (request?.source !== WEB_SOURCE || typeof request.id !== 'string' || request.id.length > 100)
      return;
    if (request.command === 'probe') {
      ready();
      return;
    }
    if (request.command !== 'revoke' && !WEB_COMMANDS.has(request.command)) return;
    if (!authorized && request.command !== 'revoke') {
      emit({
        id: request.id,
        ok: false,
        code: 'AUTH_REQUIRED',
        error: 'Bấm Kết nối tiện ích để cho phép đọc dữ liệu.',
      });
      return;
    }
    if (CLICK_COMMANDS.has(request.command)) {
      if (action !== request.command || Date.now() > actionUntil) {
        emit({
          id: request.id,
          ok: false,
          error: 'Thao tác này cần được bấm trực tiếp trên website.',
        });
        return;
      }
      action = '';
    }
    const issued = epoch;
    if (request.command === 'revoke') {
      authorized = false;
      epoch++;
      emit({ event: 'revoked' });
    }
    void send(request.command, request.args && typeof request.args === 'object' ? request.args : {})
      .then((result) => {
        if (request.command !== 'revoke' && (!authorized || issued !== epoch)) {
          emit({
            id: request.id,
            ok: false,
            code: 'AUTH_REQUIRED',
            error: 'Kết nối đã ngắt trước khi trả dữ liệu.',
          });
          return;
        }
        if (result?.code === 'AUTH_REQUIRED') {
          authorized = false;
          epoch++;
          emit({ event: 'revoked' });
        }
        emit({ id: request.id, ...result });
      })
      .catch(() => {
        authorized = false;
        epoch++;
        emit({ event: 'revoked' });
        emit({
          id: request.id,
          ok: false,
          error: 'Tiện ích đã ngắt hoặc vừa cập nhật. Tải lại website rồi kết nối lại.',
        });
      });
  };
  const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (authorized && area === 'local' && changes[STATE_KEY]) emit({ event: 'changed' });
  };
  window.addEventListener('message', message);
  document.addEventListener('click', clicked, true);
  chrome.storage.onChanged.addListener(changed);
  context.__cmWebsiteDispose = () => {
    window.removeEventListener('message', message);
    document.removeEventListener('click', clicked, true);
    chrome.storage.onChanged.removeListener(changed);
  };
  ready();
}
