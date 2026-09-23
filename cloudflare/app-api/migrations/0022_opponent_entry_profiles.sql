CREATE TABLE IF NOT EXISTS opponent_entry_profiles (
  circuit TEXT NOT NULL,
  source_player_id TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (circuit, source_player_id)
);

CREATE INDEX IF NOT EXISTS opponent_entry_profiles_name
ON opponent_entry_profiles(normalized_name, circuit);
