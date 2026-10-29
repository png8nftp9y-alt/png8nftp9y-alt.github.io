-- D1_WRITE_POLICY: additive index only; no source records rewritten.
-- The three profile_recovery_new_* triggers search unresolved identities by
-- circuit and lower(normalized_name) for each incoming ranking/alias/player.
CREATE INDEX IF NOT EXISTS identity_missing_profile_circuit_lower_name
ON player_circuit_identities(circuit,lower(normalized_name),source_key)
WHERE profile_url='';
-- Checked records have a (source_table,source_key) primary key; the trigger
-- filters source_key alone and must not scan every checked profile per insert.
CREATE INDEX IF NOT EXISTS profile_recovery_checked_active_source
ON player_profile_recovery_checked(source_key)
WHERE evidence_version<>0;
-- The existing weekly verification sorts every historical publication and
-- scans the whole history to count the newest one without these lookups.
CREATE INDEX IF NOT EXISTS te_ranking_latest_publication
ON tennis_europe_ranking_history(ranking_date DESC,captured_at DESC,publication_id);
CREATE INDEX IF NOT EXISTS te_ranking_publication_category
ON tennis_europe_ranking_history(publication_id,category);
