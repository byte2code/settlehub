package com.settlehub.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
    @NotBlank(message = "Email is required")
    @Email(message = "Please enter a valid email address")
    @Size(max = 254, message = "Email is too long")
    String email,

    @NotBlank(message = "Verification code is required")
    @Size(max = 10, message = "Verification code is invalid")
    String otp,

    @NotBlank(message = "New password is required")
    @Size(min = 8, max = 100, message = "Password must be 8 to 100 characters")
    String newPassword
) {}
