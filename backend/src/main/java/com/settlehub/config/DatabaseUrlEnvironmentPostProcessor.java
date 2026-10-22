package com.settlehub.config;

import org.springframework.boot.EnvironmentPostProcessor;
import org.springframework.boot.SpringApplication;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

/**
 * Maps the PaaS-style DATABASE_URL (postgres://user:pass@host:port/db, as given by Neon,
 * Render, Railway, Heroku) onto standard spring.datasource.* properties, so Spring Boot's own
 * DataSource and Flyway auto-configuration work unchanged.
 *
 * When no DATABASE_URL is present (environment, system property or a local .env file),
 * the in-memory H2 defaults from application.properties are used. Setting
 * app.database-url.enabled=false (done for the Maven test run) forces H2.
 *
 * Pool settings are tuned so Neon's free tier can scale compute to zero between requests:
 * no idle connections are kept open.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {

    static final String PROPERTY_SOURCE_NAME = "settlehubDatabaseUrl";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        // The test build sets this to false so a developer's .env.local can never point tests at a real database
        if (!environment.getProperty("app.database-url.enabled", Boolean.class, true)) {
            return;
        }
        String databaseUrl = environment.getProperty("DATABASE_URL");
        if (isBlank(databaseUrl)) {
            databaseUrl = findInDotEnv();
        }
        if (isBlank(databaseUrl)) {
            return;
        }
        environment.getPropertySources().addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, toProperties(databaseUrl)));
    }

    static Map<String, Object> toProperties(String rawUrl) {
        String url = stripQuotes(rawUrl.trim());
        Map<String, Object> props = new HashMap<>();

        if (url.startsWith("jdbc:")) {
            props.put("spring.datasource.url", url);
        } else {
            if (url.startsWith("postgres://")) {
                url = "postgresql://" + url.substring("postgres://".length());
            }
            URI uri = URI.create(url);
            String userInfo = uri.getUserInfo();
            if (userInfo != null) {
                String[] parts = userInfo.split(":", 2);
                props.put("spring.datasource.username", decode(parts[0]));
                if (parts.length > 1) {
                    props.put("spring.datasource.password", decode(parts[1]));
                }
            }
            int port = uri.getPort() != -1 ? uri.getPort() : 5432;
            String database = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "");
            props.put("spring.datasource.url",
                String.format("jdbc:postgresql://%s:%d/%s?sslmode=require", uri.getHost(), port, database));
        }

        props.put("spring.datasource.driver-class-name", "org.postgresql.Driver");
        props.put("spring.datasource.hikari.pool-name", "SettleHubPool");
        props.put("spring.datasource.hikari.maximum-pool-size", 5);
        props.put("spring.datasource.hikari.minimum-idle", 0);
        props.put("spring.datasource.hikari.idle-timeout", 60_000);
        props.put("spring.datasource.hikari.max-lifetime", 300_000);
        // Neon may need a few seconds to wake a suspended compute
        props.put("spring.datasource.hikari.connection-timeout", 30_000);
        props.put("spring.datasource.hikari.initialization-fail-timeout", -1);
        return props;
    }

    private static String findInDotEnv() {
        for (String candidate : new String[] {".env.local", ".env", "../.env.local", "../.env"}) {
            Path path = Path.of(candidate);
            if (!Files.isRegularFile(path)) continue;
            try {
                for (String line : Files.readAllLines(path)) {
                    String trimmed = line.trim();
                    if (trimmed.startsWith("DATABASE_URL=")) {
                        String value = stripQuotes(trimmed.substring("DATABASE_URL=".length()).trim());
                        if (!value.isEmpty()) return value;
                    }
                }
            } catch (Exception ignored) {
                // unreadable .env files are skipped
            }
        }
        return null;
    }

    private static String stripQuotes(String value) {
        if (value.length() >= 2 && ((value.startsWith("\"") && value.endsWith("\""))
                || (value.startsWith("'") && value.endsWith("'")))) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private static String decode(String value) {
        return java.net.URLDecoder.decode(value, java.nio.charset.StandardCharsets.UTF_8);
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
