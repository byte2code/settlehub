package com.settlehub.controller;

import com.settlehub.dto.InsightsDto.Insights;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.InsightsService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/insights")
public class InsightsController {

    private final InsightsService service;

    public InsightsController(InsightsService service) {
        this.service = service;
    }

    @GetMapping("/me")
    public Insights mine(@RequestParam(value = "months", defaultValue = "6") int months,
                         @RequestParam(value = "tz", required = false) String tz,
                         @AuthenticationPrincipal UserPrincipal principal) {
        return service.forUser(principal.getId(), months, tz);
    }
}
