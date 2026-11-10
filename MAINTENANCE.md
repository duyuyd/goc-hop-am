# Góc Hợp Âm — vận hành đã được chủ website yêu cầu

Giữ project_id trong .openai/hosting.json, D1 DB, R2 BUCKET, tài khoản và trạng thái truy cập hiện có. Không tạo dự án khác hoặc mua dịch vụ.

## Cập nhật dữ liệu hằng ngày

Đọc URL hiện tại từ Sites get_site. Gọi GET /api/catalog?mode=home và /api/catalog?mode=latest trên chính website. Các endpoint này cập nhật bản lưu D1 theo yêu cầu; không cần phiên hay quyền quản trị khi website đã công khai. Xác minh JSON có items/checkedAt, kiểm tra stale và HTTP status. Không thay dữ liệu thật bằng kết quả giả nếu nguồn lỗi; bản lưu cũ được giữ. Thử lại có giới hạn, không đổi danh tính truy cập hoặc vượt biện pháp chặn của nguồn.

## Kiểm tra mã nguồn mỗi thứ Hai

Mở đúng repository của Site bằng workflow chuẩn, đọc PROJECT_STATUS.md và git status trước khi thay đổi. Kiểm tra các cảnh báo dependency thực sự liên quan đến runtime (bao gồm Vinext/React Server Components dù nằm trong devDependencies), và lỗi server mới. Bản vá phù hợp phải qua kiểm tra TypeScript, tests/*.test.mjs cần thiết và build Sites trước khi triển khai cùng Site. Không dùng audit fix --force hoặc hạ phiên bản mù quáng để làm mất cảnh báo. Nếu không có lỗi/cập nhật cần thiết thì không tạo commit hoặc triển khai lại. Nếu thiếu quyền hoặc môi trường kiểm tra thì báo rõ, giữ bản đang chạy.

## Ranh giới thanh toán và quyền truy cập

Không tự đổi giá, duyệt thanh toán, mở quyền tải cho khách, thay QR, đổi mật khẩu quản trị, mua/gắn tên miền chưa xác minh hoặc đổi audience. Chủ website tự đặt giá và xác nhận đã nhận tiền trong Admin. Google chỉ được bật bằng Web Client ID của chủ website đã cấu hình đúng origin. Không lấy client ID của ứng dụng khác.

PDF đầy đủ chỉ ở R2 riêng; không chép vào public, client bundle hoặc source maps. Không ghi cookie, token, mật khẩu, số điện thoại đầy đủ hoặc QR payload vào Git, prompt lịch, log hay báo cáo. API nạp kho ban đầu và STORE_SETUP_TOKEN phải được gỡ trước khi công khai; không phục hồi chúng trong bảo trì thường kỳ.

Báo cáo ngắn kết quả cập nhật và các lỗi cần người dùng xử lý. Không bảo đảm chống được mọi cuộc tấn công hoặc sẽ được công cụ tìm kiếm đề xuất.


## Địa chỉ Pages chính từ 04/11/2026

Người dùng truy cập https://gochopam.pages.dev/ . Sites get_site vẫn trả URL backend https://goc-hop-am.onwardcrust.chatgpt.site; giữ backend public và nguyên DB/R2 vì Pages chuyển tiếp đến nó. Các yêu cầu tự động catalog home/latest vẫn chạy ở backend như cũ. Không tạo project hoặc schedule thay thế. PUBLIC_SITE_ORIGIN và GOOGLE_SITE_VERIFICATION là runtime config; giữ các giá trị khi triển khai, không ghi mật khẩu/token vào source. Đọc mục mới nhất trong PROJECT_STATUS.md trước khi xử lý Search Console; không tự gửi lặp yêu cầu indexing đang bị quota.


### Mobile 1.2 public-source boundary

Public GitHub: https://github.com/duyuyd/goc-hop-am (owner duyuyd). Sync only mobile/android, mobile/ios, public/mobile, required scripts/mobile tests and workflow; root public README derived from mobile/GITHUB_README.md. Never sync .openai, server/backend/private project notes, DB, env, signed keys or user recordings. Public repo source head at preparation: 2a8be2f8a7a76eeea6cd326c839893423d3d2661.

Android versionCode3/versionName1.2.0 uses existing .preview certificate. Do not regenerate key for an update. Native record outputs stay private to device. MediaProjection has fresh OS consent and visible stop notification; no automatic start. Player WebView has no app storage/recording bridge. Voice follows only if on-device vi-VN recognition supported. iOS CI is in public repo; Simulator and unsigned device outputs do not count as iPhone install or App Store submission.

Release v1.2.0 is public: https://github.com/duyuyd/goc-hop-am/releases/tag/v1.2.0. GitHub release workflow run41837377478 passed Android and iOS including upload steps. Device IPA remains unsigned; Simulator ZIP is for Xcode only. Site version23 successfully publishes mobile1.2/download link/GitHub at env revision4. New capture/voice needs real-device tests; cloud browser YouTube playback buffered, so do not treat UI QA as successful audio/video playback or recording.
