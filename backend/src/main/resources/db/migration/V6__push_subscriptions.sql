-- SettleHub 3.1 push subscriptions (FCM tokens for Android, Web Push endpoints for browsers/PWA).
-- Portable between PostgreSQL and H2.

CREATE TABLE push_subscriptions (
    id           UUID                        NOT NULL,
    user_id      UUID                        NOT NULL,
    device_type  VARCHAR(16)                 NOT NULL,
    device_token VARCHAR(2048)               NOT NULL,
    p256dh_key   VARCHAR(255),
    auth_key     VARCHAR(255),
    created_at   TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP(6) WITH TIME ZONE,
    CONSTRAINT pk_push_subscriptions PRIMARY KEY (id),
    CONSTRAINT uq_push_subscriptions_token UNIQUE (device_token),
    CONSTRAINT fk_push_subscriptions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);
