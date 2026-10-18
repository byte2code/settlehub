package com.settlehub.engine;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface SplitStrategy {
    /**
     * Calculates the owed cent distribution across participants.
     *
     * @param totalCostCents Total expense cost in cents
     * @param participantIds List of participant user UUIDs
     * @param params Strategy specific inputs (e.g. exact amounts or percentages)
     * @return Map of participant UUID to owed amount in cents
     */
    Map<UUID, Long> calculateSplits(Long totalCostCents, List<UUID> participantIds, Map<UUID, ?> params);
}
