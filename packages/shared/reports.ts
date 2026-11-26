import { type Run, type HistoryEntry, statusLabels, fileLabels } from './types';
export type Cell = string | number | undefined;
export function safeCell(value: Cell) {
  const s = String(value ?? '');
  return /^[=+@\-\t\r\n]/.test(s) ? `'${s}` : s;
}
export function csv(rows: Cell[][]) {
  return (
    '\uFEFF' +
    rows
      .map((row) => row.map((value) => '"' + safeCell(value).replaceAll('"', '""') + '"').join(','))
      .join('\r\n')
  );
}
export function reportRows(run: Run): Cell[][] {
  const rows: Cell[][] = [
    [
      'Sinh viên',
      'Mã sinh viên',
      'Trạng thái nộp',
      'Nộp muộn',
      'Tệp',
      'Định danh tệp',
      'Phiên bản',
      'Trạng thái tải',
      'Dung lượng (byte)',
      'Nguyên nhân / Ghi chú',
      'Thời gian tải',
      'Đường dẫn',
      'Kiểm tra tệp',
    ],
  ];
  for (const s of run.students) {
    const files = run.files.filter((f) => f.studentId === s.id);
    if (!files.length)
      rows.push([
        s.name,
        s.studentCode,
        statusLabels[s.status],
        s.late ? 'Có' : 'Không',
        '',
        '',
        '',
        '',
        '',
        s.error ||
          (s.noFiles
            ? 'Không có tệp đúng định dạng'
            : s.status === 'unknown'
              ? 'Chưa xác minh trạng thái'
              : 'Chưa xử lý / không thuộc phạm vi tải'),
      ]);
    for (const f of files)
      rows.push([
        s.name,
        s.studentCode,
        statusLabels[s.status],
        s.late ? 'Có' : 'Không',
        f.name,
        f.id,
        f.revision,
        fileLabels[f.status],
        f.bytes ?? f.size,
        f.error,
        f.finishedAt,
        f.path,
        f.verification,
      ]);
  }
  for (const w of run.warnings) rows.push(['CẢNH BÁO', '', '', '', '', '', '', '', '', w]);
  return rows;
}
export function historyRows(history: HistoryEntry[]): Cell[][] {
  return [
    [
      'Tài khoản',
      'Lớp',
      'Bài tập',
      'Tuần',
      'Sinh viên',
      'Định danh tệp',
      'Phiên bản',
      'Tên tệp',
      'Trạng thái',
      'Thời gian',
      'Nguyên nhân',
    ],
    ...history.map((h) => [
      h.account,
      h.courseName,
      h.assignmentName,
      h.week,
      h.studentName,
      h.id,
      h.revision,
      h.name,
      fileLabels[h.status],
      h.finishedAt,
      h.error,
    ]),
  ];
}
export function diagnostic(run: Run, redact = true) {
  if (!redact) return JSON.stringify(run, null, 2);
  const ids = new Map(run.students.map((s, i) => [s.id, `Sinh viên ${i + 1}`]));
  return JSON.stringify(
    {
      schema: 1,
      status: run.status,
      counts: { students: run.students.length, files: run.files.length },
      warnings: run.warnings,
      students: run.students.map((s) => ({
        name: ids.get(s.id),
        status: s.status,
        late: s.late,
        checked: s.checked,
        error: s.error ? 'Không đọc được bài nộp' : undefined,
        noFiles: s.noFiles,
      })),
      files: run.files.map((f, i) => ({
        file: `Tệp ${i + 1}`,
        student: ids.get(f.studentId),
        status: f.status,
        mime: f.mime,
        bytes: f.bytes,
        error: f.error ? 'Lỗi tải hoặc xác minh tệp' : undefined,
      })),
      logs: run.logs.map((l) => ({
        at: l.at,
        level: l.level,
        message:
          l.level === 'error'
            ? 'Lỗi thao tác (đã ẩn chi tiết)'
            : l.message.replace(/https?:\/\/\S+/g, '[URL]').replace(/[\w.+-]+@[\w.-]+/g, '[email]'),
      })),
    },
    null,
    2,
  );
}
