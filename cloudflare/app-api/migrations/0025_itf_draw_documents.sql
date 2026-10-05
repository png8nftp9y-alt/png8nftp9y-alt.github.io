-- Full acquired ITF documents, not just their match projection.
-- No DELETE: content-addressed versions make replay safe and preserve provenance.
CREATE TABLE IF NOT EXISTS itf_draw_documents (
 draw_key TEXT NOT NULL,
 content_sha256 TEXT NOT NULL,
 competition_id TEXT NOT NULL,
 event TEXT NOT NULL,
 observed_at TEXT NOT NULL,
 content_bytes INTEGER NOT NULL CHECK(content_bytes>0),
 chunk_count INTEGER NOT NULL CHECK(chunk_count>0),
 player_count INTEGER NOT NULL CHECK(player_count>=0),
 match_count INTEGER NOT NULL CHECK(match_count>0),
 PRIMARY KEY(draw_key,content_sha256)
);
CREATE TABLE IF NOT EXISTS itf_draw_document_chunks (
 draw_key TEXT NOT NULL,
 content_sha256 TEXT NOT NULL,
 chunk_index INTEGER NOT NULL CHECK(chunk_index>=0),
 content TEXT NOT NULL,
 PRIMARY KEY(draw_key,content_sha256,chunk_index)
);
CREATE INDEX IF NOT EXISTS itf_draw_documents_tournament ON itf_draw_documents(competition_id,event);
CREATE INDEX IF NOT EXISTS itf_draw_documents_latest ON itf_draw_documents(draw_key,observed_at DESC,content_sha256 DESC);
CREATE VIEW IF NOT EXISTS itf_current_draw_documents AS
 SELECT d.* FROM itf_draw_documents d WHERE NOT EXISTS (
 SELECT 1 FROM itf_draw_documents newer WHERE newer.draw_key=d.draw_key
 AND (newer.observed_at>d.observed_at OR (newer.observed_at=d.observed_at AND newer.content_sha256>d.content_sha256))
 );
