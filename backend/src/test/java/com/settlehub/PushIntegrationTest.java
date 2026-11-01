package com.settlehub;

import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;

import java.math.BigInteger;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.interfaces.ECPrivateKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Arrays;
import java.util.Base64;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class PushIntegrationTest extends ApiTestSupport {

    private static final String FCM_ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";

    @Test
    @DisplayName("Push is off until configured; web subscriptions are validated, owned by one account and removable")
    void subscriptionLifecycle() throws Exception {
        TestUser alice = register("Alice");
        TestUser bob = register("Bob");

        JsonNode config = json(perform(get("/api/v1/push/config"), alice, null).andExpect(status().isOk()));
        assertTrue(config.get("webPushPublicKey").isNull());
        assertFalse(config.get("fcmEnabled").asBoolean());

        // Arbitrary hosts are rejected so the server can't be pointed at internal URLs (SSRF)
        for (String bad : new String[] {"http://fcm.googleapis.com/x", "https://169.254.169.254/latest", "https://evilfcm.googleapis.com.attacker.io/x", "not a url"}) {
            perform(post("/api/v1/push/subscriptions"), alice, Map.of("deviceType", "WEB", "deviceToken", bad))
                .andExpect(status().isBadRequest());
        }
        perform(post("/api/v1/push/subscriptions"), alice, Map.of("deviceType", "SMOKE", "deviceToken", "x"))
            .andExpect(status().isBadRequest());

        perform(post("/api/v1/push/subscriptions"), alice, Map.of("deviceType", "WEB", "deviceToken", FCM_ENDPOINT))
            .andExpect(status().isOk()).andExpect(jsonPath("$.success").value(true));
        // Idempotent, and moves to Bob if he signs in on the same device
        perform(post("/api/v1/push/subscriptions"), alice, Map.of("deviceType", "WEB", "deviceToken", FCM_ENDPOINT)).andExpect(status().isOk());
        perform(post("/api/v1/push/subscriptions"), bob, Map.of("deviceType", "WEB", "deviceToken", FCM_ENDPOINT)).andExpect(status().isOk());

        // Alice no longer owns it, so her unsubscribe leaves Bob's subscription alone
        perform(delete("/api/v1/push/subscriptions?token=" + FCM_ENDPOINT), alice, null).andExpect(status().isOk());
        perform(delete("/api/v1/push/subscriptions?token=" + FCM_ENDPOINT), bob, null).andExpect(status().isOk());

        perform(post("/api/v1/push/subscriptions"), alice, Map.of("deviceType", "ANDROID", "deviceToken", "fcm-token-1"))
            .andExpect(status().isOk());
    }

    @Test
    @DisplayName("VAPID private keys (base64url scalar) load as P-256 keys that can sign ES256 JWTs")
    void vapidKeyCanSign() throws Exception {
        KeyPairGenerator gen = KeyPairGenerator.getInstance("EC");
        gen.initialize(new ECGenParameterSpec("secp256r1"));
        KeyPair pair = gen.generateKeyPair();
        byte[] d = ((ECPrivateKey) pair.getPrivate()).getS().toByteArray();
        if (d.length > 32) d = Arrays.copyOfRange(d, d.length - 32, d.length);
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(d);

        java.lang.reflect.Method m = Class.forName("com.settlehub.service.PushNotificationService")
            .getDeclaredMethod("parseVapidPrivateKey", String.class);
        m.setAccessible(true);
        PrivateKey parsed = (PrivateKey) m.invoke(null, encoded);
        assertEquals(new BigInteger(1, d), ((ECPrivateKey) parsed).getS());

        String jwt = Jwts.builder().subject("mailto:a@b.c").signWith(parsed, Jwts.SIG.ES256).compact();
        assertEquals("a@b.c".length() > 0, jwt.split("\\.").length == 3);
        assertEquals("mailto:a@b.c", Jwts.parser().verifyWith(pair.getPublic()).build().parseSignedClaims(jwt).getPayload().getSubject());
    }
}
