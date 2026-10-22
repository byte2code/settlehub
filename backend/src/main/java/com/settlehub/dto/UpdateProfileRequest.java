package com.settlehub.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Partial update: null fields are left unchanged; an empty upiId clears it. */
public record UpdateProfileRequest(
    @Size(min = 1, max = 60, message = "First name must be 1 to 60 characters")
    String firstName,

    @Size(max = 60, message = "Last name is too long")
    String lastName,

    @Pattern(regexp = "^[A-Za-z]{3}$", message = "Currency must be a 3-letter ISO code")
    String currencyCode,

    @Pattern(regexp = "^$|^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,63}$", message = "UPI ID looks invalid (example: name@okbank)")
    String upiId
) {}
