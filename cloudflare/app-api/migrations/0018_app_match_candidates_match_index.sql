-- Avoid a full app_match_candidates scan whenever a match is refreshed or deleted.
CREATE INDEX IF NOT EXISTS app_match_candidates_match
ON app_match_candidates(match_id);
