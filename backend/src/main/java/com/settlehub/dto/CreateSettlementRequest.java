package com.settlehub.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.Instant;
import java.util.UUID;

public record CreateSettlementRequest(
    UUID groupId, // Optional: can be within a group or 1-on-1 friend settlement

    @NotNull(message = "Payee ID is required")
    UUID payeeId,

    @NotNull(message = "Settlement amount is required")
    @Positive(message = "Settlement amount must be positive")
    Long amountCents,

    String currencyCode,
    Instant date
) {}
