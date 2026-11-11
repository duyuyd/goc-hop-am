"""QA: ten synthetic song pages, not a live third-party scrape."""
import json
from pathlib import Path
import sys
import tempfile
import unittest

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "automation"))
from collector import allowed, collect


class PipelineSmokeTest(unittest.TestCase):
    def test_parse_ten_synthetic_songs_with_resume(self):
        origin = "https://catalog.example.org"
        listing = "<main>" + "".join(
            f'<a class="song" href="/songs/{i}">Song {i}</a>' for i in range(1, 11)
        ) + "</main>"

        def handler(request):
            if request.url.path == "/robots.txt":
                return httpx.Response(200, text="User-agent: *\nAllow: /")
            if request.url.path == "/catalog":
                return httpx.Response(200, text=listing, headers={"content-type": "text/html"})
            if request.url.path.startswith("/songs/"):
                i = request.url.path.rsplit("/", 1)[-1]
                html = f'<h1>Test Song {i}</h1><p class="artist">Original QA</p>' \
                       f'<p class="chords">[C] demo</p><p class="lyrics">Test lyric {i}</p>'
                return httpx.Response(200, text=html, headers={"content-type": "text/html"})
            return httpx.Response(404)

        config = {"sources": [{
            "name": "Local fixture", "index_urls": [origin + "/catalog"],
            "allowed_hosts": ["catalog.example.org"],
            "allowed_asset_hosts": ["catalog.example.org"],
            "selectors": {"song_links": "a.song", "title": "h1", "artist": ".artist",
                          "chords": ".chords", "lyrics": ".lyrics", "assets": ".sheet a"},
        }]}
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            (tmp / "sources.json").write_text(json.dumps(config), encoding="utf-8")
            with httpx.Client(transport=httpx.MockTransport(handler), headers={"User-Agent": "test"}) as client:
                a = collect(tmp / "sources.json", tmp / "history.json", tmp / "songs_data.json",
                            tmp / "files", 10, 0, client=client)
                self.assertEqual(a["collected"], 10)
                rows = json.loads((tmp / "songs_data.json").read_text())
                self.assertEqual(len(rows), 10)
                self.assertEqual(rows[0]["slug"], "test-song-1-original-qa")
                self.assertTrue(all(row["chords_text"] and row["lyrics_text"] for row in rows))
                (tmp / "history.json").write_text(json.dumps({"synced_slugs": [r["slug"] for r in rows]}))
                b = collect(tmp / "sources.json", tmp / "history.json", tmp / "songs_data.json",
                            tmp / "files", 10, 0, client=client)
                self.assertEqual(b["collected"], 0)

    def test_denied_request_stops_without_bypass(self):
        def handler(request):
            if request.url.path == "/robots.txt":
                return httpx.Response(200, text="User-agent: *\nAllow: /")
            return httpx.Response(403)

        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            conf = {"sources": [{"name": "Blocked test", "allowed_hosts": ["example.org"],
                                 "index_urls": ["https://example.org/catalog"]}]}
            (tmp / "sources.json").write_text(json.dumps(conf))
            with httpx.Client(transport=httpx.MockTransport(handler)) as client:
                result = collect(tmp / "sources.json", tmp / "history.json", tmp / "songs.json",
                                 tmp / "assets", 10, 0, client=client)
                self.assertEqual(result["collected"], 0)
                self.assertTrue(result["blocked"])

    def test_sync_ten_rows_only_checkpoints_after_confirmed_import(self):
        from sync import sync
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            data = [{"title": f"QA {i}", "artist": "QA", "slug": f"qa-{i}",
                     "chords_text": "C", "lyrics_text": "Original QA",
                     "has_pdf": False, "pdf_url": None, "source_name": "QA fixture"}
                    for i in range(10)]
            (temp / "songs.json").write_text(json.dumps(data), encoding="utf-8")
            batches = []

            def handler(request):
                if request.url.path == "/api/stats":
                    return httpx.Response(200, json={"total_songs": 42 + sum(map(len, batches))})
                if request.url.path == "/api/admin/sync":
                    assert request.headers.get("authorization", "").startswith("Bearer ")
                    batch = json.loads(request.content)
                    batches.append(batch)
                    return httpx.Response(200, json={
                        "ok": True, "processed": len(batch), "inserted": len(batch),
                        "total_songs": 42 + sum(map(len, batches)),
                    })
                return httpx.Response(404)

            with httpx.Client(transport=httpx.MockTransport(handler)) as client:
                report = sync(temp / "songs.json", temp / "history.json", temp / "report.json",
                              "https://music.example.org", "a" * 48, client)
            self.assertEqual(report["accepted"], 10)
            self.assertEqual(report["added"], 10)
            self.assertEqual(report["total"], 52)
            self.assertEqual(len(batches), 1)
            self.assertEqual(len(json.loads((temp / "history.json").read_text())["synced_slugs"]), 10)

    def test_allowed_host_is_exact_not_suffix(self):
        self.assertTrue(allowed("https://example.org/a", ["example.org"]))
        self.assertFalse(allowed("https://example.org.attacker.invalid/a", ["example.org"]))


if __name__ == "__main__":
    unittest.main()
