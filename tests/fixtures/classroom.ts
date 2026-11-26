const origin = 'https://classroom.google.com';
export const courseUrl = `${origin}/c/COURSE`;
export const assignmentUrl = `${courseUrl}/a/A7/details`;
export const workUrl = `${courseUrl}/a/A7/submissions`;
export function frame(body: string, language = 'vi') {
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>Classroom thử nghiệm</title></head><body><button aria-label="Google Account: Giảng viên (teacher@example.test)">Tài khoản</button>${body}</body></html>`;
}
export function coursesFixture() {
  return frame(
    `<main><ul><li><h2>DHKL20A1HN – Tin cơ sở</h2><a href="${courseUrl}" title="DHKL20A1HN – Tin cơ sở">Mở lớp</a></li></ul></main>`,
  );
}
export function assignmentsFixture() {
  return frame(
    `<nav><a href="${workUrl}">Bài tập của học viên</a></nav><main><article data-assignment-id="A7" data-topic="Lập trình Python"><h2>BTVN tuần 7</h2><a href="${assignmentUrl}" title="BTVN tuần 7">BTVN tuần 7</a><time data-due datetime="2026-11-25T16:00:00Z"></time></article><article><a href="${courseUrl}/a/A8/details" title="Kiểm tra giữa kỳ">Kiểm tra giữa kỳ</a></article></main>`,
  );
}
export function studentId(index: number) {
  return `S${String(index + 1).padStart(2, '0')}`;
}
export function studentName(index: number) {
  return `Sinh viên ${String(index + 1).padStart(2, '0')}`;
}
export function studentsFixture(language = 'vi', count = 73, submitted = 55) {
  const vi = language === 'vi';
  return frame(
    `<nav><a role="tab" href="${workUrl}">${vi ? 'Bài tập của học viên' : 'Student work'}</a><button data-counter>${submitted} ${vi ? 'Để xem xét' : 'To review'}</button><button data-counter>${count - submitted} ${vi ? 'Đã giao' : 'Assigned'}</button></nav><aside role="list" style="height:400px;overflow:auto"><h2>${vi ? 'Cần xem xét' : 'To review'}</h2>${Array.from({ length: count }, (_, i) => `<div role="listitem" data-student-id="${studentId(i)}"><a href="${workUrl}/by-status/turned-in/student/${studentId(i)}" data-student-name="${studentName(i)}">${studentName(i)}</a><span role="status">${i < submitted ? (vi ? 'Cần đánh giá' : 'Needs grading') : vi ? 'Đã giao' : 'Assigned'}</span></div>`).join('')}</aside><main><section data-owner="teacher"><a title="De_bai.zip" href="https://drive.google.com/file/d/TEACHER/view">Đề bài</a></section></main>`,
    language,
  );
}
export function attachmentsFixture(
  index: number,
  options: {
    pdf?: boolean;
    empty?: boolean;
    multiple?: boolean;
    truncated?: boolean;
    unowned?: boolean;
  } = {},
) {
  const names = options.empty
    ? []
    : options.pdf
      ? ['Bai_lam.pdf']
      : options.multiple
        ? ['Bai_1.zip', 'Bai_2.zip']
        : ['Bai_tap.zip'];
  return frame(
    `<aside><a href="${workUrl}/student/${studentId(index)}">${studentName(index)}</a></aside><section data-owner="teacher"><a href="https://drive.google.com/file/d/TEACHER/view" title="De_bai.zip">Đề bài ZIP</a></section><section ${options.unowned ? 'aria-label="Tài liệu"' : `aria-label="Bài làm của ${studentName(index)}" data-submission-student-id="${studentId(index)}"`}><h2>Bài làm của ${studentName(index)}</h2>${names.map((name, i) => `<article data-file-id="F_${studentId(index)}_${i}"><a href="https://drive.google.com/file/d/F_${studentId(index)}_${i}/view" title="${name}">${options.truncated ? 'Bai_ta…' : name}</a></article>`).join('')}</section>`,
  );
}
export function driveFixture(id: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Bai_tap.zip - Google Drive</title></head><body><main><h1>Bai_tap.zip</h1><button aria-label="Tải xuống" onclick="location.href='/download?id=${id}'">Tải xuống</button></main></body></html>`;
}
export const zipBytes = Buffer.from([0x50, 0x4b, 0x05, 0x06, ...Array(18).fill(0)]);
