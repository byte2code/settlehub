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

class FeatureIntegrationTest extends ApiTestSupport {

    @Test
    @DisplayName("Settling on behalf of the debtor records the payment in the right direction, and can be undone")
    void settlementDirectionAndUndo() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        UUID groupId = createGroup(alice, "Trip", List.of(bob.email()));
        addEqualExpense(alice, groupId, 6000, alice, bob);
        assertEquals(-3000, netBalance(alice, groupId, bob));

        // Alice (the creditor) records that Bob paid her back. 2.0 recorded this as Alice paying Bob.
        JsonNode settlement = json(perform(post("/api/v1/settlements"), alice, Map.of(
            "groupId", groupId.toString(), "payerId", bob.id().toString(), "payeeId", alice.id().toString(),
            "amountCents", 3000, "note", "UPI"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.payerName").exists())
            .andExpect(jsonPath("$.note").value("UPI")));
        assertEquals(0, netBalance(alice, groupId, bob));
        assertEquals(0, netBalance(alice, groupId, alice));

        // Settlements are not duplicated into the expense feed any more
        assertEquals(1, json(perform(get("/api/v1/groups/" + groupId + "/expenses"), alice, null)).size());

        perform(delete("/api/v1/settlements/" + settlement.get("id").asString()), bob, null).andExpect(status().isOk());
        assertEquals(-3000, netBalance(alice, groupId, bob));
    }

    @Test
    @DisplayName("Amounts must be in the group currency; foreign originals are kept for display")
    void groupCurrencyIsEnforced() throws Exception {
        TestUser alice = register("Alice");
        UUID groupId = createGroup(alice, "Solo", List.of());
        List<Map<String, String>> splits = List.of(Map.of("userId", alice.id().toString()));

        perform(post("/api/v1/groups/" + groupId + "/expenses"), alice,
            Map.of("description", "Hotel", "costCents", 1000, "currencyCode", "USD", "splits", splits))
            .andExpect(status().isBadRequest());

        perform(post("/api/v1/groups/" + groupId + "/expenses"), alice, Map.of("description", "Hotel", "costCents", 830000,
            "originalCurrency", "USD", "originalAmountCents", 10000, "splits", splits))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.currencyCode").value("INR"))
            .andExpect(jsonPath("$.originalCurrency").value("USD"))
            .andExpect(jsonPath("$.originalFormatted").value("$100.00"));
    }

    @Test
    @DisplayName("Receipts are stored separately and fetched on demand")
    void receiptsAreLazy() throws Exception {
        TestUser alice = register("Alice");
        UUID groupId = createGroup(alice, "Receipts", List.of());
        String dataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
        JsonNode expense = json(perform(post("/api/v1/groups/" + groupId + "/expenses"), alice, Map.of(
            "description", "Lunch", "costCents", 500, "receiptUrl", dataUrl, "notes", "Team lunch",
            "splits", List.of(Map.of("userId", alice.id().toString()))))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.hasReceipt").value(true))
            .andExpect(jsonPath("$.notes").value("Team lunch"))
            .andExpect(jsonPath("$.receiptUrl").doesNotExist()));
        String id = expense.get("id").asString();

        perform(get("/api/v1/expenses/" + id + "/receipt"), alice, null)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dataUrl").value(dataUrl));

        perform(post("/api/v1/groups/" + groupId + "/expenses"), alice, Map.of(
            "description", "Bad", "costCents", 500, "receiptUrl", "javascript:alert(1)",
            "splits", List.of(Map.of("userId", alice.id().toString()))))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Members can only leave or be removed once settled; the last admin must hand over first")
    void memberManagement() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        UUID groupId = createGroup(alice, "Flat", List.of(bob.email()));
        addEqualExpense(alice, groupId, 2000, alice, bob);

        perform(post("/api/v1/groups/" + groupId + "/leave"), bob, null).andExpect(status().isConflict());
        perform(delete("/api/v1/groups/" + groupId + "/members/" + bob.id()), alice, null).andExpect(status().isConflict());

        perform(post("/api/v1/settlements"), bob,
            Map.of("groupId", groupId.toString(), "payeeId", alice.id().toString(), "amountCents", 1000))
            .andExpect(status().isCreated());

        // Alice is the only admin: she cannot leave while Bob remains, and cannot demote herself
        perform(post("/api/v1/groups/" + groupId + "/leave"), alice, null).andExpect(status().isConflict());
        perform(patch("/api/v1/groups/" + groupId + "/members/" + alice.id()), alice, Map.of("role", "MEMBER"))
            .andExpect(status().isConflict());

        perform(patch("/api/v1/groups/" + groupId + "/members/" + bob.id()), alice, Map.of("role", "ADMIN"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("ADMIN"));
        perform(post("/api/v1/groups/" + groupId + "/leave"), alice, null).andExpect(status().isOk());
        perform(get("/api/v1/groups/" + groupId), alice, null).andExpect(status().isNotFound());
        perform(get("/api/v1/groups/" + groupId), bob, null).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Group settings, currency lock and delete with settlements")
    void groupSettingsAndDelete() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        UUID groupId = createGroup(alice, "Settings", List.of(bob.email()));

        perform(put("/api/v1/groups/" + groupId), bob, Map.of("name", "Renamed", "budgetCents", 500000, "archived", true))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Renamed"))
            .andExpect(jsonPath("$.budgetCents").value(500000))
            .andExpect(jsonPath("$.archived").value(true));
        perform(put("/api/v1/groups/" + groupId), bob, Map.of("currencyCode", "USD")).andExpect(status().isForbidden());
        perform(put("/api/v1/groups/" + groupId), alice, Map.of("currencyCode", "USD"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.currencyCode").value("USD"));

        addEqualExpense(alice, groupId, 2000, alice, bob);
        perform(put("/api/v1/groups/" + groupId), alice, Map.of("currencyCode", "EUR")).andExpect(status().isConflict());
        perform(post("/api/v1/settlements"), bob,
            Map.of("groupId", groupId.toString(), "payeeId", alice.id().toString(), "amountCents", 500))
            .andExpect(status().isCreated());

        JsonNode activity = json(perform(get("/api/v1/groups/" + groupId + "/activity?limit=50"), bob, null)
            .andExpect(status().isOk()));
        assertTrue(activity.size() >= 4);
        assertEquals("SETTLEMENT_RECORDED", activity.get(0).get("type").asString());

        perform(delete("/api/v1/groups/" + groupId), alice, null).andExpect(status().isOk());
        perform(get("/api/v1/groups/" + groupId), alice, null).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Editing an expense replaces splits and keeps balances consistent")
    void editExpense() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        UUID groupId = createGroup(alice, "Edit", List.of(bob.email()));
        UUID expenseId = addEqualExpense(alice, groupId, 1000, alice, bob);

        perform(put("/api/v1/expenses/" + expenseId), bob, Map.of("description", "Dinner (fixed)", "costCents", 3000,
            "creationMethod", "PERCENT",
            "payers", List.of(Map.of("userId", alice.id().toString(), "paidCents", 3000)),
            "splits", List.of(Map.of("userId", alice.id().toString(), "percentage", 33.33),
                Map.of("userId", bob.id().toString(), "percentage", 66.67))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.splits.length()").value(2));

        assertEquals(-2000, netBalance(alice, groupId, bob));
        assertEquals(2000, netBalance(alice, groupId, alice));
    }
}
