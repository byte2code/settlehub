package com.settlehub.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Partial update. budgetCents: null = unchanged, 0 or less = remove the budget. */
public record UpdateGroupRequest(
    @Size(min = 1, max = 80, message = "Group name must be 1 to 80 characters")
    String name,

    @Pattern(regexp = "^(trip|home|couple|other)$", message = "Unknown group type")
    String groupType,

    Boolean simplifyByDefault,
    Boolean archived,
    Long budgetCents,

    @Pattern(regexp = "^[A-Za-z]{3}$", message = "Currency must be a 3-letter ISO code")
    String currencyCode
) {}
