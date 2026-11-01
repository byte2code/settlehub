-- SettleHub 4.0: repeating expenses (rent, subscriptions). Additive only.
CREATE TABLE recurring_expenses (
    id             UUID                        NOT NULL,
    group_id       UUID                        NOT NULL,
    created_by_id  UUID                        NOT NULL,
    description    VARCHAR(140)                NOT NULL,
    cost_cents     BIGINT                      NOT NULL,
    category       VARCHAR(20)                 NOT NULL,
    payer_id       UUID                        NOT NULL,
    participants   VARCHAR(2000)               NOT NULL,
    frequency      VARCHAR(10)                 NOT NULL,
    day_of_month   INT                         NOT NULL,
    next_run_date  DATE                        NOT NULL,
    active         BOOLEAN DEFAULT TRUE        NOT NULL,
    paused_reason  VARCHAR(120),
    created_at     TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_recurring_expenses PRIMARY KEY (id),
    CONSTRAINT fk_recurring_group FOREIGN KEY (group_id) REFERENCES expense_groups (id) ON DELETE CASCADE
);
CREATE INDEX idx_recurring_group ON recurring_expenses (group_id);
CREATE INDEX idx_recurring_due ON recurring_expenses (active, next_run_date);
