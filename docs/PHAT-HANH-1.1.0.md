# Classroom Manager 1.1.0 — Đăng nhập Google trên web

Website có luồng Google OAuth và Classroom API trực tiếp, không yêu cầu cài tiện ích hoặc nhập tệp dữ liệu. Sau đăng nhập, tự tải lớp đang hoạt động; chọn lớp để đọc bài tập và bài nộp. Có vai trò giáo viên/học viên, lọc trạng thái, mở tệp Google và xuất CSV.

Access token/dữ liệu chỉ ở RAM; đăng xuất, hết phiên hoặc đổi tài khoản không giữ dữ liệu lớp cũ. Học viên chỉ yêu cầu bài nộp với `userId=me`. Google là nơi kiểm soát quyền truy cập. Không sửa điểm, bài tập hoặc lớp.

Chủ website cần bật Classroom API và đặt repository variable `GOOGLE_CLIENT_ID` từ OAuth Client ID loại Web application. Origin: `https://huando200666.github.io`. Chưa có Client ID thì website hiển thị hướng dẫn cấu hình và khóa nút đăng nhập; không có mã giả ở production.

Kiểm tra: 107/107 unit/integration và 10/10 E2E đạt với OAuth/API mô phỏng; đã xem ảnh desktop/mobile. Đăng nhập Google và đối chiếu dữ liệu Classroom thật còn cần cấu hình Client ID. Hướng dẫn: [GOOGLE-OAUTH.md](GOOGLE-OAUTH.md).

Tiện ích DOM cũ vẫn được giữ như một lựa chọn riêng cho tải tệp hàng loạt. Website mới chưa tải ZIP hàng loạt hoặc chấm Python.
