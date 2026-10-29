package com.settlehub.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_notifications", indexes = {
    @Index(name = "idx_user_notifications_user", columnList = "user_id, is_read, created_at"),
    @Index(name = "idx_user_notifications_group", columnList = "group_id")
})
public class UserNotification {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Column(name = "group_id", nullable = false)
    private UUID groupId;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(nullable = false, length = 64)
    private String type;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, length = 512)
    private String message;

    @Column(name = "is_read", nullable = false)
    private boolean read = false;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public UserNotification() {}

    public UserNotification(UUID userId, User actor, UUID groupId, UUID entityId, String type, String title, String message) {
        this.userId = userId;
        this.actor = actor;
        this.groupId = groupId;
        this.entityId = entityId;
        this.type = type;
        this.title = title != null && title.length() > 255 ? title.substring(0, 252) + "..." : title;
        this.message = message != null && message.length() > 512 ? message.substring(0, 509) + "..." : message;
        this.read = false;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public User getActor() { return actor; }
    public UUID getGroupId() { return groupId; }
    public UUID getEntityId() { return entityId; }
    public String getType() { return type; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
    public Instant getCreatedAt() { return createdAt; }
}

