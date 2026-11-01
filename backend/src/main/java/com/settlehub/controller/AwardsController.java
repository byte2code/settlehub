package com.settlehub.controller;

import com.settlehub.dto.AwardsDtos.AwardsResponse;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.AwardsService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/groups/{groupId}/awards")
public class AwardsController {

    private final AwardsService service;

    public AwardsController(AwardsService service) {
        this.service = service;
    }

    @GetMapping
    public AwardsResponse get(@PathVariable("groupId") UUID groupId, @AuthenticationPrincipal UserPrincipal p) {
        return service.get(groupId, p.getId());
    }

    @PostMapping("/reveal")
    public AwardsResponse reveal(@PathVariable("groupId") UUID groupId, @AuthenticationPrincipal UserPrincipal p) {
        return service.reveal(groupId, p.getId());
    }

    @DeleteMapping
    public Map<String, Boolean> hide(@PathVariable("groupId") UUID groupId, @AuthenticationPrincipal UserPrincipal p) {
        service.hide(groupId, p.getId());
        return Map.of("success", true);
    }
}
