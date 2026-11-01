package com.settlehub.service;

import com.settlehub.dto.PushSubscribeRequest;
import com.settlehub.exception.BadRequestException;
import com.settlehub.model.PushSubscription;
import com.settlehub.repository.PushSubscriptionRepository;
import io.jsonwebtoken.Jwts;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.math.BigInteger;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.AlgorithmParameters;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Background push delivery, free of charge:
 * <ul>
 *   <li>Android: Firebase Cloud Messaging HTTP v1 (set {@code FCM_SERVICE_ACCOUNT_JSON}).</li>
 *   <li>Web / PWA: Web Push with VAPID (set {@code VAPID_PUBLIC_KEY} / {@code VAPID_PRIVATE_KEY}).
 *       Pushes carry no payload, so the service worker shows a generic alert and no personal data
 *       passes through the push service.</li>
 * </ul>
 * Each channel is disabled until configured. Delivery is best-effort and never blocks the request.
 */
@Service
public class PushNotificationService {

    private static final Logger log = LoggerFactory.getLogger(PushNotificationService.class);

    /** Web Push endpoints are user supplied, so only well-known push services are ever contacted. */
    private static final List<String> WEB_PUSH_HOSTS = List.of(
        "fcm.googleapis.com", "push.services.mozilla.com", "notify.windows.com", "push.apple.com");

    private final PushSubscriptionRepository repository;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(8)).build();
    private final ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();

    private final String vapidPublicKey;
    private final PrivateKey vapidPrivateKey;
    private final String vapidSubject;

    private final String fcmProjectId;
    private final String fcmClientEmail;
    private final PrivateKey fcmPrivateKey;
    private volatile String fcmAccessToken;
    private volatile Instant fcmTokenExpiry = Instant.EPOCH;

    public PushNotificationService(PushSubscriptionRepository repository,
                                   @Value("${app.push.vapid-public-key:}") String vapidPublicKey,
                                   @Value("${app.push.vapid-private-key:}") String vapidPrivateKey,
                                   @Value("${app.push.vapid-subject:mailto:admin@settlehub.app}") String vapidSubject,
                                   @Value("${app.push.fcm-service-account-json:}") String fcmJson) {
        this.repository = repository;
        this.vapidSubject = vapidSubject;

        PrivateKey vapid = null;
        String vapidPub = null;
        if (!vapidPublicKey.isBlank() && !vapidPrivateKey.isBlank()) {
            try {
                vapid = parseVapidPrivateKey(vapidPrivateKey.trim());
                vapidPub = vapidPublicKey.trim();
            } catch (Exception e) {
                log.warn("Invalid VAPID keys, web push disabled: {}", e.getMessage());
            }
        }
        this.vapidPrivateKey = vapid;
        this.vapidPublicKey = vapidPub;

        String project = null, email = null;
        PrivateKey fcmKey = null;
        if (!fcmJson.isBlank()) {
            try {
                JsonNode sa = mapper.readTree(fcmJson);
                project = sa.get("project_id").asString();
                email = sa.get("client_email").asString();
                fcmKey = parsePkcs8Pem(sa.get("private_key").asString());
            } catch (Exception e) {
                log.warn("Invalid FCM service account JSON, FCM disabled: {}", e.getMessage());
                project = null;
            }
        }
        this.fcmProjectId = project;
        this.fcmClientEmail = email;
        this.fcmPrivateKey = project != null ? fcmKey : null;
    }

    public String getWebPushPublicKey() { return vapidPrivateKey != null ? vapidPublicKey : null; }

    public boolean isFcmEnabled() { return fcmPrivateKey != null; }

    // ── registration ────────────────────────────────────────────────────────────────

    @Transactional
    public void register(UUID userId, PushSubscribeRequest req) {
        String token = req.deviceToken().trim();
        if (PushSubscription.WEB.equals(req.deviceType())) {
            requireAllowedWebPushEndpoint(token);
        }
        // A token belongs to exactly one account: signing in on a shared device moves it.
        PushSubscription sub = repository.findByDeviceToken(token)
            .orElseGet(() -> new PushSubscription(userId, req.deviceType(), token, null, null));
        sub.setUserId(userId);
        sub.setDeviceType(req.deviceType());
        sub.setP256dhKey(req.p256dhKey());
        sub.setAuthKey(req.authKey());
        repository.save(sub);
    }

    @Transactional
    public void unregister(UUID userId, String token) {
        repository.deleteByDeviceTokenAndUserId(token, userId);
    }

    static void requireAllowedWebPushEndpoint(String endpoint) {
        URI uri;
        try {
            uri = URI.create(endpoint);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid push endpoint");
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        boolean allowed = "https".equalsIgnoreCase(uri.getScheme()) && uri.getUserInfo() == null
            && WEB_PUSH_HOSTS.stream().anyMatch(h -> host.equals(h) || host.endsWith("." + h));
        if (!allowed) throw new BadRequestException("Unsupported push service");
    }

    // ── delivery ────────────────────────────────────────────────────────────────────

    /** Fire-and-forget; never throws. */
    public void sendToUser(UUID userId, String title, String body, UUID groupId) {
        if (vapidPrivateKey == null && fcmPrivateKey == null) return;
        executor.submit(() -> {
            try {
                for (PushSubscription sub : repository.findByUserId(userId)) {
                    boolean delivered = PushSubscription.WEB.equals(sub.getDeviceType())
                        ? sendWeb(sub) : sendFcm(sub, title, body, groupId);
                    if (delivered) {
                        sub.setLastUsedAt(Instant.now());
                        repository.save(sub);
                    }
                }
            } catch (Exception e) {
                log.warn("Push delivery failed for user {}: {}", userId, e.getMessage());
            }
        });
    }

    private boolean sendWeb(PushSubscription sub) throws Exception {
        if (vapidPrivateKey == null) return false;
        URI endpoint = URI.create(sub.getDeviceToken());
        String audience = endpoint.getScheme() + "://" + endpoint.getAuthority();
        String jwt = Jwts.builder()
            .audience().add(audience).and()
            .expiration(Date.from(Instant.now().plus(Duration.ofHours(12))))
            .subject(vapidSubject)
            .signWith(vapidPrivateKey, Jwts.SIG.ES256)
            .compact();
        HttpRequest request = HttpRequest.newBuilder(endpoint)
            .timeout(Duration.ofSeconds(10))
            .header("Authorization", "vapid t=" + jwt + ", k=" + vapidPublicKey)
            .header("TTL", "3600")
            .POST(HttpRequest.BodyPublishers.noBody())
            .build();
        return handleResult(sub, http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode());
    }

    private boolean sendFcm(PushSubscription sub, String title, String body, UUID groupId) throws Exception {
        if (fcmPrivateKey == null) return false;
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("token", sub.getDeviceToken());
        message.put("notification", Map.of("title", title, "body", body));
        if (groupId != null) message.put("data", Map.of("groupId", groupId.toString()));
        HttpRequest request = HttpRequest.newBuilder(URI.create(
                "https://fcm.googleapis.com/v1/projects/" + fcmProjectId + "/messages:send"))
            .timeout(Duration.ofSeconds(10))
            .header("Authorization", "Bearer " + fcmAccessToken())
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(Map.of("message", message)), StandardCharsets.UTF_8))
            .build();
        return handleResult(sub, http.send(request, HttpResponse.BodyHandlers.discarding()).statusCode());
    }

    private boolean handleResult(PushSubscription sub, int status) {
        if (status >= 200 && status < 300) return true;
        if (status == 404 || status == 410) {
            repository.delete(sub); // subscription is gone for good
        } else {
            log.warn("Push service returned HTTP {} for {} subscription", status, sub.getDeviceType());
        }
        return false;
    }

    private synchronized String fcmAccessToken() throws Exception {
        if (fcmAccessToken != null && Instant.now().isBefore(fcmTokenExpiry.minusSeconds(60))) return fcmAccessToken;
        Instant now = Instant.now();
        String assertion = Jwts.builder()
            .issuer(fcmClientEmail)
            .claim("scope", "https://www.googleapis.com/auth/firebase.messaging")
            .audience().add("https://oauth2.googleapis.com/token").and()
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(3600)))
            .signWith(fcmPrivateKey, Jwts.SIG.RS256)
            .compact();
        String form = "grant_type=" + java.net.URLEncoder.encode("urn:ietf:params:oauth:grant-type:jwt-bearer", StandardCharsets.UTF_8)
            + "&assertion=" + assertion;
        HttpResponse<String> response = http.send(HttpRequest.newBuilder(URI.create("https://oauth2.googleapis.com/token"))
            .timeout(Duration.ofSeconds(10))
            .header("Content-Type", "application/x-www-form-urlencoded")
            .POST(HttpRequest.BodyPublishers.ofString(form)).build(), HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) throw new IllegalStateException("FCM auth failed: HTTP " + response.statusCode());
        JsonNode json = mapper.readTree(response.body());
        fcmAccessToken = json.get("access_token").asString();
        fcmTokenExpiry = now.plusSeconds(json.get("expires_in").asLong());
        return fcmAccessToken;
    }

    // ── key parsing ─────────────────────────────────────────────────────────────────

    static PrivateKey parseVapidPrivateKey(String base64Url) throws Exception {
        BigInteger d = new BigInteger(1, Base64.getUrlDecoder().decode(base64Url));
        AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
        params.init(new ECGenParameterSpec("secp256r1"));
        ECParameterSpec spec = params.getParameterSpec(ECParameterSpec.class);
        return KeyFactory.getInstance("EC").generatePrivate(new ECPrivateKeySpec(d, spec));
    }

    private static PrivateKey parsePkcs8Pem(String pem) throws Exception {
        String body = pem.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "")
            .replaceAll("\\s", "");
        return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(body)));
    }
}
