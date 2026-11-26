export const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
export function tabLocked(error: unknown) {
  return /tabs cannot be edited|dragging a tab|tab.*not.*editable/i.test(String(error));
}
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    baseMs?: number;
    retryIf?: (e: unknown) => boolean;
    sleep?: (ms: number) => Promise<void>;
  } = {},
) {
  const { attempts = 4, baseMs = 300, retryIf = () => true, sleep = delay } = options;
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts - 1 || !retryIf(e)) throw e;
      await sleep(Math.min(baseMs * 2 ** i, 4000));
    }
  }
}
export async function timeout<T>(
  promise: Promise<T>,
  ms: number,
  message = 'Thao tác quá thời gian chờ',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
