import { normalize, parseStatus, parseWeek, isTruncated } from '../submission-parser';
import type { Course, Assignment, Student, Attachment, Counters } from '../shared/types';
export const textOf = (el: Element | null) => el?.textContent?.replace(/\s+/g, ' ').trim() || '';
const label = (el: Element) =>
  el.getAttribute('title') || el.getAttribute('aria-label') || textOf(el);
export function absolute(href: string, base: string) {
  try {
    const u = new URL(href, base);
    return u.protocol === 'https:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}
export function classroomUrl(url: string) {
  try {
    return new URL(url).origin === 'https://classroom.google.com';
  } catch {
    return false;
  }
}
export function courseId(url: string) {
  return new URL(url).pathname.match(/\/(?:c|w)\/([^/]+)/)?.[1];
}
export function readCourses(doc: Document, base: string): Course[] {
  const out = new Map<string, Course>();
  for (const a of doc.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const url = absolute(a.getAttribute('href')!, base);
    if (!url || !classroomUrl(url)) continue;
    const match = new URL(url).pathname.match(/^\/(?:u\/\d+\/)?c\/([^/]+)\/?$/);
    if (!match) continue;
    const card = a.closest('li,article,[role="listitem"]');
    const name =
      textOf(a.querySelector('h1,h2,h3')) ||
      a.getAttribute('title') ||
      textOf(card?.querySelector('h1,h2,h3') ?? null) ||
      label(a);
    if (name && normalize(name) !== 'mo lop hoc' && !out.has(match[1]))
      out.set(match[1], {
        id: match[1],
        name,
        url,
        subject: textOf(card?.querySelector('[data-subject]') ?? null) || undefined,
      });
  }
  return [...out.values()];
}
export function readAssignments(doc: Document, base: string, expectedCourse: string): Assignment[] {
  const out = new Map<string, Assignment>();
  for (const a of doc.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (a.closest('nav,header') || a.getAttribute('role') === 'tab') continue;
    const url = absolute(a.getAttribute('href')!, base);
    if (!url || !classroomUrl(url) || courseId(url) !== expectedCourse) continue;
    const id = new URL(url).pathname.match(/\/a\/([^/]+)/)?.[1];
    if (!id) continue;
    const card = a.closest('article,[role="listitem"],[data-assignment-id]');
    const name =
      a.getAttribute('title') ||
      textOf(a.querySelector('h2,h3')) ||
      textOf(card?.querySelector('h2,h3') ?? null) ||
      label(a);
    if (
      !name ||
      /^(view assignment|xem bai tap|student work|bai tap cua hoc vien)$/i.test(normalize(name))
    )
      continue;
    if (!out.has(id))
      out.set(id, {
        id,
        courseId: expectedCourse,
        name,
        url,
        week: parseWeek(name),
        topic: card?.getAttribute('data-topic') || undefined,
        assignedAt:
          card?.querySelector('time[data-assigned]')?.getAttribute('datetime') || undefined,
        dueAt: card?.querySelector('time[data-due]')?.getAttribute('datetime') || undefined,
      });
  }
  return [...out.values()];
}
export function readAccount(doc: Document, base: string) {
  const u = new URL(base);
  const index = u.pathname.match(/\/u\/(\d+)/)?.[1] || u.searchParams.get('authuser') || '0';
  const accountEl = [...doc.querySelectorAll('[aria-label],[title]')].find((e) =>
    /google account|tai khoan google/.test(
      normalize(`${e.getAttribute('aria-label')} ${e.getAttribute('title')}`),
    ),
  );
  const l = accountEl ? label(accountEl) : '';
  const email = l.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  return {
    label: email || l || `Tài khoản Classroom ${index}`,
    scope: email || `classroom:${index}`,
    index,
  };
}
export function teacherView(doc: Document) {
  return [...doc.querySelectorAll('a,[role="tab"],button,h1,h2')].some((e) =>
    /^(bai tap cua hoc vien|bai tap cua sinh vien|student work)$/.test(normalize(label(e))),
  );
}
export function findStudentWorkLink(doc: Document, base: string) {
  return [...doc.querySelectorAll<HTMLAnchorElement>('a[href]')]
    .filter((a) =>
      /bai tap cua hoc vien|bai tap cua sinh vien|student work/.test(normalize(label(a))),
    )
    .map((a) => absolute(a.getAttribute('href')!, base))
    .find((u) => u && classroomUrl(u));
}
function rowFor(a: Element) {
  return a.closest('[data-student-id],[role="row"],[role="listitem"],li') || a;
}
function statusOf(row: Element) {
  const explicit =
    row.getAttribute('data-submission-status') ||
    row.querySelector('[data-status]')?.getAttribute('data-status');
  if (explicit) return explicit;
  const candidates = [...row.querySelectorAll('[role="status"],[aria-label],span,small,div')]
    .map((e) => label(e))
    .filter((t) => t.length < 100 && parseStatus(t) !== 'unknown');
  if (candidates.length) return [...new Set(candidates)].join(' ');
  return textOf(row);
}
function inheritedStatus(row: Element) {
  const group = row.closest('[role="group"],section,[data-status-group]');
  const h = group?.querySelector('h2,h3,[role="heading"]');
  return h ? label(h) : '';
}
export function readStudents(doc: Document, base: string): Student[] {
  const out = new Map<string, Student>();
  for (const node of doc.querySelectorAll('[data-student-id],a[href*="/student/"]')) {
    const a = (
      node.matches('a') ? node : node.querySelector('a[href*="/student/"]')
    ) as HTMLAnchorElement | null;
    const url = a ? absolute(a.getAttribute('href')!, base) : undefined;
    const id =
      node.getAttribute('data-student-id') ||
      (url ? new URL(url).pathname.match(/\/student\/([^/?]+)/)?.[1] : undefined);
    if (!id || !url || !classroomUrl(url)) continue;
    const row = rowFor(node);
    const own = statusOf(row);
    let status = parseStatus(own);
    const raw =
      status === 'unknown' && normalize(own) === normalize(textOf(a)) ? inheritedStatus(row) : own;
    if (status === 'unknown' && raw !== own) status = parseStatus(raw);
    const name =
      row.querySelector('[data-student-name]')?.getAttribute('data-student-name') ||
      textOf(row.querySelector('[data-name]')) ||
      a?.getAttribute('data-student-name') ||
      textOf(a?.querySelector('[title]') ?? null) ||
      a?.getAttribute('title') ||
      textOf(a);
    if (!name) continue;
    const student: Student = {
      id,
      name,
      url,
      status,
      rawStatus: raw,
      late: /muon|late/.test(normalize(raw)),
      checked: false,
      studentCode: row.getAttribute('data-student-code') || undefined,
    };
    const old = out.get(id);
    if (
      old &&
      old.status !== student.status &&
      student.status !== 'unknown' &&
      old.status !== 'unknown'
    ) {
      out.set(id, { ...old, status: 'unknown', rawStatus: 'Các trạng thái DOM mâu thuẫn' });
      continue;
    }
    if (!old || old.status === 'unknown') out.set(id, student);
  }
  return [...out.values()];
}
export function readCounters(doc: Document): Counters {
  const result: Counters = {};
  for (const el of doc.querySelectorAll(
    '[data-counter],[role="tab"],button,h2,h3,[role="heading"]',
  )) {
    const raw = label(el);
    const nums = raw.match(/\d+/g);
    if (!nums || nums.length !== 1 || raw.length > 70) continue;
    const n = Number(nums[0]);
    const status = parseStatus(raw);
    if (status !== 'unknown') result[status] = Math.max(result[status] ?? 0, n);
    if (/tong so|total students|tat ca hoc vien|all students/.test(normalize(raw)))
      result.total = n;
  }
  if (result.total === undefined && result.submitted !== undefined && result.missing !== undefined)
    result.total = result.submitted + result.missing + (result.graded ?? 0);
  return result;
}
export function compareCounts(students: Student[], expected: Counters) {
  const warnings: string[] = [];
  if (expected.total !== undefined && students.length !== expected.total)
    warnings.push(
      `Danh sách đọc được ${students.length}/${expected.total} sinh viên. Có thể còn bộ lọc, nhóm thu gọn hoặc vùng cuộn chưa tải.`,
    );
  for (const status of ['submitted', 'missing', 'graded'] as const) {
    const actual = students.filter((s) => s.status === status).length;
    if (expected[status] !== undefined && actual !== expected[status])
      warnings.push(`Bộ đếm ${status}: Classroom ${expected[status]}, nhận diện ${actual}.`);
  }
  const unknown = students.filter((s) => s.status === 'unknown').length;
  if (unknown)
    warnings.push(`${unknown} sinh viên chưa xác định được trạng thái; không tự động tải.`);
  return warnings;
}
export function driveFileId(url: string) {
  try {
    const u = new URL(url);
    if (u.origin !== 'https://drive.google.com') return undefined;
    return (
      u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ||
      (u.pathname === '/open' ? u.searchParams.get('id') || undefined : undefined)
    );
  } catch {
    return undefined;
  }
}
function submissionRegion(doc: Document, student: Student) {
  const explicit = [...doc.querySelectorAll('[data-submission-student-id]')].filter(
    (e) => e.getAttribute('data-submission-student-id') === student.id,
  );
  if (explicit.length === 1) return explicit[0];
  const regions = [
    ...doc.querySelectorAll('section,article,[role="region"],[role="tabpanel"]'),
  ].filter((e) => {
    const l = normalize(e.getAttribute('aria-label') || '');
    return (
      l.includes(normalize(student.name)) &&
      /bai lam|bai nop|student work|submission|attachments/.test(l)
    );
  });
  regions.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
  if (regions[0]) return regions[0];
  throw new Error(
    'Không xác minh được vùng bài làm thuộc sinh viên đang chọn. Không tải để tránh nhầm tệp đề bài.',
  );
}
export function readAttachments(doc: Document, base: string, student: Student): Attachment[] {
  const route = new URL(base).pathname.match(/\/student\/([^/]+)/)?.[1];
  if (route !== student.id) throw new Error('Trang hiện tại không khớp sinh viên trong hàng đợi.');
  const region = submissionRegion(doc, student);
  const out = new Map<string, Attachment>();
  for (const a of region.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const url = absolute(a.getAttribute('href')!, base);
    const id = url ? driveFileId(url) : undefined;
    if (!id || !url) continue;
    if (a.closest('[data-owner="teacher"],[data-assignment-material],nav')) continue;
    const card = a.closest('[data-file-id],[role="listitem"],article') || a;
    const candidates = [
      card.getAttribute('data-file-name'),
      a.getAttribute('title'),
      a.getAttribute('aria-label'),
      ...Array.from(card.querySelectorAll('[title],[aria-label]')).flatMap((e) => [
        e.getAttribute('title'),
        e.getAttribute('aria-label'),
      ]),
      textOf(a),
    ].filter((x): x is string => !!x);
    const name = candidates.find((x) => !isTruncated(x) && /\.[a-z0-9]{1,8}$/i.test(x));
    out.set(id, {
      id,
      name: name || candidates[0] || 'Tên tệp chưa xác định',
      url,
      revision:
        card.getAttribute('data-modified-time') || card.getAttribute('data-revision') || undefined,
      size: Number(card.getAttribute('data-size')) || undefined,
    });
  }
  return [...out.values()];
}
