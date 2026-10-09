CREATE TABLE IF NOT EXISTS player_identity_people (
 canonical_id TEXT PRIMARY KEY,name_key TEXT NOT NULL,payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS player_identity_people_name ON player_identity_people(name_key,canonical_id);
CREATE TABLE IF NOT EXISTS player_circuit_identities (
 source_key TEXT PRIMARY KEY,canonical_id TEXT NOT NULL,name_key TEXT NOT NULL,
 circuit TEXT NOT NULL,official_id TEXT NOT NULL DEFAULT '',profile_url TEXT NOT NULL DEFAULT '',
 normalized_name TEXT NOT NULL,display_name TEXT NOT NULL,birth_year INTEGER,nationality TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS player_circuit_identity_person ON player_circuit_identities(canonical_id,circuit);
CREATE INDEX IF NOT EXISTS player_circuit_identity_official ON player_circuit_identities(circuit,official_id);
CREATE INDEX IF NOT EXISTS player_circuit_identity_name ON player_circuit_identities(name_key);
CREATE TABLE IF NOT EXISTS player_identity_aliases (alias_id TEXT PRIMARY KEY,canonical_id TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS player_identity_alias_person ON player_identity_aliases(canonical_id);
CREATE TABLE IF NOT EXISTS player_identity_pending_sources (
 source_table TEXT NOT NULL,source_key TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(source_table,source_key)
);
CREATE TABLE IF NOT EXISTS player_identity_sync (id TEXT PRIMARY KEY,status TEXT NOT NULL);
CREATE TRIGGER IF NOT EXISTS identity_queue_observed_players_insert AFTER INSERT ON observed_players
BEGIN
 INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('observed_players',NEW.source_key)
 ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS identity_queue_observed_players_update AFTER UPDATE ON observed_players WHEN OLD.payload IS NOT NEW.payload OR OLD.official_id IS NOT NEW.official_id OR OLD.circuit IS NOT NEW.circuit OR OLD.display_name IS NOT NEW.display_name
BEGIN
 INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('observed_players',NEW.source_key)
 ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;
END;
INSERT INTO player_identity_pending_sources(source_table,source_key) SELECT 'observed_players',source_key FROM observed_players WHERE 1 ON CONFLICT DO NOTHING;
CREATE TRIGGER IF NOT EXISTS identity_queue_search_acquired_players_insert AFTER INSERT ON search_acquired_players
BEGIN
 INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('search_acquired_players',NEW.source_key)
 ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS identity_queue_search_acquired_players_update AFTER UPDATE ON search_acquired_players WHEN OLD.payload IS NOT NEW.payload OR OLD.official_id IS NOT NEW.official_id OR OLD.circuit IS NOT NEW.circuit OR OLD.display_name IS NOT NEW.display_name
BEGIN
 INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('search_acquired_players',NEW.source_key)
 ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;
END;
INSERT INTO player_identity_pending_sources(source_table,source_key) SELECT 'search_acquired_players',source_key FROM search_acquired_players WHERE 1 ON CONFLICT DO NOTHING;
CREATE TRIGGER IF NOT EXISTS identity_queue_app_players_insert AFTER INSERT ON app_players
BEGIN
 INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('app_players',NEW.id)
 ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS identity_queue_app_players_update AFTER UPDATE ON app_players WHEN OLD.payload IS NOT NEW.payload
BEGIN
 INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('app_players',NEW.id)
 ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;
END;
INSERT INTO player_identity_pending_sources(source_table,source_key) SELECT 'app_players',id FROM app_players WHERE 1 ON CONFLICT DO NOTHING;
CREATE TRIGGER IF NOT EXISTS identity_queue_user_app_player_additions_insert AFTER INSERT ON user_app_player_additions WHEN NOT EXISTS(SELECT 1 FROM player_identity_aliases WHERE alias_id=NEW.courtwatch_id)
BEGIN
 INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('user_app_player_additions',NEW.courtwatch_id)
 ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS identity_queue_user_app_player_additions_update AFTER UPDATE ON user_app_player_additions WHEN OLD.payload IS NOT NEW.payload AND (NOT EXISTS(SELECT 1 FROM player_identity_aliases WHERE alias_id=NEW.courtwatch_id) OR json_extract(OLD.payload,'$.birthYear') IS NOT json_extract(NEW.payload,'$.birthYear') OR json_extract(OLD.payload,'$.nationality') IS NOT json_extract(NEW.payload,'$.nationality'))
BEGIN
 INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('user_app_player_additions',NEW.courtwatch_id)
 ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;
END;
INSERT INTO player_identity_pending_sources(source_table,source_key) SELECT 'user_app_player_additions',courtwatch_id FROM user_app_player_additions WHERE 1 ON CONFLICT DO NOTHING;
