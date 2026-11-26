import { describe, it, expect, vi } from 'vitest';
import { retry, tabLocked, timeout } from '../../packages/browser-adapter/retry';
import {
  emptyState,
  defaultSettings,
  type Run,
  type Student,
  type FileTask,
} from '../../packages/shared/types';
import {
  addAttachments,
  nextAction,
  recoverInterrupted,
  recordHistory,
} from '../../packages/download-manager/engine';
import { matchesDownload } from '../../packages/download-manager/capture';
function makeRun(): Run {
  return {
    id: 'r',
    status: 'running',
    account: 'a',
    course: { id: 'c', name: 'c', url: '' },
    assignment: { id: 'a', courseId: 'c', name: 'a', url: '' },
    students: [],
    files: [],
    expected: {},
    warnings: [],
    logs: [],
    startedAt: '',
    settings: structuredClone(defaultSettings),
  };
}
function student(id: string, status: Student['status']): Student {
  return { id, name: id, status, url: '', rawStatus: '', late: false, checked: false };
}
describe('retry và khóa tab', () => {
  it('exponential backoff cho tab đang kéo', async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi
      .fn()
      .mockRejectedValueOnce(
        new Error('Tabs cannot be edited right now (user may be dragging a tab).'),
      )
      .mockRejectedValueOnce(new Error('Tabs cannot be edited'))
      .mockResolvedValue(9);
    expect(await retry(fn, { sleep, retryIf: tabLocked })).toBe(9);
    expect(sleep.mock.calls).toEqual([[300], [600]]);
  });
  it('không thử lại lỗi quyền khi chỉ retry khóa tab', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Access denied'));
    await expect(retry(fn, { retryIf: tabLocked })).rejects.toThrow('Access denied');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('thao tác có thời hạn', async () => {
    await expect(timeout(new Promise(() => {}), 5)).rejects.toThrow('quá thời gian');
  });
});
describe('hàng đợi', () => {
  it('bỏ qua chưa nộp, đã chấm và không xác định', () => {
    const r = makeRun();
    r.students = [
      student('m', 'missing'),
      student('u', 'unknown'),
      student('g', 'graded'),
      student('s', 'submitted'),
    ];
    expect(nextAction(r)).toEqual({ kind: 'student', student: r.students[3] });
    r.settings.includeGraded = true;
    expect(nextAction(r)).toEqual({ kind: 'student', student: r.students[2] });
  });
  it('tạm dừng và tiếp tục không làm mất việc', () => {
    const r = makeRun();
    r.students = [student('s', 'submitted')];
    r.status = 'paused';
    expect(nextAction(r).kind).toBe('wait');
    r.status = 'running';
    expect(nextAction(r).kind).toBe('student');
    r.status = 'stopped';
    expect(nextAction(r).kind).toBe('wait');
  });
  it('nhiều ZIP, không tải PDF, không nhân đôi trong cùng phiên', () => {
    const s = emptyState();
    s.run = makeRun();
    const st = student('s', 'submitted');
    s.run.students = [st];
    const files = [
      { id: '1', name: 'a.zip', url: '' },
      { id: '2', name: 'b.zip', url: '' },
      { id: '3', name: 'c.pdf', url: '' },
    ];
    addAttachments(s, st, files);
    addAttachments(s, st, files);
    expect(s.run.files).toHaveLength(2);
    expect(st.checked).toBe(true);
    expect(nextAction(s.run).kind).toBe('file');
  });
  it('lỗi một tệp không dừng hàng đợi', () => {
    const s = emptyState();
    s.run = makeRun();
    const st = student('s', 'submitted');
    s.run.students = [st];
    addAttachments(s, st, [
      { id: '1', name: 'a.zip', url: '' },
      { id: '2', name: 'b.zip', url: '' },
    ]);
    s.run.files[0].status = 'failed';
    recordHistory(s, s.run.files[0]);
    expect(nextAction(s.run)).toEqual({ kind: 'file', file: s.run.files[1] });
    expect(s.history[0].status).toBe('failed');
  });
  it('khôi phục sau service worker bị dừng không tải trùng tự động', () => {
    const r = makeRun();
    r.files = [{ status: 'starting' } as FileTask];
    recoverInterrupted(r);
    expect(r.status).toBe('paused');
    expect(r.files[0].status).toBe('failed');
  });
  it('không nhận nhầm download cùng tên', () => {
    const f = { id: 'ABC', name: 'a.zip', startedAt: '2026-01-01T00:00:00Z' } as FileTask;
    const item = {
      url: 'https://drive.google.com/download?id=OTHER',
      filename: 'a.zip',
      startTime: '2026-01-01T00:00:01Z',
    };
    expect(matchesDownload(item, f)).toBe(false);
    expect(matchesDownload({ ...item, url: 'https://drive.google.com/download?id=ABC' }, f)).toBe(
      true,
    );
    expect(matchesDownload({ ...item, url: 'https://evil.example/download?id=ABC' }, f)).toBe(
      false,
    );
  });
});
