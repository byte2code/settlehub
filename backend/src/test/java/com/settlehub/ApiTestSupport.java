package com.settlehub;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Shared helpers for API-level tests against the in-memory H2 database. */
@SpringBootTest(properties = "app.rate-limit.auth-requests-per-minute=10000")
@AutoConfigureMockMvc
abstract class ApiTestSupport {

    @Autowired
    protected MockMvc mockMvc;

    @Autowired
    protected ObjectMapper objectMapper;

    protected record TestUser(UUID id, String email, String token) {}

    protected TestUser register(String firstName) throws Exception {
        String email = firstName.toLowerCase() + "_" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        return register(firstName, email);
    }

    protected TestUser register(String firstName, String email) throws Exception {
        JsonNode body = json(perform(post("/api/v1/auth/register"), null,
            Map.of("email", email, "password", "password123", "firstName", firstName, "currencyCode", "INR"))
            .andExpect(status().isCreated()));
        return new TestUser(UUID.fromString(body.get("user").get("id").asString()), email, body.get("token").asString());
    }

    protected UUID createGroup(TestUser owner, String name, List<String> memberEmails) throws Exception {
        JsonNode group = json(perform(post("/api/v1/groups"), owner,
            Map.of("name", name, "groupType", "trip", "currencyCode", "INR", "memberEmails", memberEmails))
            .andExpect(status().isCreated()));
        return UUID.fromString(group.get("id").asString());
    }

    /** Adds an expense paid entirely by {@code payer}, split equally between {@code participants}. */
    protected UUID addEqualExpense(TestUser payer, UUID groupId, long cents, TestUser... participants) throws Exception {
        List<Map<String, Object>> splits = java.util.Arrays.stream(participants)
            .map(p -> Map.<String, Object>of("userId", p.id().toString()))
            .toList();
        JsonNode expense = json(perform(post("/api/v1/groups/" + groupId + "/expenses"), payer,
            Map.of("description", "Dinner", "costCents", cents, "creationMethod", "EQUAL", "splits", splits))
            .andExpect(status().isCreated()));
        return UUID.fromString(expense.get("id").asString());
    }

    protected long netBalance(TestUser viewer, UUID groupId, TestUser member) throws Exception {
        JsonNode balances = json(perform(get("/api/v1/groups/" + groupId + "/balances"), viewer, null)
            .andExpect(status().isOk()));
        JsonNode value = balances.get("netBalances").get(member.id().toString());
        return value == null ? 0 : value.asLong();
    }

    protected ResultActions perform(MockHttpServletRequestBuilder request, TestUser user, Object body) throws Exception {
        if (user != null) {
            request.header("Authorization", "Bearer " + user.token());
        }
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body));
        }
        return mockMvc.perform(request);
    }

    protected JsonNode json(ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }
}
