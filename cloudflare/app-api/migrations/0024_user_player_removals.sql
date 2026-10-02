CREATE TABLE IF NOT EXISTS user_app_player_removals (
  user_id TEXT NOT NULL REFERENCES app_users(id),
  courtwatch_id TEXT NOT NULL,
  removed_at TEXT NOT NULL,
  PRIMARY KEY(user_id,courtwatch_id)
);
