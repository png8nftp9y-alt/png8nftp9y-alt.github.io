CREATE TABLE IF NOT EXISTS itf_junior_ranking_publications (
 category TEXT NOT NULL CHECK(category IN ('B','G')),ranking_date TEXT NOT NULL,
 expected_count INTEGER NOT NULL CHECK(expected_count>0),content_hash TEXT NOT NULL,
 captured_at TEXT NOT NULL,complete INTEGER NOT NULL DEFAULT 0 CHECK(complete IN (0,1)),
 PRIMARY KEY(category,ranking_date,content_hash)
);
CREATE TABLE IF NOT EXISTS itf_junior_ranking_history (
 category TEXT NOT NULL,ranking_date TEXT NOT NULL,content_hash TEXT NOT NULL,player_id TEXT NOT NULL,
 ranking INTEGER NOT NULL CHECK(ranking>0),points REAL NOT NULL,display_name TEXT NOT NULL,
 nationality TEXT,source_gender TEXT,PRIMARY KEY(category,ranking_date,content_hash,player_id),
 FOREIGN KEY(category,ranking_date,content_hash) REFERENCES itf_junior_ranking_publications(category,ranking_date,content_hash)
);
CREATE INDEX IF NOT EXISTS itf_junior_ranking_identity ON itf_junior_ranking_history(player_id,category,ranking_date);
CREATE TABLE IF NOT EXISTS itf_junior_ranking_attempts (
 run_id TEXT PRIMARY KEY,checked_at TEXT NOT NULL,status TEXT NOT NULL,detail TEXT NOT NULL,run_url TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS itf_junior_ranking_recovery (
 category TEXT PRIMARY KEY CHECK(category IN ('B','G')),cycle_key TEXT NOT NULL,
 phase TEXT NOT NULL CHECK(phase IN ('failed','acquired','complete')),
 next_retry_at TEXT,content_hash TEXT,ranking_date TEXT,expected_count INTEGER,
 snapshot_hash TEXT,chunk_count INTEGER,last_error TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS itf_junior_ranking_recovery_chunks (
 category TEXT NOT NULL,cycle_key TEXT NOT NULL,snapshot_hash TEXT NOT NULL,seq INTEGER NOT NULL,data TEXT NOT NULL,
 PRIMARY KEY(category,cycle_key,snapshot_hash,seq)
);

CREATE TABLE IF NOT EXISTS itf_junior_ranking_partial_publications (
 category TEXT NOT NULL,ranking_date TEXT NOT NULL,content_hash TEXT NOT NULL,
 expected_count INTEGER NOT NULL CHECK(expected_count>0),acquired_count INTEGER NOT NULL CHECK(acquired_count>0 AND acquired_count<=expected_count),
 captured_at TEXT NOT NULL,ready INTEGER NOT NULL DEFAULT 0 CHECK(ready IN (0,1)),
 PRIMARY KEY(category,ranking_date,content_hash),
 FOREIGN KEY(category,ranking_date,content_hash) REFERENCES itf_junior_ranking_publications(category,ranking_date,content_hash)
);
