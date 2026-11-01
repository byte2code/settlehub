-- SettleHub 4.0: reactions, comments, trip awards. Additive only, portable between PostgreSQL and H2.
CREATE TABLE expense_reactions (
    id         UUID                        NOT NULL,
    expense_id UUID                        NOT NULL,
    user_id    UUID                        NOT NULL,
    emoji      VARCHAR(16)                 NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_expense_reactions PRIMARY KEY (id),
    CONSTRAINT uq_expense_reaction UNIQUE (expense_id, user_id, emoji),
    CONSTRAINT fk_expense_reactions_expense FOREIGN KEY (expense_id) REFERENCES expenses (id) ON DELETE CASCADE,
    CONSTRAINT fk_expense_reactions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_expense_reactions_expense ON expense_reactions (expense_id);

CREATE TABLE expense_comments (
    id         UUID                        NOT NULL,
    expense_id UUID                        NOT NULL,
    user_id    UUID                        NOT NULL,
    body       VARCHAR(400)                NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_expense_comments PRIMARY KEY (id),
    CONSTRAINT fk_expense_comments_expense FOREIGN KEY (expense_id) REFERENCES expenses (id) ON DELETE CASCADE,
    CONSTRAINT fk_expense_comments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX idx_expense_comments_expense ON expense_comments (expense_id, created_at);

-- Awards are computed once by a group admin ("reveal") and stored as a snapshot
ALTER TABLE expense_groups ADD COLUMN awards_json TEXT;
ALTER TABLE expense_groups ADD COLUMN awards_revealed_at TIMESTAMP(6) WITH TIME ZONE;
