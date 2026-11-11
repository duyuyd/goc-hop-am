-- Additive: do not change or delete existing songs, members or bookmarks.
ALTER TABLE songs ADD COLUMN sheet_key TEXT;
--> statement-breakpoint
ALTER TABLE songs ADD COLUMN sheet_mime TEXT;
--> statement-breakpoint
ALTER TABLE songs ADD COLUMN sheet_url TEXT;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS songs_sheet_key_idx ON songs(sheet_key);
