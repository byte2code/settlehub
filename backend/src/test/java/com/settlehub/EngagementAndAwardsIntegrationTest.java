package com.settlehub;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class EngagementAndAwardsIntegrationTest extends ApiTestSupport {

    @Test
    @DisplayName("Reactions toggle, are limited to the emoji set, counted per expense and private to members")
    void reactions() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        TestUser outsider = register("Eve");
        UUID group = createGroup(alice, "Goa", List.of(bob.email()));
        UUID expense = addEqualExpense(alice, group, 90000, alice, bob);

        perform(put("/api/v1/expenses/" + expense + "/reactions"), bob, Map.of("emoji", "🍕"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.reactions['🍕']").value(1)).andExpect(jsonPath("$.mine[0]").value("🍕"));
        perform(put("/api/v1/expenses/" + expense + "/reactions"), alice, Map.of("emoji", "🍕"))
            .andExpect(jsonPath("$.reactions['🍕']").value(2));
        // toggling again removes only my own
        perform(put("/api/v1/expenses/" + expense + "/reactions"), bob, Map.of("emoji", "🍕"))
            .andExpect(jsonPath("$.reactions['🍕']").value(1)).andExpect(jsonPath("$.mine").isEmpty());

        perform(put("/api/v1/expenses/" + expense + "/reactions"), bob, Map.of("emoji", "💩")).andExpect(status().isBadRequest());
        perform(put("/api/v1/expenses/" + expense + "/reactions"), outsider, Map.of("emoji", "🍕")).andExpect(status().isNotFound());

        JsonNode all = json(perform(get("/api/v1/groups/" + group + "/engagement"), bob, null).andExpect(status().isOk()));
        assertEquals(1, all.get(expense.toString()).get("reactions").get("🍕").asInt());
        perform(get("/api/v1/groups/" + group + "/engagement"), outsider, null).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Comments are plain text, length-limited by characters, and removable by their author or a group admin")
    void comments() throws Exception {
        TestUser alice = register("Alice"); // group admin
        TestUser bob = register("Bob");
        TestUser cara = register("Cara");
        UUID group = createGroup(alice, "Trip", List.of(bob.email(), cara.email()));
        UUID expense = addEqualExpense(alice, group, 9000, alice, bob, cara);
        String url = "/api/v1/expenses/" + expense + "/comments";

        JsonNode created = json(perform(post(url), bob, Map.of("body", "  why   ₹900 for water?\u0007 😭 ")).andExpect(status().isCreated())
            .andExpect(jsonPath("$.body").value("why ₹900 for water? 😭")).andExpect(jsonPath("$.mine").value(true)));
        perform(post(url), bob, Map.of("body", "   ")).andExpect(status().isBadRequest());
        perform(post(url), bob, Map.of("body", "x".repeat(201))).andExpect(status().isBadRequest());
        // 200 emoji are 200 characters even though they are 400 UTF-16 units
        perform(post(url), bob, Map.of("body", "😭".repeat(200))).andExpect(status().isCreated());

        assertEquals(2, json(perform(get(url), cara, null)).size());
        assertEquals(2, json(perform(get("/api/v1/groups/" + group + "/engagement"), cara, null)).get(expense.toString()).get("comments").asInt());

        String id = created.get("id").asString();
        perform(delete("/api/v1/comments/" + id), cara, null).andExpect(status().isForbidden()); // neither author nor admin
        perform(delete("/api/v1/comments/" + id), alice, null).andExpect(status().isOk());       // admin
        assertEquals(1, json(perform(get(url), cara, null)).size());
    }

    @Test
    @DisplayName("Archived groups are read-only for reactions and comments")
    void archivedIsReadOnly() throws Exception {
        TestUser alice = register("Alice");
        UUID group = createGroup(alice, "Old trip", List.of());
        UUID expense = addEqualExpense(alice, group, 1000, alice);
        perform(put("/api/v1/groups/" + group), alice, Map.of("archived", true)).andExpect(status().isOk());
        perform(put("/api/v1/expenses/" + expense + "/reactions"), alice, Map.of("emoji", "🍕")).andExpect(status().isForbidden());
        perform(post("/api/v1/expenses/" + expense + "/comments"), alice, Map.of("body", "hi")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Awards need 3 people and 5 expenses, only admins reveal them, and the result is a stored snapshot")
    void awards() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        TestUser cara = register("Cara");
        UUID group = createGroup(alice, "Awards trip", List.of(bob.email(), cara.email()));
        String base = "/api/v1/groups/" + group + "/awards";

        JsonNode early = json(perform(get(base), bob, null).andExpect(status().isOk()));
        assertFalse(early.get("revealed").asBoolean());
        assertFalse(early.get("eligible").asBoolean());
        perform(post(base + "/reveal"), alice, null).andExpect(status().isBadRequest());

        // Bob pays three food bills, Alice two other bills
        for (int i = 0; i < 3; i++) {
            perform(post("/api/v1/groups/" + group + "/expenses"), bob, Map.of("description", "Biryani " + i, "costCents", 30000 + i,
                "creationMethod", "EQUAL", "category", "FOOD",
                "splits", List.of(Map.of("userId", alice.id().toString()), Map.of("userId", bob.id().toString()), Map.of("userId", cara.id().toString()))))
                .andExpect(status().isCreated());
        }
        addEqualExpense(alice, group, 6000, alice, bob, cara);
        addEqualExpense(alice, group, 9000, alice, bob, cara);
        // Cara settles quickly with Bob and with Alice
        perform(post("/api/v1/settlements"), cara, Map.of("groupId", group.toString(), "payerId", cara.id().toString(), "payeeId", bob.id().toString(), "amountCents", 1000))
            .andExpect(status().isCreated());

        perform(post(base + "/reveal"), bob, null).andExpect(status().isForbidden()); // not an admin
        JsonNode revealed = json(perform(post(base + "/reveal"), alice, null).andExpect(status().isOk()));
        assertTrue(revealed.get("revealed").asBoolean());
        JsonNode awards = revealed.get("awards");
        assertEquals("Bob", find(awards, "biryani-baron").get("winners").get(0).asString());
        assertEquals("Cara", find(awards, "fastest-payer").get("winners").get(0).asString());

        // Everyone can read the snapshot afterwards; later expenses don't change it
        addEqualExpense(cara, group, 5000000, alice, bob, cara);
        JsonNode again = json(perform(get(base), cara, null).andExpect(status().isOk()));
        assertTrue(again.get("revealed").asBoolean());
        assertEquals("Bob", find(again.get("awards"), "biryani-baron").get("winners").get(0).asString());

        perform(delete(base), bob, null).andExpect(status().isForbidden());
        perform(delete(base), alice, null).andExpect(status().isOk());
        assertFalse(json(perform(get(base), cara, null)).get("revealed").asBoolean());
    }

    private static JsonNode find(JsonNode awards, String id) {
        for (JsonNode a : awards) if (id.equals(a.get("id").asString())) return a;
        throw new AssertionError("missing award " + id);
    }
}
