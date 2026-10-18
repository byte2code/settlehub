package com.settlehub.engine;

import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Equal split strategy implementing the reverse-engineered divideFairly logic:
 * Divides total integer cents equally and distributes residual cents (+1 cent each)
 * to the first remainder participants so that sum(splits) strictly equals totalCostCents.
 */
@Component("equalSplitStrategy")
public class EqualSplitStrategy implements SplitStrategy {

    @Override
    public Map<UUID, Long> calculateSplits(Long totalCostCents, List<UUID> participantIds, Map<UUID, ?> params) {
        if (participantIds == null || participantIds.isEmpty()) {
            throw new IllegalArgumentException("Participant list cannot be empty for equal split.");
        }
        if (totalCostCents == null || totalCostCents < 0) {
            throw new IllegalArgumentException("Total cost must be non-negative.");
        }

        int count = participantIds.size();
        long baseCents = totalCostCents / count;
        long residualCents = totalCostCents % count;

        Map<UUID, Long> splits = new LinkedHashMap<>();
        for (int i = 0; i < count; i++) {
            UUID userId = participantIds.get(i);
            long share = baseCents + (i < residualCents ? 1L : 0L);
            splits.put(userId, share);
        }

        return splits;
    }
}
