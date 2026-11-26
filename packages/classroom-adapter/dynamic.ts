import { delay } from '../browser-adapter/retry';
export async function waitFor<T>(read: () => T | undefined, ms = 18000): Promise<T> {
  const initial = read();
  if (initial !== undefined) return initial;
  return new Promise<T>((resolve, reject) => {
    const observer = new MutationObserver(() => {
      try {
        const result = read();
        if (result !== undefined) {
          cleanup();
          resolve(result);
        }
      } catch (e) {
        cleanup();
        reject(e);
      }
    });
    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          'Không nhận diện được giao diện sau thời gian chờ. Kiểm tra đăng nhập, quyền giáo viên hoặc giao diện đã thay đổi.',
        ),
      );
    }, ms);
    function cleanup() {
      observer.disconnect();
      clearTimeout(timer);
    }
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  });
}
export async function settleDom(maxMs = 1200, quietMs = 180) {
  await new Promise<void>((resolve) => {
    let quiet: ReturnType<typeof setTimeout>;
    const observer = new MutationObserver(reset);
    const deadline = setTimeout(done, maxMs);
    function done() {
      clearTimeout(quiet);
      clearTimeout(deadline);
      observer.disconnect();
      resolve();
    }
    function reset() {
      clearTimeout(quiet);
      quiet = setTimeout(done, quietMs);
    }
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    reset();
  });
}
export async function collectDynamic<T extends { id: string }>(
  read: () => T[],
  options: { maxMs?: number; expected?: number } = {},
) {
  const started = Date.now();
  const all = new Map<string, T>();
  const scrollers = [
    document.scrollingElement,
    ...document.querySelectorAll<HTMLElement>(
      '[role="list"],[role="grid"],[role="listbox"],main,aside,div',
    ),
  ].filter(
    (e): e is HTMLElement => !!e && e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 80,
  );
  const positions = scrollers.map((e) => e.scrollTop);
  let stable = 0;
  try {
    while (Date.now() - started < (options.maxMs ?? 20000)) {
      const before = all.size;
      for (const item of read()) all.set(item.id, item);
      if (options.expected && all.size >= options.expected) break;
      let moved = false;
      for (const el of scrollers) {
        const old = el.scrollTop;
        el.scrollTop = Math.min(
          el.scrollTop + Math.max(100, el.clientHeight * 0.8),
          el.scrollHeight,
        );
        moved ||= el.scrollTop !== old;
      }
      await settleDom();
      if (all.size === before && !moved) stable++;
      else stable = 0;
      if (stable >= 3) break;
      await delay(80);
    }
  } finally {
    scrollers.forEach((e, i) => (e.scrollTop = positions[i]));
  }
  return [...all.values()];
}
