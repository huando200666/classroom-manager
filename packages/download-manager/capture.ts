import type { FileTask } from '../shared/types';
function hasFileId(url: string, id: string) {
  try {
    const u = new URL(url);
    return u.pathname.split('/').includes(id) || [...u.searchParams.values()].some((v) => v === id);
  } catch {
    return false;
  }
}
export function matchesDownload(
  item: { url: string; finalUrl?: string; referrer?: string; filename: string; startTime: string },
  file: FileTask,
) {
  if (!file.startedAt || Date.parse(item.startTime) < Date.parse(file.startedAt) - 1000)
    return false;
  const sources = [item.url, item.finalUrl || ''];
  const google = sources.some((url) => {
    try {
      const h = new URL(url).hostname;
      return (
        h === 'drive.google.com' ||
        h.endsWith('.googleusercontent.com') ||
        h === 'drive.usercontent.google.com'
      );
    } catch {
      return false;
    }
  });
  if (!google) return false;
  const sourceId = sources.some((url) => hasFileId(url, file.id));
  const referrerMatch =
    hasFileId(item.referrer || '', file.id) && item.filename.split(/[\\/]/).at(-1) === file.name;
  return sourceId || referrerMatch;
}
