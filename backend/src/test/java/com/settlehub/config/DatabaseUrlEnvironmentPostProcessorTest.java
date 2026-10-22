package com.settlehub.config;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DatabaseUrlEnvironmentPostProcessorTest {

    @Test
    void parsesNeonStyleUrl() {
        Map<String, Object> props = DatabaseUrlEnvironmentPostProcessor.toProperties(
            "postgresql://neondb_owner:p%40ss@ep-cool-1234-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require");
        assertEquals("jdbc:postgresql://ep-cool-1234-pooler.us-east-2.aws.neon.tech:5432/neondb?sslmode=require",
            props.get("spring.datasource.url"));
        assertEquals("neondb_owner", props.get("spring.datasource.username"));
        assertEquals("p@ss", props.get("spring.datasource.password"));
        assertEquals(0, props.get("spring.datasource.hikari.minimum-idle"), "Neon must be able to scale to zero");
    }

    @Test
    void acceptsLegacySchemeQuotesAndJdbcUrls() {
        Map<String, Object> props = DatabaseUrlEnvironmentPostProcessor.toProperties("\"postgres://u:p@host:6543/db\"");
        assertEquals("jdbc:postgresql://host:6543/db?sslmode=require", props.get("spring.datasource.url"));

        Map<String, Object> jdbc = DatabaseUrlEnvironmentPostProcessor.toProperties("jdbc:postgresql://h/db?user=x");
        assertEquals("jdbc:postgresql://h/db?user=x", jdbc.get("spring.datasource.url"));
    }
}
