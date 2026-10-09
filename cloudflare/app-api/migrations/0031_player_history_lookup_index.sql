CREATE INDEX IF NOT EXISTS match_participants_lower_name_match
ON match_participants(lower(normalized_name),match_id);
