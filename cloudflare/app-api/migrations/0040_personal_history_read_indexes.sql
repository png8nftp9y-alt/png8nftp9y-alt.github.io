-- Seek a player first, then paginate only their participants/matches.
CREATE INDEX IF NOT EXISTS match_participants_source_match
ON match_participants(source_player_id,match_id);
CREATE INDEX IF NOT EXISTS match_participants_name_match_key
ON match_participants(normalized_name,match_id,participant_key);
