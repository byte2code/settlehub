package com.settlehub.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.UUID;

@Component
public class JwtTokenProvider {

    private final SecretKey key;
    private final long jwtExpirationMs;

    public JwtTokenProvider(
        @Value("${app.jwt.secret:9a3f2c4e5b6a7d8e9f0123456789abcdef0123456789abcdef0123456789abcdef}") String jwtSecret,
        @Value("${app.jwt.expiration-ms:2592000000}") long jwtExpirationMs
    ) {
        byte[] keyBytes = Decoders.BASE64.decode(ensureBase64(jwtSecret));
        this.key = Keys.hmacShaKeyFor(keyBytes);
        this.jwtExpirationMs = jwtExpirationMs;
    }

    private static String ensureBase64(String secret) {
        if (secret.length() < 32) {
            secret = (secret + "0123456789abcdef0123456789abcdef").substring(0, 32);
        }
        return java.util.Base64.getEncoder().encodeToString(secret.getBytes());
    }

    public String generateToken(UserPrincipal userPrincipal) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpirationMs);

        return Jwts.builder()
            .subject(userPrincipal.getId().toString())
            .claim("email", userPrincipal.getUsername())
            .claim("name", userPrincipal.getFullName())
            .issuedAt(now)
            .expiration(expiryDate)
            .signWith(key, Jwts.SIG.HS256)
            .compact();
    }

    public UUID getUserIdFromJWT(String token) {
        Claims claims = Jwts.parser()
            .verifyWith(key)
            .build()
            .parseSignedClaims(token)
            .getPayload();

        return UUID.fromString(claims.getSubject());
    }

    public boolean validateToken(String authToken) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(authToken);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }
}
