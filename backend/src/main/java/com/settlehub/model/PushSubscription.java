package com.settlehub.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "push_subscriptions", indexes = {
    @Index(name = "idx_push_subscriptions_user", columnList = "user_id")
})
public class PushSubscription {

    public static final String WEB = "WEB";
    public static final String ANDROID = "ANDROID";

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "device_type", nullable = false, length = 16)
    private String deviceType;

    /** FCM registration token (ANDROID) or Web Push endpoint URL (WEB). */
    @Column(name = "device_token", nullable = false, length = 2048, unique = true)
    private String deviceToken;

    @Column(name = "p256dh_key")
    private String p256dhKey;

    @Column(name = "auth_key")
    private String authKey;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    public PushSubscription() {}

    public PushSubscription(UUID userId, String deviceType, String deviceToken, String p256dhKey, String authKey) {
        this.userId = userId;
        this.deviceType = deviceType;
        this.deviceToken = deviceToken;
        this.p256dhKey = p256dhKey;
        this.authKey = authKey;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getDeviceType() { return deviceType; }
    public void setDeviceType(String deviceType) { this.deviceType = deviceType; }
    public String getDeviceToken() { return deviceToken; }
    public String getP256dhKey() { return p256dhKey; }
    public void setP256dhKey(String p256dhKey) { this.p256dhKey = p256dhKey; }
    public String getAuthKey() { return authKey; }
    public void setAuthKey(String authKey) { this.authKey = authKey; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(Instant lastUsedAt) { this.lastUsedAt = lastUsedAt; }
}
