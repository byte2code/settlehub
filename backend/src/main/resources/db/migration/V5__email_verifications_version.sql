-- SettleHub 3.0: Add version column to email_verifications for optimistic locking
ALTER TABLE email_verifications ADD COLUMN version BIGINT DEFAULT 0 NOT NULL;
