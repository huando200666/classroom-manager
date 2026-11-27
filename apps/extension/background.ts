import { ChromeStore } from '../../packages/storage';
import { ChromiumAdapter } from '../../packages/browser-adapter/chromium';
import { retry, tabLocked } from '../../packages/browser-adapter/retry';
import { emptyState, type AppState, type Run, type Settings } from '../../packages/shared/types';
import { compareCounts, courseId } from '../../packages/classroom-adapter/dom';
import {
  addAttachments,
  nextAction,
  recordHistory,
  log,
  recoverInterrupted,
} from '../../packages/download-manager/engine';
import { matchesDownload } from '../../packages/download-manager/capture';
import { validCompletedDownload } from '../../packages/shared/files';
import { csv, reportRows } from '../../packages/shared/reports';
import { isTruncated, extension } from '../../packages/submission-parser';
import {
  validWebSender,
  WEB_COMMANDS,
  websiteState,
  WebAuthorizationError,
} from '../../packages/web-bridge/policy';
import { WebGrants } from './web-grants';

const store = new ChromeStore();
const browser = new ChromiumAdapter();
const webGrants = new WebGrants();
let state: AppState;
let chain = Promise.resolve();
let ticking = false;
let discovery = false;
async function get() {
  if (!state) {
    state = await store.load();
    if (state.run) {
      recoverInterrupted(state.run);
      await save();
    }
  }
  return state;
}
async function save() {
  await store.save(state);
}
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const p = chain.then(fn, fn);
  chain = p.then(
    () => {},
    () => {},
  );
  return p;
}
async function tabFor(url: string) {
  const s = await get();
  if (s.run?.workTabId) {
    try {
      await chrome.tabs.get(s.run.workTabId);
      await browser.navigate(s.run.workTabId, url);
      return s.run.workTabId;
    } catch (e) {
      if (!/no tab|invalid tab/i.test(String(e))) throw e;
    }
  }
  const id = await browser.createWorkTab(url);
  if (s.run) {
    s.run.workTabId = id;
    await save();
  }
  await browser.navigate(id, url);
  return id;
}
async function validateAccount(tabId: number) {
  const actual = await browser.dom(tabId, 'ping');
  if (!actual.url?.startsWith('https://classroom.google.com/'))
    throw new Error('Tab không còn ở Classroom.');
}
async function dispatch(command: string, args: any) {
  const s = await get();
  switch (command) {
    case 'state':
      return s;
    case 'tabs':
      return (await browser.listClassroomTabs()).filter((tab) => tab.id !== s.run?.workTabId);
    case 'open':
      return browser.openClassroom();
    case 'connect': {
      if (s.run?.status === 'running' || s.run?.status === 'paused')
        throw new Error('Dừng phiên tải trước khi đổi tài khoản.');
      const tabs = await browser.listClassroomTabs();
      const tab = tabs.find((t) => t.id === args.tabId);
      if (!tab) throw new Error('Chọn một tab Classroom đang mở.');
      await validateAccount(tab.id);
      const result = await browser.dom(tab.id, 'courses');
      if (!result.courses.length)
        throw new Error('Không đọc được lớp học. Mở trang chủ Classroom rồi thử lại.');
      s.account = {
        label: result.account.label,
        scope: result.account.scope,
        tabId: tab.id,
        teacher: false,
      };
      s.courses = result.courses;
      s.assignments = [];
      s.selectedCourseId = undefined;
      await save();
      return s;
    }
    case 'assignments': {
      if (s.run?.status === 'running' || s.run?.status === 'paused')
        throw new Error('Dừng phiên tải trước khi đổi lớp.');
      const course = s.courses.find((c) => c.id === args.courseId);
      if (!course || !s.account) throw new Error('Hãy kết nối Classroom và chọn lớp.');
      s.selectedCourseId = course.id;
      s.assignments = [];
      await save();
      const workId = await browser.createWorkTab(course.url);
      try {
        await browser.navigate(workId, course.url);
        let result = await browser
          .dom(workId, 'assignments', { courseId: course.id })
          .catch(async () => {
            const response = await browser.dom(workId, 'courseworkLink');
            if (!response?.url)
              throw new Error(
                'Không tìm thấy bài tập trên trang này. Mở mục Bài tập trên lớp của lớp học rồi kết nối lại.',
              );
            await browser.navigate(workId, response.url);
            return browser.dom(workId, 'assignments', { courseId: course.id });
          });
        if (result.account.scope !== s.account.scope)
          throw new Error('Tài khoản Classroom đã thay đổi. Kết nối lại trước khi đọc dữ liệu.');
        s.assignments = result.assignments;
        await save();
        return s;
      } finally {
        await chrome.tabs.remove(workId).catch(() => {});
      }
    }
    case 'scan': {
      if (s.run?.status === 'running' || s.run?.status === 'paused')
        throw new Error('Hãy dừng phiên hiện tại trước khi quét bài khác.');
      const assignment = s.assignments.find((a) => a.id === args.assignmentId);
      const course = s.courses.find((c) => c.id === assignment?.courseId);
      if (!assignment || !course || !s.account) throw new Error('Hãy chọn lớp và bài tập cụ thể.');
      const run: Run = {
        id: crypto.randomUUID(),
        status: 'idle',
        course,
        assignment,
        account: s.account.scope,
        students: [],
        files: [],
        expected: {},
        warnings: [],
        logs: [],
        startedAt: new Date().toISOString(),
        workTabId: s.run?.workTabId,
        settings: structuredClone(s.settings),
      };
      s.run = run;
      await save();
      try {
        const id = await tabFor(assignment.url);
        const link = await browser.dom(id, 'studentWork');
        if (link.url !== assignment.url) await browser.navigate(id, link.url);
        const result = await browser.dom(id, 'students');
        if (!result.teacher)
          throw new Error('Không xác minh được quyền giáo viên qua tab Bài tập của học viên.');
        if (result.account.scope !== run.account)
          throw new Error('Tài khoản đang hoạt động không khớp tài khoản đã kết nối.');
        if (
          result.students.some(
            (st: any) =>
              courseId(st.url) !== course.id ||
              !new URL(st.url).pathname.includes(`/a/${assignment.id}/`),
          )
        )
          throw new Error('Liên kết sinh viên không thuộc lớp/bài tập đang chọn.');
        run.students = result.students;
        run.expected = result.expected;
        run.warnings = compareCounts(run.students, run.expected);
        s.account.teacher = true;
        log(run, `Đã đọc ${run.students.length} sinh viên. Chưa bắt đầu tải.`);
        await save();
        return s;
      } catch (e) {
        log(run, String(e), 'error');
        await save();
        throw e;
      }
    }
    case 'start': {
      if (!s.run?.students.length) throw new Error('Hãy quét danh sách sinh viên trước.');
      if (s.run.status === 'running') return s;
      if (s.run.status === 'paused') throw new Error('Dùng nút Tiếp tục để khôi phục phiên.');
      if (s.run.files.length)
        throw new Error('Phiên đã có tệp. Hãy quét lại hoặc tải lại file lỗi.');
      s.run.settings = structuredClone(s.settings);
      s.run.status = 'running';
      log(s.run, 'Bắt đầu xử lý tuần tự từng bài nộp.');
      await save();
      void tick();
      return s;
    }
    case 'pause':
      if (s.run?.status === 'running') {
        s.run.status = 'paused';
        log(s.run, 'Tạm dừng hàng đợi. Lượt tải đang chạy được phép hoàn tất.');
        await save();
      }
      return s;
    case 'resume':
      if (s.run?.status === 'paused') {
        s.run.status = 'running';
        await save();
        void tick();
      }
      return s;
    case 'stop': {
      if (s.run) {
        s.run.status = 'stopped';
        for (const f of s.run.files) {
          if (['queued', 'starting', 'downloading'].includes(f.status)) {
            f.status = 'cancelled';
            if (f.downloadId !== undefined)
              await chrome.downloads.cancel(f.downloadId).catch(() => {});
            recordHistory(s, f);
          }
        }
        log(s.run, 'Đã dừng. Các tệp hoàn tất được giữ nguyên.');
        await save();
      }
      return s;
    }
    case 'retry': {
      const run = s.run;
      if (!run) throw new Error('Chưa có phiên xử lý.');
      if (run.status === 'running') throw new Error('Tạm dừng trước khi thử lại.');
      for (const f of run.files)
        if (
          (f.status === 'failed' || f.status === 'cancelled') &&
          (!args.key || f.key === args.key)
        ) {
          f.status = 'queued';
          f.downloadId = undefined;
          f.error = undefined;
        }
      for (const st of run.students)
        if (st.error) {
          st.checked = false;
          st.error = undefined;
        }
      run.status = 'running';
      await save();
      void tick();
      return s;
    }
    case 'settings': {
      if (s.run?.status === 'running' || s.run?.status === 'paused')
        throw new Error('Dừng phiên hiện tại trước khi sửa cấu hình.');
      const incoming = args.settings as Settings;
      const formats = ['zip', 'rar', '7z', 'py', 'ipynb', 'pdf', 'docx', 'xlsx', 'pptx'];
      if (
        !incoming ||
        !Array.isArray(incoming.formats) ||
        !incoming.formats.length ||
        incoming.formats.some((f) => !formats.includes(f)) ||
        !['original', 'student', 'code'].includes(incoming.nameMode) ||
        typeof incoming.rootFolder !== 'string' ||
        incoming.rootFolder.length > 100 ||
        typeof incoming.includeGraded !== 'boolean' ||
        typeof incoming.onlyNew !== 'boolean' ||
        typeof incoming.studentFolders !== 'boolean' ||
        typeof incoming.redact !== 'boolean'
      )
        throw new Error('Cấu hình không hợp lệ.');
      s.settings = incoming;
      await save();
      return s;
    }
    case 'folder':
      chrome.downloads.showDefaultFolder();
      return true;
    case 'show': {
      const h = s.history.find((h) => h.downloadId === args.id && h.status === 'complete');
      if (!h) throw new Error('Không tìm thấy file hoàn tất.');
      chrome.downloads.show(args.id);
      return true;
    }
    case 'clear': {
      if (s.run?.status === 'running' || s.run?.status === 'paused')
        throw new Error('Dừng phiên tải trước khi xóa dữ liệu.');
      await store.clear();
      state = emptyState();
      return state;
    }
    default:
      throw new Error('Lệnh không hợp lệ.');
  }
}
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    await serial(async () => {
      const s = await get();
      const run = s.run;
      if (!run || run.status !== 'running') return;
      await reconcile();
      const action = nextAction(run);
      if (action.kind === 'done') {
        run.status = 'complete';
        log(run, 'Đã xử lý xong hàng đợi. Xem báo cáo để kiểm tra tệp lỗi hoặc bài thiếu tệp.');
        await save();
        try {
          await chrome.downloads.download({
            url: 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv(reportRows(run))),
            filename: `Classroom_Downloads/Bao_cao_${run.id.slice(0, 8)}.csv`,
            conflictAction: 'uniquify',
          });
        } catch {
          log(run, 'Không tự lưu được báo cáo. Dùng nút Xuất CSV hoặc Excel.', 'warning');
          await save();
        }
        return;
      }
      if (action.kind === 'wait') return;
      const id = run.id;
      if (action.kind === 'student') {
        const student = action.student;
        try {
          await tabFor(student.url);
          const result = await browser.dom(run.workTabId!, 'attachments', { student });
          if (result.account.scope !== run.account) throw new Error('Tài khoản đã thay đổi.');
          for (const attachment of result.attachments as import('../../packages/shared/types').Attachment[]) {
            if (isTruncated(attachment.name) || !extension(attachment.name)) {
              await tabFor(attachment.url);
              const metadata = await browser.dom(run.workTabId!, 'driveMetadata');
              attachment.name = metadata.name;
            }
          }
          addAttachments(s, student, result.attachments);
        } catch (e) {
          student.checked = true;
          student.error = String(e);
          log(run, `Không đọc được một bài nộp: ${String(e)}`, 'error');
        }
        await save();
      } else {
        const file = action.file;
        file.status = 'starting';
        await save();
        try {
          await tabFor(file.url);
          file.startedAt = new Date().toISOString();
          await save();
          await browser.dom(run.workTabId!, 'driveDownload');
          log(run, 'Đã yêu cầu Drive tải tệp. Chờ trình duyệt xác nhận.');
          await save();
        } catch (e) {
          if (s.run?.id === id) {
            file.status = 'failed';
            file.error = String(e);
            file.finishedAt = new Date().toISOString();
            recordHistory(s, file);
            log(run, file.error, 'error');
            await save();
          }
        }
      }
    });
  } catch (e) {
    console.error('Queue operation failed', e);
  } finally {
    ticking = false;
  }
  if (state?.run?.status === 'running')
    setTimeout(
      () => void tick(),
      state.run.files.some((f) => ['starting', 'downloading'].includes(f.status)) ? 1000 : 50,
    );
}
async function reconcile() {
  const s = await get();
  const run = s.run;
  if (!run) return;
  for (const f of run.files) {
    if (f.status === 'starting' && f.downloadId === undefined && f.startedAt) {
      const candidates = (await chrome.downloads.search({ startedAfter: f.startedAt })).filter(
        (item) => matchesDownload(item, f),
      );
      if (candidates.length === 1) {
        f.downloadId = candidates[0].id;
        f.status = 'downloading';
      }
    }
    if (f.downloadId !== undefined && ['starting', 'downloading'].includes(f.status)) {
      const [item] = await chrome.downloads.search({ id: f.downloadId });
      if (!item) {
        f.status = 'failed';
        f.error = 'Lượt tải không còn trong lịch sử trình duyệt.';
        recordHistory(s, f);
      } else if (item.state === 'complete') {
        f.mime = item.mime;
        f.bytes = item.fileSize;
        f.path = item.filename || f.path;
        f.status = validCompletedDownload(item, f.name) ? 'complete' : 'failed';
        f.error =
          f.status === 'failed'
            ? 'Tệp rỗng hoặc MIME không khớp định dạng; không xác nhận là bài nộp hợp lệ.'
            : undefined;
        f.verification = 'Trình duyệt xác nhận hoàn tất; chưa kiểm tra chữ ký nhị phân.';
        f.finishedAt = item.endTime || new Date().toISOString();
        recordHistory(s, f);
      } else if (item.state === 'interrupted') {
        f.status = 'failed';
        f.error = item.error || 'Tải bị gián đoạn';
        f.finishedAt = new Date().toISOString();
        recordHistory(s, f);
      }
    } else if (
      f.status === 'starting' &&
      f.startedAt &&
      Date.now() - Date.parse(f.startedAt) > 30000
    ) {
      f.status = 'failed';
      f.error =
        'Không liên kết được lượt tải với định danh tệp. Kiểm tra Downloads/quyền truy cập, quyền tải nhiều tệp và xác nhận Drive trước khi thử lại.';
      recordHistory(s, f);
    }
  }
  await save();
}
chrome.downloads.onCreated.addListener((item) => {
  void serial(async () => {
    const s = await get();
    const f = s.run?.files.find((f) => f.status === 'starting' && matchesDownload(item, f));
    if (f) {
      f.downloadId = item.id;
      f.status = 'downloading';
      await save();
      await reconcile();
    }
  }).then(() => tick());
});
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
  void serial(async () => {
    const s = await get();
    const f = s.run?.files.find(
      (f) =>
        (f.status === 'starting' || (f.status === 'downloading' && f.downloadId === item.id)) &&
        matchesDownload(item, f),
    );
    if (!f) {
      suggest();
      return;
    }
    if (/text\/html|application\/xhtml/i.test(item.mime)) {
      f.status = 'failed';
      f.error = 'Drive trả về HTML. Cần đăng nhập hoặc xác nhận quyền truy cập.';
      f.downloadId = item.id;
      recordHistory(s, f);
      await save();
      suggest();
      await chrome.downloads.cancel(item.id).catch(() => {});
      return;
    }
    f.downloadId = item.id;
    f.status = 'downloading';
    f.mime = item.mime;
    await save();
    suggest({ filename: f.path, conflictAction: 'uniquify' });
  }).catch(() => suggest());
  return true;
});
chrome.downloads.onChanged.addListener(() => {
  void serial(reconcile).then(() => tick());
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cm-queue') void serial(reconcile).then(() => tick());
});
chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create('cm-queue', { periodInMinutes: 0.5 });
});
chrome.runtime.onStartup.addListener(() => {
  void chrome.alarms.create('cm-queue', { periodInMinutes: 0.5 });
});
chrome.action.onClicked.addListener(() => {
  void retry(() => chrome.tabs.create({ url: chrome.runtime.getURL('index.html') }), {
    retryIf: tabLocked,
  });
});
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.channel === 'cm-web') {
    if (!validWebSender(sender, chrome.runtime.id)) return;
    if (message.command === 'authorize' || message.command === 'revoke') {
      const operation =
        message.command === 'authorize' ? webGrants.authorize(sender) : webGrants.revoke(sender);
      void operation.then(
        () => respond({ ok: true, data: true }),
        () =>
          respond({
            ok: false,
            code: 'AUTH_REQUIRED',
            error: 'Không lưu được kết nối website. Tải lại tiện ích rồi thử lại.',
          }),
      );
      return true;
    }
    if (!WEB_COMMANDS.has(message.command)) {
      respond({ ok: false, error: 'Website không được gọi lệnh này.' });
      return;
    }
    const reading = ['connect', 'assignments', 'scan'].includes(message.command);
    if (reading && discovery) {
      respond({ ok: false, error: 'Đang đọc Classroom. Vui lòng chờ thao tác hiện tại.' });
      return;
    }
    if (reading) discovery = true;
    void serial(async () => {
      const grant = await webGrants.get(sender);
      if (!grant) throw new WebAuthorizationError();
      const current = await get();
      if (grant.account && current.account?.scope !== grant.account)
        throw new WebAuthorizationError();
      if (
        ['start', 'pause', 'resume', 'stop', 'retry'].includes(message.command) &&
        (!grant.account || current.run?.account !== grant.account)
      )
        throw new WebAuthorizationError();
      if (
        message.command === 'show' &&
        !current.history.some(
          (entry) =>
            entry.account === grant.account &&
            entry.downloadId === message.args?.id &&
            entry.status === 'complete',
        )
      )
        throw new Error('Không tìm thấy tệp thuộc tài khoản đang kết nối.');
      const result = await dispatch(message.command, message.args || {});
      if ((await webGrants.get(sender))?.nonce !== grant.nonce) throw new WebAuthorizationError();
      if (message.command === 'connect') {
        await webGrants.account(sender, grant.nonce, current.account?.scope);
        grant.account = current.account?.scope;
      }
      if (result && typeof result === 'object' && 'schema' in result)
        return websiteState(result as AppState, grant.account);
      return result;
    })
      .then(
        (data) => respond({ ok: true, data }),
        (error) =>
          respond({
            ok: false,
            code: error instanceof WebAuthorizationError ? 'AUTH_REQUIRED' : undefined,
            error: String(error.message || error),
          }),
      )
      .finally(() => {
        if (reading) discovery = false;
      });
    return true;
  }
  if (
    sender.id !== chrome.runtime.id ||
    !sender.url?.startsWith(chrome.runtime.getURL('')) ||
    sender.tab?.url?.startsWith('https:') ||
    message?.channel !== 'cm-app'
  )
    return;
  const isDiscovery = ['connect', 'assignments', 'scan'].includes(message.command);
  if (isDiscovery && discovery) {
    respond({ ok: false, error: 'Đang đọc Classroom. Vui lòng chờ thao tác hiện tại.' });
    return;
  }
  if (isDiscovery) discovery = true;
  serial(() => dispatch(message.command, message.args || {}))
    .then(
      (data) => respond({ ok: true, data }),
      (error) => respond({ ok: false, error: String(error.message || error) }),
    )
    .finally(() => {
      if (isDiscovery) discovery = false;
    });
  return true;
});
chrome.tabs.onRemoved.addListener((tabId) => {
  void webGrants.removeTab(tabId);
});
void chrome.alarms.create('cm-queue', { periodInMinutes: 0.5 });
