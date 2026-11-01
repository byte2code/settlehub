package com.settlehub;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class InsightsIntegrationTest extends ApiTestSupport {

    private void expense(TestUser payer, UUID group, String description, long cents, String category, List<TestUser> splitWith) throws Exception {
        perform(post("/api/v1/groups/" + group + "/expenses"), payer, Map.of("description", description, "costCents", cents, "creationMethod", "EQUAL",
            "category", category, "splits", splitWith.stream().map(u -> Map.of("userId", u.id().toString())).toList())).andExpect(status().isCreated());
    }

    @Test
    @DisplayName("Insights are your own share, by month and category, per currency, excluding deleted expenses and other people")
    void insights() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        UUID inr = createGroup(alice, "Goa", List.of(bob.email()));
        expense(alice, inr, "Biryani", 90000, "FOOD", List.of(alice, bob));     // Bob's share: 45000
        expense(bob, inr, "Taxi", 20000, "TRANSPORT", List.of(alice, bob));     // Bob's share: 10000
        expense(alice, inr, "Solo", 50000, "SHOPPING", List.of(alice));         // not Bob's
        UUID doomed = UUID.fromString(json(perform(post("/api/v1/groups/" + inr + "/expenses"), alice, Map.of("description", "Oops", "costCents", 99900,
            "creationMethod", "EQUAL", "category", "FOOD", "splits", List.of(Map.of("userId", bob.id().toString())))).andExpect(status().isCreated())).get("id").asString());
        perform(delete("/api/v1/expenses/" + doomed), alice, null).andExpect(status().isOk());

        UUID paris = UUID.fromString(json(perform(post("/api/v1/groups"), alice, Map.of("name", "Paris", "groupType", "trip", "currencyCode", "EUR",
            "memberEmails", List.of(bob.email()))).andExpect(status().isCreated())).get("id").asString());
        expense(alice, paris, "Croissants", 2000, "FOOD", List.of(alice, bob)); // Bob's share: 1000 EUR cents

        JsonNode bobView = json(perform(get("/api/v1/insights/me?months=3"), bob, null).andExpect(status().isOk()));
        assertEquals(3, bobView.get("months").asInt());
        JsonNode inrRow = bobView.get("currencies").get(0);
        assertEquals("INR", inrRow.get("currency").asString());
        assertEquals(55000, inrRow.get("totalCents").asLong());
        assertEquals("FOOD", inrRow.get("topCategory").asString());
        assertEquals(3, inrRow.get("months").size());
        JsonNode thisMonth = inrRow.get("months").get(2);
        assertEquals(YearMonth.now(ZoneOffset.UTC).toString(), thisMonth.get("month").asString());
        assertEquals(45000, thisMonth.get("byCategory").get("FOOD").asLong());
        assertEquals(10000, thisMonth.get("byCategory").get("TRANSPORT").asLong());
        assertEquals(0, inrRow.get("months").get(0).get("totalCents").asLong()); // empty months are filled in
        assertEquals(18333, inrRow.get("averagePerMonthCents").asLong());

        // currencies stay separate: INR (bigger) first, then EUR
        assertEquals("EUR", bobView.get("currencies").get(1).get("currency").asString());
        assertEquals(1000, bobView.get("currencies").get(1).get("totalCents").asLong());

        // Alice only sees her own shares, never Bob's: 45000 + 10000 + 50000 in INR
        JsonNode aliceInr = json(perform(get("/api/v1/insights/me"), alice, null)).get("currencies").get(0);
        assertEquals("INR", aliceInr.get("currency").asString());
        assertEquals(105000, aliceInr.get("totalCents").asLong());
    }

    @Test
    @DisplayName("Bad parameters fall back to safe defaults and nobody else's data leaks")
    void parameters() throws Exception {
        TestUser carol = register("Carol");
        JsonNode empty = json(perform(get("/api/v1/insights/me?months=999&tz=Not/AZone"), carol, null).andExpect(status().isOk()));
        assertEquals(12, empty.get("months").asInt());
        assertEquals("Z", empty.get("timeZone").asString());
        assertEquals(0, empty.get("currencies").size());
        perform(get("/api/v1/insights/me"), null, null).andExpect(status().isUnauthorized());
    }
}
