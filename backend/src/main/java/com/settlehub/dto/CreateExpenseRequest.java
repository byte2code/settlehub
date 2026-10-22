package com.settlehub.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record CreateExpenseRequest(
    @NotBlank(message = "Description is required")
    @Size(max = 140, message = "Description is too long")
    String description,

    /** Amount in the group's currency, in minor units (x100). */
    @NotNull(message = "Cost in cents is required")
    @Positive(message = "Cost must be positive")
    @Max(value = 100_000_000_000L, message = "Cost is too large")
    Long costCents,

    /** Must equal the group currency, or be omitted. Foreign amounts go in originalCurrency/originalAmountCents. */
    String currencyCode,
    Instant date,

    @Pattern(regexp = "^$|^(FOOD|TRANSPORT|STAY|ENTERTAINMENT|SHOPPING|UTILITIES|OTHER)$", message = "Unknown category")
    String category,

    /** Compressed image data URL. On update: null = keep the current receipt, "" = remove it. */
    String receiptUrl,

    @Pattern(regexp = "^$|^(EQUAL|EXACT|PERCENT)$", message = "Split method must be EQUAL, EXACT or PERCENT")
    String creationMethod,

    @Valid
    @Size(max = 50)
    List<PayerRequest> payers, // If null or empty, defaults to current user paying 100%

    @Valid
    @NotEmpty(message = "At least one participant split is required")
    @Size(max = 50)
    List<SplitRequest> splits,

    @Size(max = 500, message = "Notes are too long")
    String notes,

    @Pattern(regexp = "^$|^[A-Za-z]{3}$", message = "Original currency must be a 3-letter ISO code")
    String originalCurrency,

    @Positive(message = "Original amount must be positive")
    Long originalAmountCents
) {
    public CreateExpenseRequest(
        String description,
        Long costCents,
        String currencyCode,
        Instant date,
        String creationMethod,
        List<PayerRequest> payers,
        List<SplitRequest> splits
    ) {
        this(description, costCents, currencyCode, date, "OTHER", null, creationMethod, payers, splits, null, null, null);
    }

    public record PayerRequest(
        @NotNull UUID userId,
        @NotNull @PositiveOrZero Long paidCents
    ) {}

    public record SplitRequest(
        @NotNull UUID userId,
        @PositiveOrZero Long owedCents,
        @PositiveOrZero Double percentage
    ) {}
}
