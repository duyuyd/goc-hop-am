"""Import permitted sheet music from an approved publisher feed."""

import argparse
import base64
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
import unicodedata
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener


MAX_SOURCE_BYTES = 256 * 1024
MAX_FILE_BYTES = 3 * 1024 * 1024
MAX_REQUEST_BYTES = 9 * 1024 * 1024
MAX_FEED_ROWS = 30
MAX_BATCH_ROWS = 10
LICENSES = {"CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0", "PDM-1.0", "Permission"}
FORMATS = {"application/pdf", "image/png", "image/jpeg"}


class PipelineError(Exception):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class DirectHttp:
    def __init__(self):
        self.opener = build_opener(NoRedirect())

    def request(self, url, stage, limit, *, data=None, headers=None):
        request = Request(url, data=data, headers={
            "User-Agent": "GocHopAmSheetSync/1.0",
            **(headers or {}),
        })
        try:
            with self.opener.open(request, timeout=20) as response:
                body = response.read(limit + 1)
                if len(body) > limit:
                    raise PipelineError(f"{stage} vượt kích thước cho phép.")
                return body, response.headers.get_content_type()
        except HTTPError as error:
            error.close()
            raise PipelineError(f"{stage} trả HTTP {error.code}.") from None
        except (OSError, URLError):
            raise PipelineError(f"{stage} lỗi kết nối.") from None


def safe_url(value, stage, allowed_hosts=None):
    if not isinstance(value, str) or not value or len(value) > 2000 or re.search(r"[\x00-\x20\\]", value):
        raise PipelineError(f"{stage} cần URL HTTPS hợp lệ.")
    try:
        url = urlsplit(value)
        host = url.hostname
        valid = (
            url.scheme == "https" and host and url.port in (443, None)
            and url.username is None and url.password is None and not url.fragment
        )
    except ValueError:
        valid = False
    if not valid or (allowed_hosts is not None and host not in allowed_hosts):
        raise PipelineError(f"{stage} cần URL HTTPS thuộc nguồn đã duyệt.")
    return url


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def decode_json(body, stage):
    try:
        return json.loads(body.decode("utf-8-sig"))
    except (UnicodeError, ValueError):
        raise PipelineError(f"{stage} không trả JSON UTF-8 hợp lệ.") from None


def field(row, name, maximum, *, required=False):
    value = row.get(name, "")
    if not isinstance(value, str) or len(value) > maximum or (required and not value.strip()):
        raise PipelineError(f"Trường {name} không hợp lệ.")
    return value.strip()


def slug_for(title, artist):
    normalized = unicodedata.normalize("NFD", f"{title}-{artist}".lower().replace("đ", "d"))
    normalized = re.sub(r"[\u0300-\u036f]", "", normalized)
    return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")[:160].rstrip("-")


def load_feed(http, feed_url, hosts):
    safe_url(feed_url, "Danh mục", hosts)
    body, media = http.request(feed_url, "Danh mục", MAX_SOURCE_BYTES, headers={"Accept": "application/json"})
    if media != "application/json":
        raise PipelineError("Danh mục cần Content-Type application/json.")
    document = decode_json(body, "Danh mục")
    rows = document.get("songs") if isinstance(document, dict) else None
    if not isinstance(rows, list) or len(rows) > MAX_FEED_ROWS:
        raise PipelineError(f"Danh mục cần trường songs với tối đa {MAX_FEED_ROWS} mục.")
    entries = {}
    for row in rows:
        if not isinstance(row, dict):
            raise PipelineError("Một mục danh mục không phải đối tượng JSON.")
        title = field(row, "title", 180, required=True)
        artist = field(row, "artist", 180, required=True)
        slug = field(row, "slug", 160) or slug_for(title, artist)
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug):
            raise PipelineError("Một bài có slug không hợp lệ.")
        license_id = field(row, "license", 20, required=True)
        if license_id not in LICENSES:
            raise PipelineError("Một tệp chưa khai báo quyền đăng lại phù hợp.")
        direct = field(row, "sheet_url", 2000)
        page = field(row, "sheet_page_url", 2000)
        if bool(direct) == bool(page):
            raise PipelineError("Mỗi mục cần đúng một sheet_url hoặc sheet_page_url.")
        safe_url(direct or page, "Bản phổ", hosts)
        source = field(row, "source_url", 2000, required=True)
        safe_url(source, "Nguồn ghi công", hosts)
        entry = {
            "title": title, "artist": artist, "slug": slug,
            "source_name": field(row, "source_name", 100) or "Bản phổ",
            "license": license_id, "credit": field(row, "credit", 250, required=True),
            "source_url": source, "sheet_url": direct, "sheet_page_url": page,
        }
        if slug in entries and entries[slug] != entry:
            raise PipelineError(f"Danh mục có hai mục xung đột cho {slug}.")
        entries[slug] = entry
    return list(entries.values()), len(rows) - len(entries)


class MarkedSheets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = set()

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        attribute = {"a": "href", "iframe": "src", "img": "src"}.get(tag)
        if attribute and "data-score" in values and values.get(attribute):
            self.urls.add(values[attribute])


def attachment_url(http, entry, hosts):
    if entry["sheet_url"]:
        return entry["sheet_url"]
    page = entry["sheet_page_url"]
    body, media = http.request(page, "Trang xuất bản phổ", MAX_SOURCE_BYTES)
    if media != "text/html":
        raise PipelineError("Trang xuất bản phổ cần Content-Type text/html.")
    parser = MarkedSheets()
    parser.feed(body.decode("utf-8", errors="replace"))
    if len(parser.urls) != 1:
        raise PipelineError("Trang xuất bản phổ cần đúng một liên kết data-score.")
    url = urljoin(page, next(iter(parser.urls)))
    safe_url(url, "Tệp bản phổ", hosts)
    return url


def file_mime(data):
    if data.startswith(b"%PDF-") and data[-2048:].rstrip().endswith(b"%%EOF"):
        return "application/pdf"
    if (len(data) >= 45 and data.startswith(bytes.fromhex("89504e470d0a1a0a0000000d49484452"))
            and data.endswith(bytes.fromhex("0000000049454e44ae426082"))):
        return "image/png"
    if len(data) >= 6 and data.startswith(b"\xff\xd8\xff") and data.endswith(b"\xff\xd9"):
        return "image/jpeg"
    raise PipelineError("Nội dung tải về không phải PDF, PNG hoặc JPEG hợp lệ.")


def prepare_sheet(http, entry, hosts):
    url = attachment_url(http, entry, hosts)
    data, declared_mime = http.request(url, "Tệp bản phổ", MAX_FILE_BYTES)
    mime = file_mime(data)
    if declared_mime != mime and declared_mime != "application/octet-stream":
        raise PipelineError("Content-Type của bản phổ không khớp nội dung tệp.")
    return {
        **{key: entry[key] for key in ("title", "artist", "slug", "source_name")},
        "sheet": {
            "mime": mime, "sha256": hashlib.sha256(data).hexdigest(),
            "data": base64.b64encode(data).decode("ascii"),
            "license": entry["license"], "source_url": entry["source_url"], "credit": entry["credit"],
        },
    }


def batches(items):
    prefix = b'{"format":"song-sheets-v1","songs":['
    suffix = b"]}"
    batch = []
    size = len(prefix) + len(suffix)
    for item in items:
        encoded = json_bytes(item)
        if batch and (len(batch) == MAX_BATCH_ROWS or size + len(encoded) + 1 > MAX_REQUEST_BYTES):
            yield prefix + b",".join(batch) + suffix, len(batch)
            batch = []
            size = len(prefix) + len(suffix)
        if size + len(encoded) > MAX_REQUEST_BYTES:
            raise PipelineError("Một mục vượt kích thước yêu cầu đồng bộ.")
        size += len(encoded) + bool(batch)
        batch.append(encoded)
    if batch:
        yield prefix + b",".join(batch) + suffix, len(batch)


def count(result, key):
    value = result.get(key) if isinstance(result, dict) else None
    if type(value) is not int or value < 0:
        raise PipelineError("Sites trả số liệu đồng bộ không hợp lệ.")
    return value


def collect(http, *, feed_url, hosts, origin, token, summary):
    site = safe_url(origin, "Sites")
    if site.path not in ("", "/") or site.query:
        raise PipelineError("SHEET_SYNC_ORIGIN cần địa chỉ gốc của Sites.")
    if not re.fullmatch(r"[a-f0-9]{64}", token):
        raise PipelineError("Thiếu hoặc sai định dạng SHEET_SYNC_TOKEN.")
    origin = origin.rstrip("/")
    rows, summary["source_duplicates"] = load_feed(http, feed_url, hosts)
    # Verify the whole source batch before the first D1 write.
    sheets = [prepare_sheet(http, entry, hosts) for entry in rows]
    if not sheets:
        body, _ = http.request(origin + "/api/stats", "Thống kê Sites", MAX_SOURCE_BYTES)
        summary["total_songs"] = count(decode_json(body, "Thống kê Sites"), "total_songs")
        return
    for body, expected_rows in batches(sheets):
        response, _ = http.request(origin + "/api/admin/sync", "API đồng bộ Sites", MAX_SOURCE_BYTES,
                                   data=body, headers={"Content-Type": "application/json",
                                                       "Authorization": "Bearer " + token})
        result = decode_json(response, "API đồng bộ Sites")
        totals = {key: count(result, key) for key in ("processed", "inserted", "attached", "skipped", "total_songs")}
        if (result.get("ok") is not True or totals["processed"] != expected_rows
                or totals["inserted"] + totals["attached"] + totals["skipped"] != expected_rows
                or totals["inserted"] > totals["total_songs"]):
            raise PipelineError("Sites chưa xác nhận toàn bộ đợt đồng bộ.")
        summary["total_songs"] = totals.pop("total_songs")
        for key, value in totals.items():
            summary[key] += value
        summary["batches"] += 1


def new_summary():
    return {"processed": 0, "inserted": 0, "attached": 0, "skipped": 0, "source_duplicates": 0,
            "batches": 0, "total_songs": None, "error": None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--summary", type=Path, required=True)
    args = parser.parse_args()
    summary = new_summary()
    try:
        hosts = {host.strip().lower() for host in os.environ.get("SHEET_SOURCE_HOSTS", "").split(",") if host.strip()}
        if not hosts or any(not re.fullmatch(r"(?:[a-z0-9-]+\.)+[a-z][a-z0-9-]*", host) for host in hosts):
            raise PipelineError("SHEET_SOURCE_HOSTS cần danh sách hostname cụ thể.")
        collect(DirectHttp(), feed_url=os.environ.get("SHEET_FEED_URL", ""), hosts=hosts,
                origin=os.environ.get("SHEET_SYNC_ORIGIN", ""), token=os.environ.get("SHEET_SYNC_TOKEN", ""),
                summary=summary)
    except (PipelineError, UnicodeError) as error:
        summary["error"] = str(error) if isinstance(error, PipelineError) else "Danh mục chứa ký tự Unicode không hợp lệ."
        print(summary["error"], file=sys.stderr)
    finally:
        args.summary.write_bytes(json_bytes(summary) + b"\n")
    return 1 if summary["error"] else 0


if __name__ == "__main__":
    sys.exit(main())
