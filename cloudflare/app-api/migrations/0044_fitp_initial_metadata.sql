-- No backfill: retained identities keep their existing 21-day refresh cycle.
CREATE TABLE IF NOT EXISTS fitp_initial_metadata (
 membership_card TEXT PRIMARY KEY,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','complete','partial','unavailable','error','identity_conflict','orphan')),
 queued_at TEXT NOT NULL,
 checked_at TEXT,
 error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS fitp_initial_metadata_pending ON fitp_initial_metadata(state,membership_card);
CREATE TRIGGER IF NOT EXISTS fitp_initial_metadata_insert AFTER INSERT ON player_circuit_identities
WHEN NEW.circuit='fitp' AND length(NEW.official_id) BETWEEN 6 AND 12 AND NEW.official_id NOT GLOB '*[^0-9]*'
 AND NOT EXISTS(SELECT 1 FROM player_circuit_identities old WHERE old.circuit='fitp' AND old.official_id=NEW.official_id AND old.source_key<>NEW.source_key)
 AND NOT EXISTS(SELECT 1 FROM fitp_player_metadata m WHERE m.membership_card=NEW.official_id)
BEGIN
 INSERT INTO fitp_initial_metadata(membership_card,queued_at) VALUES(NEW.official_id,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(membership_card) DO NOTHING;
END;
CREATE TRIGGER IF NOT EXISTS fitp_initial_metadata_update AFTER UPDATE OF official_id,circuit ON player_circuit_identities
WHEN (OLD.official_id IS NOT NEW.official_id OR OLD.circuit IS NOT NEW.circuit)
 AND NEW.circuit='fitp' AND length(NEW.official_id) BETWEEN 6 AND 12 AND NEW.official_id NOT GLOB '*[^0-9]*'
 AND NOT EXISTS(SELECT 1 FROM player_circuit_identities old WHERE old.circuit='fitp' AND old.official_id=NEW.official_id AND old.source_key<>NEW.source_key)
 AND NOT EXISTS(SELECT 1 FROM fitp_player_metadata m WHERE m.membership_card=NEW.official_id)
BEGIN
 INSERT INTO fitp_initial_metadata(membership_card,queued_at) VALUES(NEW.official_id,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(membership_card) DO NOTHING;
END;
