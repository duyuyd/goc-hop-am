# Góc Hợp Âm — bàn giao tiếp tục sau Work 4 giờ 27 phút

> **Trạng thái:** chưa khôi phục mã Sites vào GitHub. Đây là **bản bàn giao bằng chứng**, không phải bản nâng cấp đã phát hành.
>
> **Nguồn:** bản lưu cuộc trò chuyện Work “Xác nhận thay đổi website” do chủ dự án cung cấp (MHTML, thời điểm lưu 2026-11-04 23:14 UTC). Chỉ tóm tắt thông tin công việc, không đăng nguyên bản lưu chứa nội dung tài khoản hoặc lịch sử công cụ lên kho công khai.

## Điểm xuất phát cần giữ

- Dự án duy nhất: Góc Hợp Âm; Sites ID `appgprj_6ae93d0e853c8191bc61999c745a657c`.
- Bản Sites Work **được Work báo cáo** là `v26`; chưa tự xác minh mã nguồn / snapshot v26 trong phiên bàn giao này.
- Website: https://goc-hop-am.onwardcrust.chatgpt.site/
- GitHub `main` tại thời điểm ghi nhận: `913d283eba8e7c29dd1ddf99f7f1d1eeb8372c67` (ứng dụng 1.3.0). **Không coi đây là nguồn mới nhất của Sites.**
- GitHub Actions cho commit này báo cáo build Android/iOS thành công, nhưng không tương đương kiểm thử đầy đủ bản Sites mới nhất.
- Các chỉnh sửa chỉ thấy trong ảnh chụp hoặc Work không được coi là đã hòa vào GitHub.

## Những công việc Work báo cáo đã làm

1. PDF bản phổ gốc đã hiển thị ngay trong bài, ví dụ “Để nhớ một thời ta đã yêu”. Bản PDF không chứng minh được tạo sheet tự động.
2. Luồng lưu bền vững bổ sung giới hạn dung lượng, kiểm tra tệp hỏng; Work báo cáo kiểm thử PDF mở lại khi giả lập mất nguồn với **0 yêu cầu máy chủ**, và tệp hỏng không ghi đè bản tốt.
3. Hàng đợi xử lý trên máy chủ: chống trùng, tối đa ba lần thử lại khi lỗi. Nguồn tìm kiếm mở rộng sang Mutopia. Cần kiểm chứng code, bảng dữ liệu, migration, quyền và luồng triển khai.
4. MIDI thật 905 nốt được Work báo cáo chuyển thành bản phổ và phát theo đoạn có đàn sáng theo nốt. Phải xác minh cao độ, thời lượng, tempo, track/part và UI thực tế.
5. Mô hình nhận dạng âm thanh miễn phí theo Work được đóng gói để xử lý WAV rồi xuất MusicXML; các phần tempo, ô nhịp, lời/hợp âm chưa được xác minh đầy đủ.
6. Có lỗi đã phát hiện ở thao tác đóng/mở lại PDF do API giải phóng tài liệu thay đổi; Work báo cáo đã kiểm thử hồi phục thành công, nhưng chưa xác minh mã fix đã triển khai.
7. Phần cuối đang rà **đổi bản phổ và nhận dạng audio khi thao tác nhanh**. Đây là chỗ phải tiếp tục, không bắt đầu lại bản demo.

## Các giới hạn chưa được giải quyết

- Work không có dữ liệu nốt gốc đầy đủ cho toàn bộ danh mục bài hát. Không suy giai điệu chỉ từ hợp âm rồi gọi đó là bản chép đúng.
- Không xác định được độ chính xác audio → note nếu chưa đánh giá trên tập dữ liệu có ground truth; kết quả thử JSON từng chỉ 3 nốt, có cảnh báo `tempo_estimated`, `lyrics_not_aligned`, `chords_not_verified`.
- Việc căn lời dưới YouTube phải dựa vào cue có kiểm chứng; video có thể không có phụ đề truy cập được.
- Không có bằng chứng 50.000 bài đều có bản sheet, hoặc đủ ba phiên bản melody/piano/organ.

## Bước tiếp theo để tiếp tục nâng cấp

### P0 — Khôi phục và đối chiếu, không ghi đè
- [ ] Từ kết nối Sites đúng ID, lấy version/hash/snapshot mã nguồn + bản sao lưu DB và lưu vị trí checksum; **không chèn secrets vào repo**.
- [ ] So sánh cấu trúc Sites v26 và nhánh GitHub `main`: ghi bảng `path | Sites hash | GitHub hash | status | quyết định`.
- [ ] Kiểm tra các thành phần Work nêu: hàng đợi job, retry, chống trùng, snapshot/PDF cache, âm thanh offline, audio model, parser MIDI, MusicXML và API sheet.
- [ ] Chỉ sau khi xác minh mới port những sửa đổi an toàn qua nhánh tính năng/PR, không force-push, không tự merge.

### P1 — Kiểm thử hồi quy bắt buộc
- [ ] PDF: mở nguồn thật, tải xuống, cache, đóng/mở, thay tệp đang xem, tệp hỏng, offline.
- [ ] MIDI 905 nốt: số nốt, tempo, trường độ/dấu nghỉ, phần/bè, đồng bộ phím đàn, seek và đổi đoạn.
- [ ] MusicXML: các part, clef/key/time, accidentals/ties/rests, xuất PDF và phát lại.
- [ ] WAV → MusicXML: kiểm chứng confidence, phân biệt tổng phổ gốc với nháp AI, chặn kết quả thiếu dữ liệu.
- [ ] Thao tác nhanh: nhiều lần đổi PDF/MIDI/MusicXML/audio; hủy request cũ, không hiển thị sheet bài khác.
- [ ] Sao lưu: thử snapshot phục hồi có kiểm tra checksum, không cần nguồn ngoài.
- [ ] Android: menu, A+/A−, tiếng Việt, khung video và lời bên dưới, bộ ba sheet khi đã có dữ liệu.

### P2 — Nâng cấp sản phẩm sau khi P0/P1 đạt
- [ ] Tìm kiếm đa nguồn + provenance/định danh chống trùng, ưu tiên dữ liệu hợp lệ đã cache.
- [ ] Sheet ở mỗi bài: giai điệu/lời/hợp âm, piano, organ với nhãn nguồn `verified` / `AI draft` / `missing`.
- [ ] Job queue idempotent, giới hạn retry + dead-letter + quota miễn phí theo tải thực.
- [ ] Đo chất lượng theo bộ dữ liệu kiểm chuẩn; không hứa độ chính xác khi chưa đo.

## Điều kiện phát hành

Không tạo dự án thay thế; không lấy GitHub 1.3.0 ghi đè Sites v26; giữ dữ liệu và quyền quản trị; không thêm chi phí hoặc tự phát hành mới. Yêu cầu snapshot, báo cáo kiểm thử, kiểm tra quyền và sự chấp thuận trước merge/deploy. Mọi hạng mục chưa kiểm chứng giữ trạng thái **blocked** hoặc **needs validation**, không đánh dấu done.

Theo dõi: https://github.com/duyuyd/goc-hop-am/issues/1
