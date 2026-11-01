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
    @DisplayName("Send OTP returns bypassed=true strictly for whitelisted admin and test accounts")
    void sendOtpBypassedForWhitelistedAccounts() throws Exception {
        // Admin account
        perform(post("/api/v1/auth/send-otp"), null, Map.of("email", "admin@settlehub.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.bypassed").value(true));

        // Test account 1
        perform(post("/api/v1/auth/send-otp"), null, Map.of("email", "test1@settlehub.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.bypassed").value(true));

        // Random email is NOT bypassed
        JsonNode randomRes = json(perform(post("/api/v1/auth/send-otp"), null, Map.of("email", "randomuser@gmail.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.bypassed").value(false)));

        assertFalse(randomRes.get("bypassed").asBoolean());
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
    @DisplayName("Verify OTP accepts code for whitelisted accounts and strictly rejects non-whitelisted accounts without record")
    void verifyOtpWhitelistedVsNonWhitelisted() throws Exception {
        // Whitelisted account succeeds
        perform(post("/api/v1/auth/verify-otp"), null, Map.of(
                "email", "test1@settlehub.com",
                "code", "000000"
        ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Non-whitelisted email without verification record is rejected
        perform(post("/api/v1/auth/verify-otp"), null, Map.of(
                "email", "nonwhitelisted@realcompany.com",
                "code", "000000"
        ))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("No verification request found for this email. Please request a new code."));
    }

    @Test
    @DisplayName("Forgot password rejects unknown email with 404 Not Found")
    void forgotPasswordUnknownEmail() throws Exception {
        perform(post("/api/v1/auth/forgot-password"), null, Map.of("email", "doesnotexist@nowhere.com"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("No account found with this email address. Please sign up."));
    }

    @Test
    @DisplayName("Forgot password and reset password flow for bypassed test account")
    void forgotAndResetPasswordFlow() throws Exception {
        TestUser user = register("ResetUser");

        // 1. Request password reset
        perform(post("/api/v1/auth/forgot-password"), null, Map.of("email", user.email()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // 2. Reset password for test domain user succeeds
        JsonNode resetRes = json(perform(post("/api/v1/auth/reset-password"), null, Map.of(
                "email", user.email(),
                "otp", "123456",
                "newPassword", "newPassword456"
        ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString())
                .andExpect(jsonPath("$.user.email").value(user.email())));

        assertNotNull(resetRes.get("token").asString());

        // 3. Login with newly reset password succeeds
        perform(post("/api/v1/auth/login"), null, Map.of(
                "email", user.email(),
                "password", "newPassword456"
        ))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString());
    }
}

