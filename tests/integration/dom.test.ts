import { describe, it, expect } from 'vitest';
import {
  readCourses,
  readAssignments,
  readStudents,
  readCounters,
  compareCounts,
  readAttachments,
  teacherView,
  readAccount,
} from '../../packages/classroom-adapter/dom';
import {
  coursesFixture,
  assignmentsFixture,
  studentsFixture,
  attachmentsFixture,
  courseUrl,
  workUrl,
  studentId,
  studentName,
} from '../fixtures/classroom';
import { csv, reportRows, diagnostic } from '../../packages/shared/reports';
import { emptyState, defaultSettings, type Run } from '../../packages/shared/types';
const doc = (html: string) => new DOMParser().parseFromString(html, 'text/html');
describe('DOM Classroom được phép đọc', () => {
  it('đọc lớp, tài khoản, bài tập và tuần', () => {
    const courses = readCourses(doc(coursesFixture()), 'https://classroom.google.com/');
    expect(courses[0].name).toBe('DHKL20A1HN – Tin cơ sở');
    const assignments = readAssignments(doc(assignmentsFixture()), courseUrl, 'COURSE');
    expect(assignments).toHaveLength(2);
    expect(assignments[0].week).toBe(7);
    expect(assignments[1].week).toBeUndefined();
    expect(readAccount(doc(coursesFixture()), courseUrl).scope).toBe('teacher@example.test');
  });
  it.each(['vi', 'en'])('73 sinh viên: 55 cần xử lý, 18 chưa nộp (%s)', (language) => {
    const d = doc(studentsFixture(language));
    const students = readStudents(d, workUrl);
    expect(students).toHaveLength(73);
    expect(students.filter((s) => s.status === 'submitted')).toHaveLength(55);
    expect(students.filter((s) => s.status === 'missing')).toHaveLength(18);
    expect(compareCounts(students, readCounters(d))).toEqual([]);
    expect(teacherView(d)).toBe(true);
  });
  it('đối chiếu danh sách thiếu và trạng thái không xác định', () => {
    const d = doc(studentsFixture());
    d.querySelector('[data-student-id="S01"] [role="status"]')!.textContent = 'Nội dung lạ';
    d.querySelector('[data-student-id="S02"]')!.remove();
    const students = readStudents(d, workUrl);
    const warnings = compareCounts(students, readCounters(d));
    expect(students).toHaveLength(72);
    expect(students.find((s) => s.id === 'S01')?.status).toBe('unknown');
    expect(warnings.length).toBeGreaterThan(1);
  });
  it('đọc nhiều ZIP, khôi phục tên bị cắt, bỏ tệp của giảng viên', () => {
    const st = { ...readStudents(doc(studentsFixture()), workUrl)[0] };
    const files = readAttachments(
      doc(attachmentsFixture(0, { multiple: true, truncated: true })),
      st.url,
      st,
    );
    expect(files.map((f) => f.name)).toEqual(['Bai_1.zip', 'Bai_2.zip']);
    expect(files.some((f) => f.id === 'TEACHER')).toBe(false);
  });
  it('không đọc tệp nếu không xác minh được vùng hoặc sinh viên', () => {
    const st = readStudents(doc(studentsFixture()), workUrl)[0];
    expect(() =>
      readAttachments(doc(attachmentsFixture(0, { unowned: true })), st.url, st),
    ).toThrow('Không xác minh');
    expect(() =>
      readAttachments(doc(attachmentsFixture(0)), st.url.replace('S01', 'S02'), st),
    ).toThrow('không khớp');
  });
  it('không suy ra trạng thái đã nộp từ tệp', () => {
    const st = readStudents(doc(studentsFixture()), workUrl)[72];
    expect(st.status).toBe('missing');
    expect(st.id).toBe(studentId(72));
  });
  it('hỗ trợ ARIA region khi không có data attribute', () => {
    const d = doc(attachmentsFixture(0));
    d.querySelector('[data-submission-student-id]')!.removeAttribute('data-submission-student-id');
    const st = readStudents(doc(studentsFixture()), workUrl)[0];
    expect(readAttachments(d, st.url, st)).toHaveLength(1);
  });
});
describe('báo cáo', () => {
  it('UTF-8 BOM, escape CSV và chống công thức Excel', () => {
    const text = csv([
      ['Tên', 'Ghi chú'],
      ['Nguyễn Văn A', '=HYPERLINK("evil")'],
    ]);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('Nguyễn Văn A');
    expect(text).toContain("'=HYPERLINK");
    expect(text).toContain('""evil""');
  });
  it('đủ sinh viên và ẩn dữ liệu chẩn đoán', () => {
    const run: Run = {
      id: 'r',
      status: 'idle',
      account: 'teacher@example.test',
      course: { id: 'c', name: 'c', url: '' },
      assignment: { id: 'a', courseId: 'c', name: 'a', url: '' },
      students: readStudents(doc(studentsFixture()), workUrl),
      files: [],
      expected: {},
      warnings: [],
      logs: [],
      settings: defaultSettings,
      startedAt: '',
    };
    expect(reportRows(run)).toHaveLength(74);
    expect(reportRows(run).some((row) => row[0] === studentName(72))).toBe(true);
    const d = diagnostic(run, true);
    expect(d).not.toContain('teacher@example.test');
    expect(d).not.toContain('classroom.google.com');
    expect(d).not.toContain('S01');
  });
});
