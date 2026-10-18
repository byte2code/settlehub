package com.settlehub.engine;

import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Exact split strategy where participants have explicitly specified cent amounts.
 * Verifies that the exact sum of all amounts strictly matches totalCostCents.
 */
@Component("exactSplitStrategy")
public class ExactSplitStrategy implements SplitStrategy {

    @Override
    public Map<UUID, Long> calculateSplits(Long totalCostCents, List<UUID> participantIds, Map<UUID, ?> params) {
        if (participantIds == null || participantIds.isEmpty()) {
            throw new IllegalArgumentException("Participant list cannot be empty for exact split.");
        }
        if (params == null || params.isEmpty()) {
            throw new IllegalArgumentException("Exact split requires amounts specified in params.");
        }

        Map<UUID, Long> splits = new LinkedHashMap<>();
        long runningSum = 0L;

        for (UUID userId : participantIds) {
            Object rawVal = params.get(userId);
            long amountCents = 0L;
            if (rawVal instanceof Number number) {
                amountCents = number.longValue();
            } else if (rawVal instanceof String strVal) {
                try {
                    // Check if string is decimal dollar like "12.50" or cent string "1250"
                    if (strVal.contains(".")) {
                        amountCents = Math.round(Double.parseDouble(strVal) * 100.0);
                    } else {
                        amountCents = Long.parseLong(strVal);
                    }
                } catch (NumberFormatException e) {
                    throw new IllegalArgumentException("Invalid amount format for user " + userId + ": " + strVal);
                }
            }

            if (amountCents < 0) {
                throw new IllegalArgumentException("Owed amount cannot be negative for user: " + userId);
            }

            splits.put(userId, amountCents);
            runningSum += amountCents;
        }

        if (runningSum != totalCostCents) {
            throw new IllegalArgumentException(String.format(
                "Exact split sum (%d cents) does not match total expense cost (%d cents). Discrepancy: %d cents.",
                runningSum, totalCostCents, totalCostCents - runningSum
            ));
        }

        return splits;
    }
}
