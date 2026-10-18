-- D1_WRITE_POLICY: incremental; no source data deletion or backfill.
CREATE TABLE IF NOT EXISTS d1_read_check_cache (
 name TEXT PRIMARY KEY,state TEXT NOT NULL DEFAULT 'dirty' CHECK(state IN ('dirty','running','valid')),
 token TEXT NOT NULL DEFAULT '',version TEXT NOT NULL DEFAULT '',result_json TEXT,verified_at TEXT
);
INSERT INTO d1_read_check_cache(name) VALUES('profile-evidence') ON CONFLICT DO NOTHING;
INSERT INTO d1_read_check_cache(name) VALUES('europe-profiles') ON CONFLICT DO NOTHING;
INSERT INTO d1_read_check_cache(name) VALUES('native-profiles') ON CONFLICT DO NOTHING;
INSERT INTO d1_read_check_cache(name) VALUES('search-sources') ON CONFLICT DO NOTHING;
INSERT INTO d1_read_check_cache(name) VALUES('universal-counts') ON CONFLICT DO NOTHING;
INSERT INTO d1_read_check_cache(name) VALUES('observed-counts') ON CONFLICT DO NOTHING;
INSERT INTO d1_read_check_cache(name) VALUES('europe-counts') ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS identity_missing_profile ON player_circuit_identities(source_key,canonical_id,circuit) WHERE profile_url='';
CREATE TRIGGER IF NOT EXISTS read_check_player_identity_pending_sources_insert AFTER INSERT ON player_identity_pending_sources WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_player_identity_pending_sources_update AFTER UPDATE ON player_identity_pending_sources WHEN OLD.source_table IS NOT NEW.source_table OR OLD.source_key IS NOT NEW.source_key OR OLD.revision IS NOT NEW.revision
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_player_identity_pending_sources_delete AFTER DELETE ON player_identity_pending_sources WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_player_circuit_identities_insert AFTER INSERT ON player_circuit_identities WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_player_circuit_identities_update AFTER UPDATE ON player_circuit_identities WHEN OLD.source_key IS NOT NEW.source_key OR OLD.canonical_id IS NOT NEW.canonical_id OR OLD.name_key IS NOT NEW.name_key OR OLD.circuit IS NOT NEW.circuit OR OLD.official_id IS NOT NEW.official_id OR OLD.profile_url IS NOT NEW.profile_url OR OLD.normalized_name IS NOT NEW.normalized_name OR OLD.display_name IS NOT NEW.display_name OR OLD.birth_year IS NOT NEW.birth_year OR OLD.nationality IS NOT NEW.nationality
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_player_circuit_identities_delete AFTER DELETE ON player_circuit_identities WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_player_identity_people_insert AFTER INSERT ON player_identity_people WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_player_identity_people_update AFTER UPDATE ON player_identity_people WHEN OLD.canonical_id IS NOT NEW.canonical_id OR OLD.name_key IS NOT NEW.name_key OR OLD.payload IS NOT NEW.payload
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_player_identity_people_delete AFTER DELETE ON player_identity_people WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_observed_players_insert AFTER INSERT ON observed_players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('observed-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_observed_players_update AFTER UPDATE ON observed_players WHEN OLD.source_key IS NOT NEW.source_key OR OLD.circuit IS NOT NEW.circuit
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('observed-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_observed_players_delete AFTER DELETE ON observed_players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('observed-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_search_acquired_players_insert AFTER INSERT ON search_acquired_players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_search_acquired_players_update AFTER UPDATE ON search_acquired_players WHEN OLD.source_key IS NOT NEW.source_key OR OLD.circuit IS NOT NEW.circuit OR OLD.official_id IS NOT NEW.official_id OR OLD.normalized_name IS NOT NEW.normalized_name OR OLD.display_name IS NOT NEW.display_name OR OLD.payload IS NOT NEW.payload
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_search_acquired_players_delete AFTER DELETE ON search_acquired_players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_matches_insert AFTER INSERT ON matches WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles','search-sources','europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_matches_update AFTER UPDATE ON matches WHEN OLD.id IS NOT NEW.id OR OLD.tournament_id IS NOT NEW.tournament_id OR OLD.circuit IS NOT NEW.circuit OR OLD.played_date IS NOT NEW.played_date OR OLD.payload IS NOT NEW.payload
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles','search-sources','europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_matches_delete AFTER DELETE ON matches WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles','search-sources','europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_match_participants_insert AFTER INSERT ON match_participants WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles','search-sources','europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_match_participants_update AFTER UPDATE ON match_participants WHEN OLD.match_id IS NOT NEW.match_id OR OLD.participant_key IS NOT NEW.participant_key OR OLD.source_player_id IS NOT NEW.source_player_id OR OLD.display_name IS NOT NEW.display_name OR OLD.normalized_name IS NOT NEW.normalized_name OR OLD.nationality IS NOT NEW.nationality OR OLD.team_index IS NOT NEW.team_index OR OLD.is_winner IS NOT NEW.is_winner OR OLD.payload IS NOT NEW.payload
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles','search-sources','europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_match_participants_delete AFTER DELETE ON match_participants WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence','europe-profiles','native-profiles','search-sources','europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_tournaments_insert AFTER INSERT ON tournaments WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-profiles','native-profiles','europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_tournaments_update AFTER UPDATE ON tournaments WHEN OLD.id IS NOT NEW.id OR OLD.circuit IS NOT NEW.circuit OR OLD.source_tournament_id IS NOT NEW.source_tournament_id
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-profiles','native-profiles','europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_tournaments_delete AFTER DELETE ON tournaments WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-profiles','native-profiles','europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_tennis_europe_ranking_history_insert AFTER INSERT ON tennis_europe_ranking_history WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_tennis_europe_ranking_history_update AFTER UPDATE ON tennis_europe_ranking_history WHEN OLD.profile_id IS NOT NEW.profile_id OR OLD.ranking_date IS NOT NEW.ranking_date OR OLD.publication_id IS NOT NEW.publication_id OR OLD.week_label IS NOT NEW.week_label OR OLD.category IS NOT NEW.category OR OLD.ranking IS NOT NEW.ranking OR OLD.points IS NOT NEW.points OR OLD.display_name IS NOT NEW.display_name OR OLD.normalized_name IS NOT NEW.normalized_name OR OLD.nationality IS NOT NEW.nationality OR OLD.source_url IS NOT NEW.source_url OR OLD.captured_at IS NOT NEW.captured_at
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_tennis_europe_ranking_history_delete AFTER DELETE ON tennis_europe_ranking_history WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_tennis_europe_player_aliases_insert AFTER INSERT ON tennis_europe_player_aliases WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_tennis_europe_player_aliases_update AFTER UPDATE ON tennis_europe_player_aliases WHEN OLD.profile_id IS NOT NEW.profile_id OR OLD.normalized_name IS NOT NEW.normalized_name OR OLD.nationality IS NOT NEW.nationality OR OLD.courtwatch_id IS NOT NEW.courtwatch_id OR OLD.verified_at IS NOT NEW.verified_at
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_tennis_europe_player_aliases_delete AFTER DELETE ON tennis_europe_player_aliases WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('profile-evidence') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_itf_draw_documents_insert AFTER INSERT ON itf_draw_documents WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('search-sources') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_itf_draw_documents_update AFTER UPDATE ON itf_draw_documents WHEN OLD.draw_key IS NOT NEW.draw_key OR OLD.content_sha256 IS NOT NEW.content_sha256 OR OLD.competition_id IS NOT NEW.competition_id OR OLD.event IS NOT NEW.event OR OLD.observed_at IS NOT NEW.observed_at OR OLD.content_bytes IS NOT NEW.content_bytes OR OLD.chunk_count IS NOT NEW.chunk_count OR OLD.player_count IS NOT NEW.player_count OR OLD.match_count IS NOT NEW.match_count
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('search-sources') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_itf_draw_documents_delete AFTER DELETE ON itf_draw_documents WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('search-sources') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_itf_draw_document_chunks_insert AFTER INSERT ON itf_draw_document_chunks WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('search-sources') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_itf_draw_document_chunks_update AFTER UPDATE ON itf_draw_document_chunks WHEN OLD.draw_key IS NOT NEW.draw_key OR OLD.content_sha256 IS NOT NEW.content_sha256 OR OLD.chunk_index IS NOT NEW.chunk_index OR OLD.content IS NOT NEW.content
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('search-sources') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_itf_draw_document_chunks_delete AFTER DELETE ON itf_draw_document_chunks WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('search-sources') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_search_draw_indexed_versions_insert AFTER INSERT ON search_draw_indexed_versions WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('search-sources') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_search_draw_indexed_versions_update AFTER UPDATE ON search_draw_indexed_versions WHEN OLD.draw_key IS NOT NEW.draw_key OR OLD.content_sha256 IS NOT NEW.content_sha256
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('search-sources') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_search_draw_indexed_versions_delete AFTER DELETE ON search_draw_indexed_versions WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('search-sources') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_search_match_indexed_insert AFTER INSERT ON search_match_indexed WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('search-sources') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_search_match_indexed_update AFTER UPDATE ON search_match_indexed WHEN OLD.match_id IS NOT NEW.match_id OR OLD.source_payload IS NOT NEW.source_payload
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('search-sources') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_search_match_indexed_delete AFTER DELETE ON search_match_indexed WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('search-sources') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_players_insert AFTER INSERT ON players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_players_update AFTER UPDATE ON players WHEN OLD.id IS NOT NEW.id
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_players_delete AFTER DELETE ON players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_entries_insert AFTER INSERT ON entries WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_entries_update AFTER UPDATE ON entries WHEN OLD.id IS NOT NEW.id
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_entries_delete AFTER DELETE ON entries WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_app_players_insert AFTER INSERT ON app_players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_app_players_update AFTER UPDATE ON app_players WHEN OLD.id IS NOT NEW.id
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_app_players_delete AFTER DELETE ON app_players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_app_users_insert AFTER INSERT ON app_users WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_app_users_update AFTER UPDATE ON app_users WHEN OLD.id IS NOT NEW.id OR OLD.email IS NOT NEW.email OR OLD.status IS NOT NEW.status
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_app_users_delete AFTER DELETE ON app_users WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_app_players_insert AFTER INSERT ON user_app_players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_app_players_update AFTER UPDATE ON user_app_players WHEN OLD.user_id IS NOT NEW.user_id OR OLD.courtwatch_id IS NOT NEW.courtwatch_id OR OLD.created_at IS NOT NEW.created_at
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_app_players_delete AFTER DELETE ON user_app_players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_app_player_removals_insert AFTER INSERT ON user_app_player_removals WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_app_player_removals_update AFTER UPDATE ON user_app_player_removals WHEN OLD.user_id IS NOT NEW.user_id OR OLD.courtwatch_id IS NOT NEW.courtwatch_id OR OLD.removed_at IS NOT NEW.removed_at
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_app_player_removals_delete AFTER DELETE ON user_app_player_removals WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_app_player_additions_insert AFTER INSERT ON user_app_player_additions WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_app_player_additions_update AFTER UPDATE ON user_app_player_additions WHEN OLD.user_id IS NOT NEW.user_id OR OLD.courtwatch_id IS NOT NEW.courtwatch_id
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_app_player_additions_delete AFTER DELETE ON user_app_player_additions WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_app_other_players_insert AFTER INSERT ON user_app_other_players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_app_other_players_update AFTER UPDATE ON user_app_other_players WHEN OLD.user_id IS NOT NEW.user_id OR OLD.courtwatch_id IS NOT NEW.courtwatch_id OR OLD.created_at IS NOT NEW.created_at
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_app_other_players_delete AFTER DELETE ON user_app_other_players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_match_analyses_insert AFTER INSERT ON user_match_analyses WHEN (1) AND (NEW.match_key<>'__courtwatch_analysis_crud_probe__')
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_match_analyses_update AFTER UPDATE ON user_match_analyses WHEN (OLD.user_id IS NOT NEW.user_id OR OLD.match_key IS NOT NEW.match_key) AND (OLD.match_key<>'__courtwatch_analysis_crud_probe__' OR NEW.match_key<>'__courtwatch_analysis_crud_probe__')
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_user_match_analyses_delete AFTER DELETE ON user_match_analyses WHEN (1) AND (OLD.match_key<>'__courtwatch_analysis_crud_probe__')
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_match_analyses_insert AFTER INSERT ON match_analyses WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_match_analyses_update AFTER UPDATE ON match_analyses WHEN OLD.match_key IS NOT NEW.match_key OR OLD.analysis IS NOT NEW.analysis OR OLD.updated_at IS NOT NEW.updated_at
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_match_analyses_delete AFTER DELETE ON match_analyses WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_schedules_insert AFTER INSERT ON schedules WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_schedules_update AFTER UPDATE ON schedules WHEN OLD.id IS NOT NEW.id OR OLD.circuit IS NOT NEW.circuit
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_schedules_delete AFTER DELETE ON schedules WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_results_insert AFTER INSERT ON results WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_results_update AFTER UPDATE ON results WHEN OLD.id IS NOT NEW.id OR OLD.circuit IS NOT NEW.circuit
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_results_delete AFTER DELETE ON results WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_tennis_europe_players_insert AFTER INSERT ON tennis_europe_players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_tennis_europe_players_update AFTER UPDATE ON tennis_europe_players WHEN OLD.identity_key IS NOT NEW.identity_key OR OLD.display_name IS NOT NEW.display_name OR OLD.normalized_name IS NOT NEW.normalized_name OR OLD.nationality IS NOT NEW.nationality OR OLD.occurrences IS NOT NEW.occurrences OR OLD.first_match_date IS NOT NEW.first_match_date OR OLD.last_match_date IS NOT NEW.last_match_date OR OLD.payload IS NOT NEW.payload
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_tennis_europe_players_delete AFTER DELETE ON tennis_europe_players WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_app_match_candidates_insert AFTER INSERT ON app_match_candidates WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_app_match_candidates_update AFTER UPDATE ON app_match_candidates WHEN OLD.courtwatch_id IS NOT NEW.courtwatch_id OR OLD.match_id IS NOT NEW.match_id OR OLD.competition_id IS NOT NEW.competition_id OR OLD.match_date IS NOT NEW.match_date OR OLD.status IS NOT NEW.status OR OLD.payload IS NOT NEW.payload
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_app_match_candidates_delete AFTER DELETE ON app_match_candidates WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_app_matches_insert AFTER INSERT ON app_matches WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts','universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_app_matches_update AFTER UPDATE ON app_matches WHEN OLD.seq IS NOT NEW.seq OR OLD.player_id IS NOT NEW.player_id OR OLD.competition_id IS NOT NEW.competition_id OR OLD.match_date IS NOT NEW.match_date OR OLD.payload IS NOT NEW.payload
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts','universal-counts') AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS read_check_app_matches_delete AFTER DELETE ON app_matches WHEN 1
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name IN ('europe-counts','universal-counts') AND state<>'dirty';
END;
