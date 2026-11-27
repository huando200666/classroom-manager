# Classroom Manager 1.2.1

Sửa lỗi chờ tab khi đọc bài tập hoặc quét bài nộp, từng hiển thị “Tab chưa sẵn sàng sau 22 giây”.

## Thay đổi

- Hiển thị tab Classroom trước bước điều hướng/chờ tài liệu, thay vì chỉ sau khi đã chờ xong. Khi xong chỉ quay về tab trước nếu người dùng chưa tự chuyển sang tab khác.
- Không tải lại lần hai URL mà tab làm việc vừa bắt đầu mở.
- Xác minh phản hồi từ tài liệu đúng đích; không bắt buộc mọi tài nguyên phụ phải tải xong mới đọc DOM.
- Chấp nhận phần `/u/N/` được thêm vào URL và chuyển chế độ `details`/`submissions` của cùng bài tập. Vẫn từ chối lớp, bài tập, tài khoản được chỉ rõ hoặc trang học viên khác. Tài khoản và quyền giáo viên tiếp tục được kiểm tra từ DOM trước khi chấp nhận danh sách.
- Giới hạn cả thời gian chờ từng ping trong ngân sách 22 giây; lỗi quyền/đăng nhập được giữ nguyên. Tab cũ trả lời không được coi là trang mới đã sẵn sàng.
- Giữ tab hiển thị cả khi bấm/đọc mục Bài tập của học viên.

## Cập nhật

1. Dừng hàng đợi, giải nén `Classroom-Manager-1.2.1.zip` và chép nội dung thư mục `Classroom-Manager` vào đúng thư mục tiện ích cũ.
2. Mở `edge://extensions` hoặc `chrome://extensions` → **Tải lại / Reload**.
3. Nhấn F5 tại Classroom và website; kiểm tra phiên bản tiện ích được nhận diện là **1.2.1**.
4. Kết nối lại, chọn lớp/bài tập và quét lại. Không cần gỡ tiện ích hay nhập lại dữ liệu.

## Giới hạn kiểm chứng

Ca hồi quy mô phỏng việc chuyển hướng tài khoản/chế độ xem và giữ một tài nguyên ảnh chưa tải xong trong Chromium có tiện ích thật. Đây là kiểm chứng lỗi trong bộ chờ, chưa xác nhận nguyên nhân trên tài khoản Classroom của người dùng. Nếu tài khoản là học viên, không thể quét bài nộp cả lớp; cần tài khoản có quyền giáo viên. Adapter đọc DOM thực tế vẫn có thể cần điều chỉnh theo giao diện Google.
