CREATE TABLE IF NOT EXISTS manual_overrides (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('player','tournament')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('upsert','hide')),
  payload TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  supersedes_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS manual_overrides_active_entity ON manual_overrides(entity_type,entity_id) WHERE active=1;
CREATE INDEX IF NOT EXISTS manual_overrides_updated ON manual_overrides(updated_at);
CREATE TABLE IF NOT EXISTS admin_audit (
  id TEXT PRIMARY KEY,
  override_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  previous_payload TEXT,
  new_payload TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_audit_override ON admin_audit(override_id,created_at);
