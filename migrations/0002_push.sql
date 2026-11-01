-- Web Push: where to reach a phone, and when he next needs you. Nothing else.
CREATE TABLE push_subs (
  endpoint TEXT PRIMARY KEY,        -- the browser's push address (no keys: pushes carry no payload)
  due_at INTEGER NOT NULL,          -- ms epoch of his next call; 0 = nothing due
  updated_at INTEGER NOT NULL
);
CREATE INDEX push_due ON push_subs(due_at);
