# Góc Hợp Âm – Scheduled sheet pipeline

- GitHub Actions cron 23:20 UTC = 06:20 Asia/Ho_Chi_Minh, plus manual workflow_dispatch.
- Input: automation/sources.json (explicit index URLs and host allowlists). Default source list is empty; no website targeted automatically.
- Reads HTML metadata, directly accessible PDF/image/MusicXML assets. HTTP 401/403/429/503 and bot challenges stop the source; no fingerprint spoofing, proxy rotation or challenge bypass.
- history.json is cached in GitHub Actions and updated only after the D1 API confirms import. D1 upserts by slug for idempotency.
- Optional private R2 upload using boto3 S3 API. Worker verifies R2 object exists and serves it through /api/sheets/[slug]. No Base64 in D1.
- Automated API access uses a dedicated Bearer SYNC_INGEST_TOKEN (32+ random characters) on both Cloudflare runtime and GitHub Actions. Browser admin cookie access remains.

## Configuration required before enabling scheduled imports

GitHub repository variable:
- SITE_BASE_URL: actual production HTTPS base URL.

GitHub repository secrets:
- SYNC_INGEST_TOKEN: same long random value also configured as the Worker/Sites secret.
- Optional R2_ENDPOINT (https://<ACCOUNT_ID>.r2.cloudflarestorage.com), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET. Grant limited bucket read/write; Worker BUCKET binding must target same bucket.
- Optional TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.

Apply the additive D1 migration drizzle/0005_sheet_assets.sql before deploying new backend. Repo merges do not necessarily deploy live Sites: confirm /api/stats and the Worker secret configuration before scheduling.

To configure a source, copy the structure of automation/sources.example.json into automation/sources.json and set selectors for sources you may access. Store no private keys in the repository.

The user-provided 4,000 previously collected songs are not present in this repository and have not been imported. This pipeline does not claim to have collected 14,000 songs.

## QA

    python -m pip install -r automation/requirements.txt
    python -m unittest discover -s tests -p test_sheet_pipeline.py -v

The QA test simulates the first 10 songs, verifies history/resume and stop-on-403 behavior without accessing third-party services.
