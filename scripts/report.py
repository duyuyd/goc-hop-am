"""Publish a GitHub Actions summary and optionally notify Telegram."""

import argparse
import os
from pathlib import Path
import re
import sys

from collector import DirectHttp, PipelineError, decode_json, json_bytes, new_summary


def message(summary):
    added = summary["inserted"]
    total = summary["total_songs"]
    if summary["error"]:
        result = f"Đồng bộ bản phổ gặp lỗi. {summary['error']} Đã xác nhận thêm {added} bài."
        return result if total is None else result + f" Tổng cộng {total} bài ở đợt đã xác nhận."
    return (
        f"Hôm nay đã nhập thêm {added} bài, tổng cộng đã có {total} bài.\n"
        f"Gắn bản phổ cho {summary['attached']} bài có sẵn, "
        f"bỏ qua {summary['skipped']} mục đã có tệp và {summary['source_duplicates']} dòng trùng trong nguồn."
    )


def notify(http, token, chat_id, text):
    if not re.fullmatch(r"\d+:[a-zA-Z0-9_-]{16,}", token) or not re.fullmatch(r"-?\d+", chat_id):
        raise PipelineError("Thiếu hoặc sai cấu hình Telegram.")
    body, _ = http.request("https://api.telegram.org/bot" + token + "/sendMessage", "Telegram", 128 * 1024,
                           data=json_bytes({"chat_id": chat_id, "text": text}),
                           headers={"Content-Type": "application/json"})
    response = decode_json(body, "Telegram")
    if not isinstance(response, dict) or response.get("ok") is not True:
        raise PipelineError("Telegram chưa xác nhận gửi thông báo.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--summary", type=Path, required=True)
    args = parser.parse_args()
    try:
        summary = decode_json(args.summary.read_bytes(), "Báo cáo đồng bộ")
    except (OSError, PipelineError):
        summary = new_summary()
        summary["error"] = "Lượt chạy dừng trước khi ghi báo cáo."
    text = message(summary)
    print(text)
    github_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if github_summary:
        with open(github_summary, "a", encoding="utf-8") as output:
            output.write("## Đồng bộ bản phổ Góc Hợp Âm\n\n" + text + "\n")
    token = os.environ.get("SHEET_TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("SHEET_TELEGRAM_CHAT_ID", "")
    if token or chat_id:
        try:
            notify(DirectHttp(), token, chat_id, text)
        except PipelineError as error:
            print(error, file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
