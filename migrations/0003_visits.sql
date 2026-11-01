-- Park visits: who took which dog to which park, when, and how the dog was
-- being cared for on arrival and on leaving. Pseudonymous — only user ids,
-- no emails in this table. The keeper's summary endpoint maps to display
-- names at read time, and only for allow-listed accounts.
CREATE TABLE IF NOT EXISTS park_visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  dog_id TEXT NOT NULL,
  dog_name TEXT NOT NULL,
  room TEXT NOT NULL,
  arrived_at INTEGER NOT NULL,
  left_at INTEGER,
  snapshot TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_visits_user_time ON park_visits(user_id, arrived_at);
CREATE INDEX IF NOT EXISTS idx_visits_open ON park_visits(left_at);
