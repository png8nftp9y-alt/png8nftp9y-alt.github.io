CREATE TABLE IF NOT EXISTS cloudflare_usage_snapshots (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  cycle_start TEXT NOT NULL,
  cycle_end TEXT NOT NULL,
  payload TEXT NOT NULL
);
