package com.settlehub.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

@Component
public class JwtTokenProvider {

    private static final Logger log = LoggerFactory.getLogger(JwtTokenProvider.class);

    /** Only ever used against the local in-memory H2 database. */
    static final String DEV_ONLY_SECRET = "settlehub-local-development-secret-do-not-use-in-production";
    /** Fallback secret that shipped in 2.0's public source; never accepted against a real database. */
    static final String LEGACY_PUBLIC_SECRET = "9a3f2c4e5b6a7d8e9f0123456789abcdef0123456789abcdef0123456789abcdef";

    private final SecretKey key;
    private final long jwtExpirationMs;

    public JwtTokenProvider(
        @Value("${app.jwt.secret:}") String jwtSecret,
        @Value("${app.jwt.expiration-ms:2592000000}") long jwtExpirationMs,
        @Value("${spring.datasource.url:}") String datasourceUrl
    ) {
        this.key = Keys.hmacShaKeyFor(resolveSecret(jwtSecret, datasourceUrl).getBytes(StandardCharsets.UTF_8));
        this.jwtExpirationMs = jwtExpirationMs;
    }

    static String resolveSecret(String configured, String datasourceUrl) {
        boolean inMemoryDev = datasourceUrl == null || datasourceUrl.isBlank() || datasourceUrl.startsWith("jdbc:h2:mem:");
        boolean missing = configured == null || configured.isBlank();
        if (!inMemoryDev && (missing || configured.equals(LEGACY_PUBLIC_SECRET))) {
            throw new IllegalStateException(
                "JWT_SECRET must be set to a private random value (32+ characters) when a real database is configured. "
                + "Generate one with: openssl rand -hex 32");
        }
        if (missing) {
            log.warn("JWT_SECRET not set - using the development-only secret (in-memory H2 database).");
            return DEV_ONLY_SECRET;
        }
        if (configured.length() < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 characters long.");
        }
        return configured;
    }

    public String generateToken(UserPrincipal userPrincipal) {
        Date now = new Date();
        return Jwts.builder()
            .subject(userPrincipal.getId().toString())
            .issuedAt(now)
            .expiration(new Date(now.getTime() + jwtExpirationMs))
            .signWith(key, Jwts.SIG.HS256)
            .compact();
    }

    /** Returns the user id of a valid, unexpired token. */
    public Optional<UUID> parseUserId(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return Optional.of(UUID.fromString(claims.getSubject()));
        } catch (JwtException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }
}
