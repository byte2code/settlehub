-- SettleHub 3.1 profile personalisation and admin flags. Portable between PostgreSQL and H2.
-- is_admin is never writable through the API: it is derived from APP_ADMIN_EMAILS at sign-in.
ALTER TABLE users ADD COLUMN bio VARCHAR(120);
ALTER TABLE users ADD COLUMN avatar_id VARCHAR(32);
ALTER TABLE users ADD COLUMN chime_sound VARCHAR(32);
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT TRUE NOT NULL;
