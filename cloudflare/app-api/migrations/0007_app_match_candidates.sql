CREATE TABLE IF NOT EXISTS app_match_candidates (
  courtwatch_id TEXT NOT NULL,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  competition_id TEXT NOT NULL,
  match_date TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  PRIMARY KEY(courtwatch_id,match_id)
);
CREATE INDEX IF NOT EXISTS app_match_candidates_player_date ON app_match_candidates(courtwatch_id,match_date);
