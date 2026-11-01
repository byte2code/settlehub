-- SettleHub 4.0: revocable sessions and account controls. Additive only, portable between PostgreSQL and H2.
-- token_version is embedded in each JWT; bumping it signs the user out everywhere.
ALTER TABLE users ADD COLUMN token_version INT DEFAULT 0 NOT NULL;
-- false for accounts created through Google sign-in (no password they know)
ALTER TABLE users ADD COLUMN password_login BOOLEAN DEFAULT TRUE NOT NULL;
CREATE INDEX idx_expense_receipts_created ON expense_receipts (created_at);
