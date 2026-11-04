# Góc Hợp Âm · Android & iOS 1.2.1

**Tác giả dự án & người lập trình: Nguyễn Phan Thế Duy.**

Tra bài hát, đọc hợp âm, đổi tông, lưu ngoại tuyến và tập cùng YouTube.

- [Website](https://gochopam.pages.dev/)
- [Tải APK Android miễn phí](https://gochopam.pages.dev/ung-dung/)
- [Bản phát hành](https://github.com/duyuyd/goc-hop-am/releases)
- [Trạng thái biên dịch thực tế](https://github.com/duyuyd/goc-hop-am/actions)

## Bản 1.2.1

Giao diện đọc lời thu gọn; YouTube hiển thị riêng phía trên (xoay ngang để đọc cạnh video). Theo lời bằng thời gian thật và phụ đề công khai của chính video YouTube, không dùng micro. Khi video thiếu phụ đề khớp lời, có thể nhập LRC hoặc đánh dấu từng câu; không đoán mốc theo độ dài bài hát.

Phòng thu: thu âm micro, quay màn hình và micro, camera trước, hoặc màn hình cùng camera trước. Chỉ bắt đầu sau thao tác và quyền của người dùng. Bản ghi lưu trên thiết bị; bấm Lưu tệp/Chia sẻ để xuất. Không tự gửi bản ghi hay giọng nói lên website hoặc GitHub. Nội dung được bảo vệ có thể bị hệ điều hành chặn ghi hình; âm thanh được thu từ micro.

Chưa kiểm thử đủ mọi loại điện thoại. Hãy thử bản ghi ngắn trước. Bản web lưu bản ghi trong IndexedDB của trình duyệt; ứng dụng cài đặt lưu tệp riêng bền vững trên thiết bị.

Bản 1.2.1 sửa thứ tự cấu hình bộ ghi Android và dùng Camera2 để quay camera trước trực tiếp, không phụ thuộc getUserMedia của WebView. Bản ghi trên web có thông báo riêng khi trình duyệt thiếu khả năng quay màn hình.

© 2026 Nguyễn Phan Thế Duy. Xem [Thông tin tác giả](COPYRIGHT.md). Chữ “chưa ký” của IPA/AAB là trạng thái kỹ thuật gói cài đặt.

## Android

Android 8 trở lên. APK phát hành trực tiếp dùng gói `vn.gochopam.app.preview`; cùng khóa ký các bản 1.0/1.1, versionCode 4 để cập nhật giữ bài đã lưu. Khóa ký không nằm trong kho này. Đây là bản thử nghiệm, chưa phát hành trên CH Play.

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
