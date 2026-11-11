# Tra bản phổ · Góc Hợp Âm

- `/ban-pho/` mở thư viện bản phổ có giấy phép, gồm PDF, ảnh và MusicXML. `node scripts/sync-open-sheets.mjs` làm mới danh mục từ các nguồn đã cấu hình.
- `/sheet/?genre=nhac-tre` lọc các trang bản phổ nhạc trẻ tại nguồn. Định dạng `sheet-page` giữ liên kết gốc. Định dạng `pdf-direct` trỏ tới PDF đã kiểm tra, có nguồn và giấy phép.
- Tìm theo tên bài hoặc nhạc sĩ có dấu và không dấu. Chỉ ghép bản phổ vào kết quả kho bài khi cả tên bài và nhạc sĩ khớp.

Chạy `node --test tests/pdf-library.test.mjs tests/sheet-federation.test.mjs tests/sheet-catalog.test.mjs tests/sheet-ui-smoke.test.mjs` để kiểm tra các đường dẫn và bộ lọc.
