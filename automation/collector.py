#!/usr/bin/env python3
"""Daily collector for allowlisted, reachable music sources.

No TLS fingerprint spoofing, challenge solving, proxy rotation or Cloudflare
evasion. Stops collection for a source on HTTP 401/403/429/503.
"""
from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path
import re
import time
import unicodedata
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx
from bs4 import BeautifulSoup

LOGGER = logging.getLogger("collector")
USER_AGENT = "GocHopAmCatalogBot/1.0 (site owner; contact via project repository)"
ASSET_MIMES = {
    "application/pdf": ".pdf",
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "application/vnd.recordare.musicxml+xml": ".musicxml",
    "application/vnd.recordare.musicxml": ".musicxml",
    "application/vnd.recordare.musicxml+zip": ".mxl",
    "application/xml": ".xml",
    "text/xml": ".xml",
}
DENIED = {401, 403, 429, 503}
MAX_ASSET_BYTES = 12 * 1024 * 1024


class AccessDenied(RuntimeError):
    """Automated access was explicitly denied. Do not bypass."""


def save_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, path)


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower().replace("đ", "d"))
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:120].strip("-") or "untitled"


def allowed(url: str, hosts: list[str]) -> bool:
    parts = urlparse(url)
    return parts.scheme == "https" and parts.hostname in hosts and not parts.username and not parts.password


def document_links(html: str, origin: str, selector: str, hosts: list[str]) -> list[str]:
    dom = BeautifulSoup(html, "html.parser")
    result = []
    for tag in dom.select(selector):
        raw = tag.get("href")
        if not raw:
            continue
        link = urljoin(origin, raw).split("#", 1)[0]
        if allowed(link, hosts) and link not in result:
            result.append(link)
    return result


def first_text(dom: BeautifulSoup, selector: str) -> str:
    if not selector:
        return ""
    node = dom.select_one(selector)
    return node.get_text("\n", strip=True) if node else ""


def parse_song(html: str, url: str, selectors: dict, asset_hosts: list[str]) -> dict | None:
    dom = BeautifulSoup(html, "html.parser")
    title = first_text(dom, selectors.get("title", "h1"))
    if not title:
        return None
    artist = first_text(dom, selectors.get("artist", ".artist"))
    slug = slugify(title + "-" + artist)
    chords = first_text(dom, selectors.get("chords", ".chords"))
    lyrics = first_text(dom, selectors.get("lyrics", ".lyrics"))
    assets = []
    selector = selectors.get("assets", "a[href], iframe[src], img[src]")
    for node in dom.select(selector):
        raw = node.get("href") or node.get("src")
        if not raw:
            continue
        asset_url = urljoin(url, raw)
        if allowed(asset_url, asset_hosts) and asset_url not in assets:
            assets.append(asset_url)
    return {
        "title": title[:180], "artist": artist[:180], "slug": slug,
        "chords_text": chords[:60000], "lyrics_text": lyrics[:60000],
        "source_name": selectors.get("source_name", "Nguồn cấu hình")[:100],
        "source_url": url, "asset_candidates": assets,
        "has_pdf": False, "pdf_url": None,
    }


class Fetcher:
    def __init__(self, client: httpx.Client):
        self.client = client
        self.robots: dict[str, RobotFileParser] = {}

    def check_robots(self, url: str) -> None:
        parts = urlparse(url)
        root = f"{parts.scheme}://{parts.netloc}"
        if root not in self.robots:
            response = self.client.get(root + "/robots.txt")
            if response.status_code in DENIED:
                raise AccessDenied(f"Robots request denied ({response.status_code}): {root}")
            parser = RobotFileParser()
            if response.status_code == 404:
                parser.parse([])
            elif response.is_success:
                parser.parse(response.text.splitlines())
            else:
                raise RuntimeError(f"robots.txt unavailable: {root} ({response.status_code})")
            self.robots[root] = parser
        if not self.robots[root].can_fetch(USER_AGENT, url):
            raise AccessDenied(f"robots.txt disallows collection: {url}")

    def get(self, url: str, hosts: list[str]) -> httpx.Response:
        if not allowed(url, hosts):
            raise ValueError(f"URL host not in allowlist: {urlparse(url).hostname}")
        self.check_robots(url)
        response = self.client.get(url, follow_redirects=False)
        if response.status_code in DENIED:
            raise AccessDenied(f"Access denied ({response.status_code}): {url}")
        if 300 <= response.status_code < 400:
            destination = urljoin(url, response.headers.get("location", ""))
            if not allowed(destination, hosts):
                raise AccessDenied("Redirect to unapproved host")
            response = self.client.get(destination, follow_redirects=False)
            if response.status_code in DENIED or response.is_redirect:
                raise AccessDenied(f"Redirect or challenge response: {destination}")
        response.raise_for_status()
        if "text/html" in response.headers.get("content-type", ""):
            text = response.text[:3000].lower()
            if any(s in text for s in ("checking your browser", "cf-challenge", "verify you are human")):
                raise AccessDenied(f"Access challenge detected: {url}")
        return response


def download_asset(fetcher: Fetcher, candidate: str, hosts: list[str], slug: str, dest: Path) -> tuple[Path, str] | None:
    # A protected HTML iframe is not a downloadable asset.
    response = fetcher.get(candidate, hosts)
    mime = response.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    ext = ASSET_MIMES.get(mime)
    if not ext or len(response.content) > MAX_ASSET_BYTES:
        return None
    dest.mkdir(parents=True, exist_ok=True)
    file_path = dest / f"{slug}{ext}"
    file_path.write_bytes(response.content)
    return file_path, mime


def r2_client():
    fields = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]
    if not all(os.environ.get(k) for k in fields):
        return None
    import boto3
    return boto3.client(
        "s3", endpoint_url=os.environ["R2_ENDPOINT"], region_name="auto",
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    )


def attach_asset(row: dict, fetcher: Fetcher, asset_hosts: list[str], dest: Path, r2) -> None:
    for candidate in row.pop("asset_candidates", []):
        try:
            downloaded = download_asset(fetcher, candidate, asset_hosts, row["slug"], dest)
            if not downloaded:
                continue
            file_path, mime = downloaded
            row["local_sheet_path"] = str(file_path)
            if r2:
                key = f"sheets/{file_path.name}"
                r2.upload_file(str(file_path), os.environ["R2_BUCKET"], key, ExtraArgs={"ContentType": mime})
                row["sheet_key"] = key
                row["sheet_mime"] = mime
                # API verifies R2 object and derives sheet_url from slug.
            break
        except AccessDenied:
            raise
        except Exception as exc:
            LOGGER.warning("Could not retrieve asset for %s: %s", row["slug"], type(exc).__name__)


def collect(config_path: Path, history_path: Path, output_path: Path, destination: Path, max_songs: int, delay: float, client=None, r2=None) -> dict:
    config = json.loads(config_path.read_text(encoding="utf-8"))
    history = json.loads(history_path.read_text(encoding="utf-8")) if history_path.exists() else {"synced_slugs": []}
    synced = set(history.get("synced_slugs", []))
    rows = []
    seen = set()
    blocked = []
    own_client = client is None
    if own_client:
        client = httpx.Client(timeout=20.0, headers={"User-Agent": USER_AGENT}, follow_redirects=False)
    fetcher = Fetcher(client)
    if r2 is None and own_client:
        r2 = r2_client()
    try:
        for source in config.get("sources", []):
            if len(rows) >= max_songs:
                break
            hosts = source.get("allowed_hosts", [])
            asset_hosts = source.get("allowed_asset_hosts", hosts)
            selectors = {**source.get("selectors", {}), "source_name": source.get("name", "Nguồn cấu hình")}
            for index_url in source.get("index_urls", []):
                if len(rows) >= max_songs:
                    break
                try:
                    index = fetcher.get(index_url, hosts)
                    targets = document_links(index.text, index_url, selectors.get("song_links", "a[href]"), hosts)
                    for url in targets:
                        if len(rows) >= max_songs:
                            break
                        if url in seen:
                            continue
                        seen.add(url)
                        time.sleep(delay)
                        page = fetcher.get(url, hosts)
                        row = parse_song(page.text, url, selectors, asset_hosts)
                        if not row or row["slug"] in synced:
                            continue
                        attach_asset(row, fetcher, asset_hosts, destination, r2)
                        rows.append(row)
                        save_json(output_path, rows)
                except AccessDenied as exc:
                    blocked.append(str(exc))
                    LOGGER.error("Stopping source after access denied: %s", exc)
                    break
    finally:
        if own_client:
            client.close()
    save_json(output_path, rows)
    save_json(history_path, history)
    return {"collected": len(rows), "blocked": blocked, "synced_before": len(synced)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="automation/sources.json")
    parser.add_argument("--history", default="automation/history.json")
    parser.add_argument("--output", default="automation/songs_data.json")
    parser.add_argument("--download-dir", default="downloaded_sheets")
    parser.add_argument("--max-songs", type=int, default=100)
    parser.add_argument("--delay", type=float, default=1.5)
    args = parser.parse_args()
    result = collect(Path(args.config), Path(args.history), Path(args.output), Path(args.download_dir),
                     max(1, min(args.max_songs, 200)), max(args.delay, 1))
    save_json(Path("automation/collection_report.json"), result)
    print(json.dumps(result, ensure_ascii=False))
    if result["blocked"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
