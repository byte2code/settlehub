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
            return;
        }

        try {
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

            environment.getPropertySources().addFirst(new MapPropertySource(PROPERTY_SOURCE_NAME, props));
            System.out.println("[DatabaseUrlEnvironmentPostProcessor] Configured PostgreSQL DataSource from DATABASE_URL: " + host + ":" + port + "/" + path);
        } catch (Exception e) {
            System.err.println("[DatabaseUrlEnvironmentPostProcessor] Failed to parse DATABASE_URL: " + e.getMessage());
        }
    }
}
