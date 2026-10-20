package com.settlehub.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.net.URI;
import java.util.HashMap;
import java.util.Map;

/**
 * Automatically inspects and parses the PaaS DATABASE_URL environment variable
 * (commonly provided by Render, Heroku, Neon, and Railway).
 * Converts postgres:// or postgresql:// URIs to standard Spring Boot JDBC properties.
 */
public class DatabaseUrlEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String PROPERTY_SOURCE_NAME = "databaseUrlProperties";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String databaseUrl = environment.getProperty("DATABASE_URL");
        if (databaseUrl == null || databaseUrl.trim().isEmpty()) {
            databaseUrl = findDatabaseUrlInDotEnv();
        }
        if (databaseUrl == null || databaseUrl.trim().isEmpty()) {
            return;
        }

        try {
            databaseUrl = databaseUrl.trim();
            if ((databaseUrl.startsWith("\"") && databaseUrl.endsWith("\"")) ||
                (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))) {
                databaseUrl = databaseUrl.substring(1, databaseUrl.length() - 1);
            }

            // Normalize postgres:// to postgresql:// if needed for standard URI parsing
            String normalizedUrl = databaseUrl.trim();
            if (normalizedUrl.startsWith("postgres://")) {
                normalizedUrl = "postgresql://" + normalizedUrl.substring("postgres://".length());
            }

            URI dbUri = new URI(normalizedUrl);
            String userInfo = dbUri.getUserInfo();
            String username = null;
            String password = null;

            if (userInfo != null && userInfo.contains(":")) {
                String[] parts = userInfo.split(":", 2);
                username = parts[0];
                password = parts[1];
            } else if (userInfo != null) {
                username = userInfo;
            }

            String host = dbUri.getHost();
            int port = dbUri.getPort() != -1 ? dbUri.getPort() : 5432;
            String path = dbUri.getPath(); // e.g. "/settlehub_db"
            if (path != null && path.startsWith("/")) {
                path = path.substring(1);
            }

            // Construct JDBC URL with SSL enabled for cloud hosting
            String jdbcUrl = String.format("jdbc:postgresql://%s:%d/%s?sslmode=require", host, port, path);

            Map<String, Object> props = new HashMap<>();
            props.put("spring.datasource.url", jdbcUrl);
            props.put("spring.datasource.driver-class-name", "org.postgresql.Driver");
            if (username != null) {
                props.put("spring.datasource.username", username);
            }
            if (password != null) {
                props.put("spring.datasource.password", password);
            }
            props.put("spring.jpa.database-platform", "org.hibernate.dialect.PostgreSQLDialect");

            // HikariCP connection pool optimization for Neon Serverless Postgres
            props.put("spring.datasource.hikari.maximum-pool-size", 10);
            props.put("spring.datasource.hikari.minimum-idle", 2);
            props.put("spring.datasource.hikari.idle-timeout", 300000);
            props.put("spring.datasource.hikari.max-lifetime", 1800000);
            props.put("spring.datasource.hikari.connection-timeout", 30000);

            environment.getPropertySources().addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, props));
            System.out.println("[DatabaseUrlEnvironmentPostProcessor] Configured Neon/PostgreSQL DataSource from DATABASE_URL: " + host + ":" + port + "/" + path);
        } catch (Exception e) {
            System.err.println("[DatabaseUrlEnvironmentPostProcessor] Failed to parse DATABASE_URL: " + e.getMessage());
        }
    }

    private String findDatabaseUrlInDotEnv() {
        java.nio.file.Path[] candidates = new java.nio.file.Path[] {
            java.nio.file.Paths.get(".env.local"),
            java.nio.file.Paths.get(".env"),
            java.nio.file.Paths.get("../.env.local"),
            java.nio.file.Paths.get("../.env")
        };

        for (java.nio.file.Path candidate : candidates) {
            java.nio.file.Path abs = candidate.toAbsolutePath().normalize();
            System.out.println("[DatabaseUrlEnvironmentPostProcessor] Inspecting env file: " + abs + " (exists: " + java.nio.file.Files.exists(abs) + ")");
            if (java.nio.file.Files.exists(abs)) {
                try {
                    for (String line : java.nio.file.Files.readAllLines(abs)) {
                        String trimmed = line.trim();
                        if (trimmed.startsWith("DATABASE_URL=")) {
                            String value = trimmed.substring("DATABASE_URL=".length()).trim();
                            if ((value.startsWith("\"") && value.endsWith("\"")) ||
                                (value.startsWith("'") && value.endsWith("'"))) {
                                value = value.substring(1, value.length() - 1);
                            }
                            if (!value.isEmpty()) {
                                System.out.println("[DatabaseUrlEnvironmentPostProcessor] Found DATABASE_URL in " + abs);
                                return value;
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("[DatabaseUrlEnvironmentPostProcessor] Error reading " + abs + ": " + e.getMessage());
                }
            }
        }
        return null;
    }
}
