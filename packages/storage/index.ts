import { emptyState, type AppState } from '../shared/types';
export const STATE_KEY = 'classroom-manager-v1';
export interface Store {
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
  clear(): Promise<void>;
}
export class ChromeStore implements Store {
  async load() {
    const r = await chrome.storage.local.get(STATE_KEY);
    const s = r[STATE_KEY] as AppState | undefined;
    return s?.schema === 1 ? s : emptyState();
  }
  async save(state: AppState) {
    await chrome.storage.local.set({ [STATE_KEY]: state });
  }
  async clear() {
    await chrome.storage.local.remove(STATE_KEY);
  }
}
