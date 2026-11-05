-- He can call more than once while you are away. The count of calls already
-- made sits beside the subscription, so the worker knows whether to ask again
-- or to stay quiet. Zero means a new absence: the client resets it when you
-- leave, and clears the subscription entirely when you come back.
ALTER TABLE push_subs ADD COLUMN sent INTEGER NOT NULL DEFAULT 0;
