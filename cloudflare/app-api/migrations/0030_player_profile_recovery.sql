CREATE TABLE IF NOT EXISTS player_profile_recovery_checked (
 source_table TEXT NOT NULL,source_key TEXT NOT NULL,source_payload TEXT NOT NULL,
 PRIMARY KEY(source_table,source_key)
);
