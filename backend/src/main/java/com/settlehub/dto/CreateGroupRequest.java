package com.settlehub.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateGroupRequest(
    @NotBlank(message = "Group name is required")
    @Size(max = 80, message = "Group name is too long")
    String name,

    @Pattern(regexp = "^$|^(trip|home|couple|other)$", message = "Unknown group type")
    String groupType,

    Boolean simplifyByDefault,

    @Pattern(regexp = "^$|^[A-Za-z]{3}$", message = "Currency must be a 3-letter ISO code")
    String currencyCode,

    @PositiveOrZero(message = "Budget cannot be negative")
    Long budgetCents,

    @Size(max = 50, message = "Too many members at once")
    List<String> memberEmails
) {
    public CreateGroupRequest(String name, String groupType, Boolean simplifyByDefault, List<String> memberEmails) {
        this(name, groupType, simplifyByDefault, "INR", null, memberEmails);
    }
}
