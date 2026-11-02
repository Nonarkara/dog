-- Durable outbox: remove local account data atomically, retry managed identity cleanup.
-- No foreign key: the account is deliberately gone while this final job remains.
CREATE TABLE email_deletions (
  provider_sub TEXT PRIMARY KEY,
  requested_at INTEGER NOT NULL,
  completed_at INTEGER -- minimal anti-revival marker expires after one day
);
