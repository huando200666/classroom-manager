import {
  type AppState,
  type Run,
  type Attachment,
  type Student,
  type FileTask,
  type HistoryEntry,
} from '../shared/types';
import { supportedAttachment } from '../submission-parser';
import { fileKey, alreadyDownloaded, downloadPath } from '../shared/files';
export function log(run: Run, message: string, level: 'info' | 'warning' | 'error' = 'info') {
  run.logs.push({ at: new Date().toISOString(), level, message });
  run.logs = run.logs.slice(-300);
}
export function eligible(s: Student, run: Run) {
  return s.status === 'submitted' || (s.status === 'graded' && run.settings.includeGraded);
}
export function addAttachments(state: AppState, student: Student, attachments: Attachment[]) {
  const run = state.run!;
  const selected = attachments.filter((a) => supportedAttachment(a, run.settings.formats));
  student.checked = true;
  student.noFiles = selected.length === 0;
  student.error = undefined;
  for (const f of selected) {
    const key = fileKey(run.account, run.course.id, run.assignment.id, student.id, f);
    if (run.files.some((t) => t.key === key)) continue;
    const duplicate = run.settings.onlyNew && alreadyDownloaded(key, f, state.history);
    run.files.push({
      ...f,
      key,
      studentId: student.id,
      studentName: student.name,
      path: downloadPath(
        run.course,
        run.assignment,
        student,
        f,
        run.students.indexOf(student),
        run.settings,
      ),
      status: duplicate ? 'duplicate' : 'queued',
    });
  }
  log(
    run,
    `Đã kiểm tra bài nộp: ${selected.length} tệp đúng định dạng${student.noFiles ? ' — không có tệp phù hợp' : ''}.`,
  );
  if (attachments.some((a) => /…|\.{3}/.test(a.name)))
    log(
      run,
      'Có tên tệp bị cắt ngắn, không suy đoán định dạng. Kiểm tra chi tiết bài nộp.',
      'warning',
    );
}
export function recordHistory(state: AppState, file: FileTask) {
  const run = state.run!;
  const entry: HistoryEntry = {
    ...file,
    account: run.account,
    courseId: run.course.id,
    courseName: run.course.name,
    assignmentId: run.assignment.id,
    assignmentName: run.assignment.name,
    week: run.assignment.week,
    runId: run.id,
  };
  const i = state.history.findIndex((h) => h.runId === run.id && h.key === file.key);
  if (i >= 0) state.history[i] = entry;
  else state.history.push(entry);
}
export function nextAction(
  run: Run,
):
  | { kind: 'student'; student: Student }
  | { kind: 'file'; file: FileTask }
  | { kind: 'done' }
  | { kind: 'wait' } {
  if (run.status !== 'running') return { kind: 'wait' };
  if (run.files.some((f) => f.status === 'starting' || f.status === 'downloading'))
    return { kind: 'wait' };
  const file = run.files.find((f) => f.status === 'queued');
  if (file) return { kind: 'file', file };
  const student = run.students.find((s) => eligible(s, run) && !s.checked);
  return student ? { kind: 'student', student } : { kind: 'done' };
}
export function metrics(run?: Run) {
  const students = run?.students ?? [];
  const files = run?.files ?? [];
  return {
    total: students.length,
    submitted: students.filter((s) => s.status === 'submitted').length,
    missing: students.filter((s) => s.status === 'missing').length,
    graded: students.filter((s) => s.status === 'graded').length,
    unknown: students.filter((s) => s.status === 'unknown').length,
    checked: students.filter((s) => s.checked).length,
    found: files.length,
    zip: files.filter((f) => f.name.toLowerCase().endsWith('.zip')).length,
    complete: files.filter((f) => f.status === 'complete').length,
    failed: files.filter((f) => f.status === 'failed').length,
    duplicate: files.filter((f) => f.status === 'duplicate').length,
    noFiles: students.filter((s) => eligible(s, run!) && s.noFiles).length,
  };
}
export function recoverInterrupted(run: Run) {
  for (const f of run.files)
    if (f.status === 'starting' && f.downloadId === undefined) {
      f.status = 'failed';
      f.error =
        'Phiên xử lý bị ngắt trước khi liên kết lượt tải. Kiểm tra Downloads trước khi thử lại.';
    }
  if (run.status === 'running') {
    run.status = 'paused';
    log(run, 'Đã khôi phục phiên. Kiểm tra tiến độ rồi nhấn Tiếp tục.', 'warning');
  }
}
