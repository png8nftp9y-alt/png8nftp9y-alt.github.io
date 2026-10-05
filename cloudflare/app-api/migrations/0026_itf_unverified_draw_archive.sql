-- Preserve checksum-verified archive documents with insufficient acquisition
-- evidence. Separate from complete draws: no table rewrite or proof upgrade.
CREATE TABLE IF NOT EXISTS itf_draw_unverified_documents (
 draw_key TEXT NOT NULL,
 content_sha256 TEXT NOT NULL,
 competition_id TEXT NOT NULL,
 event TEXT NOT NULL,
 observed_at TEXT NOT NULL,
 content_bytes INTEGER NOT NULL CHECK(content_bytes>0),
 chunk_count INTEGER NOT NULL CHECK(chunk_count>0),
 player_count INTEGER NOT NULL CHECK(player_count>=0),
 match_count INTEGER NOT NULL CHECK(match_count>=0),
 PRIMARY KEY(draw_key,content_sha256)
);
CREATE INDEX IF NOT EXISTS itf_draw_unverified_documents_tournament
 ON itf_draw_unverified_documents(competition_id,event);
