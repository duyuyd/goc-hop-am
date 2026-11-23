# Cline AI coding integration — Góc Hợp Âm

This repository is **prepared for Cline**. Cline is a developer-side VS Code/CLI coding agent, not an AI service embedded in the visitor-facing music website.

## Start (no model API key needed for promotional FREE selections)
1. Open this repository in Visual Studio Code on a computer.
2. Install the **Cline** VS Code extension (publisher/extension ID: `saoudrizwan.claude-dev`); VS Code will recommend it from `.vscode/extensions.json`.
3. Open Cline, sign in and choose **Cline** as the API Provider. Select an actually available model bearing the **FREE** badge. Availability and usage limits rotate; never assume a particular video model remains free.
4. Confirm Cline lists the two project rules under `.clinerules/`; then ask: “Đọc kiến trúc Góc Hợp Âm và liệt kê những rủi ro trước khi sửa tính năng tìm kiếm. Chưa sửa code.”
5. Approve file writes and shell commands deliberately. Run the project checks described in the rules before merging code.

## Example tasks
- “Kiểm tra luồng tìm bài từ giao diện đến /api/catalog; sửa lỗi thật, thêm regression test, giữ nguyên dữ liệu.”
- “Phân tích worker AI sheet và trạng thái hàng đợi; không chạy inference đồng bộ.”
- “Tối ưu bố cục lời và YouTube trên màn hình Android, không xóa tính năng.”

**Important:** Cline FREE promotional models work in the Cline IDE/CLI but **not through the Cline API**. These settings do not add AI transcription to production or deploy GitHub to ChatGPT Sites. For actual visitor-facing model inference, use a separate provider API with its own explicit authentication, quotas and operating-cost approval.

Official docs: https://github.com/cline/cline/blob/main/docs/getting-started/free-models.mdx
