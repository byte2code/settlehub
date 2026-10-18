package com.settlehub.controller;

import com.settlehub.dto.DebtRepaymentDto;
import com.settlehub.dto.GroupBalanceSummaryDto;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.BalanceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/groups/{groupId}")
@CrossOrigin(originPatterns = "*", allowedHeaders = "*")
public class BalanceController {

    private final BalanceService balanceService;

    public BalanceController(BalanceService balanceService) {
        this.balanceService = balanceService;
    }

    @GetMapping("/balances")
    public ResponseEntity<GroupBalanceSummaryDto> getGroupBalances(
        @PathVariable("groupId") UUID groupId,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        GroupBalanceSummaryDto summary = balanceService.getGroupBalanceSummary(groupId);
        return ResponseEntity.ok(summary);
    }

    @GetMapping("/simplified-debts")
    public ResponseEntity<List<DebtRepaymentDto>> getSimplifiedDebts(
        @PathVariable("groupId") UUID groupId,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        GroupBalanceSummaryDto summary = balanceService.getGroupBalanceSummary(groupId);
        return ResponseEntity.ok(summary.simplifiedDebts());
    }
}
