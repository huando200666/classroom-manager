export const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
];
export interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
}
interface GoogleOAuth {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    include_granted_scopes: boolean;
    callback: (response: TokenResponse) => void;
    error_callback: (error: { type?: string }) => void;
  }): { requestAccessToken(config: { prompt: string }): void };
}
declare global {
  interface Window {
    google?: { accounts: { oauth2: GoogleOAuth } };
  }
}
export class SessionExpired extends Error {
  constructor() {
    super('Phiên Google đã hết hạn. Bấm Đăng nhập bằng Google để kết nối lại.');
  }
}
let sdkPromise: Promise<void> | undefined;
export function loadGoogleSdk(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      if (error) {
        script.remove();
        reject(error);
      } else resolve();
    };
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            'Không tải được đăng nhập Google. Kiểm tra mạng hoặc trình chặn nội dung rồi tải lại trang.',
          ),
        ),
      15000,
    );
    script.onload = () =>
      finish(
        window.google?.accounts?.oauth2
          ? undefined
          : new Error('Google chưa khởi tạo được đăng nhập. Tải lại trang để thử lại.'),
      );
    script.onerror = () =>
      finish(new Error('Không tải được đăng nhập Google. Kiểm tra kết nối mạng rồi thử lại.'));
    document.head.appendChild(script);
  }).catch((error) => {
    sdkPromise = undefined;
    throw error;
  });
  return sdkPromise;
}

/** Access token chỉ ở RAM; không ghi token hay dữ liệu lớp vào localStorage/cookie. */
export class GoogleSession {
  private accessToken = '';
  private expiresAt = 0;
  private generation = 0;
  constructor(readonly clientId: string) {}
  token() {
    if (!this.accessToken || Date.now() >= this.expiresAt) {
      this.logout();
      throw new SessionExpired();
    }
    return this.accessToken;
  }
  logout() {
    this.generation++;
    this.accessToken = '';
    this.expiresAt = 0;
  }
  login(): Promise<void> {
    this.logout();
    const generation = this.generation;
    return new Promise((resolve, reject) => {
      const oauth = window.google?.accounts?.oauth2;
      if (!oauth || !this.clientId) {
        reject(new Error('Đăng nhập Google chưa sẵn sàng.'));
        return;
      }
      const client = oauth.initTokenClient({
        client_id: this.clientId,
        scope: ['openid', 'email', 'profile', ...CLASSROOM_SCOPES].join(' '),
        include_granted_scopes: true,
        callback: (response) => {
          if (generation !== this.generation) {
            reject(new Error('Đã hủy phiên đăng nhập.'));
            return;
          }
          if (response.error || !response.access_token) {
            reject(
              new Error(
                'Bạn chưa cho phép kết nối Google Classroom. Hãy đăng nhập lại và cấp quyền cần dùng.',
              ),
            );
            return;
          }
          const granted = new Set((response.scope || '').split(/\s+/));
          if (CLASSROOM_SCOPES.some((scope) => !granted.has(scope))) {
            reject(
              new Error(
                'Chưa được cấp đủ quyền đọc Classroom. Đăng nhập lại và chọn các quyền đọc lớp, bài tập và danh sách học viên.',
              ),
            );
            return;
          }
          const seconds = Number(response.expires_in);
          if (!Number.isFinite(seconds) || seconds <= 30) {
            reject(new Error('Google không cấp phiên truy cập hợp lệ. Hãy đăng nhập lại.'));
            return;
          }
          this.accessToken = response.access_token;
          this.expiresAt = Date.now() + (seconds - 30) * 1000;
          resolve();
        },
        error_callback: (error) =>
          reject(
            new Error(
              error.type === 'popup_closed'
                ? 'Bạn đã đóng cửa sổ đăng nhập Google. Có thể bấm Đăng nhập để thử lại.'
                : 'Không mở được cửa sổ đăng nhập. Cho phép cửa sổ bật lên cho website rồi thử lại.',
            ),
          ),
      });
      // Gọi trực tiếp từ sự kiện bấm nút để giữ user gesture cho cửa sổ OAuth.
      client.requestAccessToken({ prompt: 'select_account' });
    });
  }
}
