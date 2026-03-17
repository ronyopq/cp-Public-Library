PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_by_user_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_permission_overrides (
  user_id TEXT NOT NULL,
  permission_id TEXT NOT NULL,
  effect TEXT NOT NULL CHECK (effect IN ('allow', 'deny')),
  reason TEXT,
  updated_by_user_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, permission_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (permission_id) REFERENCES permissions(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user
  ON user_permission_overrides(user_id);
