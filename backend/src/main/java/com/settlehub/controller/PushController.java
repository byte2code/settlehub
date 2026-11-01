package com.settlehub.controller;

import com.settlehub.dto.PushSubscribeRequest;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.PushNotificationService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/push")
public class PushController {

    private final PushNotificationService pushService;

    public PushController(PushNotificationService pushService) {
        this.pushService = pushService;
    }

    /** Public keys the client needs to subscribe; null when that channel is not configured. */
    @GetMapping("/config")
    public Map<String, Object> config() {
        Map<String, Object> body = new HashMap<>();
        body.put("webPushPublicKey", pushService.getWebPushPublicKey());
        body.put("fcmEnabled", pushService.isFcmEnabled());
        return body;
    }

    @PostMapping("/subscriptions")
    public Map<String, Boolean> subscribe(@Valid @RequestBody PushSubscribeRequest request,
                                          @AuthenticationPrincipal UserPrincipal principal) {
        pushService.register(principal.getId(), request);
        return Map.of("success", true);
    }

    @DeleteMapping("/subscriptions")
    public Map<String, Boolean> unsubscribe(@RequestParam("token") String token,
                                            @AuthenticationPrincipal UserPrincipal principal) {
        pushService.unregister(principal.getId(), token);
        return Map.of("success", true);
    }
}
