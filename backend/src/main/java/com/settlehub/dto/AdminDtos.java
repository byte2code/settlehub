package com.settlehub.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class AdminDtos {
    private AdminDtos() {}

    public record Overview(long totalUsers, long activeGroups, long totalGroups, long expenseCount, long settlementCount,
                           Map<String, Long> expenseVolumeByCurrency, Map<String, Long> settledVolumeByCurrency,
                           Map<String, Double> settlementRatioByCurrency) {}

    public record TableStat(String table, long sizeBytes, long rows) {}

    public record SystemHealth(int emailsSentToday, int emailDailyLimit, long dbLatencyMs, String database,
                               List<TableStat> tables, long uptimeSeconds) {}

    public record AdminUser(UUID id, String email, String name, Instant createdAt, boolean active, boolean admin, long groupCount) {}

    public record AdminGroup(UUID id, String name, String currencyCode, boolean archived, Instant createdAt, long memberCount) {}

    public record SetActiveRequest(boolean active) {}
}
