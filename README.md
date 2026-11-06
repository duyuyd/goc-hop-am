# Góc Hợp Âm · Website và Android/iOS (QA 1.3.3)

**Tác giả dự án & người lập trình: NPT Duy.**

Tra bài hát, đọc hợp âm, đổi tông, lưu ngoại tuyến và tập cùng YouTube.

- [Website](https://gochopam.pages.dev/)
- [Tải APK Android miễn phí](https://gochopam.pages.dev/ung-dung/)
- [Bản phát hành](https://github.com/duyuyd/goc-hop-am/releases)
- [Trạng thái biên dịch thực tế](https://github.com/duyuyd/goc-hop-am/actions)

## Bản thử 1.3.3: website + ứng dụng sử dụng được khi Sites mất kết nối

- **Kho bài trên máy:** 12 bài **tập hợp âm nguyên bản** đóng gói vào `bundle.js`, không cần truy cập Sites. Đây là bài tập, không được gọi là sheet chuẩn của ca khúc thương mại.
- **Bài cá nhân:** người dùng tự thêm tiêu đề, tác giả, tông, lời và hợp âm. Lưu tại thiết bị; tìm kiếm có dấu/không dấu NFC/NFD, đổi tông, cuộn chữ, luyện tập không cần mạng.
- Lưu tối đa 1.000 mục trong ngân sách dữ liệu tối đa 2 MB (ưu tiên giới hạn dung lượng thực tế), giữ nguyên bản đã lưu từ các phiên trước.
- Tìm trực tuyến với Sites vẫn còn, nhưng không chặn giao diện khi mạng lỗi. YouTube và kho bài chưa tải vẫn cần Internet.
- **Dùng chung code web/app:** `public/mobile/index.html`, `bundle.js`, `app.css`; bản web cục bộ qua `npm start` (Node/Express) và ứng dụng có giao diện được đóng gói bên trong.
- **Lưu ý:** cập nhật GitHub/QA APK **không tự cập nhật** Sites project `appgprj_6ae93d0e853c8191bc61999c745a657c`. Để triển khai đúng Sites hiện tại phải có quyền chỉnh sửa Sites, không lấy nhánh GitHub ghi đè.
- Kiểm thử: `npm test`; xây giao diện đóng gói: `node mobile/scripts/prepare-web.mjs`; chạy web thử ở `http://localhost:3000` bằng `npm start`.

## Lịch sử bản 1.3.0

- Đọc phụ đề JSON3, XML, SRT, VTT và LRC; sửa nhận dữ liệu YouTube và báo rõ trường hợp bị chặn / rỗng / không có phụ đề. Phụ đề chèn vào hình không phải tệp mốc lời. Có chọn tệp, chỉnh lệch mốc và đánh dấu câu; không dùng micro để đoán lời video.
- Kéo chỉnh khung YouTube 200–420 px để chừa chỗ đọc lời. Khung video vẫn hiển thị khi nghe.
- 144 hợp âm có tiếng mẫu, gam trưởng và vòng hòa âm; piano chạm để chơi và sáng theo nốt khi phát sheet.
- Soạn sheet một bè nhịp 4/4, in / lưu PDF, sao lưu JSON và chỉnh từng nốt. Nhận sheet nháp từ tệp hát/đàn một bè: dưới 3 MB, tối đa 60 giây / 128 nốt mỗi lần. Xử lý trên máy, cần nghe lại và chỉnh, không nhận chính xác bản phối nhiều nhạc cụ.
- Nhật ký luyện tập trên máy; liên kết mở MuseScore, IMSLP và Musopen để tìm sheet. Chưa nhập toàn bộ thư viện bên ngoài.
- Website có thể thêm ra màn hình chính. Bài đã lưu và công cụ luyện nhạc mở ngoại tuyến sau lần tải đầu; YouTube và tra cứu trực tuyến cần mạng.

Phần thu âm, quay màn hình và camera của 1.2.1 được giữ nguyên. Bản ghi không tự tải lên website hoặc GitHub. Theo lời chỉ hoạt động tự động khi nhận được phụ đề công khai khớp với bài; có phụ đề hiển thị trong YouTube không bảo đảm máy chủ nhận được dữ liệu.

© 2026 NPT Duy. Xem [Thông tin tác giả](COPYRIGHT.md). Chữ “chưa ký” của IPA/AAB là trạng thái gói cài đặt.

## Android

Android 8 trở lên. APK phát hành trực tiếp dùng gói `vn.gochopam.app.preview`; cùng khóa ký các bản 1.0/1.1, versionCode 5 để cập nhật giữ bài đã lưu. Khóa ký không nằm trong kho này. Đây là bản thử nghiệm, chưa phát hành trên CH Play.

```sh
node mobile/scripts/prepare-web.mjs
node --test tests/mobile.test.mjs
gradle -p mobile/android :app:bundleRelease
```

Dùng JDK 17, Gradle 8.13, Android SDK 36. AAB production `vn.gochopam.app` chưa ký bằng upload key. Script SDK độc lập trong `mobile/scripts/build-android.py` cũng có thể build khi cung cấp SDK, ECJ, bundletool và khóa thử nghiệm riêng; không tạo đè khóa đang dùng để cập nhật app.

## iOS

Mở `mobile/ios/GocHopAm.xcodeproj` bằng Xcode. Target iOS 16 trở lên. Không cần CocoaPods. GitHub Actions biên dịch bản Simulator và bản thiết bị chưa ký; kết quả thực tế xem tại Actions.

```sh
node mobile/scripts/prepare-web.mjs
xcodebuild -project mobile/ios/GocHopAm.xcodeproj -scheme GocHopAm \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath mobile/build/ios-simulator CODE_SIGNING_ALLOWED=NO build
```

**IPA chưa ký không cài trực tiếp lên iPhone và chưa phải bản App Store.** Để cài/phân phối, chủ sở hữu cần chọn Apple Team/chứng chỉ/provisioning của mình trong Xcode. Tệp Simulator chỉ dành cho Xcode Simulator. Không đưa chứng chỉ, mật khẩu hoặc khóa ký vào kho công khai.

## Phạm vi mã nguồn

Kho GitHub hiện chứa giao diện web/native, Node Express `server.mjs` với danh mục dữ liệu **mẫu**, và bộ xử lý sheet thử nghiệm. **Đây không phải backend, cơ sở dữ liệu, tài khoản hoặc file PDF thực của Sites**. Dữ liệu mà người dùng lưu trên app nằm riêng trên thiết bị; không tự đồng bộ lên tài khoản. Tập bài tập gốc đi kèm không có nghĩa mọi bài hát đều có sheet đã xác minh.

Không có số liệu cài đặt/người dùng giả. Phiên bản, checksum APK và dung lượng thật được công bố tại [`android-release.json`](https://gochopam.pages.dev/downloads/android-release.json); kết quả build và commit xem trong Actions.
