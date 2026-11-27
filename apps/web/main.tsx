import React, { useEffect, useState } from 'react';
import { WebClassroomApp } from './WebClassroomApp';
import { version as appVersion } from '../../package.json';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard,
  GraduationCap,
  BookOpen,
  Download,
  Users,
  BarChart3,
  History,
  Code2,
  Settings,
  HelpCircle,
  Search,
  Bell,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  FolderOpen,
  FileSpreadsheet,
  Pause,
  Play,
  Square,
  RotateCcw,
  Check,
  AlertTriangle,
  PlugZap,
  Menu,
  X,
  FileArchive,
  ArrowDownToLine,
  Trash2,
  Activity,
  Info,
} from 'lucide-react';
import { request, installed, saveBlob } from './api';
import {
  emptyState,
  statusLabels,
  fileLabels,
  type AppState,
  type Settings as SettingsType,
} from '../../packages/shared/types';
import { metrics } from '../../packages/download-manager/engine';
import { csv, reportRows, historyRows, diagnostic } from '../../packages/shared/reports';
import './styles.css';

const sections = [
  ['Tổng quan', LayoutDashboard],
  ['Lớp học', GraduationCap],
  ['Bài tập', BookOpen],
  ['Tải bài nộp', Download],
  ['Quản lý sinh viên', Users],
  ['Thống kê', BarChart3],
  ['Lịch sử tải xuống', History],
  ['Chấm bài Python', Code2],
  ['Cài đặt', Settings],
  ['Hướng dẫn sử dụng', HelpCircle],
] as const;
const fmt = (date?: string) => (date ? new Date(date).toLocaleString('vi-VN') : '—');
const size = (bytes?: number) =>
  bytes === undefined || bytes < 0
    ? '—'
    : bytes > 1048576
      ? `${(bytes / 1048576).toFixed(1)} MB`
      : `${(bytes / 1024).toFixed(1)} KB`;
function App() {
  const [state, setState] = useState<AppState>(emptyState);
  const [page, setPage] = useState('Tổng quan');
  const [tabs, setTabs] = useState<{ id: number; title: string; url: string }[]>([]);
  const [tab, setTab] = useState('');
  const [course, setCourse] = useState('');
  const [assignment, setAssignment] = useState('');
  const [week, setWeek] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState<SettingsType>(state.settings);
  const savedSettings = JSON.stringify(state.settings);
  const [confirmClear, setConfirmClear] = useState(false);
  const run = state.run;
  const m = metrics(run);
  const active = run?.status === 'running' || run?.status === 'paused';
  useEffect(() => {
    let live = true;
    const refresh = () =>
      request('state')
        .then((s) => {
          if (live) setState(s);
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    void refresh();
    void request<typeof tabs>('tabs')
      .then((t) => {
        if (live) {
          setTabs(t);
          if (t.length === 1) setTab(String(t[0].id));
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    const changed = () => void refresh();
    if (installed) chrome.storage.onChanged.addListener(changed);
    return () => {
      live = false;
      if (installed) chrome.storage.onChanged.removeListener(changed);
    };
  }, []);
  useEffect(() => {
    // Storage gửi lại toàn bộ state kể cả khi chỉ tiến độ tải thay đổi.
    // Chỉ đồng bộ bản nháp khi nội dung cài đặt đã lưu thực sự thay đổi.
    setDraft(JSON.parse(savedSettings) as SettingsType);
  }, [savedSettings]);
  useEffect(() => {
    if (state.selectedCourseId) setCourse(state.selectedCourseId);
  }, [state.selectedCourseId]);
  async function perform(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }
  async function command(cmd: string, args: object = {}) {
    await perform(cmd, async () => {
      const s = await request(cmd, args);
      if (s && typeof s === 'object' && 'schema' in s) setState(s);
    });
  }
  async function loadTabs() {
    await perform('tabs', async () => {
      const t = await request<typeof tabs>('tabs');
      setTabs(t);
      if (t.length === 1) setTab(String(t[0].id));
      if (!t.length)
        setNotice(
          'Chưa có tab Classroom. Nhấn Mở Google Classroom, đăng nhập bình thường rồi làm mới.',
        );
    });
  }
  async function connect() {
    await perform('connect', async () => {
      setState(await request('connect', { tabId: Number(tab) }));
      setCourse('');
      setAssignment('');
      setNotice(
        'Đã đọc danh sách lớp từ tab được chọn. Quyền giáo viên sẽ được xác minh khi quét bài nộp.',
      );
    });
  }
  async function chooseCourse(id: string) {
    setCourse(id);
    setAssignment('');
    setWeek('');
    if (id) await command('assignments', { courseId: id });
  }
  async function exportReport(kind: 'csv' | 'xlsx' | 'diagnostic' | 'history') {
    if (kind === 'diagnostic' && run) {
      saveBlob(diagnostic(run, state.settings.redact), 'Chan_doan.json', 'application/json');
      return;
    }
    const rows = kind === 'history' ? historyRows(state.history) : run ? reportRows(run) : [];
    if (!rows.length) return;
    await perform('export', async () => {
      if (kind === 'xlsx') {
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Báo cáo bài nộp');
        rows.forEach((row) => ws.addRow(row.map((v) => v ?? '')));
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2463EB' } };
        ws.columns.forEach((c) => (c.width = 26));
        ws.views = [{ state: 'frozen', ySplit: 1 }];
        const buffer = await wb.xlsx.writeBuffer();
        saveBlob(
          new Uint8Array(buffer as ArrayBuffer),
          'Bao_cao_tai_bai.xlsx',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
      } else
        saveBlob(
          csv(rows),
          kind === 'history' ? 'Lich_su_tai.csv' : 'Bao_cao_tai_bai.csv',
          'text/csv;charset=utf-8',
        );
    });
  }
  const assignments = state.assignments.filter(
    (a) => !week || (week === 'other' ? a.week === undefined : a.week === Number(week)),
  );
  const students = (run?.students ?? []).filter(
    (s) =>
      (filter === 'all' || s.status === filter) &&
      s.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')),
  );
  const filesDone = (run?.files ?? []).filter(
    (f) => !['queued', 'starting', 'downloading'].includes(f.status),
  ).length;
  const eligibleCount =
    run?.students.filter(
      (s) => s.status === 'submitted' || (s.status === 'graded' && run.settings.includeGraded),
    ).length ?? 0;
  const checkedEligible =
    run?.students.filter(
      (s) =>
        s.checked &&
        (s.status === 'submitted' || (s.status === 'graded' && run.settings.includeGraded)),
    ).length ?? 0;
  const progress = eligibleCount
    ? Math.round(((checkedEligible + filesDone) / (eligibleCount + (run?.files.length ?? 0))) * 100)
    : 0;
  function navigation(name: string) {
    setPage(name);
    setMenu(false);
    setQuery('');
    setFilter('all');
  }
  const controls = (
    <>
      <button
        className="primary"
        disabled={!!busy || !run?.students.length || active || !!run?.files.length}
        onClick={() => void command('start')}
      >
        <Download size={17} />
        Tải tất cả bài nộp
      </button>
      {run?.status === 'running' && (
        <button onClick={() => void command('pause')} disabled={!!busy}>
          <Pause size={16} />
          Tạm dừng
        </button>
      )}
      {run?.status === 'paused' && (
        <button onClick={() => void command('resume')} disabled={!!busy}>
          <Play size={16} />
          Tiếp tục
        </button>
      )}
      {active && (
        <button className="danger-text" onClick={() => void command('stop')} disabled={!!busy}>
          <Square size={16} />
          Dừng
        </button>
      )}
      <button
        disabled={
          !!busy ||
          active ||
          !(
            m.failed ||
            run?.students.some((s) => s.error) ||
            run?.files.some((f) => f.status === 'cancelled')
          )
        }
        onClick={() => void command('retry')}
      >
        <RotateCcw size={16} />
        Tải lại lỗi
      </button>
    </>
  );
  const selector = (
    <section className="panel setup">
      <div className="panel-title">
        <div>
          <h2>Chọn bài tập cần tải</h2>
          <p>Dữ liệu được đọc trực tiếp từ giao diện Classroom của bạn.</p>
        </div>
        <span className="step-label">THIẾT LẬP PHIÊN TẢI</span>
      </div>
      <div className="select-grid">
        <label>
          Lớp học
          <select
            aria-label="Lớp học"
            value={course}
            disabled={!!busy || active || !state.courses.length}
            onChange={(e) => void chooseCourse(e.target.value)}
          >
            <option value="">Chọn lớp học</option>
            {state.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tuần học
          <select
            aria-label="Tuần học"
            value={week}
            onChange={(e) => {
              setWeek(e.target.value);
              setAssignment('');
            }}
            disabled={!!busy || active}
          >
            <option value="">Tất cả tuần</option>
            {Array.from({ length: 15 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                Tuần {String(i + 1).padStart(2, '0')}
              </option>
            ))}
            <option value="other">Ngoài tuần học</option>
          </select>
        </label>
        <label className="assignment-select">
          Bài tập
          <select
            aria-label="Bài tập"
            value={assignment}
            disabled={!!busy || active || !course}
            onChange={(e) => setAssignment(e.target.value)}
          >
            <option value="">Chọn chính xác bài tập</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.id.slice(-6)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="scan"
          disabled={!!busy || active || !assignment}
          onClick={() => void command('scan', { assignmentId: assignment })}
        >
          <RefreshCw size={17} />
          Quét bài nộp
        </button>
      </div>
      <div className="setup-bottom">
        <span>
          <ShieldCheck size={15} />
          Chỉ đọc bài nộp · Tệp gốc được giữ nguyên
        </span>
        <span>
          Định dạng: <b>{state.settings.formats.join(', ').toUpperCase()}</b>
        </span>
      </div>
    </section>
  );
  const studentTable = (
    <section className="panel table-panel">
      <div className="panel-title">
        <div>
          <h2>Danh sách bài nộp {run && <span className="count-tag">{m.total}</span>}</h2>
          <p>
            {run
              ? `${run.course.name} / ${run.assignment.name}`
              : 'Quét một bài tập để xem danh sách sinh viên và tệp đính kèm.'}
          </p>
        </div>
        <div className="actions">
          <button disabled={!run || !!busy} onClick={() => void exportReport('csv')}>
            <FileSpreadsheet size={16} />
            Xuất CSV
          </button>
          <button disabled={!run || !!busy} onClick={() => void exportReport('xlsx')}>
            Excel
          </button>
        </div>
      </div>
      <div className="table-tools">
        <div className="search">
          <Search size={16} />
          <input
            aria-label="Tìm sinh viên"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm sinh viên…"
          />
        </div>
        <select
          aria-label="Lọc trạng thái nộp"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="submitted">Đã nộp / Cần đánh giá</option>
          <option value="missing">Chưa nộp</option>
          <option value="graded">Đã chấm / Đã trả</option>
          <option value="unknown">Không xác định</option>
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Sinh viên</th>
              <th>Trạng thái nộp</th>
              <th>Tệp đính kèm</th>
              <th>Dung lượng</th>
              <th>Trạng thái tải</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const files = run!.files.filter((f) => f.studentId === s.id);
              return (
                <tr key={s.id}>
                  <td>{i + 1}</td>
                  <td>
                    <div className="student">
                      <span className="avatar">{s.name.split(' ').at(-1)?.slice(0, 1)}</span>
                      <div>
                        <strong>{s.name}</strong>
                        <small>{s.studentCode || 'Không có mã sinh viên'}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${s.status}`}>{statusLabels[s.status]}</span>
                    {s.late && <small>Nộp muộn</small>}
                  </td>
                  <td>
                    {files.length ? (
                      files.map((f) => (
                        <div className="file-line" key={f.key}>
                          <FileArchive size={15} />
                          <span title={f.name}>{f.name}</span>
                        </div>
                      ))
                    ) : (
                      <span className="muted">
                        {s.error ? 'Chưa đọc được' : s.noFiles ? 'Không có tệp phù hợp' : '—'}
                      </span>
                    )}
                  </td>
                  <td>
                    {files.map((f) => (
                      <div className="file-line" key={f.key}>
                        {size(f.bytes ?? f.size)}
                      </div>
                    ))}
                  </td>
                  <td>
                    {files.map((f) => (
                      <div className="file-line" key={f.key}>
                        <span className={`badge ${f.status}`} title={f.error}>
                          {fileLabels[f.status]}
                        </span>
                      </div>
                    ))}
                    {s.error && (
                      <span className="badge failed" title={s.error}>
                        Lỗi đọc bài nộp
                      </span>
                    )}
                  </td>
                  <td>
                    {files
                      .filter((f) => f.status === 'failed')
                      .map((f) => (
                        <button
                          key={f.key}
                          className="icon-button"
                          title="Thử lại tệp này"
                          disabled={!!busy || active}
                          onClick={() => void command('retry', { key: f.key })}
                        >
                          <RotateCcw size={16} />
                        </button>
                      ))}
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="icon-button"
                      aria-label={`Mở bài nộp ${s.name}`}
                    >
                      <ExternalLink size={15} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!students.length && (
        <div className="empty">
          <div className="empty-icon">
            <FileArchive size={30} />
          </div>
          <h3>{run ? 'Không tìm thấy kết quả' : 'Chưa có bài nộp được quét'}</h3>
          <p>
            {run
              ? 'Thử thay đổi từ khóa hoặc bộ lọc.'
              : 'Kết nối Classroom, chọn lớp và bài tập để bắt đầu.'}
          </p>
        </div>
      )}
      <div className="table-footer">
        <span>
          {students.length} / {m.total} sinh viên
        </span>
        <span>
          <ShieldCheck size={14} />
          Dữ liệu chỉ lưu trên thiết bị
        </span>
      </div>
    </section>
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigation('Tổng quan');
          }}
        >
          <span className="brand-icon">
            <GraduationCap size={25} />
          </span>
          <span>
            Classroom<span className="brand-sub">MANAGER</span>
          </span>
        </a>
        <div className="workspace-label">KHÔNG GIAN GIẢNG DẠY</div>
        <nav aria-label="Điều hướng chính">
          {sections.map(([name, Icon], i) => (
            <React.Fragment key={name}>
              {i === 8 && <div className="nav-divider" />}
              <button
                className={page === name ? 'nav-item active' : 'nav-item'}
                onClick={() => navigation(name)}
              >
                <Icon size={19} />
                <span>{name}</span>
                {name === 'Tải bài nộp' && run?.status === 'running' && (
                  <span className="live-dot" />
                )}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="local-note">
          <ShieldCheck size={21} />
          <strong>Riêng tư từ thiết kế</strong>
          <p>
            Không máy chủ trung gian.
            <br />
            Bài nộp nằm trên máy bạn.
          </p>
        </div>
        <div className="sidebar-bottom">
          <span className="avatar blue">GV</span>
          <div>
            <strong>Không gian giảng viên</strong>
            <small>Classroom Manager v1.0</small>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Mở điều hướng"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={21} /> : <Menu size={21} />}
            </button>
            <span>Không gian làm việc</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className={`connection ${state.account ? 'connected' : ''}`}>
              <span />
              {state.account ? 'Đã kết nối Classroom' : 'Chưa kết nối Classroom'}
            </span>
            <button
              className="icon-button"
              aria-label="Xem nhật ký"
              onClick={() => navigation('Thống kê')}
            >
              <Bell size={19} />
            </button>
            <span className="avatar blue">GV</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">CLASSROOM MANAGER</div>
              <h1>{page === 'Tổng quan' ? 'Quản lý bài nộp, nhẹ nhàng hơn.' : page}</h1>
              <p>
                {page === 'Tổng quan'
                  ? 'Tập trung vào giảng dạy. Để việc thu bài cho Classroom Manager.'
                  : page === 'Tải bài nộp'
                    ? 'Tải từng tệp gốc, theo dõi từng bước, không bỏ sót bài nộp.'
                    : 'Mọi dữ liệu được quản lý cục bộ trên thiết bị của bạn.'}
              </p>
            </div>
            <button onClick={() => void command('folder')} disabled={!installed}>
              <FolderOpen size={17} />
              Mở Downloads
            </button>
          </div>
          {!installed && (
            <div className="alert info">
              <Info size={20} />
              <div>
                <strong>Đây là giao diện web xem trước</strong>
                <p>
                  Để thao tác với Google Classroom, tải và giải nén tiện ích Chrome/Edge, cài bằng
                  “Tải tiện ích đã giải nén”, sau đó bấm biểu tượng tiện ích. Kết nối trực tiếp từ
                  website sẽ được bổ sung ở phiên bản sau.
                </p>
                <a
                  href={`https://github.com/huando200666/classroom-manager/releases/download/v${appVersion}/Classroom-Manager-${appVersion}.zip`}
                >
                  Tải tiện ích Chrome/Edge
                </a>
                {' · '}
                <a href="https://github.com/huando200666/classroom-manager/blob/main/docs/CAI-DAT.md">
                  Hướng dẫn cài đặt
                </a>
              </div>
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              <AlertTriangle size={20} />
              <div>{error}</div>
              <button className="icon-button" aria-label="Đóng lỗi" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert info" role="status">
              <Info size={19} />
              {notice}
            </div>
          )}
          {busy && (
            <div className="busy-bar" role="status">
              <RefreshCw size={16} className="spin" />
              Đang xử lý… Trang Classroom có thể cần một lúc để tải đủ dữ liệu. Khi đọc danh sách,
              tiện ích tạm chuyển sang Classroom rồi quay lại trang này.
            </div>
          )}
          {['Tổng quan', 'Lớp học', 'Bài tập', 'Tải bài nộp'].includes(page) && (
            <>
              <section className="connection-panel">
                <div className="connect-symbol">
                  <PlugZap size={24} />
                </div>
                <div className="connect-copy">
                  <h2>
                    {state.account
                      ? 'Sẵn sàng kết nối với lớp học'
                      : 'Kết nối Google Classroom của bạn'}
                  </h2>
                  <p>
                    {state.account
                      ? `${state.account.label} · ${state.courses.length} lớp đã đọc · ${state.account.teacher ? 'Đã xác minh quyền giáo viên' : 'Chưa xác minh quyền giáo viên'}`
                      : 'Sử dụng phiên đăng nhập hiện tại. Không cần API key hay mật khẩu.'}
                  </p>
                </div>
                <div className="connect-actions">
                  <select
                    aria-label="Chọn tab Classroom"
                    value={tab}
                    onChange={(e) => setTab(e.target.value)}
                    disabled={!!busy || active}
                  >
                    <option value="">Chọn tab Classroom</option>
                    {tabs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} · tab {t.id}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-button"
                    title="Làm mới tab"
                    disabled={!!busy || active}
                    onClick={() => void loadTabs()}
                  >
                    <RefreshCw size={17} />
                  </button>
                  <button
                    className="primary"
                    disabled={!tab || !!busy || active}
                    onClick={() => void connect()}
                  >
                    <PlugZap size={16} />
                    {state.account ? 'Kết nối lại' : 'Kết nối'}
                  </button>
                  <button
                    className="link-button"
                    disabled={!installed || !!busy}
                    onClick={() => void command('open')}
                  >
                    Mở Google Classroom <ExternalLink size={14} />
                  </button>
                </div>
              </section>
              {page === 'Lớp học' ? (
                <section className="course-grid">
                  {state.courses.map((c, i) => (
                    <button
                      className="course-card"
                      key={c.id}
                      disabled={!!busy || active}
                      onClick={() => {
                        navigation('Bài tập');
                        void chooseCourse(c.id);
                      }}
                    >
                      <div className={`course-cover cover-${i % 3}`}>
                        <GraduationCap size={32} />
                      </div>
                      <div>
                        <h2>{c.name}</h2>
                        <p>{c.subject || 'Google Classroom'}</p>
                        <span>
                          Mở danh sách bài tập <BookOpen size={16} />
                        </span>
                      </div>
                    </button>
                  ))}
                  {!state.courses.length && (
                    <div className="panel empty">
                      <GraduationCap size={34} />
                      <h3>Chưa có lớp học</h3>
                      <p>Kết nối một tab trang chủ Classroom để đọc danh sách lớp.</p>
                    </div>
                  )}
                </section>
              ) : (
                <>
                  {page === 'Tổng quan' && (
                    <div className="stats-grid">
                      {[
                        [GraduationCap, 'Lớp học đã đọc', state.courses.length, 'blue'],
                        [Users, 'Sinh viên trong bài tập', run ? m.total : '—', 'purple'],
                        [Check, 'Đã nộp / Cần đánh giá', run ? m.submitted : '—', 'green'],
                        [ArrowDownToLine, 'Tệp tải hoàn tất', run ? m.complete : '—', 'orange'],
                      ].map(([Icon, title, value, color]) => {
                        const I = Icon as typeof Users;
                        return (
                          <section className="stat-card" key={String(title)}>
                            <span className={`stat-icon ${color}`}>
                              <I size={21} />
                            </span>
                            <div className="stat-label">{String(title)}</div>
                            <strong>{String(value)}</strong>
                            <small>
                              {title === 'Lớp học đã đọc'
                                ? 'Từ tài khoản đang kết nối'
                                : run
                                  ? run.assignment.name
                                  : 'Chưa chọn bài tập'}
                            </small>
                          </section>
                        );
                      })}
                    </div>
                  )}
                  {selector}
                  {run && (
                    <section className="panel progress-panel">
                      <div className="progress-header">
                        <div>
                          <h2>
                            Tiến độ xử lý{' '}
                            <span
                              className={`badge ${run.status === 'running' ? 'downloading' : run.status === 'complete' ? 'complete' : 'unknown'}`}
                            >
                              {
                                {
                                  idle: 'Chưa bắt đầu',
                                  running: 'Đang xử lý',
                                  paused: 'Tạm dừng',
                                  stopped: 'Đã dừng',
                                  complete: 'Đã xử lý xong',
                                }[run.status]
                              }
                            </span>
                          </h2>
                          <p>
                            {checkedEligible}/{eligibleCount} bài nộp đã kiểm tra · {m.complete} tệp
                            hoàn tất · {m.failed} tệp lỗi
                          </p>
                        </div>
                        <strong>{progress}%</strong>
                      </div>
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label="Tiến độ xử lý"
                        aria-valuenow={progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div style={{ width: `${progress}%` }} />
                      </div>
                      <div className="actions">{controls}</div>
                      {run.warnings.map((w, i) => (
                        <div className="inline-warning" key={i}>
                          <AlertTriangle size={16} />
                          {w}
                        </div>
                      ))}
                    </section>
                  )}
                  {studentTable}
                </>
              )}
            </>
          )}
          {page === 'Bài tập' && (
            <section className="panel table-panel">
              <div className="panel-title">
                <div>
                  <h2>Bài tập trong lớp</h2>
                  <p>Ngày và số liệu chưa đọc được sẽ hiển thị “—”.</p>
                </div>
                <span className="count-tag">{state.assignments.length}</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Bài tập</th>
                      <th>Chủ đề / Tuần</th>
                      <th>Ngày giao</th>
                      <th>Hạn nộp</th>
                      <th>Tổng / Đã nộp / Chưa nộp / Đã chấm</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.assignments.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.name}</strong>
                          <small>{a.id}</small>
                        </td>
                        <td>
                          {a.topic || '—'}
                          <small>{a.week ? `Tuần ${a.week}` : 'Ngoài tuần học'}</small>
                        </td>
                        <td>{fmt(a.assignedAt)}</td>
                        <td>{fmt(a.dueAt)}</td>
                        <td>
                          {run?.assignment.id === a.id
                            ? `${m.total} / ${m.submitted} / ${m.missing} / ${m.graded}`
                            : '— / — / — / —'}
                        </td>
                        <td>
                          <button
                            disabled={!!busy || active}
                            onClick={() => {
                              setAssignment(a.id);
                              setWeek('');
                              void command('scan', { assignmentId: a.id });
                            }}
                          >
                            Quét bài nộp
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!state.assignments.length && (
                <div className="empty">
                  <BookOpen size={30} />
                  <p>Chọn lớp để đọc danh sách bài tập.</p>
                </div>
              )}
            </section>
          )}
          {page === 'Quản lý sinh viên' && studentTable}
          {page === 'Thống kê' && (
            <>
              <div className="panel">
                <div className="panel-title">
                  <div>
                    <h2>Thống kê phiên hiện tại</h2>
                    <p>{run ? run.assignment.name : 'Chưa có phiên xử lý'}</p>
                  </div>
                  <div className="actions">
                    <button disabled={!run || !!busy} onClick={() => void exportReport('xlsx')}>
                      <FileSpreadsheet size={16} />
                      Xuất Excel
                    </button>
                    <button disabled={!run} onClick={() => void exportReport('diagnostic')}>
                      <Download size={16} />
                      Nhật ký chẩn đoán
                    </button>
                  </div>
                </div>
                <div className="metrics-grid">
                  {[
                    ['Tổng sinh viên', m.total],
                    ['Đã nộp', m.submitted],
                    ['Chưa nộp', m.missing],
                    ['Đã chấm / Đã trả', m.graded],
                    ['Không xác định', m.unknown],
                    ['Đã kiểm tra', m.checked],
                    ['ZIP tìm thấy', m.zip],
                    ['Tệp hoàn tất', m.complete],
                    ['Tệp lỗi', m.failed],
                    ['Trùng đã bỏ qua', m.duplicate],
                    ['Không có tệp phù hợp', m.noFiles],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{run ? value : '—'}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <section className="panel log-panel">
                <div className="panel-title">
                  <h2>
                    <Activity size={18} />
                    Nhật ký xử lý
                  </h2>
                </div>
                {run?.logs.length ? (
                  <ol>
                    {run.logs
                      .slice()
                      .reverse()
                      .map((l, i) => (
                        <li key={i}>
                          <time>{fmt(l.at)}</time>
                          <span className={l.level}>{l.message}</span>
                        </li>
                      ))}
                  </ol>
                ) : (
                  <div className="empty">
                    <p>Nhật ký sẽ xuất hiện khi bạn quét hoặc tải bài nộp.</p>
                  </div>
                )}
              </section>
            </>
          )}
          {page === 'Lịch sử tải xuống' && (
            <section className="panel table-panel">
              <div className="panel-title">
                <div>
                  <h2>Lịch sử trên thiết bị</h2>
                  <p>Chỉ bỏ qua tệp trùng khi xác minh được phiên bản đã tải hoàn tất.</p>
                </div>
                <button
                  disabled={!state.history.length}
                  onClick={() => void exportReport('history')}
                >
                  <FileSpreadsheet size={16} />
                  Xuất CSV
                </button>
              </div>
              <div className="table-tools">
                <div className="search">
                  <Search size={16} />
                  <input
                    aria-label="Tìm lịch sử"
                    placeholder="Tìm tên sinh viên hoặc tệp…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Tệp / Sinh viên</th>
                      <th>Lớp / Bài tập</th>
                      <th>Tài khoản</th>
                      <th>Thời gian</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.history
                      .filter((h) =>
                        `${h.name} ${h.studentName}`.toLowerCase().includes(query.toLowerCase()),
                      )
                      .slice()
                      .reverse()
                      .map((h, i) => (
                        <tr key={`${h.runId}-${h.key}-${i}`}>
                          <td>
                            <strong>{h.name}</strong>
                            <small>{h.studentName}</small>
                          </td>
                          <td>
                            {h.courseName}
                            <small>{h.assignmentName}</small>
                          </td>
                          <td>{h.account}</td>
                          <td>{fmt(h.finishedAt)}</td>
                          <td>
                            <span className={`badge ${h.status}`} title={h.error}>
                              {fileLabels[h.status]}
                            </span>
                          </td>
                          <td>
                            <button
                              className="icon-button"
                              aria-label="Hiện tệp trong thư mục"
                              disabled={h.status !== 'complete'}
                              onClick={() => void command('show', { id: h.downloadId })}
                            >
                              <FolderOpen size={17} />
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!state.history.length && (
                <div className="empty">
                  <History size={32} />
                  <h3>Chưa có lịch sử tải xuống</h3>
                  <p>Lịch sử thực tế sẽ được lưu sau khi xử lý từng tệp.</p>
                </div>
              )}
            </section>
          )}
          {page === 'Cài đặt' && (
            <section className="panel settings-panel">
              <div className="panel-title">
                <div>
                  <h2>Cấu hình tải bài nộp</h2>
                  <p>Áp dụng cho phiên tiếp theo. Dừng phiên đang chạy trước khi thay đổi.</p>
                </div>
              </div>
              <fieldset disabled={!!busy || active}>
                <legend>Định dạng được phép tải</legend>
                <div className="format-options">
                  {['zip', 'rar', '7z', 'py', 'ipynb', 'pdf', 'docx', 'xlsx', 'pptx'].map((f) => (
                    <label key={f}>
                      <input
                        type="checkbox"
                        checked={draft.formats.includes(f)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            formats: e.target.checked
                              ? [...draft.formats, f]
                              : draft.formats.filter((v) => v !== f),
                          })
                        }
                      />
                      {f.toUpperCase()}
                    </label>
                  ))}
                </div>
                <div className="form-grid">
                  <label>
                    Thư mục con trong Downloads
                    <input
                      value={draft.rootFolder}
                      maxLength={100}
                      onChange={(e) => setDraft({ ...draft, rootFolder: e.target.value })}
                    />
                  </label>
                  <label>
                    Cách đặt tên tệp
                    <select
                      value={draft.nameMode}
                      onChange={(e) =>
                        setDraft({ ...draft, nameMode: e.target.value as SettingsType['nameMode'] })
                      }
                    >
                      <option value="student">Thêm tên sinh viên</option>
                      <option value="code">Thêm mã sinh viên (nếu có)</option>
                      <option value="original">Giữ nguyên tên gốc</option>
                    </select>
                  </label>
                </div>
                <div className="check-options">
                  {[
                    ['includeGraded', 'Tải thêm bài đã chấm / đã trả khi xác minh được bài nộp'],
                    ['onlyNew', 'Bỏ qua phiên bản đã tải thành công (nếu biết phiên bản)'],
                    ['studentFolders', 'Tạo thư mục riêng cho mỗi sinh viên'],
                    ['redact', 'Ẩn thông tin cá nhân khi xuất nhật ký chẩn đoán'],
                  ].map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={Boolean(draft[key as keyof SettingsType])}
                        onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="alert info">
                  <Info size={18} />
                  <span>
                    Đường dẫn nằm trong Downloads của trình duyệt. Để lưu sang ổ D, đổi vị trí trong
                    Cài đặt → Tệp tải xuống của Chrome/Edge. Tệp trùng tên luôn được đổi tên tự
                    động.
                  </span>
                </div>
                <button
                  className="primary"
                  disabled={!draft.formats.length}
                  onClick={() =>
                    void perform('settings', async () => {
                      setState(await request('settings', { settings: draft }));
                      setNotice('Đã lưu cấu hình trên thiết bị.');
                    })
                  }
                >
                  <Check size={17} />
                  Lưu cài đặt
                </button>
              </fieldset>
              <div className="danger-zone">
                <h3>Xóa dữ liệu cục bộ</h3>
                <p>
                  Xóa lớp, danh sách sinh viên, nhật ký và lịch sử trong tiện ích. Các tệp đã tải
                  vẫn nằm trên máy.
                </p>
                {confirmClear ? (
                  <div className="actions">
                    <button
                      className="danger"
                      disabled={active || !!busy}
                      onClick={() =>
                        void perform('clear', async () => {
                          setState(await request('clear'));
                          setCourse('');
                          setAssignment('');
                          setConfirmClear(false);
                          setNotice('Đã xóa dữ liệu cục bộ.');
                        })
                      }
                    >
                      Xác nhận xóa dữ liệu
                    </button>
                    <button onClick={() => setConfirmClear(false)}>Hủy</button>
                  </div>
                ) : (
                  <button
                    className="danger-text"
                    disabled={active || !!busy}
                    onClick={() => setConfirmClear(true)}
                  >
                    <Trash2 size={16} />
                    Xóa dữ liệu và lịch sử
                  </button>
                )}
              </div>
            </section>
          )}
          {page === 'Chấm bài Python' && (
            <section className="panel roadmap">
              <span className="roadmap-icon">
                <Code2 size={38} />
              </span>
              <span className="pill">LỘ TRÌNH MỞ RỘNG</span>
              <h2>Không gian chấm bài Python</h2>
              <p>
                Kiến trúc đã tách riêng cổng tích hợp chấm bài. MVP tập trung thu bài ổn định; chưa
                chạy mã sinh viên.
              </p>
              <div className="roadmap-grid">
                {[
                  ['Đề bài & thang điểm', 'PDF, Word và bộ tiêu chí chấm.'],
                  ['Kiểm thử trong sandbox', 'Giới hạn tài nguyên, không truy cập phiên Google.'],
                  ['Kết quả & phản hồi', 'Bảng điểm Excel và nhận xét từng bài.'],
                ].map(([t, d]) => (
                  <div key={t}>
                    <h3>{t}</h3>
                    <p>{d}</p>
                    <span>Chưa triển khai</span>
                  </div>
                ))}
              </div>
              <button onClick={() => navigation('Tải bài nộp')}>
                <Download size={17} />
                Đến tải bài nộp
              </button>
            </section>
          )}
          {page === 'Hướng dẫn sử dụng' && (
            <section className="panel help-panel">
              <h2>Bắt đầu trong vài bước</h2>
              <ol>
                <li>
                  <h3>Cài tiện ích</h3>
                  <p>
                    Giải nén Classroom-Manager-{appVersion}.zip. Vào{' '}
                    <code>chrome://extensions</code> hoặc <code>edge://extensions</code>, bật Chế độ
                    nhà phát triển, chọn Tải tiện ích đã giải nén và chọn thư mục Classroom-Manager.
                  </p>
                </li>
                <li>
                  <h3>Đăng nhập như bình thường</h3>
                  <p>
                    Mở Classroom bằng chính hồ sơ trình duyệt đã cài tiện ích. Tại trang chủ có danh
                    sách lớp, chọn đúng tài khoản. Không nhập mật khẩu vào Classroom Manager.
                  </p>
                </li>
                <li>
                  <h3>Kết nối, chọn lớp và bài tập</h3>
                  <p>
                    Bấm biểu tượng tiện ích. Làm mới tab, chọn tab Classroom và Kết nối. Chọn lớp,
                    chọn đúng bài tập và bấm Quét bài nộp. Kiểm tra bộ đếm và cảnh báo.
                  </p>
                </li>
                <li>
                  <h3>Tải và xem báo cáo</h3>
                  <p>
                    Nhấn Tải tất cả bài nộp. Tiện ích dùng một tab làm việc và tải tuần tự. Không
                    điều hướng tab đó hoặc tải tệp Drive khác trong khi chạy. Có thể tạm dừng, tiếp
                    tục hoặc dừng. Xuất CSV/Excel sau khi hoàn tất.
                  </p>
                </li>
              </ol>
              <h3>Khi Google yêu cầu xác nhận</h3>
              <p>
                Hoàn thành đăng nhập hoặc kiểm tra bảo mật trong tab Google chính thức. Nếu Drive
                hiển thị cảnh báo quét virus, xử lý trực tiếp trên Drive theo quyết định của bạn.
                Tiện ích không vượt qua bước này. Kiểm tra Downloads trước khi tải lại để tránh
                trùng.
              </p>
              <h3>Khi số lượng không khớp hoặc không có ZIP</h3>
              <p>
                Mở rộng các nhóm sinh viên, bỏ bộ lọc Classroom, sau đó quét lại. Tên bị cắt ngắn
                hoặc vùng bài nộp không xác minh được sẽ được ghi riêng; không coi là bài chưa nộp.
                Adapter hiện cần kiểm chứng thêm trên DOM Classroom thực tế.
              </p>
              <h3>Quyền riêng tư</h3>
              <p>
                Không đọc cookie, mật khẩu, token hoặc API nội bộ. Không gửi bài nộp lên máy chủ. Dữ
                liệu lưu bằng Chrome Storage trên hồ sơ trình duyệt. Chữ ký nhị phân ZIP chưa được
                kiểm tra vì tiện ích không đọc tùy ý tệp trên ổ đĩa.
              </p>
            </section>
          )}
          <footer className="page-footer">
            <span>
              Classroom Manager <span className="version">v{appVersion}</span>
            </span>
            <span>
              <ShieldCheck size={14} />
              Cục bộ · Riêng tư · Không API key
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(installed ? <App /> : <WebClassroomApp />);
