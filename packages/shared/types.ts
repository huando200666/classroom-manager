export type SubmissionStatus = 'submitted' | 'missing' | 'graded' | 'unknown';
export type FileState =
  'queued' | 'starting' | 'downloading' | 'complete' | 'failed' | 'duplicate' | 'cancelled';
export type RunStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'complete';
export interface Course {
  id: string;
  name: string;
  url: string;
  subject?: string;
}
export interface Assignment {
  id: string;
  courseId: string;
  name: string;
  url: string;
  week?: number;
  topic?: string;
  assignedAt?: string;
  dueAt?: string;
}
export interface Student {
  id: string;
  name: string;
  studentCode?: string;
  url: string;
  status: SubmissionStatus;
  rawStatus: string;
  late: boolean;
  checked: boolean;
  error?: string;
  noFiles?: boolean;
}
export interface Attachment {
  id: string;
  name: string;
  url: string;
  revision?: string;
  size?: number;
  type?: string;
}
export interface FileTask extends Attachment {
  key: string;
  studentId: string;
  studentName: string;
  status: FileState;
  path: string;
  error?: string;
  downloadId?: number;
  startedAt?: string;
  finishedAt?: string;
  bytes?: number;
  mime?: string;
  verification?: string;
}
export interface HistoryEntry extends FileTask {
  account: string;
  courseId: string;
  courseName: string;
  assignmentId: string;
  assignmentName: string;
  week?: number;
  runId: string;
}
export interface Settings {
  formats: string[];
  includeGraded: boolean;
  onlyNew: boolean;
  nameMode: 'original' | 'student' | 'code';
  studentFolders: boolean;
  rootFolder: string;
  redact: boolean;
}
export interface Account {
  label: string;
  scope: string;
  tabId: number;
  teacher: boolean;
}
export interface Counters {
  submitted?: number;
  missing?: number;
  graded?: number;
  total?: number;
}
export interface LogEntry {
  at: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}
export interface Run {
  id: string;
  status: RunStatus;
  course: Course;
  assignment: Assignment;
  account: string;
  students: Student[];
  files: FileTask[];
  expected: Counters;
  warnings: string[];
  logs: LogEntry[];
  startedAt: string;
  workTabId?: number;
  settings: Settings;
}
export interface AppState {
  schema: 1;
  courses: Course[];
  assignments: Assignment[];
  account?: Account;
  selectedCourseId?: string;
  run?: Run;
  history: HistoryEntry[];
  settings: Settings;
}
export const defaultSettings: Settings = {
  formats: ['zip'],
  includeGraded: false,
  onlyNew: true,
  nameMode: 'student',
  studentFolders: false,
  rootFolder: 'Classroom_Downloads',
  redact: true,
};
export const emptyState = (): AppState => ({
  schema: 1,
  courses: [],
  assignments: [],
  history: [],
  settings: { ...defaultSettings, formats: ['zip'] },
});
export const statusLabels: Record<SubmissionStatus, string> = {
  submitted: 'Đã nộp / Cần đánh giá',
  missing: 'Chưa nộp',
  graded: 'Đã chấm / Đã trả',
  unknown: 'Không xác định',
};
export const fileLabels: Record<FileState, string> = {
  queued: 'Chờ tải',
  starting: 'Đang mở tệp',
  downloading: 'Đang tải',
  complete: 'Hoàn tất',
  failed: 'Thất bại',
  duplicate: 'Đã có phiên bản này',
  cancelled: 'Đã dừng',
};
