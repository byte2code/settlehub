package com.settlehub;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.TestPropertySource;
import tools.jackson.databind.JsonNode;

import com.settlehub.service.GoogleIdentityVerifier;
import com.settlehub.service.MaintenanceService;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Import(AccountControlsIntegrationTest.StubGoogle.class)
@TestPropertySource(properties = {"app.receipts.group-max-chars=3000", "app.maintenance.token=test-maint-token"})
class AccountControlsIntegrationTest extends ApiTestSupport {

    @TestConfiguration
    static class StubGoogle {
        @Bean
        @Primary
        GoogleIdentityVerifier stubGoogle() {
            return new GoogleIdentityVerifier() {
                public boolean configured() { return true; }
                public Optional<GoogleIdentity> verify(String t) {
                    return t != null && t.startsWith("good:") ? Optional.of(new GoogleIdentity(t.substring(5), "Gia", "Googler")) : Optional.empty();
                }
            };
        }
    }

    @Autowired MaintenanceService maintenance;

    private TestUser login(String email) throws Exception {
        JsonNode body = json(perform(post("/api/v1/auth/login"), null, Map.of("email", email, "password", "password123")).andExpect(status().isOk()));
        return new TestUser(UUID.fromString(body.get("user").get("id").asString()), email, body.get("token").asString());
    }

    @Test
    @DisplayName("Signing out other devices kills older tokens but keeps the caller signed in")
    void revokeOtherSessions() throws Exception {
        TestUser phone = register("Pat");
        TestUser laptop = login(phone.email());
        perform(get("/api/v1/auth/me"), laptop, null).andExpect(status().isOk());

        String fresh = json(perform(post("/api/v1/auth/me/sessions/revoke-others"), phone, null).andExpect(status().isOk())).get("token").asString();
        perform(get("/api/v1/auth/me"), phone, null).andExpect(status().isUnauthorized());
        perform(get("/api/v1/auth/me"), laptop, null).andExpect(status().isUnauthorized());
        perform(get("/api/v1/auth/me"), new TestUser(phone.id(), phone.email(), fresh), null).andExpect(status().isOk());
    }

    @Test
    @DisplayName("Changing or resetting the password signs out other devices")
    void passwordChangeRevokes() throws Exception {
        TestUser phone = register("Pat");
        TestUser laptop = login(phone.email());
        String fresh = json(perform(post("/api/v1/auth/me/password"), phone, Map.of("currentPassword", "password123", "newPassword", "another-pass-1"))
            .andExpect(status().isOk())).get("token").asString();
        perform(get("/api/v1/auth/me"), laptop, null).andExpect(status().isUnauthorized());
        perform(get("/api/v1/auth/me"), new TestUser(phone.id(), phone.email(), fresh), null).andExpect(status().isOk());

        // a reset (dev master code in tests) also invalidates existing sessions
        TestUser other = register("Quin");
        perform(post("/api/v1/auth/forgot-password"), null, Map.of("email", other.email())).andExpect(status().isOk());
        perform(post("/api/v1/auth/reset-password"), null, Map.of("email", other.email(), "otp", "000000", "newPassword", "reset-pass-123")).andExpect(status().isOk());
        perform(get("/api/v1/auth/me"), other, null).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Export contains your own data; deletion needs the password, your email and no open balances")
    void exportAndDelete() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        UUID group = createGroup(alice, "Goa", List.of(bob.email()));
        addEqualExpense(alice, group, 6000, alice, bob);

        JsonNode export = json(perform(get("/api/v1/auth/me/export"), bob, null).andExpect(status().isOk()));
        assertEquals(bob.email(), export.get("profile").get("email").asString());
        assertEquals(1, export.get("expenses").size());
        assertEquals(3000, export.get("expenses").get(0).get("yourShareCents").asLong());

        Map<String, String> wrongPassword = Map.of("password", "nope", "confirmEmail", bob.email());
        perform(delete("/api/v1/auth/me"), bob, wrongPassword).andExpect(status().isBadRequest());
        perform(delete("/api/v1/auth/me"), bob, Map.of("password", "password123", "confirmEmail", "someone@else.com")).andExpect(status().isBadRequest());
        // Bob still owes Alice, so deletion is refused
        perform(delete("/api/v1/auth/me"), bob, Map.of("password", "password123", "confirmEmail", bob.email()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Settle up first")));

        perform(post("/api/v1/settlements"), bob, Map.of("groupId", group.toString(), "payerId", bob.id().toString(), "payeeId", alice.id().toString(), "amountCents", 3000))
            .andExpect(status().isCreated());
        perform(delete("/api/v1/auth/me"), bob, Map.of("password", "password123", "confirmEmail", bob.email().toUpperCase())).andExpect(status().isOk());

        perform(get("/api/v1/auth/me"), bob, null).andExpect(status().isUnauthorized());
        perform(post("/api/v1/auth/login"), null, Map.of("email", bob.email(), "password", "password123")).andExpect(status().is4xxClientError());
        // the ledger survives, with the person anonymized
        JsonNode g = json(perform(get("/api/v1/groups/" + group), alice, null).andExpect(status().isOk()));
        boolean found = false;
        for (JsonNode m : g.get("members")) if (m.get("name").asString().equals("Deleted user")) found = true;
        assertTrue(found, "deleted member should show as Deleted user");
        // the email can be used again for a brand-new account
        register("Bob again", bob.email());
    }

    @Test
    @DisplayName("When the only admin deletes their account, another member is promoted")
    void adminHandover() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        UUID group = createGroup(alice, "Flat", List.of(bob.email()));
        perform(delete("/api/v1/auth/me"), alice, Map.of("password", "password123", "confirmEmail", alice.email())).andExpect(status().isOk());
        assertEquals("ADMIN", json(perform(get("/api/v1/groups/" + group), bob, null)).get("myRole").asString());
    }

    @Test
    @DisplayName("Operator accounts listed in APP_ADMIN_EMAILS can't delete themselves")
    void adminCannotDelete() throws Exception {
        TestUser admin = registerOrLogin("Root", "root-admin@example.com");
        perform(delete("/api/v1/auth/me"), admin, Map.of("password", "password123", "confirmEmail", admin.email())).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Receipt storage is capped per group and old receipts can be purged without deleting the expense")
    void receiptLimitAndPurge() throws Exception {
        TestUser alice = register("Alice");
        UUID group = createGroup(alice, "Receipts", List.of());
        String photo = "data:image/png;base64," + "A".repeat(1400);
        Map<String, Object> body = Map.of("description", "Dinner", "costCents", 1000, "creationMethod", "EQUAL",
            "splits", List.of(Map.of("userId", alice.id().toString())), "receiptUrl", photo);

        perform(post("/api/v1/groups/" + group + "/expenses"), alice, body).andExpect(status().isCreated());
        perform(post("/api/v1/groups/" + group + "/expenses"), alice, body).andExpect(status().isCreated());
        perform(post("/api/v1/groups/" + group + "/expenses"), alice, body).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("receipt storage")));

        int removed = maintenance.purgeReceiptsOlderThan(Instant.now().plusSeconds(60));
        assertTrue(removed >= 2);
        JsonNode expenses = json(perform(get("/api/v1/groups/" + group + "/expenses"), alice, null));
        assertEquals(2, expenses.size());
        assertFalse(expenses.get(0).get("hasReceipt").asBoolean());
        // freed space can be used again
        perform(post("/api/v1/groups/" + group + "/expenses"), alice, body).andExpect(status().isCreated());
    }

    @Test
    @DisplayName("Maintenance endpoint needs the shared secret")
    void maintenanceToken() throws Exception {
        perform(post("/api/v1/internal/maintenance/purge"), null, null).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/internal/maintenance/purge").header("X-Maintenance-Token", "wrong")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/internal/maintenance/purge").header("X-Maintenance-Token", "test-maint-token"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.ranAt").exists());
    }

    @Test
    @DisplayName("The scheduler endpoint creates due repeating expenses (needs the secret)")
    void runRecurringViaScheduler() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        UUID group = createGroup(alice, "Flat", List.of(bob.email()));
        perform(post("/api/v1/groups/" + group + "/recurring"), alice, Map.of("description", "Wifi", "costCents", 80000, "payerId", alice.id().toString(),
            "participantIds", List.of(alice.id().toString(), bob.id().toString()), "frequency", "WEEKLY",
            "startDate", java.time.LocalDate.now(java.time.ZoneOffset.UTC).minusDays(7).toString())).andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/internal/maintenance/run-recurring")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/internal/maintenance/run-recurring").header("X-Maintenance-Token", "test-maint-token"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.generated").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));
        assertEquals(1, json(perform(get("/api/v1/groups/" + group + "/expenses"), alice, null)).size());
    }

    @Test
    @DisplayName("Google sign-in creates, links and claims accounts, and refuses bad tokens")
    void googleSignIn() throws Exception {
        String email = "gia_" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        perform(post("/api/v1/auth/google"), null, Map.of("idToken", "bad")).andExpect(status().isUnauthorized());

        JsonNode created = json(perform(post("/api/v1/auth/google"), null, Map.of("idToken", "good:" + email)).andExpect(status().isOk()));
        assertEquals(email, created.get("user").get("email").asString());
        assertEquals("Gia", created.get("user").get("firstName").asString());
        // signing in again returns the same account
        JsonNode again = json(perform(post("/api/v1/auth/google"), null, Map.of("idToken", "good:" + email)).andExpect(status().isOk()));
        assertEquals(created.get("user").get("id").asString(), again.get("user").get("id").asString());

        // an existing password account with the same verified email is linked, not duplicated
        TestUser existing = register("Eve");
        JsonNode linked = json(perform(post("/api/v1/auth/google"), null, Map.of("idToken", "good:" + existing.email())).andExpect(status().isOk()));
        assertEquals(existing.id().toString(), linked.get("user").get("id").asString());

        // Google-created accounts can delete themselves with just the email confirmation (they have no password)
        TestUser gia = new TestUser(UUID.fromString(created.get("user").get("id").asString()), email, created.get("token").asString());
        perform(delete("/api/v1/auth/me"), gia, Map.of("confirmEmail", email)).andExpect(status().isOk());
    }
}
