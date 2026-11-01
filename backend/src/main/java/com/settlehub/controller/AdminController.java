package com.settlehub.controller;

import com.settlehub.dto.AdminDtos.*;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.AdminService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Protected by SecurityConfig: /api/v1/admin/** requires ROLE_ADMIN. */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/overview")
    public Overview overview() { return adminService.overview(); }

    @GetMapping("/health")
    public SystemHealth health() { return adminService.health(); }

    @GetMapping("/users")
    public List<AdminUser> users(@RequestParam(value = "q", defaultValue = "") String q) { return adminService.users(q); }

    @GetMapping("/groups")
    public List<AdminGroup> groups(@RequestParam(value = "q", defaultValue = "") String q) { return adminService.groups(q); }

    @PatchMapping("/users/{id}/active")
    public AdminUser setActive(@PathVariable("id") UUID id, @RequestBody SetActiveRequest request,
                               @AuthenticationPrincipal UserPrincipal principal) {
        return adminService.setActive(principal.getId(), id, request.active());
    }
}
