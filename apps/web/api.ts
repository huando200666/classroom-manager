import { emptyState, type AppState } from '../../packages/shared/types';
import { connectionError } from '../../packages/shared/connection-errors';
import { bridgeStatus, websiteRequest } from './bridge';
export const installed = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
export async function request<T = AppState>(command: string, args: object = {}): Promise<T> {
  if (!installed) {
    if (!bridgeStatus().authorized && command === 'state') return emptyState() as T;
    if (!bridgeStatus().authorized && command === 'tabs') return [] as T;
    return websiteRequest<T>(command, args);
  }
  let result;
  try {
    result = await chrome.runtime.sendMessage({ channel: 'cm-app', command, args });
  } catch (error) {
    throw new Error(connectionError(error, 'app'));
  }
  if (!result?.ok)
    throw new Error(connectionError(result?.error || 'Tiện ích chưa phản hồi.', 'app'));
  return result.data;
}
export function saveBlob(content: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
