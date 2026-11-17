-- D1_WRITE_POLICY: incremental. Immutable native-ID evidence from complete draws.
CREATE TABLE IF NOT EXISTS itf_draw_participations (
 source_player_id TEXT NOT NULL,
 draw_key TEXT NOT NULL,
 content_sha256 TEXT NOT NULL,
 tournament_id TEXT NOT NULL,
 display_name TEXT NOT NULL,
 PRIMARY KEY(source_player_id,draw_key,content_sha256),
 FOREIGN KEY(draw_key,content_sha256) REFERENCES itf_draw_documents(draw_key,content_sha256)
);
CREATE INDEX IF NOT EXISTS itf_draw_participations_document ON itf_draw_participations(draw_key,content_sha256,source_player_id);
