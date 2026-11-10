# Chuẩn bị đưa Góc Hợp Âm 1.1 lên cửa hàng

Đây là hồ sơ chuẩn bị, chưa phải xác nhận app đã nộp hoặc đã được duyệt.

| Mục | Trạng thái hiện tại |
| --- | --- |
| APK cài thử Android | Có, chữ ký debug; gói `.preview` riêng |
| Android App Bundle | Có, cấu trúc hợp lệ; chưa ký khóa upload của chủ app |
| Dự án iOS và scheme Archive | Có mã Swift, Xcode project, assets, cấu hình iPhone/iPad |
| IPA / TestFlight | Chưa: cần macOS/Xcode, Team và ký của Apple Developer |
| Tên, mô tả tiếng Việt, review notes | Có trong `listing-vi.json` |
| Biểu tượng | Có trong Android resources và iOS Assets.xcassets |
| Ảnh màn hình cửa hàng | Chưa: chụp từ bản chạy trên từng thiết bị/Simulator; không dùng ảnh web giả làm bằng chứng native |
| Email hỗ trợ công khai, tên người phát hành | Cần chủ app chọn |
| Play Console / App Store Connect | Chưa đăng nhập để tạo bản ghi ứng dụng hoặc tải binary |
| Chấp thuận/phát hành | Chưa gửi, do cửa hàng quyết định |

## Thông tin cửa hàng phải chốt

- Xác nhận tên người/pháp nhân đứng tên app; loại tài khoản cá nhân/tổ chức và lãnh thổ phát hành. Không tự dùng tên hoặc giấy tờ trong lịch sử chat.
- Kiểm tra `vn.gochopam.app` còn dùng được; tên gói và Bundle ID không đổi sau khi đã chốt/phát hành.
- Chọn email hỗ trợ công khai, URL quyền riêng tư và hình thức tiếp nhận yêu cầu dữ liệu phù hợp. URL hỗ trợ hiện tại là trang hướng dẫn của website; cần bổ sung đầu mối liên hệ người dùng trước khi nộp.
- Trả lời độ tuổi, quyền đối với nội dung, đánh giá nội dung và App Privacy / Data Safety theo ứng dụng và việc vận hành backend thực tế. Không đánh dấu “không thu thập dữ liệu” chỉ vì app không có tài khoản. Từ khóa tìm kiếm được gửi tới backend, có bộ nhớ đệm và hạ tầng có thể có nhật ký IP.
- App không tự chèn quảng cáo, không analytics SDK, không thu âm, không quyền nhạy cảm, không nội dung PDF trả phí/QR trong binary này. YouTube được nhúng khi bấm nghe và có thể có quảng cáo/dữ liệu của YouTube; cần khai báo theo tích hợp hiện tại. Nếu bổ sung tài khoản hoặc thanh toán về sau phải hoàn tất luồng tương ứng trước khi gửi bản cập nhật.
- Kiểm thử thực tế mạng chậm, mất mạng, lưu/xóa, khởi động lại, tự cuộn, nhịp và gián đoạn âm thanh. Không coi kiểm thử bản web là kiểm thử iOS/Android đã hoàn tất.

## Lộ trình nộp

Android: ký AAB bằng upload key do chủ app giữ → Internal testing → tải/chạy trên máy thật → hoàn thiện listing và khai báo → Closed testing khi tài khoản yêu cầu → xin production → gửi duyệt.

iOS: build/chạy Simulator và iPhone → chọn Team/Bundle ID → Archive và ký → tải App Store Connect → TestFlight → hoàn thiện listing, privacy và đánh giá nội dung → gửi App Review. Không có bảo đảm Apple chấp nhận chỉ vì gói build được.

Thông tin được kiểm tra ngày 04/11/2026: Play Console có phí đăng ký một lần 25 USD; Apple Developer Program thông thường 99 USD mỗi năm hoặc giá địa phương. Không tự đăng ký hoặc thanh toán. Tài khoản Play cá nhân mới thuộc diện áp dụng phải có ít nhất 12 tester tham gia liên tục 14 ngày trước khi xin production; Google có thể yêu cầu thêm thông tin xác minh. Đọc lại yêu cầu trong chính tài khoản khi nộp.

Nguồn chính thức:
- https://support.google.com/googleplay/android-developer/answer/6112435
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://developer.apple.com/programs/whats-included/
- https://developer.apple.com/app-store/review/guidelines/#minimum-functionality
- https://developer.android.com/build/releases/agp-8-13-0-release-notes
