-- Derived partition checkpoints only; source payloads are never rewritten.
CREATE TABLE IF NOT EXISTS opponent_entry_bucket_checks(circuit TEXT NOT NULL,bucket INTEGER NOT NULL,digest TEXT,PRIMARY KEY(circuit,bucket));
CREATE INDEX IF NOT EXISTS opponent_entry_bucket_lookup ON opponent_entry_profiles(circuit,((COALESCE(unicode(substr(source_player_id,-1,1)),0)+17*COALESCE(unicode(substr(source_player_id,-2,1)),0)+31*COALESCE(unicode(substr(source_player_id,-3,1)),0)+43*COALESCE(unicode(substr(source_player_id,-4,1)),0))%128),source_player_id);
INSERT INTO opponent_entry_bucket_checks(circuit,bucket) SELECT DISTINCT circuit,((COALESCE(unicode(substr(source_player_id,-1,1)),0)+17*COALESCE(unicode(substr(source_player_id,-2,1)),0)+31*COALESCE(unicode(substr(source_player_id,-3,1)),0)+43*COALESCE(unicode(substr(source_player_id,-4,1)),0))%128) FROM opponent_entry_profiles WHERE 1 ON CONFLICT DO NOTHING;
CREATE TRIGGER IF NOT EXISTS opponent_entry_bucket_insert AFTER INSERT ON opponent_entry_profiles BEGIN
 INSERT INTO opponent_entry_bucket_checks(circuit,bucket,digest) VALUES(NEW.circuit,((COALESCE(unicode(substr(NEW.source_player_id,-1,1)),0)+17*COALESCE(unicode(substr(NEW.source_player_id,-2,1)),0)+31*COALESCE(unicode(substr(NEW.source_player_id,-3,1)),0)+43*COALESCE(unicode(substr(NEW.source_player_id,-4,1)),0))%128),NULL) ON CONFLICT(circuit,bucket) DO UPDATE SET digest=NULL WHERE digest IS NOT NULL;
 UPDATE app_state SET value='' WHERE key='opponentEntryHash' AND value<>'';
END;
CREATE TRIGGER IF NOT EXISTS opponent_entry_bucket_delete AFTER DELETE ON opponent_entry_profiles BEGIN
 INSERT INTO opponent_entry_bucket_checks(circuit,bucket,digest) VALUES(OLD.circuit,((COALESCE(unicode(substr(OLD.source_player_id,-1,1)),0)+17*COALESCE(unicode(substr(OLD.source_player_id,-2,1)),0)+31*COALESCE(unicode(substr(OLD.source_player_id,-3,1)),0)+43*COALESCE(unicode(substr(OLD.source_player_id,-4,1)),0))%128),NULL) ON CONFLICT(circuit,bucket) DO UPDATE SET digest=NULL WHERE digest IS NOT NULL;
 UPDATE app_state SET value='' WHERE key='opponentEntryHash' AND value<>'';
END;
CREATE TRIGGER IF NOT EXISTS opponent_entry_bucket_update AFTER UPDATE ON opponent_entry_profiles WHEN OLD.circuit IS NOT NEW.circuit OR OLD.source_player_id IS NOT NEW.source_player_id OR OLD.normalized_name IS NOT NEW.normalized_name OR OLD.display_name IS NOT NEW.display_name OR OLD.payload IS NOT NEW.payload BEGIN
 INSERT INTO opponent_entry_bucket_checks(circuit,bucket,digest) VALUES(OLD.circuit,((COALESCE(unicode(substr(OLD.source_player_id,-1,1)),0)+17*COALESCE(unicode(substr(OLD.source_player_id,-2,1)),0)+31*COALESCE(unicode(substr(OLD.source_player_id,-3,1)),0)+43*COALESCE(unicode(substr(OLD.source_player_id,-4,1)),0))%128),NULL) ON CONFLICT(circuit,bucket) DO UPDATE SET digest=NULL WHERE digest IS NOT NULL;
 INSERT INTO opponent_entry_bucket_checks(circuit,bucket,digest) VALUES(NEW.circuit,((COALESCE(unicode(substr(NEW.source_player_id,-1,1)),0)+17*COALESCE(unicode(substr(NEW.source_player_id,-2,1)),0)+31*COALESCE(unicode(substr(NEW.source_player_id,-3,1)),0)+43*COALESCE(unicode(substr(NEW.source_player_id,-4,1)),0))%128),NULL) ON CONFLICT(circuit,bucket) DO UPDATE SET digest=NULL WHERE digest IS NOT NULL;
 UPDATE app_state SET value='' WHERE key='opponentEntryHash' AND value<>'';
END;
