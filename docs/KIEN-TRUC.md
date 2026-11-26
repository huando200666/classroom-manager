# Kiến trúc MVP

## Luồng dữ liệu

```mermaid
flowchart LR
  UI[Dashboard React trong extension] -->|runtime message| SW[MV3 service worker]
  SW --> DB[Chrome Storage local]
  SW --> BA[Browser Adapter]
  BA --> CS[Content script]
  CS --> DOM[DOM Classroom hoặc Drive đã đăng nhập]
  SW --> Q[Hàng đợi tuần tự]
  Q --> BA
  DOM -->|nút tải công khai trên giao diện Drive| DL[Chrome Downloads]
  DL -->|định danh + trạng thái complete| SW
  SW --> R[CSV tổng kết]
  UI --> X[CSV / Excel / JSON chẩn đoán]
```

Dashboard là extension page, không dùng trang web bên ngoài để kết nối. Bản `npm run dev` sử dụng cùng giao diện nhưng không có quyền gọi Chrome extension; không tự tạo số liệu minh họa.

## Ranh giới và mô-đun

- `BrowserAdapter` cung cấp liệt kê tab, mở Classroom, điều hướng, tab làm việc và thông điệp DOM. `ChromiumAdapter` dùng API chính thức. Firefox cần implementation riêng và kiểm thử tương thích.
- Từ 1.0.3, các lệnh `courses`, `assignments`, `students` tạm kích hoạt tab Classroom trước khi đọc. Kết quả hoặc lỗi được giữ nguyên; tab trước đó được khôi phục nếu người dùng chưa tự chuyển sang tab khác. Không đổi tab cho lệnh tải Drive. Cách này xử lý trường hợp người dùng xác nhận đọc được khi hiển thị Classroom nhưng bị timeout khi để ở nền. Chrome có thể trì hoãn timer của tab nền: [tài liệu Chrome](https://developer.chrome.com/blog/timer-throttling-in-chrome-88).
- Content script chạy trong isolated world, đọc DOM công khai, ARIA, title, href, text và data attributes có trên trang. Không đọc dữ liệu bootstrap nội bộ, storage Google, cookie hay token.
- Parser dùng các nhóm trạng thái Việt/Anh, ưu tiên phủ định để không đọc “Not submitted” thành “Submitted”. Trạng thái mâu thuẫn là unknown.
- Bộ thu thập động dùng MutationObserver để đợi dữ liệu và quét các vùng cuộn có thể nhận diện. Có giới hạn tổng thời gian, đối chiếu bộ đếm và không khẳng định đã quét đủ nếu thiếu.
- Tệp phải có liên kết Drive đã hiện diện trong vùng bài nộp đã xác minh cho đúng sinh viên. Không suy ra bài nộp từ thư mục Drive.
- Mọi thay đổi trạng thái background đi qua hàng thao tác tuần tự để tránh ghi đè storage bởi các sự kiện downloads đồng thời.

## Vòng đời hàng đợi

Sinh viên đủ điều kiện → đọc vùng bài làm → lọc phần mở rộng → tạo FileTask → điều hướng tới liên kết Drive quan sát được → bấm nút Download/Tải xuống → chờ Chrome tạo lượt tải có cùng file ID → gợi ý tên bằng onDeterminingFilename → theo dõi trạng thái.

Chỉ một FileTask `starting/downloading` tồn tại trong tiến trình bình thường. Mỗi bước ghi storage trước khi thao tác có tác dụng phụ. Không tự bấm lại tải khi kết quả không rõ. Tab thao tác được tái sử dụng xuyên suốt phiên tải; tab tạm đọc danh sách bài tập được đóng sau khi đọc.

`chrome.alarms` đánh thức worker định kỳ 30 giây. `downloads.onCreated`, `onDeterminingFilename` và `onChanged` liên kết/đối chiếu lượt tải; trong khi hàng đợi hoạt động, cơ chế dự phòng kiểm tra lịch sử Downloads mỗi giây nếu còn tệp chờ xác nhận. Chỉ liên kết khi định danh tệp và mốc thời gian khớp; không liên kết bằng tên đơn thuần. Sau khi service worker bị dừng/restart, phiên đang chạy được chuyển về paused; tác vụ `starting` chưa có download ID được ghi thất bại có nguyên nhân để người dùng kiểm tra trước khi thử lại. Lượt có download ID được đối chiếu lại bằng downloads.search.

Tạm dừng/dừng được áp dụng sau thao tác DOM hiện tại có giới hạn timeout; không cắt ngang việc đọc DOM tức thì. Lượt đang tải khi pause được phép hoàn tất. Stop hủy lượt đã liên kết chưa xong.

## Xác nhận lượt tải và định dạng

Không coi trùng tên là đủ bằng chứng. File ID phải khớp một thành phần đường dẫn/query trong URL tải hoặc referrer đầy đủ cùng tên tệp, trên miền Drive/googleusercontent hợp lệ và sau thời điểm yêu cầu tải. Không ghép được thì báo lỗi; tệp có thể vẫn xuất hiện trong Downloads mặc định và cần người dùng kiểm tra.

Khi `state=complete`, kiểm tra MIME và kích thước do trình duyệt cung cấp trước khi ghi thành công. HTML không được xác nhận thành ZIP. Việc tải không đọc/giải nén nội dung và không tự chấp nhận file nguy hiểm.

API downloads không cấp quyền đọc byte tùy ý từ ổ đĩa. Hàm kiểm tra chữ ký ZIP có unit test để dùng khi có nguồn byte hợp lệ, nhưng luồng production hiện không kiểm tra chữ ký; thông tin này được ghi trong báo cáo từng tệp.

## Dữ liệu, chống trùng và báo cáo

Chrome Storage local lưu schema 1, tài khoản từ DOM, lớp/bài tập, phiên hiện tại, cấu hình, lịch sử và 300 nhật ký gần nhất. Không dùng sync storage. Lịch sử có tài khoản, lớp, bài tập, tuần, sinh viên, file ID, revision nếu DOM có, trạng thái, thời gian và download ID.

Khóa chống trùng gồm account/course/assignment/student/file ID/revision. Chỉ bỏ qua nếu có revision không rỗng và lịch sử complete cùng khóa. Khi không có revision, tải lại để không bỏ sót nội dung sửa cùng file ID.

CSV có UTF-8 BOM, quote escaping và chống công thức khi ô bắt đầu bằng ký tự đặc biệt. Excel xuất các chuỗi bằng ExcelJS, không xây công thức từ dữ liệu người dùng. Báo cáo bao gồm toàn bộ sinh viên, kể cả missing/unknown/không có file và lỗi. Nhật ký chẩn đoán mặc định thay danh tính, bỏ URL và thông tin file.

## Quyền và bảo mật

Chỉ `storage`, `downloads`, `alarms`, `scripting` và host permissions Classroom/Drive. Quyền scripting nạp lại duy nhất tệp `content.js` đóng gói sẵn vào main frame thuộc hai miền cho phép, khi Chrome báo tab chưa có bộ nhận. Không tải lại trang của giảng viên, không chạy mã lấy từ mạng. Không xin `cookies`, `identity`, `debugger`, `<all_urls>`, quyền native messaging hay quyền đọc toàn bộ tab không liên quan. Chrome cho phép xem URL/tab có host permission mà không cần quyền tabs toàn cục.

Từ 1.0.1, lỗi không có bộ nhận được phục hồi bằng scripting.executeScript trong isolated world và gửi lại lệnh đúng một lần. Nếu cổng đóng giữa chừng, không tự phát lại lệnh vì có thể thao tác tải đã được thực hiện. Script tự thay bộ nhận cũ khi nạp lại để không bấm tải trùng. Lỗi dashboard đã bị vô hiệu hóa sau cập nhật được đổi thành hướng dẫn đóng trang và mở lại từ biểu tượng tiện ích.

Background chỉ nhận lệnh app từ extension page cùng ID; content script chỉ nhận lệnh cùng extension ID. Không có externally_connectable, cửa sau web→extension hoặc tải mã từ xa. CSP chỉ cho script nội bộ, React escape text mặc định. Không thao tác chấm điểm, trả bài, xóa hoặc thông báo sinh viên.

## Tích hợp chấm Python tương lai

`packages/grading/contract.ts` khai báo GradingSandbox. Chưa có implementation. Worker chấm phải là môi trường độc lập có giới hạn CPU/RAM, network=false và không nhận cookie, token hay Chrome profile. Không chạy mã sinh viên trong extension.

## Đề xuất nâng cấp thành website riêng (26/11/2026)

Các mục dưới đây là đề xuất, chưa được triển khai trong bản MVP. Có thể tái sử dụng dashboard, mô hình bài nộp, bộ lọc và phần xuất báo cáo; cần thay tầng runtime/DOM/Chrome Downloads bằng kết nối API.

| Ưu tiên | Nâng cấp                                                                                                                            | Điều kiện kiểm thử trước khi sử dụng                                                                                                                       |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | Backend và đăng nhập Google OAuth; Classroom API đọc lớp, bài tập, danh sách học viên và bài nộp; Drive API tải nội dung            | Dùng lớp thật được cho phép; so khớp danh sách/trạng thái/tệp với Classroom; thử từ chối quyền, thu hồi quyền, hết phiên và tài khoản không phải giáo viên |
| 2       | Hàng đợi lưu trên server; phân trang API; retry có giới hạn cho lỗi tạm thời; khóa chống xử lý trùng                                | Ngắt mạng, khởi động lại worker và gửi lệnh trùng; kết quả không thiếu trang, không ghi nhận tải thành công khi tệp lỗi                                    |
| 3       | Tải thành ZIP chung theo lớp/bài tập, xử lý tên trùng; xuất Google Docs/Sheets/Slides theo định dạng phù hợp; xác minh nội dung tải | Nhiều tệp trên một bài nộp, trùng tên, file lớn, file thiếu quyền, tài liệu Google và ZIP hỏng; đối chiếu báo cáo với tệp thực                             |
| 4       | Nhiều giáo viên: tách dữ liệu theo tài khoản, kiểm tra quyền từng yêu cầu, quản lý phiên và lịch sử có phân trang                   | Hai tài khoản mở đồng thời; thay ID lớp/tệp trong request; người dùng chỉ truy cập dữ liệu họ được quyền xem                                               |

Luồng dự kiến: trình duyệt → backend có phiên đăng nhập → Classroom/Drive API → hàng đợi xử lý và kho kết quả tạm thời → trình duyệt tải kết quả. Cần xác định thời hạn giữ tệp và lịch sử; bảo vệ token trên backend; không đưa client secret vào mã giao diện.

Việc chạy được giao diện và các fixture hiện tại chưa xác nhận kết nối thật. Cần Google Cloud Project, bật API, cấu hình OAuth cho địa chỉ website và tài khoản thử có quyền giáo viên. Việc xác minh ứng dụng và cho phép từ quản trị viên phụ thuộc phạm vi quyền và cách phát hành.

Tham khảo: [quyền Classroom API](https://developers.google.com/workspace/classroom/guides/auth), [OAuth cho web server](https://developers.google.com/identity/protocols/oauth2/web-server), [tải và xuất tệp Drive](https://developers.google.com/workspace/drive/api/guides/manage-downloads).

## Tài liệu API chính thức của bản tiện ích

- https://developer.chrome.com/docs/extensions/reference/api/downloads
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- https://developer.chrome.com/docs/extensions/reference/api/alarms
- https://developer.chrome.com/docs/extensions/reference/api/storage
- https://vite.dev/guide/
