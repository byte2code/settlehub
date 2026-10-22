package com.settlehub.controller;

import com.settlehub.dto.CreateExpenseRequest;
import com.settlehub.dto.ExpenseDto;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.ExpenseService;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/v1")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @PostMapping("/groups/{groupId}/expenses")
    public ResponseEntity<ExpenseDto> createExpense(@PathVariable("groupId") UUID groupId,
                                                    @AuthenticationPrincipal UserPrincipal principal,
                                                    @Valid @RequestBody CreateExpenseRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(expenseService.createExpense(groupId, principal.getId(), request));
    }

    @GetMapping("/groups/{groupId}/expenses")
    public List<ExpenseDto> getGroupExpenses(@PathVariable("groupId") UUID groupId,
                                             @AuthenticationPrincipal UserPrincipal principal) {
        return expenseService.getExpensesForGroup(groupId, principal.getId());
    }

    @PutMapping("/expenses/{expenseId}")
    public ExpenseDto updateExpense(@PathVariable("expenseId") UUID expenseId,
                                    @AuthenticationPrincipal UserPrincipal principal,
                                    @Valid @RequestBody CreateExpenseRequest request) {
        return expenseService.updateExpense(expenseId, principal.getId(), request);
    }

    @DeleteMapping("/expenses/{expenseId}")
    public Map<String, Boolean> deleteExpense(@PathVariable("expenseId") UUID expenseId,
                                              @AuthenticationPrincipal UserPrincipal principal) {
        expenseService.deleteExpense(expenseId, principal.getId());
        return Map.of("success", true);
    }

    @GetMapping("/expenses/{expenseId}/receipt")
    public ResponseEntity<Map<String, String>> getReceipt(@PathVariable("expenseId") UUID expenseId,
                                                          @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePrivate())
            .body(Map.of("dataUrl", expenseService.getReceipt(expenseId, principal.getId())));
    }
}
