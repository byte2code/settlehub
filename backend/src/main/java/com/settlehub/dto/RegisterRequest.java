package com.settlehub.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    @Size(max = 254, message = "Email is too long")
    String email,

    @NotBlank(message = "Password is required")
    @Size(min = 8, max = 100, message = "Password must be 8 to 100 characters")
    String password,

    @NotBlank(message = "First name is required")
    @Size(max = 60, message = "First name is too long")
    String firstName,

    @Size(max = 60, message = "Last name is too long")
    String lastName,

    @Pattern(regexp = "^$|^[A-Za-z]{3}$", message = "Currency must be a 3-letter ISO code")
    String currencyCode
) {}
