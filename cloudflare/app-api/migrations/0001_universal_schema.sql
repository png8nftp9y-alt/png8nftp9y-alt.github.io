CREATE TABLE IF NOT EXISTS generations (
  id TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  status TEXT NOT NULL,
  counts_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  courtwatch_id TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tournaments (
  id TEXT PRIMARY KEY,
  circuit TEXT NOT NULL,
  source_tournament_id TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tournaments_circuit_dates ON tournaments(circuit,start_date,end_date);
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  player_id TEXT NOT NULL REFERENCES players(id),
  circuit TEXT NOT NULL,
  state TEXT,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS entries_player ON entries(player_id);
CREATE INDEX IF NOT EXISTS entries_tournament ON entries(tournament_id);
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  match_id TEXT,
  circuit TEXT NOT NULL,
  local_date TEXT,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS schedules_date ON schedules(local_date);
CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  circuit TEXT NOT NULL,
  played_date TEXT,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,
  tournament_id TEXT NOT NULL REFERENCES tournaments(id),
  match_id TEXT,
  circuit TEXT NOT NULL,
  played_date TEXT,
  payload TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
