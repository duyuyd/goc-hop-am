# Tra bản phổ · Góc Hợp Âm

- `/ban-pho/` mở thư viện bản phổ có giấy phép, gồm PDF, ảnh và MusicXML. `node scripts/sync-open-sheets.mjs` làm mới danh mục từ các nguồn đã cấu hình.
- `/sheet/?genre=nhac-tre` lọc theo nhạc trẻ. `/ban-pho/#mo-pdf` đi tới nút mở PDF trên thiết bị.
- Các phiên bản cùng tên bài và nhạc sĩ nằm trong một kết quả với liên kết riêng cho mỗi nơi đăng. Định dạng `sheet-page` mở trang tại nguồn. Định dạng `pdf-direct` trỏ tới PDF đã kiểm tra, có nguồn và giấy phép.
- Tìm theo tên bài hoặc nhạc sĩ có dấu và không dấu. Khi thêm dấu nguồn, ghi đúng phạm vi đã đối chiếu. Ví dụ một dấu trên ảnh có thể dẫn tới thư viện của người soạn, còn một bài đăng cụ thể cần URL của chính bài đó.

Chạy `node --test tests/pdf-library.test.mjs tests/sheet-federation.test.mjs tests/sheet-catalog.test.mjs tests/sheet-ui-smoke.test.mjs` để kiểm tra các đường dẫn và bộ lọc.
