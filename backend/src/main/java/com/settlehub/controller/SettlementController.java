package com.settlehub.controller;

import com.settlehub.dto.CreateSettlementRequest;
import com.settlehub.dto.SettlementDto;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.SettlementService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class SettlementController {

    private final SettlementService settlementService;

    public SettlementController(SettlementService settlementService) {
        this.settlementService = settlementService;
    }

    @PostMapping("/settlements")
    public ResponseEntity<SettlementDto> recordSettlement(@AuthenticationPrincipal UserPrincipal principal,
                                                          @Valid @RequestBody CreateSettlementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(settlementService.recordSettlement(principal.getId(), request));
    }

    @GetMapping({"/settlements/groups/{groupId}", "/groups/{groupId}/settlements"})
    public List<SettlementDto> getGroupSettlements(@PathVariable("groupId") UUID groupId,
                                                   @AuthenticationPrincipal UserPrincipal principal) {
        return settlementService.getSettlementsForGroup(groupId, principal.getId());
    }

    @DeleteMapping("/settlements/{settlementId}")
    public Map<String, Boolean> deleteSettlement(@PathVariable("settlementId") UUID settlementId,
                                                 @AuthenticationPrincipal UserPrincipal principal) {
        settlementService.deleteSettlement(settlementId, principal.getId());
        return Map.of("success", true);
    }
}
