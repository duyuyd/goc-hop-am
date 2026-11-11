# Đồng bộ bản phổ Góc Hợp Âm

Workflow **Đồng bộ bản phổ** chạy trên `ubuntu-latest` lúc 04:17 giờ Việt Nam. Kiểm thử PR và lượt chạy tay mặc định dùng dữ liệu giả lập. Lượt ghi thật chạy từ `main` khi danh mục đã được cấu hình, hoặc khi chọn `publish` trong **Run workflow**.

## Kích hoạt

1. Triển khai mã đã duyệt lên Sites `appgprj_6ae93d0e853c8191bc61999c745a657c` cùng migration mới. Khi API đã sẵn sàng, yêu cầu GET không có phiên tới `/api/admin/sync` trả HTTP 401.
2. Đặt cùng một khóa ngẫu nhiên 32 byte ở dạng 64 ký tự hex thường vào biến bí mật `SHEET_SYNC_TOKEN` của Sites và GitHub Actions. Khóa chỉ xác thực POST đồng bộ bản phổ. Luồng nhập CSV/JSON thủ công tiếp tục dùng phiên quản trị.
3. Đặt GitHub Actions Variables `SHEET_FEED_URL` và `SHEET_SOURCE_HOSTS` theo danh mục của dự án hoặc của nhà phát hành cho phép lưu lại tệp. Danh sách hostname phân cách bằng dấu phẩy, ví dụ `sheets.example.org,files.example.org`.
4. Nếu dùng Telegram, đặt cả hai GitHub Actions Secrets `SHEET_TELEGRAM_BOT_TOKEN` và `SHEET_TELEGRAM_CHAT_ID`. GitHub Actions luôn ghi báo cáo ở tab **Summary**.

## Định dạng danh mục

Feed trả JSON UTF-8 với tối đa 30 mục mới hoặc thay đổi cho mỗi lượt. Mỗi mục có một bản phổ, bằng URL tệp trực tiếp hoặc trang xuất của nhà phát hành.

```json
{
  "songs": [
    {
      "title": "Tên bài",
      "artist": "Tên tác giả",
      "slug": "ten-bai-ten-tac-gia",
      "sheet_url": "https://files.example.org/ten-bai.pdf",
      "source_url": "https://sheets.example.org/ban-pho/ten-bai",
      "license": "CC-BY-4.0",
      "credit": "Tên tác giả và người soạn bản phổ"
    }
  ]
}
```

`slug` có thể bỏ qua để tạo từ tiêu đề và tác giả. Dùng `sheet_page_url` thay cho `sheet_url` khi trang xuất chứa đúng một liên kết được đánh dấu bằng `data-score` trên thẻ `a`, `iframe` hoặc `img`. Các URL nguồn và tệp dùng HTTPS trên hostname đã duyệt. Danh mục chấp nhận `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `PDM-1.0` hoặc `Permission` khi nhà phát hành đã cho phép đăng lại.

Mỗi tệp PDF, PNG hoặc JPEG tối đa 3 MiB. Lượt chạy kiểm tra toàn bộ danh mục và tệp trước khi gọi API ghi. HTTP 403 hoặc 503 từ nguồn kết thúc lượt chạy. API lưu tệp trên R2 theo SHA-256, gắn `sheet_url` cho bài trong D1 và trả số bài mới, số bài cũ được gắn bản phổ và số mục đã có tệp. `GET /api/songs/{slug}` trả URL tệp cùng giấy phép và ghi công. `total_songs` đếm các bài trong bảng `songs` của D1.
