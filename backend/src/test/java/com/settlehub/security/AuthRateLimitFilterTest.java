package com.settlehub.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

class AuthRateLimitFilterTest {

    @Test
    void limitsPerKeyWithinSlidingWindow() {
        AtomicLong now = new AtomicLong(1_000_000);
        Clock clock = new Clock() {
            public ZoneOffset getZone() { return ZoneOffset.UTC; }
            public Clock withZone(java.time.ZoneId zone) { return this; }
            public Instant instant() { return Instant.ofEpochMilli(now.get()); }
        };
        AuthRateLimitFilter filter = new AuthRateLimitFilter(3, clock);

        assertTrue(filter.tryAcquire("ip1"));
        assertTrue(filter.tryAcquire("ip1"));
        assertTrue(filter.tryAcquire("ip1"));
        assertFalse(filter.tryAcquire("ip1"));
        assertTrue(filter.tryAcquire("ip2"), "other clients are unaffected");

        now.addAndGet(60_001);
        assertTrue(filter.tryAcquire("ip1"), "window slides");
    }
}
