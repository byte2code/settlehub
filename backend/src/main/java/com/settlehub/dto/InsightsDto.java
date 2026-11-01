package com.settlehub.dto;

import java.util.List;
import java.util.Map;

public final class InsightsDto {
    private InsightsDto() {}

    /** One calendar month of the user's own share of spending, in one currency. */
    public record MonthTotal(String month, long totalCents, Map<String, Long> byCategory) {}

    public record CurrencyInsights(String currency, long totalCents, long averagePerMonthCents, String topCategory, List<MonthTotal> months) {}

    public record Insights(int months, String timeZone, List<CurrencyInsights> currencies) {}
}
