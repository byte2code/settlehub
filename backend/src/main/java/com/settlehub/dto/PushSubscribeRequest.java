package com.settlehub.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PushSubscribeRequest(
    @NotBlank @Pattern(regexp = "WEB|ANDROID", message = "deviceType must be WEB or ANDROID") String deviceType,
    @NotBlank @Size(max = 2048) String deviceToken,
    @Size(max = 255) String p256dhKey,
    @Size(max = 255) String authKey
) {}
