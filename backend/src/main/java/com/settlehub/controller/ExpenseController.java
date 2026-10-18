package com.settlehub.controller;

import com.settlehub.dto.CreateExpenseRequest;
import com.settlehub.dto.ExpenseDto;
import com.settlehub.security.UserPrincipal;
import com.settlehub.service.ExpenseService;
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
@CrossOrigin(originPatterns = "*", allowedHeaders = "*")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @PostMapping("/groups/{groupId}/expenses")
    public ResponseEntity<ExpenseDto> createExpense(
        @PathVariable("groupId") UUID groupId,
        @AuthenticationPrincipal UserPrincipal principal,
        @Valid @RequestBody CreateExpenseRequest request
    ) {
        ExpenseDto expense = expenseService.createExpense(groupId, principal.getId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(expense);
    }

    @GetMapping("/groups/{groupId}/expenses")
    public ResponseEntity<List<ExpenseDto>> getGroupExpenses(
        @PathVariable("groupId") UUID groupId,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<ExpenseDto> expenses = expenseService.getExpensesForGroup(groupId, principal.getId());
        return ResponseEntity.ok(expenses);
    }

    @DeleteMapping("/expenses/{expenseId}")
    public ResponseEntity<Map<String, Boolean>> deleteExpense(
        @PathVariable("expenseId") UUID expenseId,
        @AuthenticationPrincipal UserPrincipal principal
    ) {
        expenseService.deleteExpense(expenseId, principal.getId());
        return ResponseEntity.ok(Map.of("success", true));
    }
}
