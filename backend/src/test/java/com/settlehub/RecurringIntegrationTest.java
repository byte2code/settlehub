package com.settlehub;

import com.settlehub.service.RecurringService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class RecurringIntegrationTest extends ApiTestSupport {

    @Test
    @DisplayName("Next-run dates: weekly, monthly, month-end clamping and year change")
    void advanceDates() {
        assertEquals(LocalDate.of(2026, 3, 8), RecurringService.advance(LocalDate.of(2026, 3, 1), "WEEKLY", 1));
        assertEquals(LocalDate.of(2026, 2, 28), RecurringService.advance(LocalDate.of(2026, 1, 31), "MONTHLY", 31));
        assertEquals(LocalDate.of(2028, 2, 29), RecurringService.advance(LocalDate.of(2028, 1, 31), "MONTHLY", 31)); // leap year
        assertEquals(LocalDate.of(2026, 3, 31), RecurringService.advance(LocalDate.of(2026, 2, 28), "MONTHLY", 31));   // back to the 31st
        assertEquals(LocalDate.of(2027, 1, 15), RecurringService.advance(LocalDate.of(2026, 12, 15), "MONTHLY", 15));
    }

    private Map<String, Object> rent(TestUser alice, TestUser bob, LocalDate start) {
        return Map.of("description", "Rent", "costCents", 1200000, "category", "STAY", "payerId", alice.id().toString(),
            "participantIds", List.of(alice.id().toString(), bob.id().toString()), "frequency", "MONTHLY", "startDate", start.toString());
    }

    @Test
    @DisplayName("Due occurrences are created once (catching up missed months), split equally, and repeat runs add nothing")
    void generatesIdempotently() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        UUID group = createGroup(alice, "Flat", List.of(bob.email()));
        LocalDate start = LocalDate.now(ZoneOffset.UTC).minusMonths(3).withDayOfMonth(1); // occurrences: -2, -1 and 0 months, all due

        JsonNode created = json(perform(post("/api/v1/groups/" + group + "/recurring"), alice, rent(alice, bob, start)).andExpect(status().isCreated()));
        assertEquals(start.plusMonths(1).toString(), created.get("nextRunDate").asString());

        JsonNode first = json(perform(post("/api/v1/groups/" + group + "/recurring/run"), bob, null).andExpect(status().isOk()));
        assertEquals(3, first.get("generated").asInt());
        assertEquals(0, json(perform(post("/api/v1/groups/" + group + "/recurring/run"), alice, null)).get("generated").asInt());

        JsonNode expenses = json(perform(get("/api/v1/groups/" + group + "/expenses"), alice, null));
        assertEquals(3, expenses.size());
        assertEquals("Rent", expenses.get(0).get("description").asString());
        assertEquals(1200000, expenses.get(0).get("costCents").asLong());
        assertEquals(600000, expenses.get(0).get("splits").get(0).get("owedCents").asLong());
        assertEquals(-1800000, netBalance(alice, group, bob)); // Bob owes three months of his half

        JsonNode listed = json(perform(get("/api/v1/groups/" + group + "/recurring"), bob, null));
        assertEquals(1, listed.size());
        assertTrue(LocalDate.parse(listed.get(0).get("nextRunDate").asString()).isAfter(LocalDate.now(ZoneOffset.UTC)));
    }

    @Test
    @DisplayName("Only members use it, the creator or an admin can delete, and a template pauses when someone leaves")
    void accessAndPausing() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        TestUser cara = register("Cara");
        TestUser outsider = register("Eve");
        UUID group = createGroup(alice, "Flat", List.of(bob.email(), cara.email()));
        LocalDate start = LocalDate.now(ZoneOffset.UTC).minusMonths(2).withDayOfMonth(1);

        perform(post("/api/v1/groups/" + group + "/recurring"), outsider, rent(alice, bob, start)).andExpect(status().isNotFound());
        perform(get("/api/v1/groups/" + group + "/recurring"), outsider, null).andExpect(status().isNotFound());
        // someone who is not in the group can't be part of it
        perform(post("/api/v1/groups/" + group + "/recurring"), alice, Map.of("description", "Rent", "costCents", 1000, "payerId", alice.id().toString(),
            "participantIds", List.of(outsider.id().toString()), "frequency", "MONTHLY")).andExpect(status().isBadRequest());
        perform(post("/api/v1/groups/" + group + "/recurring"), alice, Map.of("description", "Rent", "costCents", 1000, "payerId", alice.id().toString(),
            "participantIds", List.of(alice.id().toString()), "frequency", "YEARLY")).andExpect(status().isBadRequest());

        // Bob leaves before anything was generated, so the template pauses instead of billing a ghost
        String id = json(perform(post("/api/v1/groups/" + group + "/recurring"), bob, rent(alice, bob, start)).andExpect(status().isCreated())).get("id").asString();
        perform(delete("/api/v1/recurring/" + id), cara, null).andExpect(status().isForbidden()); // not creator, not admin
        perform(post("/api/v1/groups/" + group + "/leave"), bob, null).andExpect(status().isOk());
        assertEquals(0, json(perform(post("/api/v1/groups/" + group + "/recurring/run"), alice, null)).get("generated").asInt());
        JsonNode listed = json(perform(get("/api/v1/groups/" + group + "/recurring"), alice, null));
        assertFalse(listed.get(0).get("active").asBoolean());
        assertTrue(listed.get(0).get("pausedReason").asString().contains("left"));
        assertEquals(0, json(perform(get("/api/v1/groups/" + group + "/expenses"), alice, null)).size());

        perform(delete("/api/v1/recurring/" + id), alice, null).andExpect(status().isOk()); // admin may remove it
        assertEquals(0, json(perform(get("/api/v1/groups/" + group + "/recurring"), alice, null)).size());
    }

    @Test
    @DisplayName("Archived groups don't get new repeating expenses")
    void archivedIsSkipped() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        UUID group = createGroup(alice, "Old flat", List.of(bob.email()));
        perform(post("/api/v1/groups/" + group + "/recurring"), alice, rent(alice, bob, LocalDate.now(ZoneOffset.UTC).minusMonths(2).withDayOfMonth(1))).andExpect(status().isCreated());
        perform(put("/api/v1/groups/" + group), alice, Map.of("archived", true)).andExpect(status().isOk());
        assertEquals(0, json(perform(post("/api/v1/groups/" + group + "/recurring/run"), alice, null)).get("generated").asInt());
        perform(post("/api/v1/groups/" + group + "/recurring"), alice, rent(alice, bob, LocalDate.now(ZoneOffset.UTC))).andExpect(status().isForbidden());
    }
}
