-- SettleHub 4.0: retries of the same expense (offline sync, double taps) must not create duplicates.
ALTER TABLE expenses ADD COLUMN client_id UUID;
CREATE UNIQUE INDEX uq_expenses_group_client ON expenses (group_id, client_id);
