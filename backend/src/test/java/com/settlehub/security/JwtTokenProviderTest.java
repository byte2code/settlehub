package com.settlehub.security;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JwtTokenProviderTest {

    private static final String POSTGRES = "jdbc:postgresql://neon/db";

    @Test
    void realDatabaseRequiresPrivateSecret() {
        assertThrows(IllegalStateException.class, () -> JwtTokenProvider.resolveSecret("", POSTGRES));
        assertThrows(IllegalStateException.class, () -> JwtTokenProvider.resolveSecret(JwtTokenProvider.LEGACY_PUBLIC_SECRET, POSTGRES));
        assertThrows(IllegalStateException.class, () -> JwtTokenProvider.resolveSecret("too-short", POSTGRES));
        assertEquals("a".repeat(40), JwtTokenProvider.resolveSecret("a".repeat(40), POSTGRES));
    }

    @Test
    void inMemoryDevFallsBackToDevSecret() {
        assertEquals(JwtTokenProvider.DEV_ONLY_SECRET, JwtTokenProvider.resolveSecret("", "jdbc:h2:mem:x"));
    }

    @Test
    void roundTripsAndRejectsTamperedTokens() {
        JwtTokenProvider provider = new JwtTokenProvider("s".repeat(40), 60_000, POSTGRES);
        UUID id = UUID.randomUUID();
        String token = provider.generateToken(new UserPrincipal(id, "a@b.c", "x", "A", true, java.util.List.of()));
        assertEquals(id, provider.parseUserId(token).orElseThrow());
        assertTrue(provider.parseUserId(token + "x").isEmpty());

        JwtTokenProvider other = new JwtTokenProvider("t".repeat(40), 60_000, POSTGRES);
        assertTrue(other.parseUserId(token).isEmpty());
    }
}
