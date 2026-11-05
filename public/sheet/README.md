# Góc Hợp Âm — thư viện sheet PDF đa nguồn (nhánh đề xuất)

Đây là **bộ giao diện và các đầu nối tìm kiếm nguồn** trên GitHub, **không phải** dữ liệu Sites v26 và **không được triển khai tự động**.

## Đã có trên nhánh
- Đường dẫn \`/sheet/\`: nhập tên bài/tác giả có hoặc không dấu; lọc website nguồn, thể loại (13 nhóm), định dạng, A–Z/Z–A; giao diện Android.
- **5 PDF trực tiếp từ Mutopia**: URL nằm ở \`registry.mjs\`, có tên tác giả và nguồn. Những tệp này đã được đối chiếu với danh sách tệp PDF trong các thư mục Mutopia; liên kết mở tại máy chủ nguồn. Không tự tải hoặc sao chép tệp.
- **6 trang sheet tiếng Việt**: 2 tại hopam.net và 4 tại Hợp Âm Việt trong \`sources.mjs\`. Đây là **trang sheet gốc**, không phải 6 tệp PDF đã được host riêng.
- Nút **tìm trên 8 website**: hopam.net, Hợp Âm Việt, Mutopia, Musopen, IMSLP, OpenScore, MuseScore, Wikimedia Commons. Tìm bằng bộ lọc \`site:\` trên Google; kết quả do website nguồn quyết định, không phải kết quả PDF được xác nhận.
- \`catalog.mjs\` gọi \`https://goc-hop-am.onwardcrust.chatgpt.site/api/catalog?mode=search&q=...\` ở chế độ **chỉ đọc** khi tìm từ 3 ký tự. Nếu trình duyệt chặn CORS hoặc mạng hỏng, vẫn dùng được danh mục địa phương và nút tìm bên ngoài. Trả về bài hát **không** chứng minh đã có sheet.
- Khớp chính xác tên bài **và** nhạc sĩ trước khi gắn nhãn có sheet; không ghép nhầm chỉ vì trùng tên.

## Cách kiểm tra

\`\`\`sh
node --test tests/pdf-library.test.mjs tests/sheet-federation.test.mjs tests/sheet-catalog.test.mjs
\`\`\`

Để xem trang, dùng máy chủ tĩnh phục vụ thư mục \`public\`, ví dụ \`python3 -m http.server 8000 -d public\`, truy cập \`http://localhost:8000/sheet/\`. Mở file \`index.html\` qua \`file://\` sẽ có thể không tải được ES modules.

## Đưa thêm PDF thực vào kho

Chỉ tạo bản ghi \`format: "pdf-direct"\` khi đã xác nhận URL HTTPS thực sự trả tệp PDF bản phổ và giấy phép/tác giả phù hợp. Mọi bản ghi có \`id\`, \`title\`, \`composer\`, \`genre\`, \`sourceId\`, \`url\`, \`format\`, và nguồn/công bố; với PDF nên kèm \`license\`. Tạo trang sheet tham chiếu với \`format: "sheet-page"\` và URL gốc trong \`SHEET_PAGES\`. Đối với các bản lưu do tác giả tự đăng hoặc tệp được phép lưu, cần xây **API quản trị, phân quyền, kho lưu trữ, đồng bộ dữ liệu và PDF.js** trên mã Sites hiện tại sau khi truy cập được môi trường ấy; dự án GitHub này không có backend Sites.

Không sao chép hàng loạt sheet từ website khác, không gán giấy phép chung cho cả thư viện. Mutopia, IMSLP, Musopen, MuseScore có điều kiện cấp phép khác nhau theo từng bản phổ. Template Creator không được dùng để tạo dự án Sites thay thế.

## Tuyệt đối không ghi đè
- Không merge nhánh vào \`main\` hoặc dùng GitHub cũ để deploy Sites v26.
- Không khai báo "đã có đủ 50.135 PDF" chỉ vì API danh mục trả 50.135 bài hát kết nối.
- Chưa có chứng cứ kiểm thử trên website Sites và chưa có bản sản xuất của kho PDF này.
