CREATE INDEX IF NOT EXISTS match_participants_source_player
ON match_participants(source_player_id);

CREATE INDEX IF NOT EXISTS te_ranking_profile_date
ON tennis_europe_ranking_history(profile_id, category, ranking_date DESC);
