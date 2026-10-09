-- D1_WRITE_POLICY: incremental. Keep previous checkpoints and all player data.
ALTER TABLE player_profile_recovery_checked ADD COLUMN evidence_version INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS player_profile_recovery_runs(evidence_version INTEGER PRIMARY KEY,status TEXT NOT NULL);
-- Retry only unresolved sources when new official ranking/profile evidence arrives.
CREATE TRIGGER profile_recovery_new_te_alias AFTER INSERT ON tennis_europe_player_aliases
BEGIN
 UPDATE player_profile_recovery_checked SET evidence_version=0 WHERE evidence_version<>0 AND source_key IN (
  SELECT source_key FROM player_circuit_identities WHERE circuit='tennis-europe' AND profile_url='' AND lower(normalized_name)=lower(NEW.normalized_name)
 );
END;
CREATE TRIGGER profile_recovery_new_te_rank AFTER INSERT ON tennis_europe_ranking_history
BEGIN
 UPDATE player_profile_recovery_checked SET evidence_version=0 WHERE evidence_version<>0 AND source_key IN (
  SELECT source_key FROM player_circuit_identities WHERE circuit='tennis-europe' AND profile_url='' AND lower(normalized_name)=lower(NEW.normalized_name)
 );
END;
CREATE TRIGGER profile_recovery_new_participant AFTER INSERT ON match_participants
WHEN (length(NEW.source_player_id)=36 OR (length(NEW.source_player_id)=9 AND substr(NEW.source_player_id,1,3)='800'))
BEGIN
 UPDATE player_profile_recovery_checked SET evidence_version=0 WHERE evidence_version<>0 AND source_key IN (
  SELECT l.source_key FROM player_circuit_identities l JOIN matches m ON m.id=NEW.match_id
  WHERE l.circuit=m.circuit AND l.profile_url='' AND lower(l.normalized_name)=lower(NEW.normalized_name)
 );
END;
