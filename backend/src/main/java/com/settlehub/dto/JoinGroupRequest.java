package com.settlehub.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record JoinGroupRequest(
    @NotBlank(message = "Invite code is required")
    @Size(max = 16)
    String inviteCode
) {}
