package com.settlehub;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.settlehub.dto.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SettleHubIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("Full workflow: Register, login, create group, add expense, check simplified balances")
    void testEndToEndWorkflow() throws Exception {
        String uniqueSuffix = UUID.randomUUID().toString().substring(0, 8);
        String emailAlice = "alice_" + uniqueSuffix + "@example.com";
        String emailBob = "bob_" + uniqueSuffix + "@example.com";

        // 1. Register Alice
        RegisterRequest registerReq = new RegisterRequest(emailAlice, "password123", "Alice", "Tester", "USD");
        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registerReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.user.email").value(emailAlice));

        // 2. Login Alice
        LoginRequest loginReq = new LoginRequest(emailAlice, "password123");
        MvcResult loginResult = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginReq)))
                .andExpect(status().isOk())
                .andReturn();

        AuthResponse auth = objectMapper.readValue(loginResult.getResponse().getContentAsString(), AuthResponse.class);
        String token = auth.token();
        UUID aliceId = auth.user().id();

        // 3. Register Bob
        RegisterRequest registerBob = new RegisterRequest(emailBob, "password123", "Bob", "Builder", "USD");
        MvcResult bobResult = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registerBob)))
                .andExpect(status().isCreated())
                .andReturn();
        AuthResponse authBob = objectMapper.readValue(bobResult.getResponse().getContentAsString(), AuthResponse.class);
        UUID bobId = authBob.user().id();

        // 4. Create Group with Alice and Bob
        CreateGroupRequest groupReq = new CreateGroupRequest("Road Trip 2026", "trip", true, List.of(emailBob));
        MvcResult groupResult = mockMvc.perform(post("/api/v1/groups")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(groupReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Road Trip 2026"))
                .andReturn();

        GroupDto group = objectMapper.readValue(groupResult.getResponse().getContentAsString(), GroupDto.class);
        UUID groupId = group.id();
        assertEquals(2, group.members().size());

        // 5. Add Expense: Alice pays $60.00 split equally between Alice and Bob
        CreateExpenseRequest.SplitRequest s1 = new CreateExpenseRequest.SplitRequest(aliceId, null, null);
        CreateExpenseRequest.SplitRequest s2 = new CreateExpenseRequest.SplitRequest(bobId, null, null);
        CreateExpenseRequest expenseReq = new CreateExpenseRequest(
            "Gasoline",
            6000L,
            "USD",
            Instant.now(),
            "EQUAL",
            null, // Default payer is Alice
            List.of(s1, s2)
        );

        mockMvc.perform(post("/api/v1/groups/" + groupId + "/expenses")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(expenseReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.costCents").value(6000))
                .andExpect(jsonPath("$.description").value("Gasoline"));

        // 6. Check Balances
        MvcResult balanceResult = mockMvc.perform(get("/api/v1/groups/" + groupId + "/balances")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn();

        GroupBalanceSummaryDto summary = objectMapper.readValue(balanceResult.getResponse().getContentAsString(), GroupBalanceSummaryDto.class);
        assertEquals(1, summary.simplifiedDebts().size());
        DebtRepaymentDto debt = summary.simplifiedDebts().get(0);
        assertEquals(bobId, debt.fromUserId(), "Bob owes Alice");
        assertEquals(aliceId, debt.toUserId());
        assertEquals(3000L, debt.amountCents(), "Bob owes $30.00");
    }
}
