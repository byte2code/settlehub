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

class NotificationIntegrationTest extends ApiTestSupport {

    @Test
    @DisplayName("Expense creation notifies other group members but suppresses self-notification for actor")
    void expenseCreationNotifiesMembers() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");
        UUID groupId = createGroup(alice, "Goa Trip", List.of(bob.email()));

        // Alice adds an expense of 1000 split equally with Bob
        addEqualExpense(alice, groupId, 1000, alice, bob);

        // 1. Verify Alice (the creator) has 0 notifications
        JsonNode aliceNotifs = json(perform(get("/api/v1/notifications"), alice, null)
                .andExpect(status().isOk()));
        assertEquals(0, aliceNotifs.get("unreadCount").asInt());
        assertEquals(0, aliceNotifs.get("notifications").size());

        // 2. Verify Bob has 1 unread notification
        JsonNode bobNotifs = json(perform(get("/api/v1/notifications"), bob, null)
                .andExpect(status().isOk()));
        assertEquals(1, bobNotifs.get("unreadCount").asInt());
        assertEquals(1, bobNotifs.get("notifications").size());

        JsonNode notif = bobNotifs.get("notifications").get(0);
        assertTrue(notif.get("title").asString().contains("Goa Trip"));
        assertTrue(notif.get("message").asString().contains("Alice added"));
        assertFalse(notif.get("read").asBoolean());

        // 3. Mark single notification as read
        String notifId = notif.get("id").asString();
        perform(patch("/api/v1/notifications/" + notifId + "/read"), bob, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        JsonNode bobAfterRead = json(perform(get("/api/v1/notifications"), bob, null));
        assertEquals(0, bobAfterRead.get("unreadCount").asInt());

        // 4. Bob records a settlement back to Alice
        perform(post("/api/v1/settlements"), bob, Map.of(
                "groupId", groupId.toString(),
                "payerId", bob.id().toString(),
                "payeeId", alice.id().toString(),
                "amountCents", 500,
                "note", "GPay"
        )).andExpect(status().isCreated());

        // Alice should now have 1 notification for payment received
        JsonNode aliceAfterSettlement = json(perform(get("/api/v1/notifications"), alice, null));
        assertEquals(1, aliceAfterSettlement.get("unreadCount").asInt());
        assertTrue(aliceAfterSettlement.get("notifications").get(0).get("title").asString().contains("Payment Received"));

        // 5. Mark all as read
        perform(post("/api/v1/notifications/read-all"), alice, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        JsonNode aliceFinal = json(perform(get("/api/v1/notifications"), alice, null));
        assertEquals(0, aliceFinal.get("unreadCount").asInt());
    }
}

