package com.settlehub.dto;

public record AuthResponse(
    String token,
    String tokenType,
    UserDto user
) {
    public AuthResponse(String token, UserDto user) {
        this(token, "Bearer", user);
    }
}
