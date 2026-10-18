-- D1_WRITE_POLICY: incremental; additive indexes only, no source rewrites.
CREATE INDEX IF NOT EXISTS search_acquired_players_official ON search_acquired_players(circuit,official_id,display_name);
-- These sparse indexes let cold recovery enumerate exceptions rather than all valid identities.
CREATE INDEX IF NOT EXISTS identity_invalid_native ON player_circuit_identities(canonical_id,circuit,source_key)
WHERE (circuit='fitp' AND NOT(length(trim(official_id)) BETWEEN 6 AND 12 AND trim(official_id) NOT GLOB '*[^0-9]*')) OR (circuit='itf' AND NOT(length(trim(official_id))=9 AND trim(official_id) GLOB '800*' AND trim(official_id) NOT GLOB '*[^0-9]*'));
CREATE INDEX IF NOT EXISTS identity_invalid_europe ON player_circuit_identities(canonical_id,source_key,circuit,official_id)
WHERE circuit='tennis-europe' AND NOT (length(trim(official_id))=36 AND substr(trim(official_id),9,1)='-' AND substr(trim(official_id),14,1)='-' AND substr(trim(official_id),19,1)='-' AND substr(trim(official_id),24,1)='-' AND length(replace(trim(official_id),'-',''))=32 AND lower(replace(trim(official_id),'-','')) NOT GLOB '*[^0-9a-f]*');
-- Index only matches whose source changed. Checkpoints are acknowledged by revision.
CREATE TABLE IF NOT EXISTS search_pending_matches(match_id TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 1);
INSERT INTO search_pending_matches(match_id)
SELECT m.id FROM matches m LEFT JOIN search_match_indexed s ON s.match_id=m.id WHERE s.source_payload IS NOT m.payload
ON CONFLICT(match_id) DO NOTHING;
CREATE TRIGGER IF NOT EXISTS search_pending_match_insert AFTER INSERT ON matches
BEGIN
 INSERT INTO search_pending_matches(match_id) VALUES(NEW.id) ON CONFLICT(match_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS search_pending_match_update AFTER UPDATE ON matches WHEN OLD.payload IS NOT NEW.payload OR OLD.circuit IS NOT NEW.circuit OR OLD.id IS NOT NEW.id
BEGIN
 DELETE FROM search_pending_matches WHERE match_id=OLD.id AND OLD.id IS NOT NEW.id;
 INSERT INTO search_pending_matches(match_id) VALUES(NEW.id) ON CONFLICT(match_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS search_pending_match_delete AFTER DELETE ON matches
BEGIN
 DELETE FROM search_pending_matches WHERE match_id=OLD.id;
END;
CREATE TRIGGER IF NOT EXISTS search_pending_participant_insert AFTER INSERT ON match_participants
BEGIN
 INSERT INTO search_pending_matches(match_id) SELECT NEW.match_id WHERE EXISTS(SELECT 1 FROM matches WHERE id=NEW.match_id) ON CONFLICT(match_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS search_pending_participant_update AFTER UPDATE ON match_participants WHEN OLD.match_id IS NOT NEW.match_id OR OLD.display_name IS NOT NEW.display_name OR OLD.source_player_id IS NOT NEW.source_player_id OR OLD.nationality IS NOT NEW.nationality OR OLD.payload IS NOT NEW.payload
BEGIN
 INSERT INTO search_pending_matches(match_id) SELECT NEW.match_id WHERE EXISTS(SELECT 1 FROM matches WHERE id=NEW.match_id) ON CONFLICT(match_id) DO UPDATE SET revision=revision+1;
 INSERT INTO search_pending_matches(match_id) SELECT OLD.match_id WHERE OLD.match_id IS NOT NEW.match_id AND EXISTS(SELECT 1 FROM matches WHERE id=OLD.match_id) ON CONFLICT(match_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS search_pending_participant_delete AFTER DELETE ON match_participants
BEGIN
 INSERT INTO search_pending_matches(match_id) SELECT OLD.match_id WHERE EXISTS(SELECT 1 FROM matches WHERE id=OLD.match_id) ON CONFLICT(match_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER IF NOT EXISTS search_pending_read_check_insert AFTER INSERT ON search_pending_matches
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name='search-sources' AND state<>'dirty';
END;
CREATE TRIGGER IF NOT EXISTS search_pending_read_check_update AFTER UPDATE ON search_pending_matches WHEN OLD.match_id IS NOT NEW.match_id OR OLD.revision IS NOT NEW.revision
BEGIN
 UPDATE d1_read_check_cache SET state='dirty' WHERE name='search-sources' AND state<>'dirty';
END;
