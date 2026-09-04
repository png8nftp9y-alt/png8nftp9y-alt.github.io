CREATE TABLE IF NOT EXISTS match_analyses (
  match_key TEXT PRIMARY KEY,
  analysis TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS match_analyses_updated ON match_analyses(updated_at);
