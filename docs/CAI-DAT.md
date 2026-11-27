# Cài đặt trên Chrome và Microsoft Edge

Từ bản 1.2.0, website sử dụng tiện ích Chrome/Edge để quét giao diện Classroom. Không cần tạo Google Cloud, OAuth Client ID hay bật Classroom API. Bạn không phải tải dữ liệu rồi nhập lại vào website.

## Cài lần đầu

1. Tải và giải nén [Classroom-Manager-1.2.1.zip](https://github.com/huando200666/classroom-manager/releases/download/v1.2.1/Classroom-Manager-1.2.1.zip) vào vị trí cố định, ví dụ `D:\Classroom-Manager`. Không xóa hay chuyển thư mục sau khi cài.
2. Chrome: nhập `chrome://extensions`. Edge: nhập `edge://extensions`.
3. Bật **Developer mode / Chế độ nhà phát triển**.
4. Chọn **Load unpacked / Tải tiện ích đã giải nén**.
5. Chọn thư mục **Classroom-Manager** có `manifest.json`, không chọn tệp ZIP.
6. Ghim biểu tượng tiện ích nếu muốn. Bấm biểu tượng để mở dashboard.

Yêu cầu trình duyệt Chromium 120 trở lên. Không cần cài Python, tạo Google Cloud Project hoặc chạy lệnh lập trình. Nếu máy do cơ quan quản lý chặn tiện ích ngoài cửa hàng, cần quản trị viên cho phép cài; không có cơ chế vượt chính sách này.

## Kết nối đúng tài khoản

Nếu đang dùng bản cũ, dừng phiên tải, tải 1.2.1 và giải nén đè vào đúng thư mục đã cài, vào trang quản lý tiện ích nhấn **Tải lại / Reload**. Nếu trình duyệt hỏi quyền truy cập website dự án, cho phép để dùng cầu nối. Nhấn F5 tại website và Classroom, kiểm tra phiên bản nhận diện là **1.2.1**. Chỉ mở lại website không cập nhật tiện ích đã cài. Không gỡ tiện ích hoặc chuyển thư mục để giữ dữ liệu cũ.

Từ 1.0.3, tiện ích tạm hiển thị tab Classroom khi đọc danh sách lớp, bài tập hoặc bài nộp để tránh bộ đọc bị trì hoãn ở tab nền. Sau khi đọc xong sẽ quay về tab trước đó nếu bạn chưa tự chuyển sang tab khác. Có thể dùng cách tạm thời trên bản cũ: bấm Kết nối rồi chuyển ngay sang Classroom trong lúc đọc.

1. Mở `https://classroom.google.com/` trong chính hồ sơ trình duyệt đã cài tiện ích.
2. Đăng nhập trên Google như bình thường. Với nhiều tài khoản, chọn tài khoản giáo viên mong muốn.
3. Về trang chủ Classroom có các thẻ lớp học.
4. Mở [website](https://huando200666.github.io/classroom-manager/), bấm **Kết nối tiện ích** để cho phép đọc dữ liệu và điều khiển tải trong tab website đó. Nếu có một tab Classroom, website tự đọc danh sách lớp. Nếu có nhiều tab, chọn tab chính xác rồi bấm Kết nối. Có thể dùng dashboard riêng bằng biểu tượng tiện ích.
5. Từ bản 1.0.1, tiện ích tự nạp kết nối vào tab đã mở trước khi cài. Nếu trình duyệt chặn, nhấn F5 ở tab Classroom rồi thử lại.

Website phải mở ở đúng địa chỉ GitHub Pages, trong cùng trình duyệt và hồ sơ đã cài tiện ích. Không mở tệp HTML từ ổ đĩa. **Ngắt kết nối website** xóa dữ liệu hiển thị/quyền của tab, nhưng không dừng hàng đợi đang chạy và không xóa dữ liệu trong tiện ích. Dùng Dừng trước nếu muốn dừng tải. Tải lại website phải bấm kết nối lại.

Ứng dụng không yêu cầu mật khẩu và không chuyển tài khoản ngầm. Tài khoản được nhận diện từ nhãn Google Account trong DOM hoặc chỉ số tài khoản trong URL khi không có nhãn. Trường hợp thiếu nhãn tài khoản là giới hạn cần kiểm tra thủ công.

## Tải bài nộp

1. Chọn lớp. Tiện ích đọc bài tập có thể truy cập từ giao diện lớp/Bài tập trên lớp.
2. Chọn tuần nếu cần, sau đó chọn bài tập cụ thể. Bài trùng tên được phân biệt bằng định danh hiển thị trong danh sách.
3. Bấm Quét bài nộp. Tiện ích dùng tab Bài tập của học viên để kiểm tra quyền và đọc danh sách.
4. Đối chiếu tổng sinh viên, đã nộp, chưa nộp và cảnh báo. Nếu thiếu dữ liệu, mở rộng nhóm, bỏ bộ lọc trên Classroom và quét lại.
5. Bấm Tải tất cả bài nộp. Không điều hướng tab làm việc trong quá trình tải và tránh bắt đầu các lượt tải Drive thủ công khác.
6. Theo dõi trạng thái từng tệp. Tạm dừng ngừng nhận việc mới; lượt đang xử lý có thể hoàn tất. Dừng hủy các lượt tải đã liên kết còn chạy và giữ tệp đã hoàn tất.
7. Kiểm tra báo cáo. Hàng đợi “Đã xử lý xong” vẫn có thể có tệp lỗi hoặc sinh viên không có tệp phù hợp; xem các chỉ số cụ thể.
8. Báo cáo CSV tự tải cuối phiên. Có thể bấm Xuất CSV hoặc Excel để xuất lại, kể cả giữa phiên.

## Vị trí tệp

Mặc định, bên trong thư mục Downloads:

```text
Classroom_Downloads/
  Ten_lop/
    Tuan_07/
      01_Nguyễn Văn A__BaiTap.zip
```

Tên lớp thực tế được làm sạch ký tự không hợp lệ. Mỗi ZIP giữ nguyên nội dung và được tải riêng, không giải nén hoặc gộp ZIP. Tệp trùng tên được trình duyệt đổi tên, không ghi đè. CSV tự động tổng kết nằm ở gốc `Classroom_Downloads`; CSV/Excel xuất thủ công theo vị trí tải mặc định của trình duyệt.

Để lưu sang ổ D: mở Cài đặt trình duyệt → Downloads / Tệp tải xuống → thay đổi Vị trí. Có thể bật “Hỏi nơi lưu từng tệp”, nhưng thao tác này sẽ làm quy trình cần xác nhận nhiều lần. Tiện ích không có quyền ghi tùy ý vào mọi ổ đĩa.

## Khi gặp lỗi

- **Chưa tìm thấy tiện ích hỗ trợ website:** cập nhật tiện ích lên 1.2.1, bấm Reload tại trang extensions, kiểm tra tiện ích được phép truy cập `huando200666.github.io`, rồi nhấn F5 trên website. Dùng cùng hồ sơ trình duyệt với Classroom; cửa sổ ẩn danh/hồ sơ khác không dùng chung tiện ích hoặc phiên đăng nhập.
- **Tab chưa sẵn sàng sau 22 giây khi đọc/quét bài tập:** bản 1.2.1 sửa việc chờ tab nền, chờ tài nguyên phụ và URL chuyển hướng của cùng bài tập. Cập nhật tiện ích, Reload rồi F5 cả website/Classroom. Nếu còn lỗi, mở tab bài tập do tiện ích tạo để xem nội dung: hoàn tất đăng nhập nếu Google yêu cầu, kiểm tra đúng tài khoản và quyền giáo viên. Nếu bài tập đã hiện nhưng không có mục Bài tập của học viên, tài khoản có thể là học viên hoặc adapter chưa nhận diện được giao diện đó.
- **Kết nối website đã ngắt hoặc tài khoản đã đổi:** bấm Kết nối tiện ích lại. Nếu còn phiên tải cũ đang chạy/tạm dừng, mở dashboard bằng biểu tượng tiện ích để quản lý hoặc dừng trước khi đổi tài khoản.
- **Could not establish connection / Receiving end does not exist:** với bản cũ, nhấn F5 ở tab Classroom. Để dùng bản sửa 1.0.1, vào trang extensions, nhấn Tải lại / Reload ở Classroom Manager, đóng dashboard cũ và mở lại bằng biểu tượng tiện ích. Kiểm tra Chi tiết → Quyền truy cập trang web cho phép Classroom/Drive.
- **Thao tác quá thời gian chờ khi Kết nối:** bản 1.0.1 có thời hạn nhận kết quả ngắn hơn thời gian chờ/thu thập danh sách. Cập nhật 1.0.2. Bản mới chờ tối đa 45 giây cho danh sách lớp/bài tập/bài nộp và báo rõ bước bị chậm. Nếu vẫn lỗi, mở trang chủ Classroom, chờ tải xong rồi thử lại; giao diện Google thực tế có thể chưa được adapter hỗ trợ.
- **Đọc danh sách lớp quá 45 giây ở bản 1.0.2:** nếu chuyển sang tab Classroom giúp đọc được lớp, cập nhật 1.0.3 để tiện ích tự hiển thị tab khi đọc. Trên bản cũ có thể bấm Kết nối rồi chuyển ngay sang Classroom trong lúc chờ. Nếu 1.0.3 vẫn lỗi, cần kiểm tra thông báo cụ thể và giao diện thực tế; không chỉ tăng tiếp thời gian chờ.

- **Chưa đọc được lớp:** về trang chủ Classroom, chờ hiển thị thẻ lớp rồi kết nối lại.
- **Chưa đọc được bài tập:** mở Bài tập trên lớp của lớp mong muốn; Google có thể đã đổi cấu trúc DOM.
- **Quyền giáo viên chưa xác minh:** kiểm tra tài khoản có tab Bài tập của học viên của đúng bài tập.
- **Không nhận diện được vùng bài làm:** không tiếp tục tải nhầm. Cần cập nhật adapter theo DOM thực tế.
- **Không có ZIP:** xem ghi chú tệp bị cắt tên, lỗi đọc vùng bài nộp hoặc định dạng khác. Không coi số đã nộp là số ZIP.
- **Drive từ chối truy cập / yêu cầu đăng nhập:** xử lý trực tiếp trong tab Google chính thức. Tiện ích không vượt xác thực.
- **Drive yêu cầu xác nhận quét virus:** người dùng quyết định trực tiếp trên Drive. Tiện ích không tự chấp thuận cảnh báo bảo mật.
- **Không liên kết được lượt tải:** kiểm tra Downloads trước khi thử lại; không xác nhận thành công dựa vào trùng tên tệp.
- **Tải gián đoạn:** tạm dừng nếu cần, chọn Tải lại lỗi. Mỗi lần thử lại vẫn dùng đổi tên chống ghi đè.
- **Trình duyệt chặn tải nhiều tệp:** kiểm tra thông báo/quyền tải xuống tự động cho trang Google Drive trong trình duyệt. Tiện ích không tự thay đổi quyền trang của bạn.
- **Đang kéo tab:** bỏ thao tác kéo; tiện ích thử lại với backoff có giới hạn.

## Xóa dữ liệu và cập nhật

Trong dashboard mở bằng biểu tượng tiện ích: Cài đặt → Xóa dữ liệu và lịch sử → xác nhận. Website không có quyền xóa toàn bộ dữ liệu tiện ích. Tệp đã tải không bị xóa. Với hồ sơ trình duyệt dùng chung, xuất báo cáo vào vị trí được bảo vệ trước khi xóa dữ liệu.

Để cập nhật bản unpacked: dừng hàng đợi, sao lưu báo cáo cần giữ, thay nội dung thư mục cũ bằng bản mới rồi bấm Reload trên trang extensions. Dùng cùng thư mục để giữ định danh tiện ích và dữ liệu. Tải lại các tab Classroom/Drive. Bản thay đổi schema lưu trữ cần có hướng dẫn di chuyển dữ liệu riêng; phiên bản 1.0 dùng schema 1.
