CREATE TABLE IF NOT EXISTS user_collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility = 'private'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  UNIQUE(user_id, slug)
);
CREATE INDEX IF NOT EXISTS user_collections_user ON user_collections(user_id);

CREATE TABLE IF NOT EXISTS user_collection_players (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES user_collections(id),
  observed_source_key TEXT REFERENCES observed_players(source_key),
  courtwatch_player_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('pending','active','archived')),
  slot_source TEXT NOT NULL CHECK(slot_source IN ('included','purchased','admin')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  CHECK(observed_source_key IS NOT NULL OR courtwatch_player_id IS NOT NULL),
  UNIQUE(collection_id, observed_source_key),
  UNIQUE(collection_id, courtwatch_player_id)
);
CREATE INDEX IF NOT EXISTS user_collection_players_collection ON user_collection_players(collection_id,status);
CREATE INDEX IF NOT EXISTS user_collection_players_player ON user_collection_players(observed_source_key);
CREATE INDEX IF NOT EXISTS user_collection_players_courtwatch ON user_collection_players(courtwatch_player_id);

CREATE TABLE IF NOT EXISTS user_player_capacity (
  user_id TEXT PRIMARY KEY REFERENCES app_users(id),
  included_slots INTEGER NOT NULL DEFAULT 1 CHECK(included_slots >= 0),
  purchased_slots INTEGER NOT NULL DEFAULT 0 CHECK(purchased_slots >= 0),
  updated_at TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS player_capacity_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id),
  event_type TEXT NOT NULL CHECK(event_type IN ('signup_included','purchase','refund','admin_adjustment')),
  quantity INTEGER NOT NULL,
  external_reference TEXT,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS player_capacity_events_user ON player_capacity_events(user_id,created_at);
