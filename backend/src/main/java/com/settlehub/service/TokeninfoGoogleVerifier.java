package com.settlehub.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;

/** Uses Google's tokeninfo endpoint (no extra library or key). Only the audience we configured is accepted. */
@Component
public class TokeninfoGoogleVerifier implements GoogleIdentityVerifier {

    private static final Logger log = LoggerFactory.getLogger(TokeninfoGoogleVerifier.class);
    private final String clientId;
    private final ObjectMapper mapper;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();

    public TokeninfoGoogleVerifier(@Value("${app.google.client-id:}") String clientId, ObjectMapper mapper) {
        this.clientId = clientId == null ? "" : clientId.trim();
        this.mapper = mapper;
    }

    @Override
    public boolean configured() { return !clientId.isEmpty(); }

    @Override
    public Optional<GoogleIdentity> verify(String idToken) {
        if (!configured() || idToken == null || idToken.isBlank() || idToken.length() > 4096) return Optional.empty();
        try {
            HttpResponse<String> response = http.send(HttpRequest.newBuilder(
                    URI.create("https://oauth2.googleapis.com/tokeninfo?id_token=" + URLEncoder.encode(idToken, StandardCharsets.UTF_8)))
                .timeout(Duration.ofSeconds(8)).GET().build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) return Optional.empty();
            JsonNode json = mapper.readTree(response.body());
            boolean audienceOk = clientId.equals(json.path("aud").asString(""));
            boolean verified = "true".equalsIgnoreCase(json.path("email_verified").asString(""));
            String email = json.path("email").asString("");
            if (!audienceOk || !verified || email.isBlank()) return Optional.empty();
            return Optional.of(new GoogleIdentity(email.toLowerCase(), json.path("given_name").asString(""), json.path("family_name").asString("")));
        } catch (Exception e) {
            log.warn("Google token verification failed: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
