package com.settlehub.engine;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class EqualSplitStrategyTest {

    private final EqualSplitStrategy strategy = new EqualSplitStrategy();

    @Test
    @DisplayName("Equal split of $10.00 across 3 people distributes residual cents correctly (334c, 333c, 333c)")
    void testEqualSplitWithResidualCents() {
        UUID u1 = UUID.randomUUID();
        UUID u2 = UUID.randomUUID();
        UUID u3 = UUID.randomUUID();
        List<UUID> participants = List.of(u1, u2, u3);

        long totalCents = 1000L; // $10.00
        Map<UUID, Long> splits = strategy.calculateSplits(totalCents, participants, Collections.emptyMap());

        assertEquals(3, splits.size());
        assertEquals(334L, splits.get(u1), "First participant receives 1 residual cent");
        assertEquals(333L, splits.get(u2));
        assertEquals(333L, splits.get(u3));

        long sum = splits.values().stream().mapToLong(Long::longValue).sum();
        assertEquals(totalCents, sum, "Sum of all splits must strictly match total cost in cents");
    }

    @Test
    @DisplayName("Equal split of $100.00 across 4 people divides cleanly with 0 remainder")
    void testEqualSplitEvenDivision() {
        UUID u1 = UUID.randomUUID();
        UUID u2 = UUID.randomUUID();
        UUID u3 = UUID.randomUUID();
        UUID u4 = UUID.randomUUID();
        List<UUID> participants = List.of(u1, u2, u3, u4);

        long totalCents = 10000L; // $100.00
        Map<UUID, Long> splits = strategy.calculateSplits(totalCents, participants, Collections.emptyMap());

        assertEquals(4, splits.size());
        for (UUID id : participants) {
            assertEquals(2500L, splits.get(id));
        }

        long sum = splits.values().stream().mapToLong(Long::longValue).sum();
        assertEquals(totalCents, sum);
    }

    @Test
    @DisplayName("Equal split of $0.02 across 5 people allocates 1 cent to first 2 and 0 to remaining")
    void testEqualSplitSmallAmount() {
        List<UUID> participants = List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        long totalCents = 2L;

        Map<UUID, Long> splits = strategy.calculateSplits(totalCents, participants, Collections.emptyMap());

        assertEquals(1L, splits.get(participants.get(0)));
        assertEquals(1L, splits.get(participants.get(1)));
        assertEquals(0L, splits.get(participants.get(2)));
        assertEquals(0L, splits.get(participants.get(3)));
        assertEquals(0L, splits.get(participants.get(4)));

        long sum = splits.values().stream().mapToLong(Long::longValue).sum();
        assertEquals(totalCents, sum);
    }
}
