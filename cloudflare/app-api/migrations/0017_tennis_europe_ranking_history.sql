CREATE TABLE IF NOT EXISTS tennis_europe_ranking_history (
  profile_id TEXT NOT NULL,
  ranking_date TEXT NOT NULL,
  publication_id TEXT NOT NULL,
  week_label TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('B14','G14','B16','G16')),
  ranking INTEGER NOT NULL,
  points REAL,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  nationality TEXT,
  source_url TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  PRIMARY KEY(profile_id, ranking_date, category)
);
CREATE INDEX IF NOT EXISTS te_ranking_name_date ON tennis_europe_ranking_history(normalized_name,category,ranking_date DESC);

CREATE TABLE IF NOT EXISTS tennis_europe_player_aliases (
  profile_id TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  nationality TEXT,
  courtwatch_id TEXT,
  verified_at TEXT NOT NULL,
  PRIMARY KEY(profile_id, normalized_name)
);
CREATE INDEX IF NOT EXISTS te_alias_courtwatch ON tennis_europe_player_aliases(courtwatch_id);

CREATE TABLE IF NOT EXISTS tennis_europe_match_ranking_snapshots (
  courtwatch_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  participant_role TEXT NOT NULL CHECK(participant_role IN ('player','partner','opponent')),
  participant_index INTEGER NOT NULL DEFAULT 0,
  profile_id TEXT,
  category TEXT NOT NULL CHECK(category IN ('B14','G14','B16','G16')),
  ranking INTEGER,
  ranking_date TEXT,
  publication_id TEXT,
  snapshotted_at TEXT NOT NULL,
  PRIMARY KEY(courtwatch_id,match_id,participant_role,participant_index)
);
CREATE INDEX IF NOT EXISTS te_match_ranking_lookup ON tennis_europe_match_ranking_snapshots(courtwatch_id,match_id);
