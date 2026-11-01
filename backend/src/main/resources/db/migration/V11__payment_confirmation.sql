-- SettleHub 4.0: a payment you record yourself waits for the person who received it to confirm.
-- Existing payments are treated as confirmed. Balances count a payment immediately either way.
ALTER TABLE settlements ADD COLUMN status VARCHAR(16) DEFAULT 'CONFIRMED' NOT NULL;
ALTER TABLE settlements ADD COLUMN confirmed_at TIMESTAMP(6) WITH TIME ZONE;
