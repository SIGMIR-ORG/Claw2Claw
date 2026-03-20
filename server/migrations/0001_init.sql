CREATE TABLE IF NOT EXISTS agent_records (
  id TEXT PRIMARY KEY,
  agent_card_url TEXT NOT NULL,
  agent_card_hash TEXT NOT NULL,
  agent_card_snapshot TEXT NOT NULL,
  claw_profile TEXT NOT NULL,
  trust_tier TEXT NOT NULL,
  signing_keys TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_validated_at TEXT NOT NULL,
  heartbeat_interval_seconds INTEGER NOT NULL,
  heartbeat_ttl_seconds INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  tombstoned_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_records_card_url
  ON agent_records(agent_card_url);

CREATE INDEX IF NOT EXISTS idx_agent_records_tombstoned
  ON agent_records(tombstoned_at);

CREATE TABLE IF NOT EXISTS used_nonces (
  nonce TEXT PRIMARY KEY,
  first_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_used_nonces_expires_at
  ON used_nonces(expires_at);
