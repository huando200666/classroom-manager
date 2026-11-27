import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  GraduationCap,
  LogIn,
  LogOut,
  RefreshCw,
  Users,
  FileSpreadsheet,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
  Search,
  LoaderCircle,
} from 'lucide-react';
import { version } from '../../package.json';
import {
  ClassroomClient,
  GoogleApiError,
  attachmentLinks,
  safeGoogleLink,
  submissionLabels,
  submissionRows,
  type ApiAssignment,
  type ApiStudent,
  type ApiSubmission,
  type GoogleProfile,
  type WebCourse,
} from '../../packages/google-classroom/client';
import { GoogleSession, SessionExpired, loadGoogleSdk } from './google-auth';
import { csv } from '../../packages/shared/reports';
import { saveBlob } from './api';
import './web-classroom.css';

const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
function due(assignment: ApiAssignment) {
  const date = assignment.dueDate;
  if (!date) return 'Không có hạn nộp';
  if (!assignment.dueTime) return `${date.day}/${date.month}/${date.year}`;
  return new Date(
    Date.UTC(
      date.year,
      date.month - 1,
      date.day,
      assignment.dueTime.hours || 0,
      assignment.dueTime.minutes || 0,
    ),
  ).toLocaleString('vi-VN');
}
export function WebClassroomApp() {
  const [auth] = useState(() => new GoogleSession(clientId));
  const api = useMemo(() => new ClassroomClient(() => auth.token()), [auth]);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<GoogleProfile | null>(null);
  const [courses, setCourses] = useState<WebCourse[]>([]);
  const [courseId, setCourseId] = useState('');
  const [assignments, setAssignments] = useState<ApiAssignment[]>([]);
  const [assignmentId, setAssignmentId] = useState('');
  const [people, setPeople] = useState<ApiStudent[]>([]);
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([]);
  const [loadedSubmissions, setLoadedSubmissions] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const generation = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const course = courses.find((item) => item.id === courseId);
  const assignment = assignments.find((item) => item.id === assignmentId);
  const rows = useMemo(
    () =>
      course && profile && loadedSubmissions
        ? submissionRows(course, people, submissions, profile)
        : [],
    [course, people, submissions, profile, loadedSubmissions],
  );
  const filtered = rows.filter(
    (row) =>
      (status === 'all' || (row.submission?.state || 'UNKNOWN') === status) &&
      `${row.name} ${row.email || ''}`
        .toLocaleLowerCase('vi')
        .includes(query.toLocaleLowerCase('vi')),
  );

  useEffect(() => {
    let live = true;
    if (clientId)
      void loadGoogleSdk()
        .then(() => {
          if (live) setReady(true);
        })
        .catch((reason) => {
          if (live) setError(reason.message);
        });
    return () => {
      live = false;
      generation.current++;
      controller.current?.abort();
      auth.logout();
    };
  }, [auth]);
  function begin(label: string) {
    controller.current?.abort();
    controller.current = new AbortController();
    const id = ++generation.current;
    setBusy(label);
    setError('');
    return { id, signal: controller.current.signal };
  }
  function clearCourse() {
    setCourseId('');
    setAssignments([]);
    setAssignmentId('');
    setPeople([]);
    setSubmissions([]);
    setLoadedSubmissions(false);
    setQuery('');
    setStatus('all');
    setWarning('');
  }
  function logout() {
    generation.current++;
    controller.current?.abort();
    auth.logout();
    setProfile(null);
    setCourses([]);
    clearCourse();
    setBusy('');
    setError('');
  }
  function failed(reason: unknown, id: number) {
    if (generation.current !== id) return;
    if (
      reason instanceof SessionExpired ||
      (reason instanceof GoogleApiError && reason.status === 401)
    )
      logout();
    const message =
      reason instanceof Error ? reason.message : 'Không đọc được dữ liệu Google Classroom.';
    setError(
      /Failed to fetch|NetworkError|Load failed/i.test(message)
        ? 'Không kết nối được Google. Kiểm tra mạng rồi bấm Làm mới dữ liệu.'
        : message,
    );
  }
  async function login() {
    logout();
    const request = begin('Đang đăng nhập Google…');
    try {
      await auth.login();
      if (request.id !== generation.current) return;
      const [identity, list] = await Promise.all([
        api.profile(request.signal),
        api.courses(request.signal),
      ]);
      if (request.id !== generation.current) return;
      setProfile({ ...identity, name: identity.name || identity.email || 'Tài khoản Google' });
      setCourses(list);
      if (list.length === 1) await loadCourse(list[0]);
    } catch (reason) {
      failed(reason, request.id);
    } finally {
      if (request.id === generation.current) setBusy('');
    }
  }
  async function loadCourse(selected: WebCourse, keepAssignment = '') {
    const request = begin('Đang tải dữ liệu lớp…');
    clearCourse();
    setCourseId(selected.id);
    try {
      const results = await Promise.allSettled([
        api.assignments(selected.id, request.signal),
        selected.role === 'teacher'
          ? api.students(selected.id, request.signal)
          : Promise.resolve([] as ApiStudent[]),
      ]);
      if (request.id !== generation.current) return;
      if (results[0].status === 'rejected') throw results[0].reason;
      const list = results[0].value;
      let roster: ApiStudent[] = [];
      if (results[1].status === 'fulfilled') roster = results[1].value;
      else {
        if (
          results[1].reason instanceof SessionExpired ||
          (results[1].reason instanceof GoogleApiError && results[1].reason.status === 401)
        )
          throw results[1].reason;
        setWarning(
          'Chưa đọc được danh sách học viên. Các bài nộp vẫn được hiển thị theo dữ liệu Google trả về; một số tên có thể chỉ hiện mã học viên.',
        );
      }
      setAssignments(list);
      setPeople(roster);
      const first = list.find((item) => item.id === keepAssignment) || list[0];
      if (first) await loadSubmissions(selected, first.id);
    } catch (reason) {
      failed(reason, request.id);
    } finally {
      if (request.id === generation.current) setBusy('');
    }
  }
  async function loadSubmissions(selected: WebCourse, selectedAssignment: string) {
    const request = begin('Đang tải bài nộp…');
    setAssignmentId(selectedAssignment);
    setSubmissions([]);
    setLoadedSubmissions(false);
    setQuery('');
    setStatus('all');
    try {
      const list = await api.submissions(selected, selectedAssignment, request.signal);
      if (request.id === generation.current) {
        setSubmissions(list);
        setLoadedSubmissions(true);
      }
    } catch (reason) {
      failed(reason, request.id);
    } finally {
      if (request.id === generation.current) setBusy('');
    }
  }
  async function refresh() {
    if (course) {
      await loadCourse(course, assignmentId);
      return;
    }
    const request = begin('Đang làm mới danh sách lớp…');
    try {
      const list = await api.courses(request.signal);
      if (request.id === generation.current) setCourses(list);
    } catch (reason) {
      failed(reason, request.id);
    } finally {
      if (request.id === generation.current) setBusy('');
    }
  }
  function exportCsv() {
    saveBlob(
      csv([
        ['Lớp', 'Bài tập', 'Học viên', 'Email', 'Trạng thái', 'Nộp muộn', 'Điểm', 'Tệp / Bài làm'],
        ...rows.map((row) => [
          course?.name,
          assignment?.title,
          row.name,
          row.email,
          submissionLabels[row.submission?.state || 'UNKNOWN'] || 'Không xác định',
          row.submission?.late ? 'Có' : 'Không',
          row.submission?.assignedGrade,
          attachmentLinks(row.submission)
            .map((file) => file.name)
            .join('; ') ||
            row.submission?.shortAnswerSubmission?.answer ||
            row.submission?.multipleChoiceSubmission?.answer,
        ]),
      ]),
      'Bao_cao_Classroom.csv',
      'text/csv;charset=utf-8',
    );
  }
  return (
    <div className="gc-app">
      <header className="gc-header">
        <a className="gc-brand" href={import.meta.env.BASE_URL}>
          <span className="gc-brand-icon">
            <GraduationCap size={27} />
          </span>
          <span>
            Classroom<span className="gc-brand-sub">MANAGER</span>
          </span>
        </a>
        <div className="gc-account">
          {profile ? (
            <>
              <span>
                <strong>{profile.name}</strong>
                <small>{profile.email}</small>
              </span>
              <button onClick={logout}>
                <LogOut size={16} /> Đăng xuất
              </button>
            </>
          ) : (
            <span className="gc-private">
              <ShieldCheck size={17} /> Kết nối qua Google
            </span>
          )}
        </div>
      </header>
      <main className="gc-main">
        {error && (
          <div className="gc-error" role="alert">
            <AlertTriangle size={21} />
            <span>{error}</span>
          </div>
        )}
        {!profile ? (
          <section className="gc-login">
            <div className="gc-intro">
              <span className="gc-eyebrow">KHÔNG GIAN LỚP HỌC CỦA BẠN</span>
              <h1>
                Lớp học của bạn.
                <br />
                Kết nối ngay trên web.
              </h1>
              <p>
                Đăng nhập bằng tài khoản Google đang dùng Classroom để xem lớp, bài tập và bài nộp
                tại một nơi.
              </p>
              <div className="gc-benefits">
                <span>
                  <GraduationCap /> Danh sách lớp tự cập nhật sau đăng nhập
                </span>
                <span>
                  <BookOpen /> Xem bài tập và hạn nộp
                </span>
                <span>
                  <Users /> Dữ liệu theo quyền tài khoản của bạn
                </span>
              </div>
            </div>
            <div className="gc-login-card">
              <div className="gc-login-icon">
                <LogIn size={29} />
              </div>
              <h2>Kết nối Google Classroom</h2>
              <p>
                Chọn tài khoản và cho phép đọc dữ liệu Classroom. Bạn nhập mật khẩu trên trang của
                Google.
              </p>
              <button
                className="gc-primary gc-login-button"
                disabled={!ready || !!busy || !clientId}
                onClick={() => void login()}
              >
                {busy ? <LoaderCircle size={19} className="gc-spin" /> : <LogIn size={19} />}
                {busy || 'Đăng nhập bằng Google'}
              </button>
              {!clientId ? (
                <div className="gc-setup" role="status">
                  <strong>Đang chờ cấu hình đăng nhập Google</strong>
                  <p>Chủ website cần thêm Google OAuth Client ID để bật đăng nhập.</p>
                  <a
                    href="https://github.com/huando200666/classroom-manager/blob/main/docs/GOOGLE-OAUTH.md"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Hướng dẫn cấu hình cho chủ website
                  </a>
                </div>
              ) : !ready && !error ? (
                <p role="status">Đang chuẩn bị kết nối Google…</p>
              ) : null}
              <p className="gc-note">
                <ShieldCheck size={16} /> Chỉ yêu cầu quyền đọc. Phiên truy cập và dữ liệu lớp được
                giữ trong bộ nhớ của tab này.
              </p>
            </div>
          </section>
        ) : (
          <>
            <div className="gc-heading">
              <div>
                <span className="gc-eyebrow">GOOGLE CLASSROOM</span>
                <h1>{course?.name || 'Lớp học của bạn'}</h1>
                <p>
                  {course
                    ? `${course.section || 'Dữ liệu trực tiếp từ Google Classroom'} · ${course.role === 'teacher' ? 'Vai trò giáo viên' : 'Vai trò học viên'}`
                    : `${courses.length} lớp đang hoạt động trong tài khoản của bạn.`}
                </p>
              </div>
              <button onClick={() => void refresh()} disabled={!!busy}>
                <RefreshCw size={17} /> Làm mới dữ liệu
              </button>
            </div>
            {busy && (
              <div className="gc-loading" role="status">
                <LoaderCircle size={18} className="gc-spin" />
                {busy}
              </div>
            )}
            {!course ? (
              <section aria-label="Danh sách lớp" className="gc-courses">
                {courses.map((item) => (
                  <button
                    className="gc-course-card"
                    key={item.id}
                    onClick={() => void loadCourse(item)}
                  >
                    <span className="gc-course-top">
                      <GraduationCap size={23} />
                      <span className={`gc-role ${item.role}`}>
                        {item.role === 'teacher' ? 'Giáo viên' : 'Học viên'}
                      </span>
                    </span>
                    <h2>{item.name}</h2>
                    <p>{item.section || item.descriptionHeading || 'Google Classroom'}</p>
                    <span className="gc-course-open">Xem dữ liệu lớp</span>
                  </button>
                ))}
                {!courses.length && !busy && (
                  <div className="gc-empty">
                    <GraduationCap size={40} />
                    <h2>Chưa có lớp đang hoạt động</h2>
                    <p>
                      Kiểm tra tài khoản Google đã chọn. Bạn có thể đăng xuất rồi chọn tài khoản
                      Classroom khác.
                    </p>
                  </div>
                )}
              </section>
            ) : (
              <>
                <div className="gc-course-tools">
                  <button
                    onClick={() => {
                      generation.current++;
                      controller.current?.abort();
                      clearCourse();
                      setBusy('');
                      setError('');
                    }}
                  >
                    <ArrowLeft size={16} /> Tất cả lớp
                  </button>
                  {safeGoogleLink(course.alternateLink) && (
                    <a
                      href={safeGoogleLink(course.alternateLink)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Mở lớp trên Classroom <ExternalLink size={15} />
                    </a>
                  )}
                </div>
                {course.role === 'student' && (
                  <div className="gc-info">
                    Bạn đang xem với vai trò học viên. Website hiển thị bài nộp và điểm của chính
                    bạn theo quyền Google cấp.
                  </div>
                )}
                {warning && (
                  <div className="gc-info" role="status">
                    {warning}
                  </div>
                )}
                <div className="gc-stats">
                  <div>
                    <BookOpen size={21} />
                    <strong>{assignments.length}</strong>
                    <span>Bài tập đã đăng</span>
                  </div>
                  <div>
                    <Users size={21} />
                    <strong>{busy ? '—' : rows.length}</strong>
                    <span>
                      {course.role === 'teacher' ? 'Học viên trong báo cáo' : 'Bài nộp của bạn'}
                    </span>
                  </div>
                  <div>
                    <strong>
                      {busy
                        ? '—'
                        : rows.filter((row) => row.submission?.state === 'TURNED_IN').length}
                    </strong>
                    <span>Đã nộp</span>
                  </div>
                  <div>
                    <strong>
                      {busy
                        ? '—'
                        : rows.filter((row) => row.submission?.state === 'RETURNED').length}
                    </strong>
                    <span>Đã trả</span>
                  </div>
                </div>
                <section className="gc-panel">
                  <div className="gc-assignment-picker">
                    <label>
                      Bài tập
                      <select
                        aria-label="Bài tập Classroom"
                        value={assignmentId}
                        disabled={!assignments.length}
                        onChange={(event) => void loadSubmissions(course, event.target.value)}
                      >
                        <option value="" disabled>
                          Chọn bài tập
                        </option>
                        {assignments.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    {assignment && (
                      <div className="gc-due">
                        <span>Hạn nộp</span>
                        <strong>{due(assignment)}</strong>
                        {safeGoogleLink(assignment.alternateLink) && (
                          <a
                            href={safeGoogleLink(assignment.alternateLink)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Mở bài tập <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  {assignment?.description && (
                    <p className="gc-description">{assignment.description}</p>
                  )}
                  {!assignments.length && !busy && (
                    <p className="gc-empty-text">
                      Lớp chưa có bài tập đã đăng mà tài khoản này được phép xem.
                    </p>
                  )}
                </section>
                <section className="gc-panel gc-submissions">
                  <div className="gc-table-heading">
                    <div>
                      <h2>
                        {course.role === 'teacher' ? 'Bài nộp của học viên' : 'Bài nộp của bạn'}
                      </h2>
                      <p>{assignment?.title || 'Chọn bài tập để xem dữ liệu.'}</p>
                    </div>
                    <button disabled={!rows.length || !!busy} onClick={exportCsv}>
                      <FileSpreadsheet size={17} /> Xuất CSV
                    </button>
                  </div>
                  <div className="gc-filters">
                    <label className="gc-search">
                      <Search size={18} />
                      <input
                        aria-label="Tìm học viên"
                        placeholder="Tìm theo tên hoặc email…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                      />
                    </label>
                    <select
                      aria-label="Trạng thái bài nộp"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <option value="all">Tất cả trạng thái</option>
                      {Object.entries(submissionLabels).map(([key, label]) => (
                        <option value={key} key={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="gc-scroll-hint">Vuốt bảng sang ngang để xem tệp và điểm.</p>
                  <div className="gc-table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Học viên</th>
                          <th>Trạng thái</th>
                          <th>Bài làm / Tệp đính kèm</th>
                          <th>Điểm</th>
                        </tr>
                      </thead>
                      <tbody>
                        {busy ? (
                          <tr>
                            <td colSpan={4} className="gc-empty-cell">
                              Đang lấy dữ liệu từ Google…
                            </td>
                          </tr>
                        ) : (
                          filtered.map((row) => (
                            <tr key={row.userId}>
                              <td>
                                <strong>{row.name}</strong>
                                {row.email && <small>{row.email}</small>}
                              </td>
                              <td>
                                <span className={`gc-status ${row.submission?.state || 'UNKNOWN'}`}>
                                  {submissionLabels[row.submission?.state || 'UNKNOWN'] ||
                                    'Không xác định'}
                                </span>
                                {row.submission?.late && (
                                  <small className="gc-late">Nộp muộn</small>
                                )}
                              </td>
                              <td>
                                {attachmentLinks(row.submission).map((file, i) => (
                                  <a
                                    className="gc-file"
                                    key={`${file.url}-${i}`}
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    {file.name} <ExternalLink size={14} />
                                  </a>
                                ))}
                                {row.submission?.shortAnswerSubmission?.answer ||
                                  row.submission?.multipleChoiceSubmission?.answer ||
                                  (!attachmentLinks(row.submission).length ? (
                                    <span className="gc-muted">Không có tệp đính kèm</span>
                                  ) : null)}
                              </td>
                              <td>
                                {row.submission?.assignedGrade !== undefined
                                  ? `${row.submission.assignedGrade}${assignment?.maxPoints !== undefined ? ` / ${assignment.maxPoints}` : ''}`
                                  : '—'}
                              </td>
                            </tr>
                          ))
                        )}
                        {!busy && !filtered.length && (
                          <tr>
                            <td colSpan={4} className="gc-empty-cell">
                              {query || status !== 'all'
                                ? 'Không có kết quả phù hợp bộ lọc.'
                                : 'Chưa có bản ghi bài nộp để hiển thị.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="gc-table-footer">
                    {busy ? 'Đang tải…' : `${filtered.length} / ${rows.length} bản ghi`}
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>
      <footer className="gc-footer">
        <span>Classroom Manager v{version}</span>
        <a href={`${import.meta.env.BASE_URL}privacy.html`}>Quyền riêng tư</a>
        <a href="https://classroom.google.com/" target="_blank" rel="noopener noreferrer">
          Google Classroom <ExternalLink size={13} />
        </a>
      </footer>
    </div>
  );
}
