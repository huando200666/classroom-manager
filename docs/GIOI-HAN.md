# Lỗi đã xử lý và giới hạn còn lại

## Website qua tiện ích 1.2.0

Website dùng content script của tiện ích đã cài để đọc DOM Classroom, không dùng OAuth/Classroom API. Cần Chrome/Edge trên máy tính, cùng hồ sơ trình duyệt với Classroom và tiện ích 1.2.0. Chỉ trang chủ dự án tại `https://huando200666.github.io/classroom-manager/` (hoặc `index.html`) được kết nối. Localhost, tệp HTML và repository khác không được cấp quyền.

Quyền cấp sau thao tác bấm trực tiếp, theo tab/document và mất khi tải lại trang. Ngắt website chặn dữ liệu đến muộn, nhưng không xóa lịch sử tiện ích hoặc dừng hàng đợi đang chạy. Nếu đang tải/tạm dừng mà cần kết nối lại, dùng dashboard của tiện ích để quản lý phiên cũ. Website không có lệnh xóa toàn bộ storage. Các giới hạn DOM bên dưới áp dụng cho cả website và dashboard tiện ích.

## Đã có biện pháp xử lý trong mã và kiểm thử

| Tình huống                                     | Cách xử lý                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Đăng nhập Chromium tự động bị Google chặn      | Dùng phiên trình duyệt người dùng đã đăng nhập; không tự động đăng nhập      |
| “Not submitted” bị nhận thành “Submitted”      | Phân tích phủ định trước, mâu thuẫn về unknown                               |
| 73 sinh viên bị coi thành 73 bài đã nộp        | Phân loại từng hàng và đối chiếu bộ đếm                                      |
| 55 sinh viên bị coi thành 55 ZIP               | Tách hàng đợi sinh viên và hàng đợi từng tệp                                 |
| Liên kết Student work bị coi thành tên bài tập | Bỏ liên kết điều hướng và role tab khỏi danh sách bài tập                    |
| Tải nhầm tệp đề bài                            | Chỉ đọc vùng bài nộp xác minh cho sinh viên hiện tại; bỏ vùng teacher        |
| Tên tệp bị cắt ở nhãn hiển thị                 | Ưu tiên tên đầy đủ từ title/aria-label/data-file-name                        |
| Drive từ chối quyền hoặc đòi xác thực          | Hiển thị nguyên nhân, không vượt bước xác nhận                               |
| Đang kéo tab                                   | Retry tab update/create với exponential backoff có giới hạn                  |
| Tải HTML dưới tên ZIP                          | Kiểm tra MIME từ Downloads, hủy/ghi lỗi thay vì thành công                   |
| Chưa hoàn tất đã báo thành công                | Chờ trạng thái complete của Chrome Downloads                                 |
| Cùng tên tệp nhưng khác sinh viên/nội dung     | Khóa account/course/assignment/student/file/revision; đổi tên chống ghi đè   |
| Worker bị dừng giữa chừng                      | Lưu trạng thái, alarm và phục hồi paused; không tự bấm tải lại kết quả mơ hồ |
| Một tệp lỗi làm dừng cả lớp                    | Ghi lỗi từng tệp/sinh viên rồi tiếp tục; có thử lại riêng                    |
| CSV tiếng Việt và ô công thức nguy hiểm        | UTF-8 BOM, CSV escaping và formula escaping                                  |
| Trạng thái nền ghi đè cài đặt đang sửa         | Chỉ đồng bộ bản nháp khi nội dung cài đặt đã lưu thực sự thay đổi            |
| ZIP phát hành khác mã nguồn hiện tại           | Lệnh package build lại, đối chiếu phiên bản manifest và tạo SHA-256          |

## Cần kiểm chứng trên Classroom thật

Bản 1.0.2 sửa thời hạn nhận kết quả quá ngắn khi đọc danh sách và bổ sung lỗi theo từng thao tác. Việc sửa timeout không thay thế kiểm chứng selector và cấu trúc trang Classroom thực tế.

Bản 1.0.3 tạm hiển thị Classroom khi đọc danh sách lớp/bài tập/bài nộp. Người dùng đã xác nhận trên trang của họ rằng chuyển Classroom ra trước giúp đọc được lớp. Đây là bằng chứng cho điều kiện kích hoạt lỗi đang xử lý, không phải xác minh toàn bộ luồng tải trên dữ liệu thật.

1. **Chưa có phiên Classroom thực tế để kiểm chứng DOM.** Các selector ngữ nghĩa đã được kiểm thử trên fixture, không phải bản sao DOM production của Google. Hệ thống có thể dừng với lỗi adapter khi Google dùng cấu trúc khác. Cần đối chiếu trên lớp được phép dùng trước khi triển khai cho giảng viên.
2. Đọc vùng bài nộp yêu cầu data attribute xác định chủ sở hữu hoặc vùng ARIA gắn tên sinh viên. Những bố cục khác sẽ bị từ chối để tránh tải nhầm tệp. Hiện chưa hỗ trợ mọi trình xem bài/iframe/shortcut Google Docs.
3. Cuộn động có ngân sách thời gian; nhóm thu gọn, filter, danh sách không có href sinh viên hoặc virtual list đặc thù có thể chưa được đọc đầy đủ. Có cảnh báo khi bộ đếm không khớp, không điền số liệu còn thiếu bằng giả định.
4. Tài khoản fallback theo chỉ số `/u/N` khi DOM không cho email có thể không đủ để phân biệt người dùng sau khi đổi thứ tự tài khoản. Kiểm tra nhãn tài khoản trước mỗi phiên.
5. Ngày giao/hạn nộp/chủ đề chỉ có khi DOM cung cấp thông tin có thể nhận diện; không gọi API để bổ sung. Không nội suy số lượng bài nộp khi chưa quét bài tập.
6. Revision từ DOM không luôn có. Trong trường hợp đó tải lại là chủ ý để tránh bỏ sót bài nộp sửa đổi.
7. Không tự động bấm xác nhận virus, tải tệp nguy hiểm, CAPTCHA, yêu cầu truy cập hoặc đăng nhập lại.
8. Liên kết giữa lượt tải và file ID chỉ thành công khi Downloads cung cấp ID trong URL/referrer theo điều kiện kiểm chứng được. Nếu Google che ID, tệp có thể tải vào Downloads mặc định nhưng tiện ích không đánh dấu thành công.
9. Chưa kiểm tra chữ ký nhị phân ZIP trong luồng tải thực tế. MIME và kích thước giúp loại HTML/rỗng nhưng không chứng minh cấu trúc ZIP hợp lệ trong mọi trường hợp. Báo cáo ghi rõ mức xác minh.
10. Tạm dừng/dừng có thể cần chờ thao tác hiện tại kết thúc/timeout. Nếu đóng trình duyệt hoặc worker bị ngắt, cần Tiếp tục sau khi khôi phục. Không bảo đảm thực thi nền khi Chrome/Edge đã đóng.
11. Lưu trữ Chrome Storage chịu hạn mức của trình duyệt. Với lịch sử rất lớn, nên xuất báo cáo rồi xóa dữ liệu. Chưa có phân trang lịch sử hoặc migration schema khác v1.
12. Bản unpacked chưa ký và chưa phát hành Chrome Web Store/Edge Add-ons. Firefox mới có giao diện adapter để mở rộng, chưa có bản build/test tương thích.
13. Chấm bài Python chưa triển khai, chỉ có hợp đồng tích hợp sandbox.

Không nên diễn giải “kiểm thử đạt” thành bảo đảm hoạt động với mọi tài khoản, ngôn ngữ hoặc phiên bản Classroom.
