#!/usr/bin/env python3
"""Upload collected song batches to the existing authenticated D1 ingestion API."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import httpx
from collector import save_json


def sync(output_path: Path, history_path: Path, report_path: Path, api_base: str, token: str, client=None) -> dict:
    report = {"collected": 0, "accepted": 0, "added": 0, "total": None, "errors": []}
    if not output_path.exists():
        save_json(report_path, report)
        return report

    data = json.loads(output_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("Expected a JSON array of song rows")
    report["collected"] = len(data)
    if not data:
        if api_base.startswith("https://"):
            temporary_client = client is None
            empty_client = client or httpx.Client(timeout=15.0)
            try:
                stats = empty_client.get(api_base.rstrip("/") + "/api/stats")
                if stats.status_code == 200:
                    report["total"] = stats.json().get("total_songs")
            except Exception:
                report["errors"].append("Cannot read D1 statistics")
            finally:
                if temporary_client:
                    empty_client.close()
        save_json(report_path, report)
        return report

    if not api_base.startswith("https://") or len(token) < 32:
        report["errors"].append("Missing HTTPS SITE_BASE_URL or secure SYNC_INGEST_TOKEN")
        save_json(report_path, report)
        raise RuntimeError(report["errors"][-1])

    history = json.loads(history_path.read_text(encoding="utf-8")) if history_path.exists() else {}
    synced = set(history.get("synced_slugs", []))
    upload = [item for item in data if item["slug"] not in synced]
    own_client = client is None
    if own_client:
        client = httpx.Client(timeout=35.0)
    base = api_base.rstrip("/")
    before = None
    try:
        stats = client.get(base + "/api/stats")
        if stats.status_code == 200:
            before = stats.json().get("total_songs")
        for offset in range(0, len(upload), 50):
            batch = upload[offset:offset + 50]
            payload = [{key: value for key, value in row.items()
                       if key not in ("source_url", "local_sheet_path")} for row in batch]
            response = client.post(
                base + "/api/admin/sync", json=payload,
                headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
            )
            if response.status_code != 200:
                report["errors"].append(f"Sync rejected ({response.status_code})")
                break
            result = response.json()
            if result.get("ok") is not True or result.get("processed") != len(batch):
                report["errors"].append("Sync did not confirm the entire batch")
                break
            report["accepted"] += len(batch)
            report["total"] = result.get("total_songs")
            synced.update(row["slug"] for row in batch)
            history["synced_slugs"] = sorted(synced)
            save_json(history_path, history)
        stats = client.get(base + "/api/stats")
        if stats.status_code == 200:
            report["total"] = stats.json().get("total_songs")
        if isinstance(before, int) and isinstance(report["total"], int):
            report["added"] = max(0, report["total"] - before)
    finally:
        if own_client:
            client.close()
        save_json(report_path, report)
    if report["errors"]:
        raise RuntimeError("; ".join(report["errors"]))
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="automation/songs_data.json")
    parser.add_argument("--history", default="automation/history.json")
    parser.add_argument("--report", default="automation/sync_report.json")
    args = parser.parse_args()
    result = sync(
        Path(args.input), Path(args.history), Path(args.report),
        os.getenv("SITE_BASE_URL", ""), os.getenv("SYNC_INGEST_TOKEN", ""),
    )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
