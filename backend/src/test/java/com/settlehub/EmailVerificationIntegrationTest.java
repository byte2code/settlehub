package com.settlehub;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EmailVerificationIntegrationTest extends ApiTestSupport {

    @Test
    @DisplayName("Send OTP returns bypassed=true for test domains or when disabled")
    void sendOtpBypassedForTestDomains() throws Exception {
        JsonNode res = json(perform(post("/api/v1/auth/send-otp"), null, Map.of("email", "qa-user@example.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.bypassed").value(true)));

        assertTrue(res.get("bypassed").asBoolean());
    }

    @Test
    @DisplayName("Send OTP prevents duplicate registration if full user already exists")
    void sendOtpConflictForExistingUser() throws Exception {
        TestUser user = register("Existing");

        perform(post("/api/v1/auth/send-otp"), null, Map.of("email", user.email()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("An account with this email already exists. Try signing in."));
    }

    @Test
    @DisplayName("Verify OTP accepts master universal code 000000")
    void verifyOtpMasterCode() throws Exception {
        perform(post("/api/v1/auth/verify-otp"), null, Map.of(
                "email", "newuser@mycompany.org",
                "code", "000000"
        ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
    }
}
