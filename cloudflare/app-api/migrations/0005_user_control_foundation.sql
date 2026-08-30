CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','operator','user')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','suspended')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS app_users_status_role ON app_users(status,role);
CREATE TABLE IF NOT EXISTS user_player_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id),
  observed_source_key TEXT NOT NULL REFERENCES observed_players(source_key),
  relationship TEXT NOT NULL DEFAULT 'follows' CHECK(relationship IN ('self','guardian','coach','follows')),
  alerts_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  UNIQUE(user_id,observed_source_key)
);
CREATE INDEX IF NOT EXISTS user_player_profiles_user ON user_player_profiles(user_id);
CREATE INDEX IF NOT EXISTS user_player_profiles_player ON user_player_profiles(observed_source_key);
