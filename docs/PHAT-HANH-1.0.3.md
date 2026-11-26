# Classroom Manager 1.0.3

Sửa bước đọc danh sách lớp/bài tập/bài nộp khi Classroom đang là tab nền.

Người dùng xác nhận cùng trang Classroom đọc được danh sách lớp sau khi chuyển trang đó ra phía trước. Bản này tạm kích hoạt tab Classroom trước các thao tác đọc danh sách, rồi khôi phục tab trước đó khi hoàn tất hoặc có lỗi. Nếu người dùng đã tự chọn tab khác trong lúc đọc, tiện ích giữ nguyên lựa chọn đó. Lỗi khôi phục một dashboard đã đóng không làm mất kết quả đọc.

Không thay đổi thời hạn 45 giây và không tự phát lại lệnh tải Drive.

Kiểm tra ngày 26/11/2026: **91/91 unit/integration đạt**, **5/5 E2E đạt** (2,3 phút), build tiện ích và website đều đạt. Ca kết nối kiểm tra trạng thái tab bằng Chrome API trước lệnh đọc và sau khi khôi phục dashboard; các dữ liệu lớp/bài nộp trong E2E vẫn là fixture mô phỏng.

## Cập nhật

1. Tải `Classroom-Manager-1.0.3.zip` và giải nén.
2. Chép nội dung thư mục `Classroom-Manager` mới đè vào thư mục tiện ích đang cài.
3. Mở `chrome://extensions` hoặc `edge://extensions`, nhấn **Tải lại / Reload** ở Classroom Manager.
4. Đóng dashboard cũ, mở lại bằng biểu tượng tiện ích, kiểm tra **v1.0.3** rồi kết nối.

Bản này xử lý trường hợp đọc danh sách bị ảnh hưởng khi tab ở nền. Các bước nhận diện bài tập, sinh viên và tệp vẫn cần đối chiếu trên Classroom thực tế; chưa khẳng định hỗ trợ mọi bố cục Google.
