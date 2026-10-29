package com.settlehub.controller;

import com.settlehub.dto.NotificationSummaryDto;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.NotificationService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public NotificationSummaryDto getNotifications(
            @RequestParam(value = "limit", defaultValue = "30") int limit,
            @AuthenticationPrincipal UserPrincipal principal) {
        return notificationService.getUserNotifications(principal.getId(), limit);
    }

    @PatchMapping("/{id}/read")
    public Map<String, Boolean> markRead(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserPrincipal principal) {
        notificationService.markAsRead(id, principal.getId());
        return Map.of("success", true);
    }

    @PostMapping("/read-all")
    public Map<String, Boolean> markAllRead(@AuthenticationPrincipal UserPrincipal principal) {
        notificationService.markAllAsRead(principal.getId());
        return Map.of("success", true);
    }
}

