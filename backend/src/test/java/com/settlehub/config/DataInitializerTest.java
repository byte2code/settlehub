package com.settlehub.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DataInitializerTest {

    @Test
    void demoDataOnlySeedsLocalH2ByDefault() {
        assertTrue(DataInitializer.shouldSeed("auto", "jdbc:h2:mem:settlehub"));
        assertFalse(DataInitializer.shouldSeed("auto", "jdbc:postgresql://neon/db"));
        assertFalse(DataInitializer.shouldSeed("false", "jdbc:h2:mem:settlehub"));
        assertTrue(DataInitializer.shouldSeed("true", "jdbc:postgresql://neon/db"));
    }
}
