# Classroom Manager

Website tiếng Việt để **đăng nhập Google và xem dữ liệu Classroom trực tiếp trên web**: lớp học, bài tập, bài nộp, trạng thái và liên kết tệp. Người dùng không cần cài tiện ích hoặc tải dữ liệu về rồi nhập lại. Chủ website cấu hình một Google OAuth Client ID theo [hướng dẫn](docs/GOOGLE-OAUTH.md).

**Trạng thái 1.1.0:** có luồng Google OAuth và Classroom REST API; 107/107 unit/integration và 10/10 E2E đã đạt với OAuth/API mô phỏng. Đăng nhập và đối chiếu dữ liệu Google thật cần OAuth Client ID hợp lệ, bật Classroom API và tài khoản được cho phép. Khi chưa có Client ID, nút đăng nhập bị khóa và website hiển thị hướng dẫn cấu hình.

## Website và mã nguồn

- Website: https://huando200666.github.io/classroom-manager/
- Mã nguồn: https://github.com/huando200666/classroom-manager
- Tải bản cài đặt và mã nguồn ZIP: https://github.com/huando200666/classroom-manager/releases/latest

GitHub Pages phục vụ website đăng nhập Google qua popup. Sau đăng nhập, lớp đang hoạt động được tải tự động; chọn lớp để tải bài tập và xem bài nộp. Học viên chỉ được yêu cầu bài của mình, giáo viên xem dữ liệu được phép trong lớp mình dạy. Có lọc trạng thái, mở tệp trên Google và xuất CSV. Token/dữ liệu chỉ ở RAM; đăng xuất hoặc tải lại trang xóa phiên. Website chưa tải ZIP hàng loạt hoặc chấm Python.

Chủ website đặt repository variable **GOOGLE_CLIENT_ID** trong GitHub Actions rồi triển khai lại. Client ID là mã công khai; không đưa Client Secret vào frontend. Chi tiết tại [GOOGLE-OAUTH.md](docs/GOOGLE-OAUTH.md). Không cần API key hoặc backend để dùng luồng đọc trực tiếp này.

Mỗi lần đẩy mã lên nhánh `main`, GitHub Actions chạy unit/integration tests, build và triển khai website. Thư mục build web là `dist/site`, tách riêng bản tiện ích `dist/extension`. `node_modules`, cache và hồ sơ trình duyệt kiểm thử không đưa vào kho; có thể cài lại thư viện bằng `npm ci`.

```powershell
npm run build:web
npm run preview:web
```

Đường dẫn Vite của bản web được cấu hình cho `/classroom-manager/`. Nếu đổi tên repository, cập nhật `base` của mode `web` trong `vite.config.ts`.

## Tiện ích Chrome/Edge tùy chọn

Phần bên dưới là luồng cũ để tải tệp hàng loạt từ DOM. Website đăng nhập Google không yêu cầu các bước cài tiện ích này. Adapter DOM vẫn cần kiểm chứng thêm trên Classroom thật.

1. Giải nén `release/Classroom-Manager-1.1.0.zip`.
2. Mở `chrome://extensions` hoặc `edge://extensions`.
3. Bật **Chế độ nhà phát triển** → **Tải tiện ích đã giải nén / Load unpacked**.
4. Chọn thư mục **Classroom-Manager** có tệp `manifest.json`.
5. Mở Google Classroom, chọn tài khoản giáo viên, về trang chủ có danh sách lớp.
6. Bấm biểu tượng Classroom Manager → làm mới tab → chọn tab → **Kết nối**.
7. Chọn lớp, bài tập cụ thể → **Quét bài nộp** → kiểm tra số lượng/cảnh báo → **Tải tất cả bài nộp**.

Cũng có thể cài trực tiếp thư mục `dist/extension`. Không mở `index.html` bằng File Explorer để sử dụng phiên Classroom. Website và tiện ích có hai tầng kết nối riêng: Google OAuth/API và Chrome runtime/DOM.

![Giao diện dashboard](docs/dashboard-desktop.png)

## Chức năng tiện ích DOM

- Chọn tab Classroom, đọc tài khoản đang hoạt động, danh sách lớp và bài tập từ DOM.
- Nhận diện tuần 1–15; bài ngoài tuần được chọn trực tiếp theo định danh, không tự chọn khi trùng tên.
- Xác minh tab Bài tập của học viên và liên kết sinh viên thuộc đúng lớp/bài tập trước khi tải.
- Phân loại trạng thái Việt/Anh, lưu riêng trạng thái không xác định, đối chiếu bộ đếm.
- Thu thập các vùng cuộn có thể nhận diện, chờ MutationObserver với giới hạn thời gian.
- Tải tuần tự nhiều tệp của từng bài đã nộp; mặc định ZIP. Có cấu hình RAR, 7Z, PY, IPYNB, PDF, DOCX, XLSX, PPTX.
- Chỉ lấy đính kèm trong vùng bài làm đã xác minh thuộc sinh viên; bỏ vùng tài liệu giảng viên.
- Một tab làm việc trong hàng đợi; tạm dừng, tiếp tục, dừng, thử lại lỗi.
- Chỉ xác nhận hoàn tất bằng Downloads API; phát hiện MIME HTML, gián đoạn và lỗi quyền.
- Tên tệp an toàn cho Windows, đường dẫn tương đối trong Downloads, `uniquify` chống ghi đè.
- Chrome Storage lưu phiên, cấu hình, lịch sử; phục hồi về trạng thái tạm dừng sau khi worker bị ngắt.
- Chỉ bỏ qua bài trùng khi có định danh + phiên bản đã tải thành công. Không có phiên bản thì tải lại.
- Xuất CSV UTF-8 BOM, Excel `.xlsx`, nhật ký JSON có tùy chọn ẩn thông tin cá nhân; tự xuất CSV tổng kết cuối phiên.
- Module chấm Python mới có hợp đồng tích hợp, chưa thực thi mã.

## Mã nguồn và phát triển

Yêu cầu dành riêng cho lập trình viên: Node 22.12+ hoặc Node 24, npm.

```powershell
npm ci
npm test
npm run build
npm run test:e2e
npm run package
```

Playwright cần Chromium. Nếu máy chưa có, chạy `npx playwright install chromium`. Có thể đặt `CM_CHROMIUM_PATH` trỏ đến Chromium hỗ trợ sideload extension. Bản Chrome thương mại mới có thể chặn cờ nạp extension trong automation; dùng Chromium của Playwright cho E2E.

```text
apps/web/                   React + TypeScript, CSS + Tailwind, Lucide
apps/extension/             manifest, content script, service worker
packages/browser-adapter/   điều hướng, timeout, retry khóa tab
packages/classroom-adapter/ DOM, account, course, assignment, student, attachment
packages/google-classroom/ Classroom REST API, phân trang, vai trò, dữ liệu bài nộp
packages/drive-adapter/     tên tệp xem trước, nút tải Drive và kiểm tra mơ hồ
packages/submission-parser/ trạng thái, tuần, phần mở rộng, chữ ký ZIP
packages/download-manager/ hàng đợi, nhận dạng lượt tải, lịch sử
packages/storage/           Chrome Storage, schema v1
packages/shared/            types, tên tệp, CSV, báo cáo, chẩn đoán
packages/grading/           hợp đồng sandbox tương lai
tests/                     unit, integration, e2e và fixtures
scripts/                   build và đóng gói ZIP
docs/                      cài đặt, kiến trúc, kiểm thử, giới hạn
dist/extension/            bản cài được bằng Load unpacked
dist/site/                 website GitHub Pages
public/                    trang quyền riêng tư của website
release/                   ZIP bản cài và mã nguồn
```

## Tài liệu

- [Cài đặt, sử dụng và cập nhật](docs/CAI-DAT.md)
- [Đăng nhập Google trên website](docs/GOOGLE-OAUTH.md)
- [Kiến trúc và quyền riêng tư](docs/KIEN-TRUC.md)
- [Báo cáo kiểm thử](docs/KIEM-THU.md)
- [Lỗi đã xử lý và giới hạn](docs/GIOI-HAN.md)

Website nhận access token do Google cấp sau khi người dùng đồng ý, giữ trong RAM và gọi Google API trực tiếp; không đọc mật khẩu/cookie Google hoặc gửi dữ liệu lớp đến backend riêng. Tiện ích DOM không đọc token. Không thay đổi điểm, trả bài hoặc gửi thông báo; chỉ xem dữ liệu tài khoản được phép truy cập.
