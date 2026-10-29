package com.settlehub.dto;

import com.settlehub.model.UserNotification;
import java.time.Instant;
import java.util.UUID;

public record NotificationDto(
    UUID id,
    UUID groupId,
    UUID entityId,
    String type,
    String title,
    String message,
    UUID actorId,
    String actorName,
    boolean read,
    Instant createdAt
) {
    public static NotificationDto fromEntity(UserNotification n) {
        return new NotificationDto(
            n.getId(),
            n.getGroupId(),
            n.getEntityId(),
            n.getType(),
            n.getTitle(),
            n.getMessage(),
            n.getActor() != null ? n.getActor().getId() : null,
            n.getActor() != null ? n.getActor().getFullName() : "Someone",
            n.isRead(),
            n.getCreatedAt()
        );
    }
}

