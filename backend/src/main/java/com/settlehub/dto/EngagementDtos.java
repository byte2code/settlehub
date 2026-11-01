package com.settlehub.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class EngagementDtos {
    private EngagementDtos() {}

    /** reactions: emoji -> count; mine: emojis the caller used. */
    public record Engagement(Map<String, Integer> reactions, List<String> mine, int comments) {}

    public record CommentDto(UUID id, UUID userId, String userName, String body, Instant createdAt, boolean mine) {}

    public record ReactionRequest(String emoji) {}

    public record CommentRequest(String body) {}
}
