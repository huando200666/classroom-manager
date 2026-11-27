import { WebAuthorizationError } from '../../packages/web-bridge/policy';
interface Grant {
  tabId: number;
  documentId: string;
  nonce: string;
  account?: string;
}
const KEY = 'cm-website-grants-v1';
export class WebGrants {
  private chain: Promise<unknown> = Promise.resolve();
  private grants?: Grant[];
  private operation<T>(fn: (grants: Grant[]) => Promise<T>): Promise<T> {
    const result = this.chain.then(async () => {
      if (!this.grants) {
        const saved = (await chrome.storage.session.get(KEY))[KEY];
        this.grants = Array.isArray(saved) ? (saved as Grant[]) : [];
      }
      return fn(this.grants!);
    });
    this.chain = result.catch(() => {});
    return result;
  }
  private save() {
    return chrome.storage.session.set({ [KEY]: this.grants });
  }
  get(sender: chrome.runtime.MessageSender) {
    return this.operation(async (grants) => {
      const grant = grants.find(
        (g) => g.tabId === sender.tab!.id && g.documentId === sender.documentId,
      );
      return grant ? { ...grant } : undefined;
    });
  }
  authorize(sender: chrome.runtime.MessageSender) {
    return this.operation(async (grants) => {
      this.grants = grants.filter((g) => g.tabId !== sender.tab!.id);
      this.grants.push({
        tabId: sender.tab!.id!,
        documentId: sender.documentId!,
        nonce: crypto.randomUUID(),
      });
      await this.save();
    });
  }
  revoke(sender: chrome.runtime.MessageSender) {
    return this.operation(async (grants) => {
      this.grants = grants.filter(
        (g) => g.tabId !== sender.tab!.id || g.documentId !== sender.documentId,
      );
      await this.save();
    });
  }
  account(sender: chrome.runtime.MessageSender, nonce: string, account?: string) {
    return this.operation(async (grants) => {
      const grant = grants.find(
        (g) =>
          g.tabId === sender.tab!.id && g.documentId === sender.documentId && g.nonce === nonce,
      );
      if (!grant) throw new WebAuthorizationError();
      grant.account = account;
      await this.save();
    });
  }
  removeTab(tabId: number) {
    return this.operation(async (grants) => {
      this.grants = grants.filter((g) => g.tabId !== tabId);
      await this.save();
    });
  }
}
