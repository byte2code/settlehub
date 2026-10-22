package com.settlehub.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** One entry in a group's activity feed (who did what, when). */
@Entity
@Table(name = "activities", indexes = {
    @Index(name = "idx_activity_group_created", columnList = "group_id, created_at")
})
public class Activity {

    public enum Type {
        GROUP_CREATED, GROUP_UPDATED, GROUP_ARCHIVED, GROUP_RESTORED,
        MEMBER_JOINED, MEMBER_ADDED, MEMBER_REMOVED, MEMBER_LEFT, ROLE_CHANGED, INVITE_RESET,
        EXPENSE_CREATED, EXPENSE_UPDATED, EXPENSE_DELETED,
        SETTLEMENT_RECORDED, SETTLEMENT_DELETED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "group_id", nullable = false)
    private UUID groupId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id")
    private User actor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private Type type;

    @Column(nullable = false, length = 500)
    private String summary;

    private Long amountCents;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public Activity() {}

    public Activity(UUID groupId, User actor, Type type, String summary, Long amountCents) {
        this.groupId = groupId;
        this.actor = actor;
        this.type = type;
        this.summary = summary.length() > 500 ? summary.substring(0, 497) + "..." : summary;
        this.amountCents = amountCents;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getGroupId() { return groupId; }
    public User getActor() { return actor; }
    public Type getType() { return type; }
    public String getSummary() { return summary; }
    public Long getAmountCents() { return amountCents; }
    public Instant getCreatedAt() { return createdAt; }
}
