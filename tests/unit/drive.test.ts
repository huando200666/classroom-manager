import { afterEach, expect, it } from 'vitest';
import { readDriveName, findDriveDownloadButton } from '../../packages/drive-adapter/dom';
import { safeName, downloadPath } from '../../packages/shared/files';
import { defaultSettings } from '../../packages/shared/types';
import { allowedNavigation, sameDestination } from '../../packages/browser-adapter/chromium';
afterEach(() => {
  document.body.innerHTML = '';
  document.title = '';
});
it('chấp nhận query đổi sau redirect nhưng không chấp nhận file hoặc host khác', () => {
  expect(
    sameDestination(
      'https://drive.google.com/file/d/ABC/view?authuser=0',
      'https://drive.google.com/file/d/ABC/view',
    ),
  ).toBe(true);
  expect(
    sameDestination(
      'https://drive.google.com/file/d/OTHER/view',
      'https://drive.google.com/file/d/ABC/view',
    ),
  ).toBe(false);
  expect(allowedNavigation('https://drive.google.com.evil.test/file/d/ABC/view')).toBe(false);
  expect(allowedNavigation('http://classroom.google.com/')).toBe(false);
});
it('đọc tên đầy đủ từ tiêu đề Drive khi Classroom bị cắt tên', () => {
  document.title = 'Bài tập của Nguyễn Văn A.zip - Google Drive';
  document.body.innerHTML = '<h1>Bài tập…</h1>';
  expect(readDriveName(document)).toBe('Bài tập của Nguyễn Văn A.zip');
});
it('chỉ chọn nút tải hiển thị và không chọn xác nhận bảo mật', () => {
  document.body.innerHTML =
    '<button hidden aria-label="Download">Tải</button><button aria-label="Tải xuống">Tải</button><button>Download anyway</button>';
  expect(findDriveDownloadButton(document)?.getAttribute('aria-label')).toBe('Tải xuống');
});
it('từ chối nhiều nút tải khả dụng mơ hồ', () => {
  document.body.innerHTML = '<button>Download</button><button>Tải xuống</button>';
  expect(findDriveDownloadButton(document)).toBeUndefined();
});
it('tên và đường dẫn dài vẫn giữ phần mở rộng ZIP', () => {
  expect(safeName('A'.repeat(300) + '.zip')).toHaveLength(100);
  expect(safeName('A'.repeat(300) + '.zip')).toMatch(/\.zip$/);
  const path = downloadPath(
    { id: 'c', name: 'C'.repeat(100), url: '' },
    { id: 'a', courseId: 'c', name: 'A'.repeat(100), url: '' },
    {
      id: 's',
      name: 'S'.repeat(100),
      url: '',
      status: 'submitted',
      rawStatus: '',
      late: false,
      checked: false,
    },
    { id: 'f', name: 'F'.repeat(300) + '.zip', url: '' },
    0,
    { ...defaultSettings, rootFolder: 'R'.repeat(100), studentFolders: true },
  );
  expect(path.length).toBeLessThanOrEqual(200);
  expect(path).toMatch(/\.zip$/);
});
