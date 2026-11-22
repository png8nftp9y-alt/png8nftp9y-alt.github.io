-- User-owned events remain separate from all automatic imports.
CREATE TABLE IF NOT EXISTS user_calendar_events (
 user_id TEXT NOT NULL, player_group TEXT NOT NULL CHECK(player_group IN ('main','others')),
 id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
 PRIMARY KEY(user_id,player_group,id)
) WITHOUT ROWID;
