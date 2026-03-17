PRAGMA foreign_keys = ON;

ALTER TABLE bibliographic_records ADD COLUMN subcategory_id TEXT REFERENCES categories(id);
ALTER TABLE bibliographic_records ADD COLUMN internal_note TEXT;
ALTER TABLE bibliographic_records ADD COLUMN public_visibility INTEGER NOT NULL DEFAULT 1;
ALTER TABLE bibliographic_records ADD COLUMN cover_thumbnail_r2_key TEXT;
ALTER TABLE bibliographic_records ADD COLUMN metadata_page_r2_key TEXT;
ALTER TABLE bibliographic_records ADD COLUMN normalized_authors TEXT NOT NULL DEFAULT '';
ALTER TABLE bibliographic_records ADD COLUMN source_payload_json TEXT;

ALTER TABLE book_copies ADD COLUMN room_label TEXT;
ALTER TABLE book_copies ADD COLUMN rack_label TEXT;
ALTER TABLE book_copies ADD COLUMN shelf_label TEXT;

CREATE INDEX IF NOT EXISTS idx_bibliographic_subcategory ON bibliographic_records(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_bibliographic_public_visibility ON bibliographic_records(public_visibility);
CREATE INDEX IF NOT EXISTS idx_bibliographic_authors ON bibliographic_records(normalized_authors);
