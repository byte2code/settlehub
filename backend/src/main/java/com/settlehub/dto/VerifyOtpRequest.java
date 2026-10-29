package com.settlehub.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record VerifyOtpRequest(
    @NotBlank(message = "Email is required")
    @Email(message = "Email must be valid")
    @Size(max = 254, message = "Email is too long")
    String email,

    @NotBlank(message = "Verification code is required")
    @Size(min = 4, max = 10, message = "Verification code is invalid")
    String code
) {}

