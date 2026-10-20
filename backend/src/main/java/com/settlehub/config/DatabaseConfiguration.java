package com.settlehub.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class DatabaseConfiguration {

    private static final Logger log = LoggerFactory.getLogger(DatabaseConfiguration.class);

    @Value("${DATABASE_URL:#{null}}")
    private String databaseUrlProperty;

    @Bean
    @Primary
    public DataSource dataSource() {
        String dbUrl = databaseUrlProperty;
        if (dbUrl == null || dbUrl.trim().isEmpty()) {
            dbUrl = System.getenv("DATABASE_URL");
        }
        if (dbUrl == null || dbUrl.trim().isEmpty()) {
            dbUrl = System.getProperty("DATABASE_URL");
        }
        if (dbUrl == null || dbUrl.trim().isEmpty()) {
            dbUrl = findDatabaseUrlInDotEnv();
        }

        if (dbUrl != null && !dbUrl.trim().isEmpty()) {
            return createPostgreSqlDataSource(dbUrl.trim());
        }

        log.info("[DatabaseConfiguration] No DATABASE_URL found. Initializing default in-memory H2 DataSource.");
        HikariConfig h2Config = new HikariConfig();
        h2Config.setDriverClassName("org.h2.Driver");
        h2Config.setJdbcUrl("jdbc:h2:mem:settlehub;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE;MODE=PostgreSQL");
        h2Config.setUsername("sa");
        h2Config.setPassword("");
        return new HikariDataSource(h2Config);
    }

    private DataSource createPostgreSqlDataSource(String rawUrl) {
        if ((rawUrl.startsWith("\"") && rawUrl.endsWith("\"")) ||
            (rawUrl.startsWith("'") && rawUrl.endsWith("'"))) {
            rawUrl = rawUrl.substring(1, rawUrl.length() - 1);
        }

        String normalizedUrl = rawUrl;
        if (normalizedUrl.startsWith("postgres://")) {
            normalizedUrl = "postgresql://" + normalizedUrl.substring("postgres://".length());
        }

        try {
            URI uri = new URI(normalizedUrl);
            String userInfo = uri.getUserInfo();
            String username = null;
            String password = null;

            if (userInfo != null && userInfo.contains(":")) {
                String[] parts = userInfo.split(":", 2);
                username = parts[0];
                password = parts[1];
            } else if (userInfo != null) {
                username = userInfo;
            }

            String host = uri.getHost();
            int port = uri.getPort() != -1 ? uri.getPort() : 5432;
            String path = uri.getPath();
            if (path != null && path.startsWith("/")) {
                path = path.substring(1);
            }

            String jdbcUrl = String.format("jdbc:postgresql://%s:%d/%s?sslmode=require", host, port, path);

            HikariConfig config = new HikariConfig();
            config.setDriverClassName("org.postgresql.Driver");
            config.setJdbcUrl(jdbcUrl);
            if (username != null) config.setUsername(username);
            if (password != null) config.setPassword(password);

            // Neon Serverless Postgres pool optimizations
            config.setMaximumPoolSize(10);
            config.setMinimumIdle(2);
            config.setIdleTimeout(300000);
            config.setMaxLifetime(1800000);
            config.setConnectionTimeout(30000);
            config.setPoolName("NeonPostgreSqlPool");

            log.info("[DatabaseConfiguration] Successfully configured Neon PostgreSQL DataSource connected to {}:{}/{}", host, port, path);
            return new HikariDataSource(config);
        } catch (Exception e) {
            log.error("[DatabaseConfiguration] Failed to parse DATABASE_URL: {}", e.getMessage(), e);
            throw new IllegalStateException("Failed to configure PostgreSQL DataSource from DATABASE_URL", e);
        }
    }

    private String findDatabaseUrlInDotEnv() {
        Path[] candidates = new Path[] {
            Paths.get(".env.local"),
            Paths.get(".env"),
            Paths.get("../.env.local"),
            Paths.get("../.env"),
            Paths.get("../../.env.local")
        };

        for (Path candidate : candidates) {
            Path abs = candidate.toAbsolutePath().normalize();
            if (Files.exists(abs)) {
                try {
                    for (String line : Files.readAllLines(abs)) {
                        String trimmed = line.trim();
                        if (trimmed.startsWith("DATABASE_URL=")) {
                            String value = trimmed.substring("DATABASE_URL=".length()).trim();
                            if ((value.startsWith("\"") && value.endsWith("\"")) ||
                                (value.startsWith("'") && value.endsWith("'"))) {
                                value = value.substring(1, value.length() - 1);
                            }
                            if (!value.isEmpty()) {
                                log.info("[DatabaseConfiguration] Discovered DATABASE_URL from: {}", abs);
                                return value;
                            }
                        }
                    }
                } catch (Exception ignored) {
                }
            }
        }
        return null;
    }
}
