package com.settlehub.controller;

import com.settlehub.dto.CreateSettlementRequest;
import com.settlehub.dto.SettlementDto;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.SettlementService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/settlements")
@CrossOrigin(originPatterns = "*", allowedHeaders = "*")
public class SettlementController {

    private final SettlementService settlementService;

    public SettlementController(SettlementService settlementService) {
        this.settlementService = settlementService;
    }

    @PostMapping
    public ResponseEntity<SettlementDto> recordSettlement(
        @AuthenticationPrincipal UserPrincipal principal,
        @Valid @RequestBody CreateSettlementRequest request
    ) {
        SettlementDto settlement = settlementService.recordSettlement(principal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(settlement);
    }
}
