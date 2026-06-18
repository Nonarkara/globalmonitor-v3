-- 002_globalmonitor_loaders
-- Archive tables for conflict events, fire hotspots, market quotes, sentiment.
-- All idempotent, public-read RLS, service-role write.

CREATE TABLE IF NOT EXISTS gm_acled_events (
  pk             BIGSERIAL PRIMARY KEY,
  event_date     DATE NOT NULL,
  event_type     TEXT,
  sub_event_type TEXT,
  actor1         TEXT,
  actor2         TEXT,
  country        TEXT,
  admin1         TEXT,
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  fatalities     INTEGER DEFAULT 0,
  notes          TEXT,
  source         TEXT,
  fetched_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_date, latitude, longitude, actor1)
);
CREATE INDEX IF NOT EXISTS gm_acled_events_date_idx    ON gm_acled_events (event_date DESC);
CREATE INDEX IF NOT EXISTS gm_acled_events_country_idx ON gm_acled_events (country);
ALTER TABLE gm_acled_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read gm_acled_events" ON gm_acled_events;
CREATE POLICY "public read gm_acled_events" ON gm_acled_events FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS gm_firms_hotspots (
  pk          BIGSERIAL PRIMARY KEY,
  acq_date    DATE NOT NULL,
  acq_time    TEXT,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  brightness  DOUBLE PRECISION,
  frp         DOUBLE PRECISION,
  satellite   TEXT,
  confidence  TEXT,
  daynight    TEXT,
  theater     TEXT,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (acq_date, acq_time, latitude, longitude)
);
CREATE INDEX IF NOT EXISTS gm_firms_hotspots_date_idx    ON gm_firms_hotspots (acq_date DESC);
CREATE INDEX IF NOT EXISTS gm_firms_hotspots_theater_idx ON gm_firms_hotspots (theater);
ALTER TABLE gm_firms_hotspots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read gm_firms_hotspots" ON gm_firms_hotspots;
CREATE POLICY "public read gm_firms_hotspots" ON gm_firms_hotspots FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS gm_market_quotes (
  pk          BIGSERIAL PRIMARY KEY,
  symbol      TEXT NOT NULL,
  price       TEXT,
  change_perc TEXT,
  is_positive BOOLEAN,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gm_market_quotes_symbol_idx ON gm_market_quotes (symbol, fetched_at DESC);
ALTER TABLE gm_market_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read gm_market_quotes" ON gm_market_quotes;
CREATE POLICY "public read gm_market_quotes" ON gm_market_quotes FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS gm_sentiment_readings (
  pk           BIGSERIAL PRIMARY KEY,
  query        TEXT NOT NULL,
  tone         DOUBLE PRECISION,
  reading_date DATE,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS gm_sentiment_readings_date_idx ON gm_sentiment_readings (reading_date DESC);
ALTER TABLE gm_sentiment_readings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read gm_sentiment_readings" ON gm_sentiment_readings;
CREATE POLICY "public read gm_sentiment_readings" ON gm_sentiment_readings FOR SELECT USING (true);
