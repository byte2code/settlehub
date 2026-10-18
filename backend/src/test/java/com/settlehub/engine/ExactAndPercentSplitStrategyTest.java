package com.settlehub.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class ExactAndPercentSplitStrategyTest {

    private final ExactSplitStrategy exactStrategy = new ExactSplitStrategy();
    private final PercentageSplitStrategy percentStrategy = new PercentageSplitStrategy();

    @Test
    @DisplayName("Exact split accepts valid amounts that strictly sum to total cost")
    void testExactSplitValid() {
        UUID u1 = UUID.randomUUID();
        UUID u2 = UUID.randomUUID();
        List<UUID> participants = List.of(u1, u2);

        Map<UUID, Long> params = Map.of(u1, 4500L, u2, 5500L);
        Map<UUID, Long> splits = exactStrategy.calculateSplits(10000L, participants, params);

        assertEquals(4500L, splits.get(u1));
        assertEquals(5500L, splits.get(u2));
    }

    @Test
    @DisplayName("Exact split throws exception when amounts differ from total by even 1 cent")
    void testExactSplitSumMismatch() {
        UUID u1 = UUID.randomUUID();
        UUID u2 = UUID.randomUUID();
        List<UUID> participants = List.of(u1, u2);

        Map<UUID, Long> params = Map.of(u1, 4500L, u2, 5499L); // 9999 != 10000
        assertThrows(IllegalArgumentException.class, () ->
            exactStrategy.calculateSplits(10000L, participants, params)
        );
    }

    @Test
    @DisplayName("Percentage split (33.33%, 33.33%, 33.34%) reconciles rounding discrepancies to exactly match $10.00")
    void testPercentageSplitReconciliation() {
        UUID u1 = UUID.randomUUID();
        UUID u2 = UUID.randomUUID();
        UUID u3 = UUID.randomUUID();
        List<UUID> participants = List.of(u1, u2, u3);

        Map<UUID, Double> params = Map.of(u1, 33.33, u2, 33.33, u3, 33.34);
        long totalCents = 1000L; // $10.00

        Map<UUID, Long> splits = percentStrategy.calculateSplits(totalCents, participants, params);

        assertEquals(3, splits.size());
        long sum = splits.values().stream().mapToLong(Long::longValue).sum();
        assertEquals(totalCents, sum, "Percentages must sum to exactly total cents after discrepancy reconciliation");
    }

    @Test
    @DisplayName("Percentage split rejects inputs where total percentage deviates from 100%")
    void testPercentageSumInvalid() {
        UUID u1 = UUID.randomUUID();
        UUID u2 = UUID.randomUUID();
        List<UUID> participants = List.of(u1, u2);

        Map<UUID, Double> params = Map.of(u1, 50.0, u2, 40.0); // 90% != 100%
        assertThrows(IllegalArgumentException.class, () ->
            percentStrategy.calculateSplits(5000L, participants, params)
        );
    }
}
