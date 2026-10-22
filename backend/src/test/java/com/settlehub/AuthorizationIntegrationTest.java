package com.settlehub;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Every group-scoped endpoint must be invisible to non-members (2.0 allowed full access by UUID). */
class AuthorizationIntegrationTest extends ApiTestSupport {

    private TestUser alice;
    private TestUser bob;
    private TestUser eve;
    private UUID groupId;
    private UUID expenseId;
    private UUID settlementId;

    @BeforeEach
    void setUp() throws Exception {
        alice = register("Alice");
        bob = register("Bob");
        eve = register("Eve");
        groupId = createGroup(alice, "Private trip", List.of(bob.email()));
        expenseId = addEqualExpense(alice, groupId, 1000, alice, bob);
        JsonNode settlement = json(perform(post("/api/v1/settlements"), bob,
            Map.of("groupId", groupId.toString(), "payeeId", alice.id().toString(), "amountCents", 100))
            .andExpect(status().isCreated()));
        settlementId = UUID.fromString(settlement.get("id").asString());
    }

    @Test
    @DisplayName("Non-members get 404 on every group-scoped read")
    void nonMemberReadsAreHidden() throws Exception {
        for (String path : List.of(
            "/api/v1/groups/" + groupId,
            "/api/v1/groups/" + groupId + "/expenses",
            "/api/v1/groups/" + groupId + "/balances",
            "/api/v1/groups/" + groupId + "/simplified-debts",
            "/api/v1/groups/" + groupId + "/settlements",
            "/api/v1/settlements/groups/" + groupId,
            "/api/v1/groups/" + groupId + "/activity",
            "/api/v1/groups/" + groupId + "/export/whatsapp",
            "/api/v1/groups/" + groupId + "/export/excel",
            "/api/v1/expenses/" + expenseId + "/receipt")) {
            perform(get(path), eve, null).andExpect(status().isNotFound());
        }
    }

    @Test
    @DisplayName("Non-members cannot write to a group")
    void nonMemberWritesAreRejected() throws Exception {
        Map<String, Object> expense = Map.of("description", "Hack", "costCents", 100,
            "splits", List.of(Map.of("userId", eve.id().toString())));
        perform(post("/api/v1/groups/" + groupId + "/expenses"), eve, expense).andExpect(status().isNotFound());
        perform(put("/api/v1/expenses/" + expenseId), eve, expense).andExpect(status().isNotFound());
        perform(delete("/api/v1/expenses/" + expenseId), eve, null).andExpect(status().isNotFound());
        perform(put("/api/v1/groups/" + groupId), eve, Map.of("name", "Mine now")).andExpect(status().isNotFound());
        perform(delete("/api/v1/groups/" + groupId), eve, null).andExpect(status().isNotFound());
        perform(post("/api/v1/groups/" + groupId + "/members"), eve, Map.of("email", "x@example.com")).andExpect(status().isNotFound());
        perform(delete("/api/v1/settlements/" + settlementId), eve, null).andExpect(status().isNotFound());
        perform(post("/api/v1/settlements"), eve,
            Map.of("groupId", groupId.toString(), "payeeId", alice.id().toString(), "amountCents", 100))
            .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Admin-only actions are 403 for regular members")
    void adminOnlyActions() throws Exception {
        perform(delete("/api/v1/groups/" + groupId), bob, null).andExpect(status().isForbidden());
        perform(post("/api/v1/groups/" + groupId + "/invite-code"), bob, null).andExpect(status().isForbidden());
        perform(patch("/api/v1/groups/" + groupId + "/members/" + alice.id()), bob, Map.of("role", "MEMBER"))
            .andExpect(status().isForbidden());
        perform(delete("/api/v1/groups/" + groupId + "/members/" + alice.id()), bob, null).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Expenses cannot include people outside the group")
    void expenseParticipantsMustBeMembers() throws Exception {
        perform(post("/api/v1/groups/" + groupId + "/expenses"), alice, Map.of("description", "Sneaky", "costCents", 100,
            "splits", List.of(Map.of("userId", eve.id().toString()))))
            .andExpect(status().isBadRequest());
        perform(post("/api/v1/groups/" + groupId + "/expenses"), alice, Map.of("description", "Sneaky", "costCents", 100,
            "payers", List.of(Map.of("userId", eve.id().toString(), "paidCents", 100)),
            "splits", List.of(Map.of("userId", alice.id().toString()))))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Viewing an invite code is a preview; only POST /join adds the member")
    void invitePreviewHasNoSideEffects() throws Exception {
        String code = json(perform(get("/api/v1/groups/" + groupId), alice, null)).get("inviteCode").asString();

        JsonNode preview = json(perform(get("/api/v1/groups/invite/" + code), eve, null).andExpect(status().isOk()));
        org.junit.jupiter.api.Assertions.assertFalse(preview.get("alreadyMember").asBoolean());
        perform(get("/api/v1/groups/" + groupId), eve, null).andExpect(status().isNotFound());

        perform(post("/api/v1/groups/join"), eve, Map.of("inviteCode", code.toLowerCase())).andExpect(status().isOk());
        perform(get("/api/v1/groups/" + groupId), eve, null).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Resetting the invite code invalidates the old one")
    void inviteCodeReset() throws Exception {
        String oldCode = json(perform(get("/api/v1/groups/" + groupId), alice, null)).get("inviteCode").asString();
        String newCode = json(perform(post("/api/v1/groups/" + groupId + "/invite-code"), alice, null)
            .andExpect(status().isOk())).get("inviteCode").asString();
        org.junit.jupiter.api.Assertions.assertNotEquals(oldCode, newCode);
        perform(post("/api/v1/groups/join"), eve, Map.of("inviteCode", oldCode)).andExpect(status().isNotFound());
    }
}
