# Góc Hợp Âm · Android & iOS 1.4.0

**Tác giả dự án & người lập trình: NPT Duy.**

Tra bài hát, đọc hợp âm, đổi tông, lưu ngoại tuyến và tập cùng YouTube.

- [Website](https://gochopam.pages.dev/)
- [Tải APK Android miễn phí](https://gochopam.pages.dev/ung-dung/)
- [Bản phát hành](https://github.com/duyuyd/goc-hop-am/releases)
- [Trạng thái biên dịch thực tế](https://github.com/duyuyd/goc-hop-am/actions)

## Bản 1.4.0

- Bản phổ nằm ngay ở từng bài và có kho bản phổ riêng. Hiển thị PDF nguồn bằng bộ đọc PDF cục bộ trong web/Android/iOS, giữ nguyên nốt, nhịp, dấu nghỉ và thông tin tác giả trong tệp. Chọn phiên bản, chuyển trang, phóng to và mở PDF để in/lưu.
- Tìm bản phổ theo cùng mã bài trong kho kết nối; danh sách bản phổ có phân trang. Không yêu cầu người nghe tự tải tệp lên để xem bản phổ đã có.
- Bài thiếu bản phổ hoặc nguồn không truy cập được được báo đúng trạng thái. **Không tạo nốt suy đoán từ hợp âm rồi gọi là sheet đúng bài. Chưa có sheet xác minh cho toàn bộ 50.000 bài.**
- Theo lời tô sáng và cuộn các dòng lời bên dưới YouTube; sửa lỗi bỏ qua dòng đầu, cập nhật khi tua hoặc chuyển tông. Khi nguồn chặn đọc phụ đề, vẫn cần mốc lời có sẵn, tệp phụ đề hoặc mốc đánh dấu; không tự đoán thời gian.
- Giao diện riêng NPT Duy: xanh mực, cam san hô, đầu trang gọn, nút bản phổ đặt cạnh bài hát.
- Không gọi API AI trả phí. Thu âm, camera và quay màn hình được giữ nguyên. Bản ghi và mốc lời không tự tải lên mạng.

PDF.js 6.5.438 được phân phối theo Apache-2.0; xem `public/mobile/vendor/PDFJS-LICENSE.txt`. Các bản phổ có thể là giai điệu/hợp âm hoặc một bản chuyển soạn cụ thể; ứng dụng không tự gọi chúng là tổng phổ piano hai tay khi nguồn không ghi như vậy. PDF không tự chuyển tông theo nút đổi tông hợp âm.

© 2026 NPT Duy. Xem [Thông tin tác giả](COPYRIGHT.md).

## Android

Android 8 trở lên. APK phát hành trực tiếp dùng gói `vn.gochopam.app.preview`; cùng khóa ký các bản 1.0/1.1, versionCode 6 để cập nhật giữ bài đã lưu. Khóa ký không nằm trong kho này. Đây là bản thử nghiệm, chưa phát hành trên CH Play.

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

Kho công khai gồm giao diện ứng dụng và vỏ native Android/iOS. Kết nối API đọc kho bài công khai tại website. Không chứa backend riêng, tài khoản, cơ sở dữ liệu, tài liệu PDF, bản ghi của người dùng hoặc bí mật vận hành. Lời/hợp âm và video lấy từ kho kết nối khi dùng app; kho mã này không đóng gói các nội dung đó.

Không có số liệu cài đặt/người dùng giả. Phiên bản, checksum APK và dung lượng thật được công bố tại [`android-release.json`](https://gochopam.pages.dev/downloads/android-release.json); kết quả build và commit xem trong Actions.
