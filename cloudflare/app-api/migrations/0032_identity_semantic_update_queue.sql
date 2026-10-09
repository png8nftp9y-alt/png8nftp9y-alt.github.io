-- D1_WRITE_POLICY: incremental; no backfill and no data deletion.
DROP TRIGGER IF EXISTS identity_queue_observed_players_update;
CREATE TRIGGER identity_queue_observed_players_update AFTER UPDATE ON observed_players WHEN OLD.official_id IS NOT NEW.official_id OR OLD.circuit IS NOT NEW.circuit OR OLD.display_name IS NOT NEW.display_name OR OLD.normalized_name IS NOT NEW.normalized_name OR (EXISTS(SELECT 1 FROM json_each(OLD.payload) o WHERE o.key NOT IN ('updatedAt','generatedAt','observedAt','lastObservedAt','lastSeenAt','checkedAt','syncedAt','ranking','rankings','fitpRanking','diagnostics','lastAttemptAt') AND o.value IS NOT json_extract(NEW.payload,'$."'||o.key||'"')) OR EXISTS(SELECT 1 FROM json_each(NEW.payload) n WHERE n.key NOT IN ('updatedAt','generatedAt','observedAt','lastObservedAt','lastSeenAt','checkedAt','syncedAt','ranking','rankings','fitpRanking','diagnostics','lastAttemptAt') AND n.value IS NOT json_extract(OLD.payload,'$."'||n.key||'"')))
BEGIN
 INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('observed_players',NEW.source_key)
 ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;
END;
DROP TRIGGER IF EXISTS identity_queue_search_acquired_players_update;
CREATE TRIGGER identity_queue_search_acquired_players_update AFTER UPDATE ON search_acquired_players WHEN OLD.official_id IS NOT NEW.official_id OR OLD.circuit IS NOT NEW.circuit OR OLD.display_name IS NOT NEW.display_name OR OLD.normalized_name IS NOT NEW.normalized_name OR (EXISTS(SELECT 1 FROM json_each(OLD.payload) o WHERE o.key NOT IN ('updatedAt','generatedAt','observedAt','lastObservedAt','lastSeenAt','checkedAt','syncedAt','ranking','rankings','fitpRanking','diagnostics','lastAttemptAt') AND o.value IS NOT json_extract(NEW.payload,'$."'||o.key||'"')) OR EXISTS(SELECT 1 FROM json_each(NEW.payload) n WHERE n.key NOT IN ('updatedAt','generatedAt','observedAt','lastObservedAt','lastSeenAt','checkedAt','syncedAt','ranking','rankings','fitpRanking','diagnostics','lastAttemptAt') AND n.value IS NOT json_extract(OLD.payload,'$."'||n.key||'"')))
BEGIN
 INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('search_acquired_players',NEW.source_key)
 ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;
END;
DROP TRIGGER IF EXISTS identity_queue_app_players_update;
CREATE TRIGGER identity_queue_app_players_update AFTER UPDATE ON app_players WHEN (EXISTS(SELECT 1 FROM json_each(OLD.payload) o WHERE o.key NOT IN ('updatedAt','generatedAt','observedAt','lastObservedAt','lastSeenAt','checkedAt','syncedAt','ranking','rankings','fitpRanking','diagnostics','lastAttemptAt') AND o.value IS NOT json_extract(NEW.payload,'$."'||o.key||'"')) OR EXISTS(SELECT 1 FROM json_each(NEW.payload) n WHERE n.key NOT IN ('updatedAt','generatedAt','observedAt','lastObservedAt','lastSeenAt','checkedAt','syncedAt','ranking','rankings','fitpRanking','diagnostics','lastAttemptAt') AND n.value IS NOT json_extract(OLD.payload,'$."'||n.key||'"')))
BEGIN
 INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('app_players',NEW.id)
 ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;
END;
DROP TRIGGER IF EXISTS identity_queue_user_app_player_additions_update;
CREATE TRIGGER identity_queue_user_app_player_additions_update AFTER UPDATE ON user_app_player_additions WHEN (EXISTS(SELECT 1 FROM json_each(OLD.payload) o WHERE o.key NOT IN ('updatedAt','generatedAt','observedAt','lastObservedAt','lastSeenAt','checkedAt','syncedAt','ranking','rankings','fitpRanking','diagnostics','lastAttemptAt') AND o.value IS NOT json_extract(NEW.payload,'$."'||o.key||'"')) OR EXISTS(SELECT 1 FROM json_each(NEW.payload) n WHERE n.key NOT IN ('updatedAt','generatedAt','observedAt','lastObservedAt','lastSeenAt','checkedAt','syncedAt','ranking','rankings','fitpRanking','diagnostics','lastAttemptAt') AND n.value IS NOT json_extract(OLD.payload,'$."'||n.key||'"')))
BEGIN
 INSERT INTO player_identity_pending_sources(source_table,source_key) VALUES('user_app_player_additions',NEW.courtwatch_id)
 ON CONFLICT(source_table,source_key) DO UPDATE SET revision=revision+1;
END;
