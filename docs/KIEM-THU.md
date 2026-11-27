# Báo cáo kiểm thử 1.2.1

Ngày 27/11/2026 (Asia/Bangkok).

## Phạm vi và kết quả

Vitest/jsdom kiểm tra parser, adapter, hàng đợi, lưu trữ và chính sách cầu nối. Playwright chạy Chromium với tiện ích MV3 unpacked thật, nhưng Classroom/Drive được intercept thành DOM và tệp mô phỏng. Luồng website phục vụ bản production `dist/site` tại origin GitHub Pages mô phỏng để chạy content script đúng manifest; không giả lập tầng cầu nối.

| Kiểm tra                          | Kết quả                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Unit/integration                  | **107/107 đạt**, 7 tệp kiểm thử                                                                           |
| Playwright E2E                    | **8/8 đạt**, 0 unexpected/flaky/skipped                                                                   |
| Desktop và 390px                  | Không lỗi JavaScript hoặc tràn ngang toàn trang                                                           |
| Website nhận dữ liệu qua tiện ích | Đọc lớp, bài tập và 5 học viên (3 đã nộp, 2 chưa nộp); không gọi Classroom API                            |
| Quét danh sách lớn                | 73 sinh viên, đúng 55 đã nộp và 18 chưa nộp                                                               |
| Tải hàng loạt                     | 54 ZIP hoàn tất; không tải đề bài hoặc bài chưa nộp                                                       |
| Phục hồi lỗi                      | Nhận diện gián đoạn, Drive từ chối và HTML giả ZIP; thử lại đủ 5/5 tệp, không tải lại 2 tệp đã thành công |
| Báo cáo                           | Đọc lại CSV có BOM và Excel đúng số hàng; có sinh viên chưa nộp                                           |

Không tự động đăng nhập Google, không dùng dữ liệu học viên thật. Người dùng đã xác nhận đọc được danh sách lớp khi đưa Classroom ra trước; kết quả này chưa xác minh toàn bộ bài nộp và tải trên giao diện Google thật. Adapter có thể cần điều chỉnh khi Google thay đổi DOM.

## Cầu nối website

- Chỉ đúng HTTPS origin và đường dẫn trang chủ dự án được phép. Repository khác trên cùng github.io không nhận diện/kết nối được tiện ích.
- Background kiểm tra extension ID, tab, main frame và document ID. Unit test từ chối iframe, nguồn thiếu định danh và URL khác.
- Mở website/probe không làm lộ account/history đã có trong Chrome Storage. Script website tự gửi authorize không tạo được quyền.
- Click thực vào Kết nối tiện ích mới cấp grant; grant gắn tài khoản sau khi đọc thành công. Trạng thái/history/run khác tài khoản được lọc.
- Gửi lệnh start bằng script không có click tương ứng bị từ chối. Website không được gọi clear toàn bộ storage.
- Ngắt kết nối xóa giao diện và quyền của website, giữ nguyên lịch sử tiện ích. Tải lại trang không tự cho phép đọc dữ liệu.
- Giữ chậm một yêu cầu đọc bài tập, ngắt kết nối rồi mới trả DOM: background hoàn tất nhưng tên bài riêng tư tới muộn không xuất hiện trong thông điệp/trạng thái website.
- Grant dùng storage session, tồn tại qua worker restart, không dùng lại được bởi tab/tài liệu khác; nonce cũ không ghi đè grant mới sau thu hồi/cấp lại.

## Hồi quy lỗi chờ tab 22 giây

Thêm 7 unit test cho URL tài khoản/chuyển hướng trong cùng bài tập, từ chối sai lớp/bài/tài khoản/học viên, tài liệu còn loading nhưng phản hồi được, hiển thị tab trước khi chờ, không tải lại URL vừa mở, không nhận ping của tài liệu cũ, giới hạn ping treo và giữ lỗi quyền truy cập. Khi chạy trên mã cũ, 5 ca thất bại; sau sửa, cả 7 ca đạt.

E2E mới chuyển hướng từ URL lớp/bài tập sang `/u/1/...`, từ details sang submissions và giữ một ảnh chưa phản hồi để tab luôn ở trạng thái loading. Website vẫn đọc được 5 học viên, không có lỗi và kiểm tra Chrome API xác nhận tab còn loading. Đây là dữ liệu mô phỏng, chưa xác nhận nguyên nhân trên tài khoản thật của người dùng.

## Hồi quy chức năng tiện ích

1. Giao diện trống khi chưa có dữ liệu, không tự đưa dữ liệu mẫu vào production; kiểm tra desktop/390px và chụp ảnh hướng dẫn.
2. Kết nối tab Classroom mở trước khi cài: tự nạp lại content script, không nhân đôi thao tác tải khi nạp nhiều lần.
3. Đọc lớp/bài tập, xác minh quyền giáo viên khi quét; đếm 73/55/18 và đối chiếu bộ đếm.
4. Tải tuần tự nhiều ZIP trên một bài; bỏ bài thiếu tệp, chỉ có PDF hoặc chưa nộp; lấy tên đầy đủ khi nhãn bị cắt.
5. Tạm dừng/tiếp tục, theo dõi Chrome Downloads thật trên response tệp mô phỏng, lưu lịch sử và xuất báo cáo.
6. Từng lỗi mạng/quyền/MIME được ghi riêng; hàng đợi vẫn kết thúc, chỉ thử lại tệp lỗi khi nguồn phục hồi.
7. Quét lại tái sử dụng tab làm việc; tab này không xuất hiện như tab nguồn khi website kết nối lại.
8. Thay đổi tiến độ nền không ghi đè bản nháp cài đặt; lưu thư mục/định dạng mới đúng.

Unit/integration còn bao phủ trạng thái Việt/Anh, tuần, đường dẫn Windows, định dạng/chữ ký ZIP, khóa trùng, timeout/retry khóa tab, vùng bài làm đúng chủ sở hữu, virtual list, MutationObserver, CSV escaping và ẩn danh chẩn đoán. Chữ ký ZIP chỉ được kiểm thử ở hàm parser; tải production xác minh Downloads/MIME/kích thước, không đọc byte trên ổ đĩa.

## Lệnh tái lập

```powershell
npm ci
npm test
npm run build
npm run build:web
npm run test:e2e
npm run package
```

E2E cần Chromium hỗ trợ nạp tiện ích, có thể đặt `CM_CHROMIUM_PATH`. Phải build web và extension trước E2E vì ca website dùng các artifact này. Báo cáo HTML nằm ở `playwright-report/index.html`; test-results/profile không đưa lên GitHub. Ảnh tại `docs/dashboard-desktop.png`, `docs/dashboard-mobile.png`, `docs/website-bridge-data.png`.

Dependency và phiên bản cụ thể được khóa trong `package-lock.json`. Build TypeScript strict áp dụng cho cả hai bản web/extension. Tệp ZIP phát hành có manifest trùng phiên bản package và đi kèm SHA-256.
