# Góc Hợp Âm: lộ trình nghiệm thu P0–P5 trên đúng Sites hiện tại

> 2026-11-05 — tài liệu triển khai **chưa phải bằng chứng đã triển khai**. Sites ID: `appgprj_6ae93d0e853c8191bc61999c745a657c`.
> Site đang phát triển: https://goc-hop-am.onwardcrust.chatgpt.site/
> `main` GitHub 1.3.0 là ảnh mã cũ, không phải bản sao chắc chắn của Sites v26. **Không tự merge, không triển khai, không xóa hoặc thay thế Sites hiện tại**.

## Trạng thái bằng chứng

| Khả năng | Đã xác minh | Cần xác minh trước triển khai |
|---|---|---|
| GitHub Android / iOS | GitHub Actions `41889116459` báo build success trên commit `913d283` | Khả năng cài đặt, quyền camera/mic, độ ổn định thiết bị thật |
| GitHub sheet cũ | Bộ biên soạn 4/4 một bè; 128 nốt và phát thử | Chức năng tương ứng ở Sites v26 mới hơn |
| P1 catalog helpers | 5 bài kiểm thử Node địa phương đạt cho hàm chuẩn hóa và tìm kiếm ở `lib/catalog-identity.mjs` | Cắm vào backend/sites sau khi đối chiếu version, đánh chỉ mục dataset thật, stress-test |
| P2 Sites Work | Lưu Work báo cáo thử PDF mở lại offline, MIDI 905 nốt, audio model | Snapshot mã nguồn, database và bản ghi thực chứng chưa đọc trực tiếp |
| ASVS 5.0.0 | Có checklist bên dưới | Chưa có bằng chứng đạt/chứng nhận ASVS |
| Ba loại sheet | Có trạng thái `melody`, `piano`, `organ` trong helper P1 mới | Chưa có ba bản sheet thực cho mỗi bài |

## P0. Thứ tự khôi phục và chặn ghi đè

1. Từ **chính** Sites project ID trên, đọc deployment version, commit/snapshot và export mã, migration, cấu hình lược đồ, assets, metadata phiên bản. Khóa quyền admin về đúng chủ sở hữu. Tuyệt đối không đưa session, token, mật khẩu, signing key hay dữ liệu cá nhân vào GitHub công khai.
2. Snapshot nhất quán DB + file stores; tạo manifest checksums SHA-256, bản ghi schema + ngày; thử khôi phục vào môi trường kiểm thử **tách dữ liệu** rồi so sánh kiểm kê và checksum. Không coi tải file về là thử phục hồi thành công.
3. So sánh Sites snapshot với GitHub `main`: `path | Sites checksum | GitHub checksum | quyết định giữ/chuyển | nguy cơ`. Dùng Sites làm nguồn đúng cho bản mới; chỉ cherry-pick thay đổi GitHub đã kiểm thử.
4. Chạy smoke test read-only: menu di động, Unicode tiếng Việt, A+/A−, mục lục, căn hợp âm, video khung nhỏ, tìm kiếm, các trang Admin/bài hát, lưu offline.
5. Chỉ sửa trên nhánh staging/preview có backup. Không tự công khai nội dung lỗi hoặc mất chức năng.

## P1. Music Catalog độc lập với nguồn

Mô hình danh mục:
- `work` (tác phẩm: mã bền vững, tên hiển thị, tên tìm kiếm chuẩn hóa NFC/NFD/bỏ dấu, tác giả), `recording` (bản thu + phiên bản), `source_record` (nguồn/ID, license, attribution, URL, fetched_at, hash), `sheet_revision` (format, variant, trạng thái, confidence, checksum, số nốt/part, bộ kiểm định).
- Ba loại sheet `melody / piano / organ` có trạng thái rõ `verified / ai_draft / missing / unknown`. Một bản AI chỉ được đánh dấu verified sau kiểm tra đủ căn cứ. PDF scan khác với MusicXML; không gọi PDF chỉ chứa ảnh là sheet editable.
- Tìm kiếm chuẩn hóa Unicode, tiếng Việt không dấu, gần đúng, theo tác phẩm/nghệ sĩ/tác giả; phân trang có cursor; tránh phân trang theo thứ tự không ổn định.
- Gộp theo `workId` đáng tin cậy hoặc tác phẩm + tác giả; tránh gộp nhầm hai tác phẩm tên giống nhau; **không dùng fuzzy match để tự hợp nhất**.
- `lib/catalog-identity.mjs` mới chỉ là helper độc lập chưa nối API. Bài thử kiểm 1.000 bản ghi chứng tỏ không hard-code 30, không chứng tỏ 1.000 bài có sheet. Backend cần index DB và đo thời gian trên dữ liệu thực.

## P2. Pipeline Auto Sheet: không suy diễn giai điệu

1. Chọn và khóa `workId / recordingId / variant / source-hash`. Tra kho **đã lưu** trước (verified ưu tiên), không gọi mạng mỗi lần mở.
2. Nếu chưa có, tìm tuần tự nội bộ → danh mục đối tác/nguồn cho phép tải và lưu, ghi license, attribution, provenance; xử lý MusicXML, MIDI, PDF phù hợp. PDF chỉ là ảnh cần OMR và đối soát.
3. Với audio được phép xử lý: chọn mono polyphonic model theo loại input; tách bè, VAD/onsets, tempo/beat grid, quantize có điều kiện, rests, ties, key, hợp âm, lời có cue tin cậy, MusicXML có part; so sánh playback với input.
4. Kiểm định cấu trúc MusicXML, số nốt, tempo, những ô nhịp lỗi, khả năng render và replay; đo note precision/recall/F1, onset tolerance, beat/downbeat, lyric alignment trên bộ ground truth độc lập; lưu confidence từng part.
5. Không đủ thông tin giai điệu → `missing` và job chờ nguồn; đầu ra AI chưa nghiệm thu → `ai_draft`, không trình bày như original.
6. Hàng đợi job có khóa idempotency theo work/recording/revision, các trạng thái queued/running/succeeded/failed, retry có backoff và giới hạn, dead-letter, timeout, cancel/replay-safe; đánh dấu checksum trước/ sau mỗi ghi. Chặn quá tải bằng ngân sách tài nguyên và giới hạn free tier (chặn job mới, không tự mua tài nguyên).
7. Mỗi đầu ra có lưu bền vững + audit revisions; độc lập thay đổi nguồn ngoài. Không tự nhận dữ liệu nguồn thứ ba là sáng tác của Góc Hợp Âm. Giao diện có thể mang toàn bộ thương hiệu Góc Hợp Âm nhưng giấy phép/ghi công nguồn gốc bắt buộc vẫn được giữ.

## P3. Luyện tập và chất lượng trải nghiệm

- Đồng hồ audio/video dùng chung cho sheet highlighting + piano/organ/guitar, seek, loop A-B, speed, transpose và karaoke; hủy request cũ khi đổi bài/tệp nhanh; không để phát nốt/hiển thị sheet từ bài khác.
- Mobile: viewport 360–430 px, menu ba gạch, A+/A−, không tràn chữ, giảm diện tích YouTube không che lời; thao tác chạm tối thiểu 44px; hỗ trợ orientation và Android WebView / iOS WKWebView.
- Camera/micro/screen record phải có thao tác người dùng, quyền rõ, ghi vào bộ nhớ riêng; dữ liệu user-private không tự đăng.
- Offline: cache chỉ những mục được phép lưu, có checksum, bản tốt cuối cùng, rollback và chỉ báo trạng thái offline.

## P4. An toàn, nguồn gốc và chống thất thoát dữ liệu

- Kiểm thử và ghi mapping theo OWASP ASVS **5.0.0** với phiên bản yêu cầu, mục tiêu ASVS L2 cho API/auth; phạm vi bị loại trừ ghi riêng. Không gọi đạt chuẩn khi chưa kiểm tra đủ.
- Auth: Admin MFA, session/cookie Secure/HttpOnly/SameSite, rotate/revoke, RBAC/IDOR test ở mọi API admin, CSRF; password reset/recovery.
- Input/API: XSS output encoding, parameterized DB queries, allowlist fetch URL + IP/network/redirect/size/time checks để tránh SSRF; upload whitelist file magic/MIME/content, size/decompression cap, random file name, private storage, malware scanning nếu có.
- Rate limit per user/IP/route, bot-defense & quota, audit logs, secret vault, dependency scanning/SBOM, signed releases, workflows least privilege, protected branch.
- Lưu bản gốc upstream license, URL, creator, hash, thời gian, quyền phân phối/biến đổi, revision; hạn chế export hàng loạt bằng RBAC/throttling, nhưng không xóa attribution cần thiết.
- Giám sát sức khỏe bằng số job lỗi, data integrity, backup age và restore drill, không lưu nội dung ghi âm người dùng trong logs.

## P5. Cổng nghiệm thu và bằng chứng bắt buộc

Không được đánh dấu DONE nếu thiếu:
- [ ] version + snapshot Sites & checksum backup verified by restore drill
- [ ] tests unit/integration/e2e & Android/iOS device logs với commit/build ID
- [ ] truy vấn kho thực: số bài distinct, số verified melody/piano/organ, AI drafts, missing
- [ ] dữ liệu âm thanh ground truth có precision, recall, onset F1, sai nhịp, số sample, CI
- [ ] load/concurrency + fault injection: nguồn ngoài down, trùng job, 429, timeout, corrupt PDF, offline
- [ ] audit ASVS 5.0.0 theo control IDs + findings còn mở, dependency report
- [ ] release gate: owner xác nhận trước merge/publish, không phát sinh trả phí

## Nguồn kỹ thuật được đối chiếu

- [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/v5.0.0)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [MusicXML duration units](https://www.w3.org/2021/06/musicxml40/musicxml-reference/elements/duration/)
- [OpenSheetMusicDisplay — MusicXML rendering, không phải editor](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay)
- [Spotify Basic Pitch — best one instrument at a time](https://github.com/spotify/basic-pitch)
- [Magenta MT3 — multi-instrument research, resource costs cần đo](https://github.com/magenta/mt3)
- [Audiveris OMR — AGPL, cần xem xét trước khi tích hợp](https://github.com/Audiveris/audiveris)
- [Mutopia Project — các tác phẩm có giấy phép khác nhau](https://www.mutopiaproject.org/)
- [Creative Commons attribution](https://creativecommons.org/faq/)
