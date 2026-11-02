-- Park visits are recorded only after the owner agrees to the consent note.
ALTER TABLE users ADD COLUMN visit_consent_at INTEGER;
