-- Independent private list; existing main memberships remain unchanged.
CREATE TABLE IF NOT EXISTS user_app_other_players (
  user_id TEXT NOT NULL REFERENCES app_users(id),
  courtwatch_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id,courtwatch_id)
);
