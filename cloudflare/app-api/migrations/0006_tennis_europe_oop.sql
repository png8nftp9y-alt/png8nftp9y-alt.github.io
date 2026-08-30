CREATE TABLE IF NOT EXISTS tennis_europe_players (
  identity_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  nationality TEXT,
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_match_date TEXT,
  last_match_date TEXT,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS te_players_name ON tennis_europe_players(normalized_name);

CREATE TABLE IF NOT EXISTS match_participants (
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  participant_key TEXT NOT NULL,
  source_player_id TEXT,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  nationality TEXT,
  team_index INTEGER NOT NULL,
  is_winner INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,
  PRIMARY KEY(match_id,participant_key)
);
CREATE INDEX IF NOT EXISTS match_participants_name ON match_participants(normalized_name);
CREATE INDEX IF NOT EXISTS match_participants_match ON match_participants(match_id);
