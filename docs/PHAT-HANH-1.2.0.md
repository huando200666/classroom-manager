# Classroom Manager 1.2.0

Website hiển thị dữ liệu quét qua tiện ích Chrome/Edge đã cài, không cần Google Cloud, Classroom API hay nhập tệp dữ liệu thủ công.

## Thay đổi

- Kết nối website với tiện ích bằng content script, giữ nguyên định danh của tiện ích unpacked khi cập nhật tại cùng thư mục.
- Sau khi cho phép, tự kết nối nếu có một tab Classroom; nhiều tab được chọn thủ công. Đọc lớp, bài tập và quét bài nộp trên cùng dashboard.
- Website điều khiển hàng đợi tải hiện có và xuất báo cáo. Lệnh tải/cài đặt yêu cầu thao tác bấm trực tiếp.
- Chỉ cho phép trang chủ dự án trên GitHub Pages; kiểm tra origin, đường dẫn, main frame, extension ID, tab và document ID. Quyền cấp theo phiên/tab, dữ liệu lọc theo tài khoản. Ngắt kết nối chặn cả phản hồi tới muộn.
- Giữ cách tạm hiển thị Classroom khi đọc, khắc phục trường hợp tab nền gây timeout. Loại tab làm việc của tiện ích khỏi danh sách tab nguồn.
- Bỏ luồng OAuth/API khỏi bản hiện tại và cập nhật hướng dẫn/quyền riêng tư.

## Cập nhật

1. Dừng phiên tải đang chạy.
2. Giải nén `Classroom-Manager-1.2.0.zip`, thay nội dung trong đúng thư mục tiện ích cũ.
3. Vào `chrome://extensions` hoặc `edge://extensions`, bấm **Tải lại / Reload** và kiểm tra phiên bản **1.2.0**. Chấp thuận quyền truy cập website dự án nếu trình duyệt hỏi.
4. Nhấn F5 tại website và Classroom, mở danh sách lớp trong cùng hồ sơ trình duyệt.
5. Website → **Kết nối tiện ích** → chọn lớp/bài tập → **Quét bài nộp**.

Ngắt website không dừng hàng đợi và không xóa lịch sử trong tiện ích. Không cần gỡ/cài lại tiện ích hoặc chuyển thư mục.

## Kiểm chứng

Xem [báo cáo kiểm thử](KIEM-THU.md). E2E chạy tiện ích MV3 thật với DOM Classroom/Drive mô phỏng, gồm nhận dữ liệu trên website, cấp/thu hồi quyền, phản hồi tới muộn và hồi quy tải tệp. Việc đọc/tải trên giao diện Classroom thật còn phụ thuộc adapter và cần đối chiếu số lượng trước khi dùng cho cả lớp.
