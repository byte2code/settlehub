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

class SettleHubIntegrationTest extends ApiTestSupport {

    @Test
    @DisplayName("Full workflow: register, login, create group, add expense, check simplified balances")
    void endToEndWorkflow() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");

        perform(post("/api/v1/auth/login"), null, Map.of("email", alice.email(), "password", "password123"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").exists())
            .andExpect(jsonPath("$.user.email").value(alice.email()));

        UUID groupId = createGroup(alice, "Road Trip 2026", List.of(bob.email()));
        addEqualExpense(alice, groupId, 6000, alice, bob);

        JsonNode summary = json(perform(get("/api/v1/groups/" + groupId + "/balances"), alice, null).andExpect(status().isOk()));
        JsonNode debts = summary.get("simplifiedDebts");
        assertEquals(1, debts.size());
        assertEquals(bob.id().toString(), debts.get(0).get("fromUserId").asString(), "Bob owes Alice");
        assertEquals(alice.id().toString(), debts.get(0).get("toUserId").asString());
        assertEquals(3000L, debts.get(0).get("amountCents").asLong());

        JsonNode groups = json(perform(get("/api/v1/groups"), bob, null).andExpect(status().isOk()));
        assertEquals(1, groups.size());
        assertEquals(-3000L, groups.get(0).get("userNetBalanceCents").asLong());
        assertEquals(6000L, groups.get(0).get("totalSpendCents").asLong());
        assertEquals("MEMBER", groups.get(0).get("myRole").asString());
    }

    @Test
    @DisplayName("Bad credentials return 401 (not 500) and unauthenticated calls return 401")
    void authErrors() throws Exception {
        TestUser alice = register("Alice");
        perform(post("/api/v1/auth/login"), null, Map.of("email", alice.email(), "password", "wrong-password"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value("Invalid email or password"));
        perform(get("/api/v1/groups"), null, null).andExpect(status().isUnauthorized());
        perform(get("/api/v1/groups"), new TestUser(alice.id(), alice.email(), "not-a-jwt"), null)
            .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Registering an existing email is a 409; short passwords are rejected")
    void registrationRules() throws Exception {
        TestUser alice = register("Alice");
        perform(post("/api/v1/auth/register"), null,
            Map.of("email", alice.email(), "password", "password123", "firstName", "Again"))
            .andExpect(status().isConflict());
        perform(post("/api/v1/auth/register"), null,
            Map.of("email", "short@example.com", "password", "1234567", "firstName", "Short"))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Someone added by email can sign up later and claims the placeholder account")
    void placeholderAccountIsClaimedOnRegister() throws Exception {
        TestUser alice = register("Alice");
        String carolEmail = "carol_" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        UUID groupId = createGroup(alice, "Flat", List.of(carolEmail));

        // Placeholder cannot log in
        perform(post("/api/v1/auth/login"), null, Map.of("email", carolEmail, "password", ""))
            .andExpect(status().isBadRequest());

        TestUser carol = register("Carol", carolEmail);
        JsonNode groups = json(perform(get("/api/v1/groups"), carol, null).andExpect(status().isOk()));
        assertEquals(1, groups.size());
        assertEquals(groupId.toString(), groups.get(0).get("id").asString());
        perform(post("/api/v1/auth/login"), null, Map.of("email", carolEmail, "password", "password123"))
            .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Profile update and password change")
    void profileAndPassword() throws Exception {
        TestUser alice = register("Alice");
        perform(patch("/api/v1/auth/me"), alice, Map.of("firstName", "Alicia", "upiId", "alicia@okhdfc", "currencyCode", "usd"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.firstName").value("Alicia"))
            .andExpect(jsonPath("$.upiId").value("alicia@okhdfc"))
            .andExpect(jsonPath("$.currencyCode").value("USD"));
        perform(patch("/api/v1/auth/me"), alice, Map.of("upiId", "not a upi"))
            .andExpect(status().isBadRequest());

        perform(post("/api/v1/auth/me/password"), alice, Map.of("currentPassword", "wrong", "newPassword", "newpassword1"))
            .andExpect(status().isBadRequest());
        perform(post("/api/v1/auth/me/password"), alice, Map.of("currentPassword", "password123", "newPassword", "newpassword1"))
            .andExpect(status().isNoContent());
        perform(post("/api/v1/auth/login"), null, Map.of("email", alice.email(), "password", "newpassword1"))
            .andExpect(status().isOk());
    }
}
