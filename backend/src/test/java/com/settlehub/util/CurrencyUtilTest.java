package com.settlehub.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CurrencyUtilTest {

    @Test
    void formatsWithGroupingAndMinorUnits() {
        assertEquals("₹123,456.78", CurrencyUtil.formatCents(12_345_678, "INR"));
        assertEquals("-$10.05", CurrencyUtil.formatCents(-1005, "usd"));
        assertEquals("¥1,234", CurrencyUtil.formatCents(123_400, "JPY"));
        assertEquals("CHF 5.00", CurrencyUtil.formatCents(500, "CHF"));
    }
}
