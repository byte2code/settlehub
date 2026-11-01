package com.settlehub;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PaymentSummaryIntegrationTest extends ApiTestSupport {

    @Test
    @DisplayName("Payment summary lists who you owe (with UPI) and who owes you, per group")
    void summaryAcrossGroups() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        perform(patch("/api/v1/auth/me"), bob, Map.of("upiId", "bob@upi")).andExpect(status().isOk());

        UUID trip = createGroup(alice, "Goa Trip", List.of(bob.email()));
        UUID flat = createGroup(alice, "Flat", List.of(bob.email()));
        addEqualExpense(bob, trip, 6000, alice, bob);   // alice owes bob 3000
        addEqualExpense(alice, flat, 2000, alice, bob); // bob owes alice 1000

        JsonNode aliceView = json(perform(get("/api/v1/balances/me/summary"), alice, null).andExpect(status().isOk()));
        assertEquals(3000, aliceView.get("totalOweByCurrency").get("INR").asLong());
        assertEquals(1000, aliceView.get("totalReceivableByCurrency").get("INR").asLong());

        JsonNode owe = aliceView.get("peopleYouOwe");
        assertEquals(1, owe.size());
        assertEquals(bob.id().toString(), owe.get(0).get("userId").asString());
        assertEquals("bob@upi", owe.get(0).get("upiId").asString());
        assertEquals(3000, owe.get(0).get("totalAmountCents").asLong());
        assertEquals("Goa Trip", owe.get(0).get("groupBreakdown").get(0).get("groupName").asString());

        JsonNode owed = aliceView.get("peopleWhoOweYou");
        assertEquals(1, owed.size());
        assertEquals(1000, owed.get(0).get("totalAmountCents").asLong());
        assertTrue(owed.get(0).get("upiId").isNull(), "UPI ids are only exposed for people you owe");

        // Bob sees the mirror image
        JsonNode bobView = json(perform(get("/api/v1/balances/me/summary"), bob, null).andExpect(status().isOk()));
        assertEquals(3000, bobView.get("peopleWhoOweYou").get(0).get("totalAmountCents").asLong());
        assertEquals(1000, bobView.get("peopleYouOwe").get(0).get("totalAmountCents").asLong());
    }

    @Test
    @DisplayName("Payment summary is empty for a user with no debts and requires authentication")
    void emptyAndUnauthenticated() throws Exception {
        TestUser carol = register("Carol");
        JsonNode view = json(perform(get("/api/v1/balances/me/summary"), carol, null).andExpect(status().isOk()));
        assertEquals(0, view.get("peopleYouOwe").size());
        assertEquals(0, view.get("peopleWhoOweYou").size());

        int code = perform(get("/api/v1/balances/me/summary"), null, null).andReturn().getResponse().getStatus();
        assertTrue(code == 401 || code == 403);
    }
}
