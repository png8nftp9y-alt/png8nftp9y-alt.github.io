CREATE TABLE IF NOT EXISTS search_acquired_players (
 source_key TEXT PRIMARY KEY,circuit TEXT NOT NULL,official_id TEXT,
 normalized_name TEXT NOT NULL,display_name TEXT NOT NULL,payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS search_acquired_players_name ON search_acquired_players(normalized_name,source_key);
CREATE TABLE IF NOT EXISTS search_draw_indexed_versions (
 draw_key TEXT NOT NULL,content_sha256 TEXT NOT NULL,
 PRIMARY KEY(draw_key,content_sha256)
);
CREATE TABLE IF NOT EXISTS search_match_indexed (
 match_id TEXT PRIMARY KEY,source_payload TEXT NOT NULL
);
