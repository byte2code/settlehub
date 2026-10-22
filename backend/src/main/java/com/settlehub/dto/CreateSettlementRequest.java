package com.settlehub.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;

public record CreateSettlementRequest(
    @NotNull(message = "Group is required")
    UUID groupId,

    /** Who paid. Defaults to the caller; the caller must be the payer or the payee. */
    UUID payerId,

    @NotNull(message = "Payee ID is required")
    UUID payeeId,

    @NotNull(message = "Settlement amount is required")
    @Positive(message = "Settlement amount must be positive")
    @Max(value = 100_000_000_000L, message = "Settlement amount is too large")
    Long amountCents,

    /** Ignored: settlements always use the group currency. Kept for 2.0 client compatibility. */
    String currencyCode,

    Instant date,

    @Size(max = 255, message = "Note is too long")
    String note
) {
    public CreateSettlementRequest(UUID groupId, UUID payeeId, Long amountCents, String currencyCode, Instant date) {
        this(groupId, null, payeeId, amountCents, currencyCode, date, null);
    }
}
