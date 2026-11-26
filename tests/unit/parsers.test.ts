import { describe, it, expect } from 'vitest';
import {
  parseStatus,
  parseWeek,
  supportedAttachment,
  isZipSignature,
} from '../../packages/submission-parser';
import {
  safeName,
  fileKey,
  alreadyDownloaded,
  downloadPath,
  validCompletedDownload,
} from '../../packages/shared/files';
import { defaultSettings, type HistoryEntry } from '../../packages/shared/types';
describe('phân loại trạng thái', () => {
  it.each([
    'Đã nộp',
    'Đã nộp muộn',
    'Cần đánh giá',
    'Cần xem xét',
    'Để xem xét',
    'Turned in',
    'Submitted',
    'Needs grading',
    'To review',
  ])('%s là đã nộp', (s) => expect(parseStatus(s)).toBe('submitted'));
  it.each([
    'Đã giao',
    'Chưa nộp',
    'Thiếu',
    'Chưa hoàn thành',
    'Assigned',
    'Missing',
    'Not submitted',
    'Not turned in',
  ])('%s là chưa nộp', (s) => expect(parseStatus(s)).toBe('missing'));
  it.each(['Đã chấm điểm', 'Đã trả bài', 'Graded', 'Returned'])('%s là đã chấm', (s) =>
    expect(parseStatus(s)).toBe('graded'),
  );
  it.each(['', 'Trạng thái khác', 'Cần đánh giá Đã giao'])('không đoán trạng thái mơ hồ: %s', (s) =>
    expect(parseStatus(s)).toBe('unknown'),
  );
});
describe('tuần và định dạng', () => {
  it.each([
    'BTVN tuần 7',
    'BTVN Tuần 07',
    'Bài tập về nhà tuần 7',
    'Case Study tuần 7',
    'Week 7',
    'Assignment 7',
  ])('nhận diện tuần: %s', (s) => expect(parseWeek(s)).toBe(7));
  it.each(['Kiểm tra số 1', 'Kiểm tra giữa kỳ', 'Bài tập cuối kỳ', 'Week 0', 'Week 16'])(
    'bài ngoài tuần: %s',
    (s) => expect(parseWeek(s)).toBeUndefined(),
  );
  it('chỉ nhận phần mở rộng chính xác', () => {
    expect(supportedAttachment({ id: 'x', name: 'BÀI.ZIP', url: '' }, ['zip'])).toBe(true);
    for (const name of ['bai.zip.html', 'bai…', 'bai.zip.exe'])
      expect(supportedAttachment({ id: 'x', name, url: '' }, ['zip'])).toBe(false);
  });
  it('kiểm tra chữ ký ZIP', () => {
    expect(isZipSignature(new Uint8Array([80, 75, 3, 4]))).toBe(true);
    expect(isZipSignature(new TextEncoder().encode('<html>'))).toBe(false);
  });
});
describe('tệp và phiên bản', () => {
  it.each([
    ['CON', '_CON'],
    ['NUL.zip', '_NUL.zip'],
    ['../a:b?.zip', '.._a_b_.zip'],
    ['abc. ', 'abc'],
    ['..', 'Khong_ten'],
  ])('làm sạch %s', (input, result) => expect(safeName(input)).toBe(result));
  it('không bỏ qua bài nộp lại khi không có phiên bản', () => {
    const f = { id: 'f', name: 'A.zip', url: '' };
    const key = fileKey('a', 'c', 'w', 's', f);
    expect(alreadyDownloaded(key, f, [{ key, status: 'complete' } as HistoryEntry])).toBe(false);
  });
  it('định danh phân biệt tài khoản, học viên và phiên bản', () => {
    const f = { id: 'f', name: 'A.zip', url: '', revision: 'r1' };
    const key = fileKey('a', 'c', 'w', 's', f);
    const h = [{ key, status: 'complete' } as HistoryEntry];
    expect(alreadyDownloaded(key, f, h)).toBe(true);
    expect(fileKey('a', 'c', 'w', 's', { ...f, revision: 'r2' })).not.toBe(key);
    expect(fileKey('b', 'c', 'w', 's', f)).not.toBe(key);
    expect(alreadyDownloaded(key, f, [{ key, status: 'failed' } as HistoryEntry])).toBe(false);
  });
  it('đường dẫn tương đối trong Downloads', () => {
    const p = downloadPath(
      { id: 'c', name: 'DHKL20A1HN', url: '' },
      { id: 'a', courseId: 'c', name: 'BTVN tuần 7', week: 7, url: '' },
      {
        id: 's',
        name: 'Nguyễn Văn A',
        status: 'submitted',
        url: '',
        rawStatus: '',
        late: false,
        checked: false,
      },
      { id: 'f', name: 'BaiTap.zip', url: '' },
      0,
      defaultSettings,
    );
    expect(p).toBe('Classroom_Downloads/DHKL20A1HN/Tuan_07/01_Nguyễn Văn A__BaiTap.zip');
  });
  it('không xác nhận HTML, PDF giả ZIP, file rỗng hoặc đang tải', () => {
    for (const item of [
      { state: 'in_progress', mime: 'application/zip', fileSize: 22 },
      { state: 'complete', mime: 'text/html', fileSize: 200 },
      { state: 'complete', mime: 'application/pdf', fileSize: 200 },
      { state: 'complete', mime: 'application/zip', fileSize: 0 },
    ])
      expect(validCompletedDownload({ ...item, filename: 'a.zip' }, 'a.zip')).toBe(false);
  });
});
