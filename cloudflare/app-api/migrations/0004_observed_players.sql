CREATE TABLE IF NOT EXISTS observed_players (
  source_key TEXT PRIMARY KEY,
  circuit TEXT NOT NULL,
  official_id TEXT,
  normalized_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  monitored INTEGER NOT NULL DEFAULT 0,
  observations INTEGER NOT NULL DEFAULT 1,
  first_observed_at TEXT,
  last_observed_at TEXT,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS observed_players_name ON observed_players(normalized_name);
CREATE INDEX IF NOT EXISTS observed_players_circuit_name ON observed_players(circuit,normalized_name);
CREATE INDEX IF NOT EXISTS observed_players_official_id ON observed_players(circuit,official_id);
CREATE INDEX IF NOT EXISTS observed_players_monitored ON observed_players(monitored,display_name);
