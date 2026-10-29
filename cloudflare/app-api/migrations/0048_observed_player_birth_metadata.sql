CREATE TABLE IF NOT EXISTS player_birth_metadata (
 source_key TEXT PRIMARY KEY,canonical_id TEXT NOT NULL,circuit TEXT NOT NULL,
 official_id TEXT NOT NULL DEFAULT '',birth_year INTEGER,
 status TEXT NOT NULL,source_url TEXT NOT NULL DEFAULT '',checked_at TEXT NOT NULL,error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS player_birth_metadata_person ON player_birth_metadata(canonical_id);
