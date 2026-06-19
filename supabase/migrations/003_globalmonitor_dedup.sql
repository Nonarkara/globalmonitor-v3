-- 003_globalmonitor_dedup
-- Add unique constraints required for idempotent upserts and switch loaders
-- from `.insert()` to upsert-on-conflict to avoid duplicate rows on re-runs.

-- Market quotes: keep one current row per symbol, updated on each run.
ALTER TABLE gm_market_quotes
    ADD CONSTRAINT gm_market_quotes_symbol_unique UNIQUE (symbol);

-- Sentiment readings: one tone reading per query + date.
ALTER TABLE gm_sentiment_readings
    ADD CONSTRAINT gm_sentiment_readings_query_date_unique UNIQUE (query, reading_date);
