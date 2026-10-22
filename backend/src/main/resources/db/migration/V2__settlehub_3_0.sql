-- SettleHub 3.0 schema changes. Portable between PostgreSQL and H2 (PostgreSQL mode).

-- Users: invited placeholder accounts can be claimed at sign-up; optional UPI ID for pay links
ALTER TABLE users ADD COLUMN placeholder BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE users ADD COLUMN upi_id VARCHAR(100);
UPDATE users SET placeholder = TRUE WHERE password = '';

-- Groups: archived was nullable in 2.0
UPDATE expense_groups SET archived = FALSE WHERE archived IS NULL;
ALTER TABLE expense_groups ALTER COLUMN archived SET DEFAULT FALSE;
ALTER TABLE expense_groups ALTER COLUMN archived SET NOT NULL;

-- Expenses: notes, foreign-currency originals, receipt flag
ALTER TABLE expenses ADD COLUMN notes VARCHAR(500);
ALTER TABLE expenses ADD COLUMN original_currency VARCHAR(3);
ALTER TABLE expenses ADD COLUMN original_amount_cents BIGINT;
ALTER TABLE expenses ADD COLUMN has_receipt BOOLEAN DEFAULT FALSE NOT NULL;

-- Receipts move out of the hot expenses table so lists and live events stay small
CREATE TABLE expense_receipts (
    expense_id UUID                        NOT NULL,
    data_url   TEXT                        NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_expense_receipts PRIMARY KEY (expense_id),
    CONSTRAINT fk_expense_receipts_expense FOREIGN KEY (expense_id) REFERENCES expenses (id) ON DELETE CASCADE
);

INSERT INTO expense_receipts (expense_id, data_url, created_at)
SELECT id, receipt_url, created_at FROM expenses WHERE receipt_url IS NOT NULL AND receipt_url <> '';

UPDATE expenses SET has_receipt = TRUE
WHERE id IN (SELECT expense_id FROM expense_receipts);

ALTER TABLE expenses DROP COLUMN receipt_url;

-- Settlements: who recorded it, optional note
ALTER TABLE settlements ADD COLUMN created_by_id UUID;
ALTER TABLE settlements ADD COLUMN note VARCHAR(255);
ALTER TABLE settlements ADD CONSTRAINT fk_settlements_created_by FOREIGN KEY (created_by_id) REFERENCES users (id);

-- Group activity feed
CREATE TABLE activities (
    id           UUID                        NOT NULL,
    group_id     UUID                        NOT NULL,
    actor_id     UUID,
    type         VARCHAR(40)                 NOT NULL,
    summary      VARCHAR(500)                NOT NULL,
    amount_cents BIGINT,
    created_at   TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_activities PRIMARY KEY (id),
    CONSTRAINT fk_activities_group FOREIGN KEY (group_id) REFERENCES expense_groups (id) ON DELETE CASCADE,
    CONSTRAINT fk_activities_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX idx_activity_group_created ON activities (group_id, created_at);

-- Membership lookups happen on every request
CREATE INDEX idx_group_member_user ON group_members (user_id);
