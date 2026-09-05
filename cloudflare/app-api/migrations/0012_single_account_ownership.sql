INSERT INTO app_users(id,email,display_name,role,status,created_at,updated_at,payload)
VALUES('user-federico-181099','federico181099@gmail.com','Federico','admin','active',datetime('now'),datetime('now'),'{}')
ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,role='admin',status='active',updated_at=datetime('now');

CREATE TABLE IF NOT EXISTS user_app_players (
  user_id TEXT NOT NULL REFERENCES app_users(id),
  courtwatch_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,courtwatch_id)
);
CREATE INDEX IF NOT EXISTS user_app_players_player ON user_app_players(courtwatch_id);
INSERT OR IGNORE INTO user_app_players(user_id,courtwatch_id,created_at)
SELECT 'user-federico-181099',id,datetime('now') FROM app_players;

CREATE TABLE IF NOT EXISTS user_match_analyses (
  user_id TEXT NOT NULL REFERENCES app_users(id),
  match_key TEXT NOT NULL,
  analysis TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id,match_key)
);
CREATE INDEX IF NOT EXISTS user_match_analyses_updated ON user_match_analyses(user_id,updated_at);
INSERT OR IGNORE INTO user_match_analyses(user_id,match_key,analysis,updated_at)
SELECT 'user-federico-181099',match_key,analysis,updated_at FROM match_analyses;
