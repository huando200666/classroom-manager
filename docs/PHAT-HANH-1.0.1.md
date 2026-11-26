# Classroom Manager 1.0.1

- Phục hồi kết nối cho tab Classroom đã mở trước khi cài tiện ích; không tự tải lại trang và không nhân đôi thao tác tải.
- Sửa lỗi trạng thái nền ghi đè cấu hình đang chỉnh sửa.
- Tách bản build website GitHub Pages khỏi bản tiện ích Chrome/Edge.
- Tự build trước khi đóng gói, kiểm tra phiên bản manifest và tạo mã SHA-256.

Website: https://huando200666.github.io/classroom-manager/

## Cài tiện ích

Tải `Classroom-Manager-1.0.1.zip`, giải nén, mở `chrome://extensions` hoặc `edge://extensions`, bật chế độ nhà phát triển và chọn **Tải tiện ích đã giải nén**. Chọn thư mục `Classroom-Manager` chứa `manifest.json`.

Tệp `Classroom-Manager-1.0.1-source.zip` chứa mã nguồn, tài liệu và workflow GitHub Pages. Dùng `SHA256SUMS.txt` để đối chiếu tệp tải về.

## Phạm vi hiện tại

Website cung cấp giao diện xem trước và liên kết tải tiện ích. Kết nối Classroom trực tiếp từ website bằng OAuth/API chưa triển khai. Adapter DOM của tiện ích chưa được kiểm chứng trên tài khoản Classroom thật.

Trước khi đưa lên GitHub: 81/81 unit/integration và 5/5 E2E đã đạt trong lần rà soát 26/11/2026 với dữ liệu mô phỏng. Chấm bài Python chưa triển khai.
