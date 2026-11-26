import type { SubmissionStatus, Attachment } from '../shared/types';
export function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
const terms: Record<Exclude<SubmissionStatus, 'unknown'>, string[]> = {
  missing: [
    'chua nop',
    'da giao',
    'thieu',
    'chua hoan thanh',
    'assigned',
    'missing',
    'not submitted',
    'not turned in',
  ],
  graded: ['da cham diem', 'da tra bai', 'graded', 'returned'],
  submitted: [
    'da nop',
    'can danh gia',
    'can xem xet',
    'de xem xet',
    'turned in',
    'submitted',
    'needs grading',
    'to review',
  ],
};
export function parseStatus(text: string): SubmissionStatus {
  const n = normalize(text);
  const hits = new Set<SubmissionStatus>();
  // Negative phrases contain "submitted"; strip them before testing positive phrases.
  let rest = n;
  for (const phrase of terms.missing)
    if (new RegExp(`(^|[^a-z])${phrase}($|[^a-z])`).test(rest)) {
      hits.add('missing');
      rest = rest.replaceAll(phrase, ' ');
    }
  for (const s of ['graded', 'submitted'] as const)
    for (const phrase of terms[s])
      if (new RegExp(`(^|[^a-z])${phrase}($|[^a-z])`).test(rest)) hits.add(s);
  return hits.size === 1 ? [...hits][0] : 'unknown';
}
export function parseWeek(text: string) {
  const m = normalize(text).match(/(?:\btuan|\bweek|\bassignment)\s*[:#_-]?\s*0?(\d{1,2})\b/);
  const w = m ? Number(m[1]) : 0;
  return w >= 1 && w <= 15 ? w : undefined;
}
export function extension(name: string) {
  return name
    .trim()
    .match(/\.([a-z0-9]+)$/i)?.[1]
    .toLowerCase();
}
export function supportedAttachment(a: Attachment, formats: string[]) {
  return !isTruncated(a.name) && formats.includes(extension(a.name) || '');
}
export function isZipSignature(bytes: Uint8Array) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 3 && bytes[3] === 4) ||
      (bytes[2] === 5 && bytes[3] === 6) ||
      (bytes[2] === 7 && bytes[3] === 8))
  );
}
export function isTruncated(name: string) {
  return /…|\.{3}/.test(name);
}
