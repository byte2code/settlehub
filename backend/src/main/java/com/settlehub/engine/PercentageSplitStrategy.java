package com.settlehub.engine;

import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Percentage split strategy that computes per-user shares based on percentage values,
 * rounds to cent boundaries, and dynamically reconciles rounding residual cents
 * to guarantee that sum(splits) == totalCostCents.
 */
@Component("percentageSplitStrategy")
public class PercentageSplitStrategy implements SplitStrategy {

    @Override
    public Map<UUID, Long> calculateSplits(Long totalCostCents, List<UUID> participantIds, Map<UUID, ?> params) {
        if (participantIds == null || participantIds.isEmpty()) {
            throw new IllegalArgumentException("Participant list cannot be empty for percentage split.");
        }
        if (params == null || params.isEmpty()) {
            throw new IllegalArgumentException("Percentage split requires percentages specified in params.");
        }

        Map<UUID, Double> percentages = new LinkedHashMap<>();
        double totalPercentage = 0.0;

        for (UUID userId : participantIds) {
            Object rawVal = params.get(userId);
            double pct = 0.0;
            if (rawVal instanceof Number number) {
                pct = number.doubleValue();
            } else if (rawVal instanceof String strVal) {
                try {
                    pct = Double.parseDouble(strVal.replace("%", "").trim());
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("Invalid percentage for user " + userId + ": " + strVal);
                }
            }

            if (pct < 0) {
                throw new IllegalArgumentException("Percentage cannot be negative for user: " + userId);
            }

            percentages.put(userId, pct);
            totalPercentage += pct;
        }

        // Validate percentage sum is within floating tolerance of 100%
        if (Math.abs(totalPercentage - 100.0) > 0.05) {
            throw new IllegalArgumentException(String.format(
                "Total percentages must sum to 100.0%% (Current sum: %.2f%%).", totalPercentage
            ));
        }

        Map<UUID, Long> splits = new LinkedHashMap<>();
        long calculatedSum = 0L;

        for (UUID userId : participantIds) {
            double pct = percentages.get(userId);
            long shareCents = Math.round((pct * totalCostCents) / 100.0);
            splits.put(userId, shareCents);
            calculatedSum += shareCents;
        }

        // Reconcile residual discrepancy (difference between totalCostCents and calculatedSum)
        long discrepancy = totalCostCents - calculatedSum;
        if (discrepancy != 0) {
            Iterator<UUID> iterator = participantIds.iterator();
            while (discrepancy != 0) {
                if (!iterator.hasNext()) {
                    iterator = participantIds.iterator();
                }
                UUID id = iterator.next();
                long current = splits.get(id);
                if (discrepancy > 0) {
                    splits.put(id, current + 1L);
                    discrepancy--;
                } else if (discrepancy < 0 && current > 0) {
                    splits.put(id, current - 1L);
                    discrepancy++;
                }
            }
        }

        return splits;
    }
}
