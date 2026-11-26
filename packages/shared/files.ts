import type { Attachment, Course, Assignment, Student, Settings, HistoryEntry } from './types';
export function safeName(input: string, maxLength = 100) {
  let s = input
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  if (!s || /^\.+$/.test(s)) s = 'Khong_ten';
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)) s = `_${s}`;
  if (s.length > maxLength) {
    const suffix = s.match(/\.[a-z0-9]{1,10}$/i)?.[0] || '';
    s = s.slice(0, maxLength - suffix.length) + suffix;
  }
  return s.replace(/[. ]+$/g, '');
}
export function downloadPath(
  c: Course,
  a: Assignment,
  s: Student,
  f: Attachment,
  index: number,
  settings: Settings,
) {
  const name = safeName(f.name);
  const prefix =
    settings.nameMode === 'original'
      ? ''
      : `${String(index + 1).padStart(2, '0')}_${safeName(settings.nameMode === 'code' ? s.studentCode || s.name : s.name)}__`;
  const folders = [
    safeName(settings.rootFolder, 40),
    safeName(c.name, 40),
    a.week ? `Tuan_${String(a.week).padStart(2, '0')}` : safeName(a.name, 40),
    ...(settings.studentFolders ? [safeName(s.name, 40)] : []),
  ];
  const budget = 200 - folders.join('/').length - 1;
  return [...folders, safeName(prefix + name, budget)].join('/');
}
export function fileKey(
  account: string,
  courseId: string,
  assignmentId: string,
  studentId: string,
  file: Attachment,
) {
  return JSON.stringify([
    account,
    courseId,
    assignmentId,
    studentId,
    file.id,
    file.revision ?? null,
  ]);
}
export function alreadyDownloaded(key: string, file: Attachment, history: HistoryEntry[]) {
  return !!file.revision && history.some((h) => h.key === key && h.status === 'complete');
}
export function validCompletedDownload(
  item: { state: string; mime: string; filename: string; error?: string; fileSize?: number },
  expectedName: string,
) {
  if (item.state !== 'complete') return false;
  if (item.error || item.fileSize === 0) return false;
  const mime = item.mime.split(';')[0].trim().toLowerCase();
  if (/(?:text\/html|application\/xhtml)/i.test(mime)) return false;
  if (mime === 'text/plain' && !/\.(py|ipynb)$/i.test(expectedName)) return false;
  if (
    expectedName.toLowerCase().endsWith('.zip') &&
    mime &&
    ![
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
      'application/x-compressed',
      'application/download',
      'binary/octet-stream',
    ].includes(mime)
  )
    return false;
  return true;
}
