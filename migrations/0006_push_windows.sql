-- Delivery windows are computed on the phone. No timezone, location, dog
-- details or reminder text is stored here. Zero retains legacy one-shot rows.
ALTER TABLE push_subs ADD COLUMN expires_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE push_subs ADD COLUMN followup_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE push_subs ADD COLUMN followup_expires_at INTEGER NOT NULL DEFAULT 0;
-- This is a monotonic intent counter on the phone, not an account identifier.
-- It stops a delayed hidden-tab request re-arming a newer return/clear.
ALTER TABLE push_subs ADD COLUMN client_revision INTEGER NOT NULL DEFAULT 0;
-- Disable removes the raw subscription URL. Its irreversible digest keeps
-- the ordering fence for thirty days so an in-flight old POST cannot restore it.
CREATE TABLE push_revocations (
  endpoint_hash TEXT PRIMARY KEY,
  client_revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX push_revocations_updated ON push_revocations(updated_at);
