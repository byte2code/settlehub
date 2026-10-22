package com.settlehub.engine;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Percentage split using the largest-remainder method:
 * each share is floor(total * pct / sumPct); the leftover cents go to the participants with the
 * largest fractional parts (ties broken by participant order). sum(splits) == totalCostCents always.
 */
@Component("percentageSplitStrategy")
public class PercentageSplitStrategy implements SplitStrategy {

    private static final double TOLERANCE = 0.05;

    @Override
    public Map<UUID, Long> calculateSplits(Long totalCostCents, List<UUID> participantIds, Map<UUID, ?> params) {
        SplitStrategy.requireDistinctParticipants(participantIds);
        if (params == null || params.isEmpty()) {
            throw new IllegalArgumentException("Percentage split requires percentages specified in params.");
        }
        if (totalCostCents == null || totalCostCents < 0) {
            throw new IllegalArgumentException("Total cost must be non-negative.");
        }

        List<BigDecimal> percentages = new ArrayList<>();
        BigDecimal totalPercentage = BigDecimal.ZERO;
        for (UUID userId : participantIds) {
            BigDecimal pct = parsePercentage(userId, params.get(userId));
            percentages.add(pct);
            totalPercentage = totalPercentage.add(pct);
        }

        if (totalPercentage.subtract(BigDecimal.valueOf(100)).abs().doubleValue() > TOLERANCE) {
            throw new IllegalArgumentException(String.format(
                "Total percentages must sum to 100%% (current sum: %.2f%%).", totalPercentage.doubleValue()));
        }

        BigDecimal total = BigDecimal.valueOf(totalCostCents);
        long[] shares = new long[participantIds.size()];
        BigDecimal[] remainders = new BigDecimal[participantIds.size()];
        long allocated = 0;
        for (int i = 0; i < shares.length; i++) {
            BigDecimal exact = total.multiply(percentages.get(i)).divide(totalPercentage, 10, RoundingMode.HALF_UP);
            BigDecimal floor = exact.setScale(0, RoundingMode.FLOOR);
            shares[i] = floor.longValueExact();
            remainders[i] = exact.subtract(floor);
            allocated += shares[i];
        }

        long leftover = totalCostCents - allocated;
        Integer[] order = new Integer[shares.length];
        for (int i = 0; i < order.length; i++) order[i] = i;
        Arrays.sort(order, (a, b) -> remainders[b].compareTo(remainders[a]));
        for (int i = 0; i < leftover; i++) {
            shares[order[i % order.length]]++;
        }

        Map<UUID, Long> splits = new LinkedHashMap<>();
        for (int i = 0; i < shares.length; i++) {
            splits.put(participantIds.get(i), shares[i]);
        }
        return splits;
    }

    private static BigDecimal parsePercentage(UUID userId, Object rawVal) {
        BigDecimal pct;
        if (rawVal instanceof Number number) {
            pct = new BigDecimal(number.toString());
        } else if (rawVal instanceof String strVal) {
            try {
                pct = new BigDecimal(strVal.replace("%", "").trim());
            } catch (NumberFormatException e) {
                throw new IllegalArgumentException("Invalid percentage for user " + userId + ": " + strVal);
            }
        } else {
            pct = BigDecimal.ZERO;
        }
        if (pct.signum() < 0) {
            throw new IllegalArgumentException("Percentage cannot be negative for user: " + userId);
        }
        return pct;
    }
}
