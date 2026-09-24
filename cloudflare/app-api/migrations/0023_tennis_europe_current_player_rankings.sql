CREATE TABLE IF NOT EXISTS tennis_europe_current_player_rankings (
  courtwatch_id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  ranking_date TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS tennis_europe_current_player_rankings_date
ON tennis_europe_current_player_rankings(ranking_date);
