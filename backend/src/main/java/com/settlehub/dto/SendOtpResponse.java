package com.settlehub.dto;

public record SendOtpResponse(
    boolean success,
    boolean bypassed,
    String message,
    int expiresInSeconds
) {}

