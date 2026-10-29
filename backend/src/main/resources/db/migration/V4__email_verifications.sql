-- SettleHub 3.0 email verification & OTP schema. Portable between PostgreSQL and H2.

CREATE TABLE email_verifications (
    id         UUID                        NOT NULL,
    email      VARCHAR(255)                NOT NULL,
    otp_hash   VARCHAR(255)                NOT NULL,
    expires_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    attempts   INT DEFAULT 0               NOT NULL,
    verified   BOOLEAN DEFAULT FALSE       NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_email_verifications PRIMARY KEY (id)
);

CREATE INDEX idx_email_verifications_email ON email_verifications (email, expires_at);

