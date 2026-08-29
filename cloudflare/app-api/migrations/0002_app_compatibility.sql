CREATE TABLE IF NOT EXISTS app_players (
  seq INTEGER PRIMARY KEY,
  id TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS app_players_id ON app_players(id);
CREATE TABLE IF NOT EXISTS app_tournaments (
  seq INTEGER PRIMARY KEY,
  player_id TEXT NOT NULL,
  competition_id TEXT,
  circuit TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_tournaments_player ON app_tournaments(player_id);
CREATE TABLE IF NOT EXISTS app_matches (
  seq INTEGER PRIMARY KEY,
  player_id TEXT NOT NULL,
  competition_id TEXT,
  match_date TEXT,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS app_matches_player_date ON app_matches(player_id,match_date);
