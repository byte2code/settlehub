package com.settlehub.util;

import java.util.Locale;

public final class CurrencyUtil {

    public static final String DEFAULT_CURRENCY = "INR";

    private CurrencyUtil() {}

    public static String getSymbol(String currencyCode) {
        if (currencyCode == null || currencyCode.isBlank()) {
            return "₹";
        }
        return switch (currencyCode.trim().toUpperCase()) {
            case "INR" -> "₹";
            case "USD" -> "$";
            case "EUR" -> "€";
            case "GBP" -> "£";
            case "CAD" -> "C$";
            case "AUD" -> "A$";
            case "SGD" -> "S$";
            case "JPY" -> "¥";
            case "AED" -> "AED ";
            default -> currencyCode.trim().toUpperCase() + " ";
        };
    }

    public static String formatCents(long cents, String currencyCode) {
        String symbol = getSymbol(currencyCode);
        boolean negative = cents < 0;
        long absCents = Math.abs(cents);
        String formattedNumber = String.format(Locale.US, "%.2f", absCents / 100.0);
        return (negative ? "-" : "") + symbol + formattedNumber;
    }
}
