CREATE TABLE IF NOT EXISTS events (
 id BIGSERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT, location TEXT DEFAULT 'Binghamton Flynnstoned', tag TEXT DEFAULT 'Event',
 start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, display_date TEXT, recurring TEXT DEFAULT 'none', image_url TEXT,
 featured BOOLEAN NOT NULL DEFAULT false, active BOOLEAN NOT NULL DEFAULT true,
 created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS deals (
 id BIGSERIAL PRIMARY KEY, brand TEXT NOT NULL, description TEXT NOT NULL, location TEXT DEFAULT 'Binghamton Flynnstoned',
 category TEXT, badge TEXT, start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, image_url TEXT,
 active BOOLEAN NOT NULL DEFAULT true, sort_order INTEGER NOT NULL DEFAULT 0,
 created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
