CREATE TABLE IF NOT EXISTS app_user_devices (
  user_id TEXT NOT NULL REFERENCES app_users(id),
  device_id TEXT NOT NULL,
  label TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  last_path TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  revoked_at TEXT,
  PRIMARY KEY(user_id,device_id)
);
CREATE INDEX IF NOT EXISTS app_user_devices_last_seen ON app_user_devices(user_id,status,last_seen DESC);
