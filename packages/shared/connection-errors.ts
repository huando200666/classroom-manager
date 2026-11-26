function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function missingReceiver(error: unknown) {
  return /receiving end does not exist|could not establish connection/i.test(message(error));
}

/** Chỉ dịch lỗi đường truyền; giữ nguyên lỗi nghiệp vụ từ Classroom/Drive. */
export function connectionError(error: unknown, target: 'app' | 'page' = 'page') {
  const raw = message(error);
  if (/extension context invalidated/i.test(raw) || (target === 'app' && missingReceiver(error))) {
    return 'Tiện ích vừa được cài lại hoặc cập nhật. Đóng trang Classroom Manager này rồi mở lại bằng biểu tượng tiện ích. Nếu vẫn lỗi, vào trang quản lý tiện ích và nhấn Tải lại.';
  }
  if (missingReceiver(error)) {
    return 'Chưa kết nối được với tab Classroom/Drive. Nhấn F5 ở tab đó, kiểm tra quyền truy cập trang của tiện ích rồi kết nối lại.';
  }
  if (/message port closed|message channel closed|receiving end.*closed/i.test(raw)) {
    return 'Tab đã chuyển trang hoặc ngắt kết nối khi đang xử lý. Thử kết nối lại; nếu đang tải tệp, kiểm tra Downloads trước khi thử lại để tránh tải trùng.';
  }
  if (/no tab with id|invalid tab id/i.test(raw)) {
    return 'Tab Classroom/Drive đã đóng. Làm mới danh sách tab và chọn lại tab đang mở.';
  }
  return raw;
}
