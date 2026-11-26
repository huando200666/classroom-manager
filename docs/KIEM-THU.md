# Báo cáo kiểm thử

Ngày kiểm tra gần nhất: 26/11/2026 (Asia/Bangkok).

## Phạm vi

Kiểm thử unit/integration bằng Vitest + jsdom; E2E giao diện và tiện ích MV3 bằng Playwright + Chromium. Các trang Classroom/Drive trong E2E được intercept thành fixture có quyền sử dụng, không kết nối dữ liệu sinh viên thực và không đăng nhập Google tự động.

## Kết quả cuối cùng

| Kiểm tra                                     | Kết quả                                                                        |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| TypeScript strict và build production        | Đạt, tạo `dist/extension`                                                      |
| Vitest unit/integration                      | **91/91 đạt**, 6 tệp kiểm thử, 5,85 giây cho bản 1.0.3                         |
| Playwright E2E                               | **5/5 đạt**, tổng 2,3 phút trên bản build 1.0.3                                |
| Giao diện desktop và 390px                   | Đạt, không lỗi JavaScript hoặc tràn ngang toàn trang                           |
| Quét 73 sinh viên                            | Đúng 55 submitted và 18 missing                                                |
| Tải nhiều ZIP từ 55 bài đủ điều kiện         | **54 ZIP hoàn tất**, không tải tệp teacher hoặc bài missing                    |
| Lỗi gián đoạn / Drive từ chối / HTML giả ZIP | Ghi đúng 3 tệp lỗi; 2 tệp khác hoàn tất; hàng đợi vẫn kết thúc                 |
| Thử lại lỗi sau khi khôi phục nguồn thử      | 5/5 tệp hoàn tất; 2 tệp đã thành công không bị tải lại                         |
| CSV xuất từ tiện ích                         | Đọc lại tệp, xác nhận BOM và có sinh viên chưa nộp                             |
| Excel xuất từ tiện ích                       | Mở lại workbook bằng ExcelJS, xác nhận đầy đủ 7 hàng trong fixture 5 sinh viên |
| Quét lại bài tập                             | Tái sử dụng cùng tab làm việc                                                  |

Unit/integration bao phủ trạng thái Việt/Anh; tuần; tên và đường dẫn Windows dài; phần mở rộng; chữ ký ZIP; khóa trùng; retry khóa tab và timeout; hàng đợi; vùng bài nộp xác minh; tài khoản; đếm 73/55/18 ở hai ngôn ngữ; nhiều ZIP và tên bị cắt; virtual list; MutationObserver; CSV và ẩn thông tin chẩn đoán; nút tải Drive khả dụng/mơ hồ.

Môi trường: Windows, Node 24.14.0, npm 11.9.0, React 19.3.1, Vite 7.3.8, TypeScript 5.9.3, Vitest 3.2.7, Playwright 1.65.1. Dependency được khóa trong `package-lock.json`.

Các lỗi phát hiện và sửa trong quá trình kiểm thử: liên kết điều hướng bị nhận thành tên bài tập; nhãn select chưa rõ cho automation/accessibility; bỏ sót liên kết lượt tải khi chỉ dùng onDeterminingFilename. Luồng tải hiện kết hợp onCreated, onDeterminingFilename, onChanged và đối chiếu lịch sử Downloads theo file ID.

## Kịch bản E2E

1. Dashboard trạng thái trống, không đưa dữ liệu mẫu vào chế độ thật; điều hướng Cài đặt, xác nhận xóa và hủy, module Python chưa triển khai.
2. Responsive ở desktop và 390px, không tràn ngang toàn trang; chụp ảnh hướng dẫn.
3. Nạp tiện ích unpacked trong Chromium, kết nối tab Classroom mô phỏng, đọc lớp/bài tập và xác minh quyền giáo viên.
4. Đọc đủ 73 sinh viên, phân loại đúng 55/18, không có cảnh báo lệch bộ đếm.
5. Chạy hàng đợi, tạm dừng/tiếp tục, bỏ 18 bài chưa nộp.
6. Trong 55 bài đã nộp: một người có 2 ZIP, một người chỉ có PDF, một người không có file, một tên ZIP hiển thị bị cắt nhưng title có đầy đủ. Kỳ vọng 54 ZIP, không suy ra số tệp bằng số sinh viên.
7. Theo dõi trạng thái Chrome Downloads thật trên response tệp mô phỏng; không yêu cầu tệp teacher; lưu lịch sử và xuất CSV.
8. Gián đoạn mạng một tệp, một trang Drive từ chối truy cập, một response HTML mang tên ZIP; tiếp tục xử lý và thử lại riêng lỗi sau khi khôi phục nguồn.
9. Đọc lại tệp CSV/XLSX đã xuất; quét lại cùng bài để kiểm tra tái sử dụng tab.
10. Tab đã mở trước khi cài tiện ích không có content script: tự nạp kết nối, giữ nguyên trang và không nhân đôi thao tác tải khi nạp script nhiều lần.
11. Chỉnh tên thư mục và thêm định dạng PDF, phát cập nhật trạng thái nền, xác nhận bản nháp được giữ và lưu được. Ca này chạy giao diện thật với cầu nối Chrome được mô phỏng.

## Lỗi phát hiện trong lần rà soát 26/11

- **Đọc danh sách khi Classroom nằm nền (sửa ở 1.0.3):** người dùng xác nhận việc chuyển sang tab Classroom ngay sau Kết nối giúp đọc được lớp. Adapter tạm kích hoạt Classroom cho ba lệnh đọc danh sách và khôi phục tab trước đó khi không có lựa chọn mới từ người dùng. Bổ sung 5 unit tests về thứ tự kích hoạt/đọc/khôi phục, giữ lựa chọn mới, xử lý lỗi và không phát lại lệnh tải. Ca E2E kết nối bắt đầu từ tab Classroom không hoạt động, kiểm tra Chrome API xác nhận tab được kích hoạt trước `courses` và dashboard được khôi phục. Dữ liệu trả về vẫn do content script đọc từ fixture. Headless Chromium có thể coi nhiều document cùng visible, nên kiểm tra trạng thái tab qua Chrome API thay vì giả định Page Visibility phản ánh tab thật trong môi trường headless.

- **Timeout nhận kết quả ngắn hơn thao tác đọc (sửa ở 1.0.2):** chờ trang tối đa 18 giây rồi thu thập danh sách tối đa 20 giây có thể vượt thời hạn nhận phản hồi 26 giây. Ba ca hồi quy `courses/assignments/students` với phản hồi ở giây 32 đều thất bại ở mã cũ và đạt sau sửa. Dùng chung mốc thời gian giữa content script và browser adapter; thời hạn đọc danh sách là 45 giây, có tên thao tác trong thông báo. Kiểm tra thêm lệnh đọc bị treo vẫn kết thúc và lệnh tải không bị phát lại khi timeout. Đây là lỗi tái hiện được trong mã, chưa đủ xác nhận là nguyên nhân duy nhất trên mọi trang Classroom thật.

- **Mất bản nháp cài đặt:** mỗi lần nhận lại state từ Chrome Storage, React nhận một object settings mới và ghi đè các trường đang sửa dù nội dung settings không thay đổi. Đã tái hiện bằng E2E thất bại (thư mục `Bai_nop_2026` bị đổi về `Classroom_Downloads`); sửa bằng cách chỉ đồng bộ khi nội dung settings đã lưu thay đổi. Ca hồi quy đã đạt sau sửa.
- **Gói phát hành cũ:** README và package là 1.0.1 nhưng thư mục release chỉ có ZIP 1.0.0. Lệnh package trước đây không build lại nên có thể đóng gói mã cũ. Đã thêm build vào lệnh package, kiểm tra phiên bản manifest và tự tạo SHA256SUMS cho các ZIP phát hành.
- **Báo cáo kiểm thử lỗi thời:** số lượng 72/3 không phản ánh các ca kiểm thử kết nối đã được thêm. Báo cáo được cập nhật theo kết quả chạy lại.

Đây là kiểm thử bản tiện ích hiện tại. `apps/web/api.ts` vẫn gửi lệnh qua Chrome runtime; website độc lập chưa có OAuth, backend hay kết nối Classroom/Drive API. Chưa thể dùng các kết quả này để xác nhận website kết nối dữ liệu thật.

Ảnh đã tạo và kiểm tra: [desktop](dashboard-desktop.png), [mobile](dashboard-mobile.png), [kết quả trên dữ liệu mô phỏng](download-tested.png).

## Chưa xác minh

- DOM và thao tác Drive trên tài khoản Classroom production.
- Chính sách tải nhiều tệp, kiểm tra bảo mật, CORS/referrer thực của từng hồ sơ Google.
- Tương thích Edge riêng biệt và Firefox.
- Chữ ký/khả năng mở của nội dung ZIP tải thực tế.
- Tải hàng nghìn sinh viên và hạn mức storage khi lịch sử rất lớn.

Xem `GIOI-HAN.md`. Báo cáo Playwright được tạo trong `playwright-report`, kết quả từng lượt trong `test-results` (không đóng gói dữ liệu profile trình duyệt).
