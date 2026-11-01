package com.settlehub.service;

import com.settlehub.dto.InsightsDto.CurrencyInsights;
import com.settlehub.dto.InsightsDto.Insights;
import com.settlehub.dto.InsightsDto.MonthTotal;
import com.settlehub.repository.ExpenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.*;

/** Your own spending, by month and category. Currencies are never added together. */
@Service
public class InsightsService {

    private final ExpenseRepository expenseRepository;

    public InsightsService(ExpenseRepository expenseRepository) {
        this.expenseRepository = expenseRepository;
    }

    @Transactional(readOnly = true)
    public Insights forUser(UUID userId, int monthsRequested, String timeZone) {
        int months = Math.min(Math.max(monthsRequested, 1), 12);
        ZoneId zone = parseZone(timeZone);
        YearMonth current = YearMonth.now(zone);
        YearMonth first = current.minusMonths(months - 1L);
        Instant from = first.atDay(1).atStartOfDay(zone).toInstant();

        // currency -> month -> category -> cents
        Map<String, Map<YearMonth, Map<String, Long>>> data = new TreeMap<>();
        for (Object[] row : expenseRepository.shareRowsSince(userId, from)) {
            YearMonth month = YearMonth.from(((Instant) row[0]).atZone(zone));
            if (month.isBefore(first) || month.isAfter(current)) continue; // future-dated entries aren't spending yet
            String category = row[1] == null ? "OTHER" : (String) row[1];
            data.computeIfAbsent((String) row[2], k -> new HashMap<>())
                .computeIfAbsent(month, k -> new TreeMap<>())
                .merge(category, ((Number) row[3]).longValue(), Long::sum);
        }

        List<CurrencyInsights> out = new ArrayList<>();
        for (Map.Entry<String, Map<YearMonth, Map<String, Long>>> c : data.entrySet()) {
            List<MonthTotal> list = new ArrayList<>();
            Map<String, Long> overall = new HashMap<>();
            long total = 0;
            for (YearMonth m = first; !m.isAfter(current); m = m.plusMonths(1)) {
                Map<String, Long> cats = c.getValue().getOrDefault(m, Map.of());
                long sum = cats.values().stream().mapToLong(Long::longValue).sum();
                cats.forEach((k, v) -> overall.merge(k, v, Long::sum));
                total += sum;
                list.add(new MonthTotal(m.toString(), sum, new LinkedHashMap<>(cats)));
            }
            String top = overall.entrySet().stream().max(Map.Entry.comparingByValue()).map(Map.Entry::getKey).orElse(null);
            out.add(new CurrencyInsights(c.getKey(), total, Math.round(total / (double) months), top, list));
        }
        out.sort(Comparator.comparingLong(CurrencyInsights::totalCents).reversed());
        return new Insights(months, zone.getId(), out);
    }

    private static ZoneId parseZone(String tz) {
        try {
            return tz == null || tz.isBlank() ? ZoneOffset.UTC : ZoneId.of(tz);
        } catch (Exception e) {
            return ZoneOffset.UTC;
        }
    }
}
