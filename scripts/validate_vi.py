"""Vietnamese word segmentation and provenance validation; no generated source rows."""
import json
import re
from pathlib import Path
from underthesea import word_tokenize

songs = json.loads(Path("artifacts/songs_import.json").read_text(encoding="utf-8")).get("songs")
if not isinstance(songs, list) or len(songs) < 5:
    raise SystemExit("FAIL: minimum five verified source songs")
for i, item in enumerate(songs, 1):
    source_id = item.get("source_id", "")
    source_url = item.get("source_url", "")
    if not re.fullmatch(r"[A-Za-z0-9]+", source_id) or not source_url.endswith("/" + source_id + ".html"):
        raise SystemExit(f"FAIL: source_id/URL mismatch in record {i}")
    for column in ("chords_text", "lyrics_text"):
        value = item.get(column, "")
        if (len(value) <= 50 or len(word_tokenize(value)) < 10 or
            not re.search(r"[àáảãạăâđèéẻẽẹêìíỉĩịòóỏõọôơùúủũụưỳýỷỹỵ]", value.lower())):
            raise SystemExit(f"FAIL: Vietnamese linguistic validation: record {i}, {column}")
print(f"Verified {len(songs)} actual source records using underthesea.")
