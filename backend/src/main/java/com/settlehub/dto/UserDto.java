package com.settlehub.dto;

import com.settlehub.model.User;
import java.util.UUID;

public record UserDto(
    UUID id,
    String email,
    String firstName,
    String lastName,
    String fullName,
    String currencyCode,
    String upiId,
    String bio,
    String avatarId,
    String chimeSound,
    boolean admin
) {
    public static UserDto fromEntity(User user) {
        if (user == null) return null;
        return new UserDto(
            user.getId(),
            user.getEmail(),
            user.getFirstName(),
            user.getLastName(),
            user.getFullName(),
            user.getCurrencyCode(),
            user.getUpiId(),
            user.getBio(),
            user.getAvatarId(),
            user.getChimeSound(),
            user.isAdmin()
        );
    }
}
