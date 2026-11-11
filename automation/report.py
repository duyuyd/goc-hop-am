#!/usr/bin/env python3
"""Telegram or GitHub Actions summary; report only confirmed D1 statistics."""
from __future__ import annotations

import json
import os
from pathlib import Path
import urllib.parse
import urllib.request


def render(report: dict) -> str:
    total = report.get("total")
    verified = total if isinstance(total, int) else "chưa xác minh"
    return (f"Góc Hợp Âm – Đồng bộ hằng ngày\n"
            f"Thêm mới thực tế: {report.get('added', 0)} bài\n"
            f"Đã ghi nhận trong đợt: {report.get('accepted', 0)} bài\n"
            f"Tổng bài trong D1: {verified}\n"
            f"Lỗi: {'; '.join(report.get('errors', [])) or 'không'}")


def main() -> None:
    path = Path("automation/sync_report.json")
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {
        "added": 0, "accepted": 0, "total": None,
        "errors": ["Chưa chạy đồng bộ hoặc chưa có báo cáo"],
    }
    body = render(data)
    print(body)
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as file:
            file.write("\n## Góc Hợp Âm – Sheet Pipeline\n\n" + body.replace("\n", "  \n") + "\n")
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if token and chat_id:
        fields = urllib.parse.urlencode({"chat_id": chat_id, "text": body}).encode("utf-8")
        req = urllib.request.Request(
            f"https://api.telegram.org/bot{token}/sendMessage", data=fields,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as response:
                if response.status != 200:
                    print("Telegram returned non-200 status")
        except Exception:
            print("Telegram notification failed (credentials redacted)")


if __name__ == "__main__":
    main()
