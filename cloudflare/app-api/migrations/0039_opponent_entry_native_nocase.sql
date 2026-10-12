-- D1_WRITE_POLICY: incremental
-- Native identity lookup is case-insensitive for UUIDs; circuit/card/ITF ID boundaries remain exact.
CREATE INDEX IF NOT EXISTS opponent_entry_native_nocase ON opponent_entry_profiles(circuit,source_player_id COLLATE NOCASE);
