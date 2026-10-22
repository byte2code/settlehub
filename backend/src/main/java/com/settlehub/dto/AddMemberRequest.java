package com.settlehub.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddMemberRequest(
    @NotBlank(message = "Email is required to add a member")
    @Email(message = "Email must be valid")
    @Size(max = 254)
    String email
) {}
