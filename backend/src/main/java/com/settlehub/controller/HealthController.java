package com.settlehub.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class HealthController {

    private final JdbcTemplate jdbcTemplate;
    private final String version;

    public HealthController(JdbcTemplate jdbcTemplate, @Value("${app.version:dev}") String version) {
        this.jdbcTemplate = jdbcTemplate;
        this.version = version;
    }

    /**
     * Liveness: never touches the database, so uptime/keep-warm pings don't wake a sleeping Neon compute.
     */
    @GetMapping({"/health", "/api/v1/health", "/"})
    public Map<String, Object> health() {
        return Map.of(
            "status", "UP",
            "service", "settlehub-backend",
            "version", version,
            "timestamp", Instant.now().toString()
        );
    }

    /** Readiness: verifies the database connection (wakes Neon if suspended). */
    @GetMapping("/api/v1/health/ready")
    public ResponseEntity<Map<String, Object>> ready() {
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return ResponseEntity.ok(Map.of("status", "UP", "database", "UP", "version", version));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(Map.of("status", "DOWN", "database", "DOWN", "version", version));
        }
    }
}
