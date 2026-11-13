import base64
import hashlib
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from collector import DirectHttp, PipelineError, batches, collect, json_bytes, new_summary
from report import message, notify


PUBLISHER = "https://publisher.example"
SITE = "https://site.example"
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWFsAAAAASUVORK5CYII="
)
PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"
TOKEN = "ab" * 32


class FixtureHttp:
    def __init__(self):
        self.calls = []
        self.posts = []
        self.slugs = set()
        self.records = [{
            "title": f"Nhạc thử số {i}", "artist": "Tác giả thử", "license": "CC0-1.0",
            "credit": "Người soạn thử", "source_url": f"{PUBLISHER}/info/{i}",
            **({"sheet_url": f"{PUBLISHER}/score-{i}.pdf"} if i % 2 == 0 else
               {"sheet_page_url": f"{PUBLISHER}/page/{i}"}),
        } for i in range(10)]
        self.overrides = {}

    def request(self, url, stage, limit, *, data=None, headers=None):
        self.calls.append(url)
        if url in self.overrides:
            override = self.overrides[url]
            if isinstance(override, Exception):
                raise override
            return override
        if url == PUBLISHER + "/feed.json":
            return json_bytes({"songs": self.records}), "application/json"
        if url.startswith(PUBLISHER + "/page/"):
            number = int(url.rsplit("/", 1)[-1])
            template = ('<img data-score src="/image.png">' if number % 4 == 1 else
                        '<iframe data-score src="/image.png"></iframe>')
            return template.encode(), "text/html"
        if url.endswith(".pdf"):
            return PDF, "application/pdf"
        if url == PUBLISHER + "/image.png":
            return PNG, "image/png"
        if url == SITE + "/api/admin/sync":
            assert headers["Authorization"] == "Bearer " + TOKEN
            body = json.loads(data)
            assert body["format"] == "song-sheets-v1"
            self.posts.append(body["songs"])
            before = len(self.slugs)
            self.slugs.update(song["slug"] for song in body["songs"])
            inserted = len(self.slugs) - before
            processed = len(body["songs"])
            return json_bytes({"ok": True, "inserted": inserted, "attached": 0, "processed": processed,
                               "skipped": processed - inserted, "total_songs": len(self.slugs)}), "application/json"
        if url == SITE + "/api/stats":
            return json_bytes({"total_songs": len(self.slugs)}), "application/json"
        if url.startswith("https://api.telegram.org/"):
            self.posts.append(json.loads(data))
            return b'{"ok":true}', "application/json"
        raise AssertionError(f"Unexpected request at {stage}")


def run_fixture(http):
    summary = new_summary()
    collect(http, feed_url=PUBLISHER + "/feed.json", hosts={"publisher.example"},
            origin=SITE, token=TOKEN, summary=summary)
    return summary


class PipelineTests(unittest.TestCase):
    def test_ten_rows_pdf_image_iframe_and_report(self):
        http = FixtureHttp()
        first = run_fixture(http)
        self.assertEqual((first["inserted"], first["total_songs"], first["batches"]), (10, 10, 1))
        self.assertIn("Hôm nay đã nhập thêm 10 bài, tổng cộng đã có 10 bài.", message(first))
        for index, item in enumerate(http.posts[0]):
            sheet = item["sheet"]
            expected = PNG if index % 2 else PDF
            self.assertEqual(sheet["mime"], "image/png" if index % 2 else "application/pdf")
            self.assertEqual(base64.b64decode(sheet["data"]), expected)
            self.assertEqual(sheet["sha256"], hashlib.sha256(expected).hexdigest())
        second = run_fixture(http)
        self.assertEqual((second["inserted"], second["skipped"], second["total_songs"]), (0, 10, 10))
        notify(http, "123456789:synthetic-test-token-value", "123456789", message(second))
        self.assertEqual(http.posts[-1]["chat_id"], "123456789")
        self.assertIn("nhập thêm 0 bài", http.posts[-1]["text"])

    def test_duplicate_feed_rows_and_batches(self):
        http = FixtureHttp()
        http.records.append(http.records[0].copy())
        result = run_fixture(http)
        self.assertEqual((result["inserted"], result["source_duplicates"]), (10, 1))
        http.records.append({**http.records[0], "credit": "Different"})
        with self.assertRaisesRegex(PipelineError, "xung đột"):
            run_fixture(http)
        self.assertEqual(len(http.posts), 1)
        output = list(batches([{"id": i} for i in range(21)]))
        self.assertEqual([size for _, size in output], [10, 10, 1])

    def test_blocked_source_does_not_send_any_import(self):
        for status in (403, 503):
            with self.subTest(status=status):
                http = FixtureHttp()
                http.overrides[PUBLISHER + "/score-8.pdf"] = PipelineError(f"Tệp bản phổ trả HTTP {status}.")
                with self.assertRaisesRegex(PipelineError, str(status)):
                    run_fixture(http)
                self.assertFalse(http.posts)
                self.assertEqual(http.calls[-1], PUBLISHER + "/score-8.pdf")

    def test_approval_and_content_are_checked_before_import(self):
        for fixture in ("license", "mime", "unapproved"):
            with self.subTest(fixture=fixture):
                http = FixtureHttp()
                if fixture == "license":
                    http.records[0]["license"] = "All rights reserved"
                elif fixture == "mime":
                    http.overrides[PUBLISHER + "/score-0.pdf"] = (b"<html>bad</html>", "application/pdf")
                else:
                    http.overrides[PUBLISHER + "/page/1"] = (
                        b'<iframe data-score src="https://other.example/image.png"></iframe>', "text/html"
                    )
                with self.assertRaises(PipelineError):
                    run_fixture(http)
                self.assertFalse(http.posts)
                self.assertNotIn("https://other.example/image.png", http.calls)

    def test_empty_feed_and_redirect_policy(self):
        http = FixtureHttp()
        http.records = []
        self.assertEqual(run_fixture(http)["total_songs"], 0)
        self.assertFalse(http.posts)
        opener = DirectHttp().opener
        policy = next(handler for handler in opener.handlers if hasattr(handler, "redirect_request"))
        self.assertIsNone(policy.redirect_request(None, None, 302, "Found", {}, "https://other.example"))


if __name__ == "__main__":
    unittest.main()
