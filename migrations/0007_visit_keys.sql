-- Existing records stay unkeyed. New park tabs close only their own visit.
ALTER TABLE park_visits ADD COLUMN visit_key TEXT;
CREATE UNIQUE INDEX idx_visits_user_key ON park_visits(user_id, visit_key);
