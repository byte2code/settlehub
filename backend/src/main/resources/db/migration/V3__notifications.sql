-- SettleHub 3.0 notification system. Portable between PostgreSQL and H2.

CREATE TABLE user_notifications (
    id         UUID                        NOT NULL,
    user_id    UUID                        NOT NULL,
    actor_id   UUID,
    group_id   UUID                        NOT NULL,
    entity_id  UUID,
    type       VARCHAR(64)                 NOT NULL,
    title      VARCHAR(255)                NOT NULL,
    message    VARCHAR(512)                NOT NULL,
    is_read    BOOLEAN DEFAULT FALSE       NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_user_notifications PRIMARY KEY (id),
    CONSTRAINT fk_user_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_notifications_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_user_notifications_group FOREIGN KEY (group_id) REFERENCES expense_groups (id) ON DELETE CASCADE
);

CREATE INDEX idx_user_notifications_user ON user_notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_user_notifications_group ON user_notifications (group_id);

