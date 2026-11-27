import { emptyState, type AppState } from '../shared/types';
export const WEB_SOURCE = 'cm-website-v1';
export const EXTENSION_SOURCE = 'cm-extension-v1';
export const WEBSITE_URL = 'https://huando200666.github.io/classroom-manager/';
export const WEB_COMMANDS = new Set([
  'state',
  'tabs',
  'open',
  'connect',
  'assignments',
  'scan',
  'start',
  'pause',
  'resume',
  'stop',
  'retry',
  'settings',
  'folder',
  'show',
]);
export const CLICK_COMMANDS = new Set([
  'open',
  'start',
  'pause',
  'resume',
  'stop',
  'retry',
  'settings',
  'folder',
  'show',
  'clear',
]);
export function allowedWebsite(url?: string) {
  try {
    const value = new URL(url || '');
    return (
      value.origin === 'https://huando200666.github.io' &&
      ['/classroom-manager/', '/classroom-manager/index.html'].includes(value.pathname) &&
      !value.username &&
      !value.password
    );
  } catch {
    return false;
  }
}
export function validWebSender(sender: chrome.runtime.MessageSender, extensionId: string) {
  return (
    sender.id === extensionId &&
    sender.frameId === 0 &&
    typeof sender.tab?.id === 'number' &&
    typeof sender.documentId === 'string' &&
    allowedWebsite(sender.url) &&
    allowedWebsite(sender.tab.url)
  );
}
export function websiteState(state: AppState, account?: string): AppState {
  if (!account || state.account?.scope !== account) return emptyState();
  return {
    ...state,
    run: state.run?.account === account ? state.run : undefined,
    history: state.history.filter((entry) => entry.account === account),
  };
}
export class WebAuthorizationError extends Error {
  readonly code = 'AUTH_REQUIRED';
  constructor() {
    super(
      'Kết nối website đã ngắt hoặc tài khoản trong tiện ích đã đổi. Bấm Kết nối tiện ích để đọc lại dữ liệu.',
    );
  }
}
