# Đăng nhập Google và đọc Classroom trực tiếp trên website

Website dùng Google Identity Services và Classroom REST API trực tiếp trong trình duyệt. Giữ link GitHub Pages; người dùng không cần cài tiện ích hoặc nhập dữ liệu từ tệp tải về.

## Chủ website cấu hình một lần

1. Tạo hoặc chọn dự án trong [Google Cloud Console](https://console.cloud.google.com/).
2. Bật [Google Classroom API trong Library](https://console.cloud.google.com/apis/library/classroom.googleapis.com). Nếu không tìm thấy bằng ô tìm kiếm, dùng [luồng bật API trực tiếp của Google](https://console.cloud.google.com/flows/enableapi?apiid=classroom.googleapis.com), chọn đúng dự án rồi bấm Enable/Bật. Nếu đã có Manage/Quản lý, API đã được bật.
3. Trong Google Auth Platform, cấu hình tên ứng dụng, email hỗ trợ/liên hệ và đối tượng sử dụng. Nếu dùng External/Testing, thêm tài khoản Classroom cần thử vào Test users. Tài khoản trường có thể cần quản trị viên cho phép ứng dụng.
4. Trong Data Access, khai báo `openid`, `email`, `profile` và các quyền đọc:

   - `https://www.googleapis.com/auth/classroom.courses.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.me.readonly`
   - `https://www.googleapis.com/auth/classroom.coursework.students.readonly`
   - `https://www.googleapis.com/auth/classroom.rosters.readonly`

5. Tạo OAuth Client ID loại **Web application**. Authorized JavaScript origins là **https://huando200666.github.io**, không thêm `/classroom-manager/`. Khi phát triển cục bộ, thêm `http://127.0.0.1:5173` hoặc `http://localhost:5173` tương ứng địa chỉ dùng. Popup token model không sử dụng redirect callback của backend.
6. Trang chủ: `https://huando200666.github.io/classroom-manager/`. Quyền riêng tư: `https://huando200666.github.io/classroom-manager/privacy.html`. Chủ website cần kiểm tra chính sách trước khi phát hành rộng.
7. Sao chép Client ID có đuôi `.apps.googleusercontent.com`. Đây là mã công khai. Không đưa Client Secret hoặc mật khẩu vào frontend hay kho mã.
8. GitHub repository → Settings → Secrets and variables → Actions → **Variables**: tạo **GOOGLE_CLIENT_ID**, giá trị là Client ID. Chạy lại workflow **Deploy GitHub Pages**. Mã được đưa vào `VITE_GOOGLE_CLIENT_ID` khi build.

Nếu chưa cấu hình Client ID, website hiển thị trạng thái chờ và không cho bấm đăng nhập. Không dùng mã giả trong bản production. Khi phát hành rộng, Google có thể yêu cầu xác minh quyền nhạy cảm; code không thay thế xét duyệt hoặc chính sách của trường.

## Sử dụng

Mở web → Đăng nhập bằng Google → chọn tài khoản và cấp quyền → danh sách lớp đang hoạt động xuất hiện. Chọn lớp để tự tải bài tập; bài tập đầu tiên được chọn và tải bài nộp, có thể đổi bài bằng danh sách chọn.

Vai trò lấy từ các lớp API trả về cho `teacherId=me` và `studentId=me`. Với học viên, mọi yêu cầu bài nộp có `userId=me`, không đọc roster. Với giáo viên, đọc roster và các bài nộp được phép xem. Nếu roster không đọc được, cảnh báo và hiển thị mã học viên khi thiếu tên. Không coi học viên thiếu bản ghi bài nộp là đã/chưa nộp.

Tệp đính kèm mở bằng liên kết Google. Website xuất CSV từ dữ liệu đã đọc, chưa tải ZIP hàng loạt hoặc chấm Python. Đăng xuất xóa dữ liệu giao diện; đổi tài khoản/chuyển lớp hủy yêu cầu cũ để tránh lẫn dữ liệu.

## Phiên và phát triển

Access token và dữ liệu chỉ ở RAM; tải lại trang cần đăng nhập lại. Token hết hạn hoặc API trả 401 thì xóa phiên và yêu cầu đăng nhập từ thao tác bấm của người dùng. Không lưu refresh token, không tự bật popup nền. Thông báo riêng cho thiếu quyền, API chưa bật, hạn mức, lỗi mạng và timeout.

Cục bộ: sao chép `.env.example` thành `.env.local`, đặt `VITE_GOOGLE_CLIENT_ID`, chạy `npm ci` rồi `npm run dev`. Kiểm thử dùng OAuth/API mô phỏng; cần thử thêm đăng nhập và đối chiếu Classroom thật sau khi có Client ID.

Tài liệu chính thức: [token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [quyền Classroom](https://developers.google.com/workspace/classroom/guides/auth), [quyền xem bài nộp](https://developers.google.com/workspace/classroom/reference/rest/v1/courses.courseWork.studentSubmissions/list).
