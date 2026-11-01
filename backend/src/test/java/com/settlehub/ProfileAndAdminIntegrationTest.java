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

class ProfileAndAdminIntegrationTest extends ApiTestSupport {

    private boolean earned(JsonNode badges, String id) {
        for (JsonNode b : badges) if (id.equals(b.get("id").asString())) return b.get("earned").asBoolean();
        throw new AssertionError("missing badge " + id);
    }

    @Test
    @DisplayName("Profile accepts bio, avatar and chime; rejects unsafe values; cannot grant admin")
    void profileFields() throws Exception {
        TestUser u = register("Pat");
        perform(patch("/api/v1/auth/me"), u, Map.of("bio", "Splitting bills, not friendships", "avatarId", "fox", "chimeSound", "bell"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.bio").value("Splitting bills, not friendships"))
            .andExpect(jsonPath("$.avatarId").value("fox"))
            .andExpect(jsonPath("$.chimeSound").value("bell"))
            .andExpect(jsonPath("$.admin").value(false));

        perform(patch("/api/v1/auth/me"), u, Map.of("bio", "<script>alert(1)</script>")).andExpect(status().isBadRequest());
        perform(patch("/api/v1/auth/me"), u, Map.of("bio", "x".repeat(121))).andExpect(status().isBadRequest());
        perform(patch("/api/v1/auth/me"), u, Map.of("chimeSound", "../../etc/passwd")).andExpect(status().isBadRequest());

        // Unknown fields such as admin are ignored
        perform(patch("/api/v1/auth/me"), u, Map.of("admin", true, "isAdmin", true)).andExpect(status().isOk())
            .andExpect(jsonPath("$.admin").value(false));
        perform(get("/api/v1/admin/overview"), u, null).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Badges are computed from real activity")
    void badges() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        TestUser cara = register("Cara");

        JsonNode fresh = json(perform(get("/api/v1/auth/me/badges"), alice, null).andExpect(status().isOk()));
        assertEquals(4, fresh.size());
        assertFalse(earned(fresh, "zero-debt"), "a brand-new user hasn't settled anything");

        UUID trip = createGroup(alice, "Trip", List.of(bob.email(), cara.email()));
        addEqualExpense(alice, trip, 9000, alice, bob, cara);
        JsonNode afterExpense = json(perform(get("/api/v1/auth/me/badges"), alice, null));
        assertTrue(earned(afterExpense, "trip-mvp"));
        assertFalse(earned(afterExpense, "zero-debt"));

        // Bob and Cara pay Alice back right away
        for (TestUser payer : List.of(bob, cara)) {
            perform(post("/api/v1/settlements"), payer, Map.of("groupId", trip.toString(), "payerId", payer.id().toString(),
                "payeeId", alice.id().toString(), "amountCents", 3000)).andExpect(status().isCreated());
        }
        assertTrue(earned(json(perform(get("/api/v1/auth/me/badges"), bob, null)), "instant-settler"));
        assertFalse(earned(json(perform(get("/api/v1/auth/me/badges"), alice, null)), "instant-settler"));
        assertTrue(earned(json(perform(get("/api/v1/auth/me/badges"), alice, null)), "zero-debt"));
        assertFalse(earned(json(perform(get("/api/v1/auth/me/badges"), alice, null)), "globetrotter"));

        perform(post("/api/v1/groups"), alice, Map.of("name", "Europe", "groupType", "trip", "currencyCode", "EUR",
            "memberEmails", List.of())).andExpect(status().isCreated());
        assertTrue(earned(json(perform(get("/api/v1/auth/me/badges"), alice, null)), "globetrotter"));
    }

    @Test
    @DisplayName("Admin APIs need ROLE_ADMIN derived from APP_ADMIN_EMAILS; admins can search and deactivate users")
    void adminPortal() throws Exception {
        perform(get("/api/v1/admin/overview"), null, null).andExpect(status().isUnauthorized());

        TestUser admin = register("Root", "root-admin@example.com");
        assertTrue(json(perform(get("/api/v1/auth/me"), admin, null)).get("admin").asBoolean());

        TestUser victim = register("Victim");
        UUID groupId = createGroup(victim, "Searchable Group", List.of());
        addEqualExpense(victim, groupId, 500, victim);

        JsonNode overview = json(perform(get("/api/v1/admin/overview"), admin, null).andExpect(status().isOk()));
        assertTrue(overview.get("totalUsers").asLong() >= 2);
        assertTrue(overview.get("expenseVolumeByCurrency").get("INR").asLong() >= 500);

        JsonNode health = json(perform(get("/api/v1/admin/health"), admin, null).andExpect(status().isOk()));
        assertEquals(300, health.get("emailDailyLimit").asInt());
        assertTrue(health.get("dbLatencyMs").asLong() >= 0);

        JsonNode found = json(perform(get("/api/v1/admin/users?q=" + victim.email()), admin, null).andExpect(status().isOk()));
        assertEquals(1, found.size());
        assertEquals(1, found.get(0).get("groupCount").asInt());
        // % is matched literally, not as a wildcard
        assertEquals(0, json(perform(get("/api/v1/admin/users?q=%25"), admin, null)).size());
        assertEquals(1, json(perform(get("/api/v1/admin/groups?q=searchable"), admin, null)).size());

        perform(patch("/api/v1/admin/users/" + admin.id() + "/active"), admin, Map.of("active", false)).andExpect(status().isBadRequest());

        perform(patch("/api/v1/admin/users/" + victim.id() + "/active"), admin, Map.of("active", false))
            .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        // The victim's existing token stops working, and they can't sign in
        assertEquals(401, perform(get("/api/v1/auth/me"), victim, null).andReturn().getResponse().getStatus());
        perform(post("/api/v1/auth/login"), null, Map.of("email", victim.email(), "password", "password123"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("deactivated")));

        perform(patch("/api/v1/admin/users/" + victim.id() + "/active"), admin, Map.of("active", true)).andExpect(status().isOk());
        perform(get("/api/v1/auth/me"), victim, null).andExpect(status().isOk());

        // Non-admins can't use it
        perform(patch("/api/v1/admin/users/" + victim.id() + "/active"), victim, Map.of("active", false)).andExpect(status().isForbidden());
    }
}
