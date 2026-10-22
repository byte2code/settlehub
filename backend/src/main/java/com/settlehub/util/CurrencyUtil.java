package com.settlehub.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.Locale;
import java.util.Set;

/**
 * All amounts are stored as long "cents" (minor units x100) for every currency.
 * Zero-decimal currencies such as JPY are still stored x100 but displayed without decimals.
 */
public final class CurrencyUtil {

    public static final String DEFAULT_CURRENCY = "INR";

    private static final Set<String> ZERO_DECIMAL = Set.of("JPY", "KRW", "VND", "IDR", "CLP", "HUF", "ISK");

    private CurrencyUtil() {}

    public static String normalize(String currencyCode) {
        return (currencyCode == null || currencyCode.isBlank()) ? DEFAULT_CURRENCY : currencyCode.trim().toUpperCase(Locale.ROOT);
    }

    public static String getSymbol(String currencyCode) {
        String code = normalize(currencyCode);
        return switch (code) {
            case "INR" -> "₹";
            case "USD" -> "$";
            case "EUR" -> "€";
            case "GBP" -> "£";
            case "CAD" -> "C$";
            case "AUD" -> "A$";
            case "SGD" -> "S$";
            case "JPY" -> "¥";
            case "THB" -> "฿";
            default -> code + " ";
        };
    }

    public static boolean isZeroDecimal(String currencyCode) {
        return ZERO_DECIMAL.contains(normalize(currencyCode));
    }

    public static String formatCents(long cents, String currencyCode) {
        int decimals = isZeroDecimal(currencyCode) ? 0 : 2;
        BigDecimal major = BigDecimal.valueOf(Math.abs(cents), 2).setScale(decimals, RoundingMode.HALF_UP);
        DecimalFormat format = new DecimalFormat(decimals == 0 ? "#,##0" : "#,##0.00", DecimalFormatSymbols.getInstance(Locale.US));
        return (cents < 0 ? "-" : "") + getSymbol(currencyCode) + format.format(major);
    }
}
