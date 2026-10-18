package com.settlehub.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CreateExpenseRequest(
    @NotBlank(message = "Description is required")
    String description,

    @NotNull(message = "Cost in cents is required")
    @Positive(message = "Cost must be positive")
    Long costCents,

    String currencyCode,
    Instant date,

    String creationMethod, // "EQUAL", "EXACT", "PERCENT"

    List<PayerRequest> payers, // If null or empty, defaults to current user paying 100%

    @NotEmpty(message = "At least one participant split is required")
    List<SplitRequest> splits
) {
    public record PayerRequest(
        @NotNull UUID userId,
        @NotNull Long paidCents
    ) {}

    public record SplitRequest(
        @NotNull UUID userId,
        Long owedCents,
        Double percentage
    ) {}
}
