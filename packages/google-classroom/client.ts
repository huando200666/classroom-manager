export interface GoogleProfile {
  sub: string;
  name: string;
  email?: string;
}
export interface ApiCourse {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  alternateLink?: string;
  courseState?: string;
}
export interface WebCourse extends ApiCourse {
  role: 'teacher' | 'student';
}
export interface ApiAssignment {
  id: string;
  title: string;
  description?: string;
  alternateLink?: string;
  maxPoints?: number;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number };
  workType?: string;
}
export interface ApiStudent {
  userId: string;
  profile: { name?: { fullName?: string }; emailAddress?: string };
}
export interface ApiAttachment {
  driveFile?: { id: string; title?: string; alternateLink?: string };
  link?: { url: string; title?: string };
  youTubeVideo?: { id: string; title?: string; alternateLink?: string };
}
export interface ApiSubmission {
  id: string;
  userId: string;
  courseWorkId: string;
  state?: string;
  late?: boolean;
  assignedGrade?: number;
  draftGrade?: number;
  assignmentSubmission?: { attachments?: ApiAttachment[] };
  shortAnswerSubmission?: { answer?: string };
  multipleChoiceSubmission?: { answer?: string };
  alternateLink?: string;
}
export const submissionLabels: Record<string, string> = {
  NEW: 'Chưa nộp',
  CREATED: 'Chưa nộp',
  RECLAIMED_BY_STUDENT: 'Đã rút bài',
  TURNED_IN: 'Đã nộp',
  RETURNED: 'Đã trả',
  UNKNOWN: 'Chưa có bản ghi',
};
export interface SubmissionRow {
  userId: string;
  name: string;
  email?: string;
  submission?: ApiSubmission;
}
export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function safeGoogleLink(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function attachmentLinks(submission?: ApiSubmission) {
  return (submission?.assignmentSubmission?.attachments ?? []).flatMap((attachment) => {
    const file = attachment.driveFile;
    const video = attachment.youTubeVideo;
    const link = attachment.link;
    const url = safeGoogleLink(
      file?.alternateLink ||
        (file?.id
          ? `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`
          : undefined) ||
        link?.url ||
        video?.alternateLink,
    );
    return url ? [{ name: file?.title || link?.title || video?.title || 'Mở bài nộp', url }] : [];
  });
}
export function submissionRows(
  course: WebCourse,
  people: ApiStudent[],
  submissions: ApiSubmission[],
  profile: GoogleProfile,
): SubmissionRow[] {
  const rows = new Map<string, SubmissionRow>();
  if (course.role === 'teacher')
    for (const person of people)
      rows.set(person.userId, {
        userId: person.userId,
        name: person.profile.name?.fullName || person.userId,
        email: person.profile.emailAddress,
      });
  for (const submission of submissions) {
    rows.set(submission.userId, {
      ...(rows.get(submission.userId) || {
        userId: submission.userId,
        name: course.role === 'student' ? profile.name : `Học viên ${submission.userId}`,
      }),
      submission,
    });
  }
  return [...rows.values()];
}
export class ClassroomClient {
  constructor(
    private token: () => string,
    private fetcher: typeof fetch = (...args) => fetch(...args),
  ) {}
  private async json<T>(url: string, signal?: AbortSignal): Promise<T> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await this.fetcher(url, {
        headers: { Authorization: `Bearer ${this.token()}` },
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const reasons = JSON.stringify(data?.error?.details || data?.error?.errors || []);
        const message =
          response.status === 401
            ? 'Phiên Google đã hết hạn. Đăng nhập lại để tải dữ liệu.'
            : /SERVICE_DISABLED|accessNotConfigured/.test(reasons)
              ? 'Google Classroom API chưa được bật trong dự án Google Cloud. Chủ website cần bật API rồi thử lại.'
              : response.status === 403
                ? 'Google chưa cho phép đọc dữ liệu này. Kiểm tra quyền đã cấp, vai trò trong lớp hoặc chính sách tài khoản trường.'
                : response.status === 429
                  ? 'Google đang giới hạn số yêu cầu. Chờ một lát rồi bấm Làm mới dữ liệu.'
                  : response.status === 404
                    ? 'Lớp hoặc bài tập không còn tồn tại, hoặc tài khoản không được truy cập.'
                    : 'Google Classroom đang gặp lỗi. Bấm Làm mới dữ liệu để thử lại.';
        throw new GoogleApiError(response.status, message);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (controller.signal.aborted && !signal?.aborted)
        throw new Error('Google phản hồi quá chậm. Kiểm tra mạng rồi bấm Làm mới dữ liệu.');
      throw error;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
  private async list<T>(
    path: string,
    key: string,
    params: Record<string, string> = {},
    signal?: AbortSignal,
  ): Promise<T[]> {
    const rows: T[] = [];
    const tokens = new Set<string>();
    let pageToken = '';
    do {
      const url = new URL(`https://classroom.googleapis.com/v1/${path}`);
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      url.searchParams.set('pageSize', '100');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const data = await this.json<Record<string, unknown>>(url.href, signal);
      if (data[key] !== undefined && !Array.isArray(data[key]))
        throw new Error('Google trả dữ liệu không đúng định dạng danh sách.');
      rows.push(...((data[key] || []) as T[]));
      pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
      if (pageToken && tokens.has(pageToken))
        throw new Error('Google lặp mã phân trang; chưa thể xác nhận đã đọc đủ dữ liệu.');
      if (pageToken) tokens.add(pageToken);
    } while (pageToken);
    return rows;
  }
  profile(signal?: AbortSignal) {
    return this.json<GoogleProfile>('https://www.googleapis.com/oauth2/v3/userinfo', signal);
  }
  async courses(signal?: AbortSignal): Promise<WebCourse[]> {
    const [teaching, studying] = await Promise.all([
      this.list<ApiCourse>(
        'courses',
        'courses',
        { teacherId: 'me', courseStates: 'ACTIVE' },
        signal,
      ),
      this.list<ApiCourse>(
        'courses',
        'courses',
        { studentId: 'me', courseStates: 'ACTIVE' },
        signal,
      ),
    ]);
    const courses = new Map<string, WebCourse>();
    for (const course of studying) courses.set(course.id, { ...course, role: 'student' });
    for (const course of teaching) courses.set(course.id, { ...course, role: 'teacher' });
    return [...courses.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }
  assignments(courseId: string, signal?: AbortSignal) {
    return this.list<ApiAssignment>(
      `courses/${encodeURIComponent(courseId)}/courseWork`,
      'courseWork',
      {},
      signal,
    );
  }
  students(courseId: string, signal?: AbortSignal) {
    return this.list<ApiStudent>(
      `courses/${encodeURIComponent(courseId)}/students`,
      'students',
      {},
      signal,
    );
  }
  submissions(course: WebCourse, assignmentId: string, signal?: AbortSignal) {
    return this.list<ApiSubmission>(
      `courses/${encodeURIComponent(course.id)}/courseWork/${encodeURIComponent(assignmentId)}/studentSubmissions`,
      'studentSubmissions',
      course.role === 'student' ? { userId: 'me' } : {},
      signal,
    );
  }
}
