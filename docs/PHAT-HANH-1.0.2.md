# Classroom Manager 1.0.2

Sửa lỗi có thể báo “Thao tác quá thời gian chờ” khi kết nối Classroom hoặc đọc danh sách bài tập/bài nộp.

Trước đây phía nhận kết quả dừng sau 26 giây, trong khi nội dung có thể chờ trang 18 giây rồi thu thập danh sách thêm 20 giây. Bản này dùng chung các mốc thời gian và dành 45 giây cho ba thao tác đọc danh sách; timeout nêu rõ bước đang đọc và cách kiểm tra. Không tự phát lại lệnh tải tệp khi hết thời gian.

Các ca hồi quy mô phỏng phản hồi sau 32 giây đã tái hiện lỗi ở mã cũ và đạt sau sửa. Vẫn cần kiểm tra trên trang Classroom thực tế của người dùng; bản sửa không bảo đảm mọi bố cục DOM đều được hỗ trợ.

Kiểm tra bản 1.0.2 ngày 26/11/2026: **86/86 unit/integration đạt**, **5/5 E2E đạt** (2,4 phút); build tiện ích và build website đều đạt. Các ca trình duyệt dùng dữ liệu mô phỏng.

## Cập nhật tiện ích đã cài

1. Tải và giải nén `Classroom-Manager-1.0.2.zip`.
2. Chép nội dung thư mục `Classroom-Manager` mới đè vào đúng thư mục đang được Chrome/Edge nạp.
3. Mở `chrome://extensions` hoặc `edge://extensions`, nhấn **Tải lại / Reload** ở Classroom Manager.
4. Đóng dashboard cũ, mở lại từ biểu tượng tiện ích và kiểm tra phiên bản **1.0.2**.
5. Mở trang chủ Classroom, chờ danh sách lớp tải xong rồi nhấn **Kết nối** trong tiện ích.

Nếu chọn một thư mục cài mới, có thể gỡ bản cũ và dùng **Tải tiện ích đã giải nén** để chọn thư mục mới. Gỡ tiện ích sẽ xóa cấu hình và lịch sử cục bộ; có thể xuất báo cáo trước.
