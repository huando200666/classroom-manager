import {
  readCourses,
  readAssignments,
  readStudents,
  readCounters,
  readAccount,
  teacherView,
  findStudentWorkLink,
  readAttachments,
  textOf,
} from '../../packages/classroom-adapter/dom';
import { waitFor, collectDynamic, settleDom } from '../../packages/classroom-adapter/dynamic';
import { normalize } from '../../packages/submission-parser';
import { readDriveName, findDriveDownloadButton } from '../../packages/drive-adapter/dom';
import type { Student } from '../../packages/shared/types';
function checkAccess() {
  const t = normalize(textOf(document.querySelector('main')) || document.title);
  if (
    /you need access|request access|ban can co quyen truy cap|yeu cau quyen truy cap|access denied/.test(
      t,
    )
  )
    throw new Error('Google từ chối quyền truy cập. Hãy kiểm tra đúng tài khoản giáo viên.');
  if (location.hostname === 'accounts.google.com')
    throw new Error('Cần đăng nhập Google trong tab chính thức.');
}
async function handle(message: any) {
  checkAccess();
  switch (message.command) {
    case 'ping':
      return { url: location.href };
    case 'driveMetadata': {
      return waitFor(() => {
        const name = readDriveName(document);
        return name ? { name } : undefined;
      });
    }
    case 'courseworkLink': {
      const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href]')].filter((a) =>
        /^(classwork|bai tap tren lop)$/.test(normalize(a.getAttribute('aria-label') || textOf(a))),
      );
      if (links.length !== 1) throw new Error('Không tìm được liên kết Bài tập trên lớp.');
      const url = new URL(links[0].href, location.href);
      if (url.origin !== location.origin) throw new Error('Liên kết ngoài Classroom.');
      return { url: url.href };
    }
    case 'courses': {
      await waitFor(() => (readCourses(document, location.href).length ? true : undefined));
      const courses = await collectDynamic(() => readCourses(document, location.href));
      return {
        courses,
        account: readAccount(document, location.href),
        teacher: teacherView(document),
      };
    }
    case 'assignments': {
      await waitFor(() =>
        readAssignments(document, location.href, message.courseId).length ? true : undefined,
      );
      return {
        assignments: await collectDynamic(() =>
          readAssignments(document, location.href, message.courseId),
        ),
        account: readAccount(document, location.href),
      };
    }
    case 'studentWork': {
      const link = findStudentWorkLink(document, location.href);
      if (link) return { url: link };
      const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"],button')].filter((e) =>
        /^(student work|bai tap cua hoc vien|bai tap cua sinh vien)$/.test(
          normalize(e.getAttribute('aria-label') || textOf(e)),
        ),
      );
      if (tabs.length !== 1)
        throw new Error('Không tìm được tab Bài tập của học viên; chưa xác minh quyền giáo viên.');
      tabs[0].click();
      await waitFor(() => (readStudents(document, location.href).length ? true : undefined));
      return { url: location.href };
    }
    case 'students': {
      await waitFor(() => (readStudents(document, location.href).length ? true : undefined));
      const expected = readCounters(document);
      const students = await collectDynamic(() => readStudents(document, location.href), {
        expected: expected.total,
      });
      return {
        students,
        expected,
        teacher: teacherView(document) || /\/submissions\b/.test(location.pathname),
        account: readAccount(document, location.href),
      };
    }
    case 'attachments': {
      const student = message.student as Student;
      await waitFor(() => {
        try {
          readAttachments(document, location.href, student);
          return true;
        } catch {
          return undefined;
        }
      });
      await settleDom(1800, 350);
      return {
        attachments: readAttachments(document, location.href, student),
        account: readAccount(document, location.href),
      };
    }
    case 'driveDownload': {
      await waitFor(() => findDriveDownloadButton(document)).then((button) => button.click());
      return { clicked: true };
    }
    default:
      throw new Error('Lệnh DOM không được hỗ trợ.');
  }
}
type DomListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];
const bridgeContext = globalThis as typeof globalThis & { __cmDomListener?: DomListener };
// Tránh nhiều bộ nhận và nhiều lần bấm tải nếu phải nạp lại script trên cùng tài liệu.
if (bridgeContext.__cmDomListener)
  chrome.runtime.onMessage.removeListener(bridgeContext.__cmDomListener);
const domListener: DomListener = (message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || message?.channel !== 'cm-dom') return;
  handle(message)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((e) => sendResponse({ ok: false, error: String(e.message || e) }));
  return true;
};
chrome.runtime.onMessage.addListener(domListener);
bridgeContext.__cmDomListener = domListener;
