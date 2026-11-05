# Handoff có kiểm soát — Góc Hợp Âm Sites v26+ / PDF / React (06-11-2026)

## SOURCE OF TRUTH (không thay thế)
- ChatGPT Sites Project ID: `appgprj_6ae93d0e853c8191bc61999c745a657c`
- Live site: https://goc-hop-am.onwardcrust.chatgpt.site/
- GitHub: https://github.com/duyuyd/goc-hop-am — `main` hiện chứa ứng dụng mobile cũ; tuyệt đối không dùng để ghi đè Sites.
- `recovery/sites-v26-handoff` chứa tài liệu handoff, **chưa được chứng minh** chứa toàn bộ source Sites v26+.
- `feat/sheet-pdf-library-parity` là nhánh mã PDF song song, chưa được triển khai.

## Đã có nguồn và kiểm thử
- Tính năng /sheet/ tĩnh trên nhánh này: 8 nguồn; 5 URL PDF Mutopia được kiểm tra mở bản phổ; 6 trang sheet tiếng Việt, không lưu PDF của các trang bên ngoài. Tìm không dấu, lọc nguồn/thể loại/định dạng, và API Sites ở chế độ đọc có fallback.
- Ngày 06/11 người dùng đưa ZIP của ứng dụng React AI Studio. Một bản sửa độc lập đã hoàn thiện trong cuộc trò chuyện: sửa mất menu ở 768–1279px, thanh tìm kiếm từ mọi tab quay lại catalog, thay pipeline mô phỏng tạo nhạc/điểm 95 bằng tra bản phổ đúng nguồn, không tự tạo lời/nốt giả.
- Đã chạy **9/9 test local** (5 thư viện sheet + 4 regression React), kiểm cú pháp AST trên 18 TS/TSX (0 syntax error).
- **Không được kết luận QA build đạt**: React `npm run build` chưa chạy thành công do thiếu dependencies trong môi trường; chưa có E2E.
- Trên nhánh GitHub này thêm test `tests/sheet-ui-smoke.test.mjs`; test GitHub chưa chạy qua CI, không được tuyên bố đạt.

## Trước khi cập nhật website thật
1. Mở đúng project Sites `appgprj_6ae93d0e853c8191bc61999c745a657c` trong phiên Work/Sites có quyền, xác minh đúng website và trạng thái riêng tư. **Không tạo website mới.**
2. Sao lưu source và assets hiện tại, ghi lại revision/hash. Nếu không truy cập được source thì **dừng bước deploy**; không lấy GitHub/ZIP cũ khôi phục đè.
3. Đối chiếu routes hiện có (`/sheet/`, `/tai-lieu`, trang chi tiết bài, `/api/catalog`) với module PDF. Chỉ áp dụng diff nhỏ, giữ song, MIDI, audio analysis, PDF và dữ liệu chưa commit.
4. Tích hợp đúng vào navbar/mobile, chi tiết bài, trả kết quả PDF đúng tên + nhạc sĩ và đánh dấu rõ `pdf-direct` vs `sheet-page`. Cho iframe PDF fallback mở ở tab nguồn.
5. Bảo đảm không dùng mô phỏng Auto Sheet 95% hoặc `setInterval` làm bằng chứng tạo bản phổ thật.
6. Chạy build, test search có/không dấu, CORS, PDF tải trên Android/iPhone, kiểm link, quyền quản trị, không phát sinh chi phí, không tăng mức công khai.
7. Khi chỉ khi đủ bằng chứng môi trường preview và bản rollback: cập nhật **chính project Sites** và báo URL thật + revision; không đổi cấu hình quảng cáo.

## Chặn tác vụ sai hệ thống
- WebsitePublisher hiện chỉ quản lý project `31999` tên `My First Project`; mọi page write ở đây sẽ live trên website khác nên KHÔNG dùng để phục hồi Sites.
- TinyFish Browser Context Profile mặc định chưa ghi nhận đăng nhập ChatGPT Sites; các agent browser step tính phí, không chạy khi người dùng không chấp thuận chi phí.
- Ads Manager thuộc hệ thống quảng cáo, không chỉnh mã nguồn Sites.
- Sheet Music Analysis cần PDF/MusicXML bản nhạc thật; Music as Code tạo tài liệu âm nhạc riêng, không tự triển khai website.

Đây là **hồ sơ bàn giao với mã GitHub nhánh nháp**, không phải lời xác nhận đã cập nhật site live.
