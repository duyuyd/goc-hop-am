-- Additive migration. Preserve all existing tables and rows.
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL UNIQUE,
  chords_text TEXT NOT NULL DEFAULT '',
  lyrics_text TEXT NOT NULL DEFAULT '',
  has_pdf INTEGER NOT NULL DEFAULT 0 CHECK (has_pdf IN (0, 1)),
  pdf_url TEXT,
  source_name TEXT NOT NULL DEFAULT 'Tệp nhập',
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS songs_title_idx ON songs (title);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS songs_artist_idx ON songs (artist);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS songs_created_at_idx ON songs (created_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS sync_logs (
  id TEXT PRIMARY KEY NOT NULL,
  total_fetched INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL,
  error_message TEXT,
  synced_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sync_logs_synced_at_idx ON sync_logs (synced_at);
