package com.settlehub.controller;

import com.settlehub.exception.NotFoundException;
import com.settlehub.service.ActionRateLimiter;
import com.settlehub.service.MaintenanceService;
import com.settlehub.service.RecurringService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

/**
 * Called by an external scheduler (UptimeRobot / GitHub Actions) with a shared secret, because the free
 * Render instance can sleep or restart. Disabled (404) until MAINTENANCE_TOKEN is set.
 */
@RestController
@RequestMapping("/api/v1/internal/maintenance")
public class MaintenanceController {

    private final MaintenanceService maintenance;
    private final RecurringService recurring;
    private final ActionRateLimiter limiter;
    private final byte[] token;

    public MaintenanceController(MaintenanceService maintenance, RecurringService recurring, ActionRateLimiter limiter,
                                 @Value("${app.maintenance.token:}") String token) {
        this.maintenance = maintenance;
        this.recurring = recurring;
        this.limiter = limiter;
        this.token = token == null ? new byte[0] : token.getBytes(StandardCharsets.UTF_8);
    }

    @PostMapping("/purge")
    public Map<String, Object> purge(@RequestHeader(value = "X-Maintenance-Token", required = false) String provided, HttpServletRequest request) {
        authorize(provided, request);
        return maintenance.purge();
    }

    @PostMapping("/run-recurring")
    public Map<String, Object> runRecurring(@RequestHeader(value = "X-Maintenance-Token", required = false) String provided, HttpServletRequest request) {
        authorize(provided, request);
        return Map.of("generated", recurring.runAll());
    }

    void authorize(String provided, HttpServletRequest request) {
        if (token.length == 0) throw new NotFoundException("Not found");
        limiter.check("maintenance:" + request.getRemoteAddr(), 30, 3_600_000);
        byte[] given = provided == null ? new byte[0] : provided.getBytes(StandardCharsets.UTF_8);
        if (!MessageDigest.isEqual(token, given)) throw new com.settlehub.exception.ForbiddenException("Invalid maintenance token");
    }
}
