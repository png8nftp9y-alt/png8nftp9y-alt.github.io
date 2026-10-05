-- Personal selections survive regenerated app_players projections.
CREATE TABLE IF NOT EXISTS user_app_player_additions (
  user_id TEXT NOT NULL REFERENCES app_users(id),
  courtwatch_id TEXT NOT NULL,
  observed_source_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,courtwatch_id),
  UNIQUE(user_id,observed_source_key)
);
