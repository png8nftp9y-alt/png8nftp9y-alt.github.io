CREATE TABLE IF NOT EXISTS fitp_player_metadata (
 membership_card TEXT PRIMARY KEY,canonical_id TEXT NOT NULL,
 club TEXT NOT NULL DEFAULT '',ranking TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS fitp_metadata_person ON fitp_player_metadata(canonical_id);
CREATE TABLE IF NOT EXISTS fitp_metadata_progress (
 cycle TEXT PRIMARY KEY,last_card TEXT NOT NULL DEFAULT '',complete INTEGER NOT NULL DEFAULT 0,
 checked INTEGER NOT NULL DEFAULT 0,with_club INTEGER NOT NULL DEFAULT 0,with_ranking INTEGER NOT NULL DEFAULT 0,
 unavailable INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fitp_metadata_failures (
 cycle TEXT NOT NULL,membership_card TEXT NOT NULL,canonical_id TEXT NOT NULL,error TEXT NOT NULL,
 PRIMARY KEY(cycle,membership_card)
);
