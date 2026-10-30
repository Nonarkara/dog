-- Accounts and cloud-saved dogs. See design/accounts-and-saves-plan.md.
-- One dog per account for now (dogs.user_id is unique).

CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- our random id
  provider TEXT NOT NULL,           -- 'google' | 'line' | 'dev'
  provider_sub TEXT NOT NULL,       -- the provider's stable user id
  display_name TEXT NOT NULL,
  email TEXT,                       -- only if the provider gives it
  created_at INTEGER NOT NULL,
  UNIQUE (provider, provider_sub)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,      -- SHA-256 of the cookie token; the token itself is never stored
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE dogs (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dog_id TEXT NOT NULL,             -- which household dog he was adopted from
  revision INTEGER NOT NULL,        -- the save's own revision counter; higher wins
  backup TEXT NOT NULL,             -- the app's owned-dog backup (tama-dog-chi-owned-v1)
  updated_at INTEGER NOT NULL
);
