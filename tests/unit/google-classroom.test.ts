import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ClassroomClient,
  GoogleApiError,
  safeGoogleLink,
  attachmentLinks,
  submissionRows,
  type WebCourse,
} from '../../packages/google-classroom/client';
import {
  GoogleSession,
  CLASSROOM_SCOPES,
  SessionExpired,
  type TokenResponse,
} from '../../apps/web/google-auth';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const teacher: WebCourse = { id: 'C', name: 'Lớp C', role: 'teacher' };
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete window.google;
});

describe('Classroom REST API', () => {
  it('đọc đủ trang, giữ tham số, gửi token trong header và không đưa lên URL', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ courseWork: [{ id: 'A1' }], nextPageToken: 'next' }))
      .mockResolvedValueOnce(json({ courseWork: [{ id: 'A2' }] }));
    const list = await new ClassroomClient(() => 'TOKEN', fetcher).assignments('C/1');
    expect(list.map((item) => item.id)).toEqual(['A1', 'A2']);
    const second = new URL(fetcher.mock.calls[1][0]);
    expect(second.pathname).toContain('C%2F1/courseWork');
    expect(second.searchParams.get('pageToken')).toBe('next');
    expect(second.searchParams.get('pageSize')).toBe('100');
    for (const [url, options] of fetcher.mock.calls) {
      expect(url).not.toContain('TOKEN');
      expect(options.headers.Authorization).toBe('Bearer TOKEN');
      expect(options.credentials).toBe('omit');
      expect(options.body).toBeUndefined();
    }
  });
  it('hợp nhất lớp theo vai trò và ưu tiên vai trò giáo viên khi có trùng', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const teaching = new URL(String(url)).searchParams.has('teacherId');
      return json({
        courses: teaching
          ? [
              { id: 'T', name: 'Dạy' },
              { id: 'B', name: 'Trùng' },
            ]
          : [
              { id: 'S', name: 'Học' },
              { id: 'B', name: 'Trùng' },
            ],
      });
    });
    const list = await new ClassroomClient(() => 'TOKEN', fetcher).courses();
    expect(list).toHaveLength(3);
    expect(list.find((item) => item.id === 'B')?.role).toBe('teacher');
    expect(list.find((item) => item.id === 'S')?.role).toBe('student');
  });
  it('mọi yêu cầu bài nộp học viên đều giới hạn userId=me, kể cả các trang tiếp theo', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json({ nextPageToken: 'p2' }))
      .mockResolvedValueOnce(json({ studentSubmissions: [] }));
    await new ClassroomClient(() => 'TOKEN', fetcher).submissions(
      { ...teacher, role: 'student' },
      'A',
    );
    for (const [url] of fetcher.mock.calls)
      expect(new URL(url).searchParams.get('userId')).toBe('me');
  });
  it('không giới hạn userId khi giáo viên đọc lớp của mình', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ studentSubmissions: [] }));
    await new ClassroomClient(() => 'TOKEN', fetcher).submissions(teacher, 'A');
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.has('userId')).toBe(false);
  });
  it('dừng khi Google lặp mã phân trang, không lặp vô hạn', async () => {
    const fetcher = vi.fn(async () => json({ courseWork: [], nextPageToken: 'same' }));
    await expect(new ClassroomClient(() => 'TOKEN', fetcher).assignments('C')).rejects.toThrow(
      'lặp mã phân trang',
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([401, 403, 429, 500])(
    'giữ mã lỗi %i để giao diện xử lý phiên/quyền/hạn mức',
    async (status) => {
      const client = new ClassroomClient(
        () => 'TOKEN',
        vi.fn().mockResolvedValue(json({ error: {} }, status)),
      );
      await expect(client.assignments('C')).rejects.toMatchObject({ status });
    },
  );
  it('phân biệt API chưa bật với lỗi quyền thông thường', async () => {
    const client = new ClassroomClient(
      () => 'TOKEN',
      vi
        .fn()
        .mockResolvedValue(json({ error: { details: [{ reason: 'SERVICE_DISABLED' }] } }, 403)),
    );
    await expect(client.assignments('C')).rejects.toThrow('chưa được bật');
  });
  it('không biến roster thiếu bản ghi thành chưa nộp, giữ nguyên điểm 0', () => {
    const rows = submissionRows(
      teacher,
      [
        { userId: 'U1', profile: { name: { fullName: 'An' } } },
        { userId: 'U2', profile: { name: { fullName: 'Bình' } } },
      ],
      [{ id: 'R', userId: 'U1', courseWorkId: 'A', state: 'RETURNED', assignedGrade: 0 }],
      { sub: 'SELF', name: 'Giảng viên' },
    );
    expect(rows[0].submission?.assignedGrade).toBe(0);
    expect(rows[1].submission).toBeUndefined();
    const own = submissionRows(
      { ...teacher, role: 'student' },
      [{ userId: 'OTHER', profile: {} }],
      [],
      { sub: 'SELF', name: 'Tôi' },
    );
    expect(own).toEqual([]);
  });
  it('loại URL thực thi mã hoặc có thông tin đăng nhập khỏi liên kết đính kèm', () => {
    expect(safeGoogleLink('javascript:alert(1)')).toBeUndefined();
    expect(safeGoogleLink('https://user:pass@example.test')).toBeUndefined();
    expect(
      attachmentLinks({
        id: 'R',
        userId: 'U',
        courseWorkId: 'A',
        assignmentSubmission: {
          attachments: [
            { link: { url: 'javascript:alert(1)' } },
            { driveFile: { id: 'F', title: 'Bài.zip' } },
          ],
        },
      }),
    ).toEqual([{ name: 'Bài.zip', url: 'https://drive.google.com/file/d/F/view' }]);
  });
});

describe('phiên Google OAuth trong bộ nhớ', () => {
  const response: TokenResponse = {
    access_token: 'PRIVATE_TOKEN',
    expires_in: 3600,
    scope: CLASSROOM_SCOPES.join(' '),
  };
  function sdk(result = response) {
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn((config) => ({
            requestAccessToken: () => config.callback(result),
          })),
        },
      },
    };
  }
  it('đăng nhập từ SDK, token không ghi vào storage và bị xóa khi đăng xuất', async () => {
    sdk();
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const session = new GoogleSession('public.apps.googleusercontent.com');
    await session.login();
    expect(session.token()).toBe('PRIVATE_TOKEN');
    expect(write).not.toHaveBeenCalled();
    session.logout();
    expect(() => session.token()).toThrow(SessionExpired);
  });
  it('token hết hạn không còn dùng được', async () => {
    vi.useFakeTimers();
    sdk();
    const session = new GoogleSession('public.apps.googleusercontent.com');
    await session.login();
    await vi.advanceTimersByTimeAsync(3600000);
    expect(() => session.token()).toThrow(SessionExpired);
  });
  it('từ chối quyền thiếu trước khi đọc dữ liệu, không giữ token một phần', async () => {
    sdk({ ...response, scope: CLASSROOM_SCOPES[0] });
    const session = new GoogleSession('public.apps.googleusercontent.com');
    await expect(session.login()).rejects.toThrow('Chưa được cấp đủ quyền');
    expect(() => session.token()).toThrow(SessionExpired);
  });
  it('callback đăng nhập đến sau đăng xuất không khôi phục token', async () => {
    let finish: (response: TokenResponse) => void = () => {};
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => {
            finish = config.callback;
            return { requestAccessToken() {} };
          },
        },
      },
    };
    const session = new GoogleSession('public.apps.googleusercontent.com');
    const result = session.login().catch((error) => error);
    session.logout();
    finish(response);
    expect(await result).toBeInstanceOf(Error);
    expect(() => session.token()).toThrow(SessionExpired);
  });
});
