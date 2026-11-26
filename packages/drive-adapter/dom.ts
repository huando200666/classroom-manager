import { normalize, isTruncated, extension } from '../submission-parser';

/** Chỉ đọc thông tin đang hiện diện trong giao diện xem trước Drive. */
export function readDriveName(doc: Document) {
  const candidates = [
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content'),
    ...Array.from(doc.querySelectorAll('h1,[data-file-name],[title]')).map(
      (e) => e.getAttribute('data-file-name') || e.getAttribute('title') || e.textContent?.trim(),
    ),
    doc.title.replace(/\s*[-–]\s*Google Drive\s*$/i, ''),
  ];
  return candidates.find((s): s is string => !!s && !isTruncated(s) && !!extension(s));
}

/** Nếu có nhiều nút tương ứng thì không tự chọn. Không bấm xác nhận bảo mật. */
export function findDriveDownloadButton(doc: Document) {
  const buttons = [
    ...doc.querySelectorAll<HTMLElement>('button,[role="button"],a[download]'),
  ].filter((el) => {
    if (el.closest('[hidden],[aria-hidden="true"]')) return false;
    const style = doc.defaultView?.getComputedStyle(el);
    if (style?.display === 'none' || style?.visibility === 'hidden') return false;
    const label = el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '';
    return (
      /^(download|tai xuong)(\s*\([^)]*\))?$/.test(normalize(label)) &&
      !el.hasAttribute('disabled') &&
      el.getAttribute('aria-disabled') !== 'true'
    );
  });
  return buttons.length === 1 ? buttons[0] : undefined;
}
