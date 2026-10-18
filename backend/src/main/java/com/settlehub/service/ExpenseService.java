package com.settlehub.service;

import com.settlehub.dto.CreateExpenseRequest;
import com.settlehub.dto.ExpenseDto;
import com.settlehub.engine.EqualSplitStrategy;
import com.settlehub.engine.ExactSplitStrategy;
import com.settlehub.engine.PercentageSplitStrategy;
import com.settlehub.engine.SplitStrategy;
import com.settlehub.model.*;
import com.settlehub.repository.ExpenseRepository;
import com.settlehub.repository.GroupRepository;
import com.settlehub.repository.UserRepository;
import com.settlehub.util.CurrencyUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final GroupRepository groupRepository;
    private final UserRepository userRepository;
    private final EqualSplitStrategy equalSplitStrategy;
    private final ExactSplitStrategy exactSplitStrategy;
    private final PercentageSplitStrategy percentageSplitStrategy;

    public ExpenseService(ExpenseRepository expenseRepository,
                          GroupRepository groupRepository,
                          UserRepository userRepository,
                          EqualSplitStrategy equalSplitStrategy,
                          ExactSplitStrategy exactSplitStrategy,
                          PercentageSplitStrategy percentageSplitStrategy) {
        this.expenseRepository = expenseRepository;
        this.groupRepository = groupRepository;
        this.userRepository = userRepository;
        this.equalSplitStrategy = equalSplitStrategy;
        this.exactSplitStrategy = exactSplitStrategy;
        this.percentageSplitStrategy = percentageSplitStrategy;
    }

    @Transactional
    public ExpenseDto createExpense(UUID groupId, UUID currentUserId, CreateExpenseRequest request) {
        Group group = null;
        if (groupId != null) {
            group = groupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found: " + groupId));
        }

        User creator = userRepository.findById(currentUserId)
            .orElseThrow(() -> new IllegalArgumentException("User not found: " + currentUserId));

        long totalCostCents = request.costCents();
        if (totalCostCents <= 0) {
            throw new IllegalArgumentException("Expense cost must be strictly positive.");
        }

        String method = request.creationMethod() != null ? request.creationMethod().toUpperCase() : "EQUAL";

        // Resolve participants
        List<UUID> participantIds = new ArrayList<>();
        Map<UUID, Object> splitParams = new HashMap<>();

        for (CreateExpenseRequest.SplitRequest sr : request.splits()) {
            participantIds.add(sr.userId());
            if ("PERCENT".equals(method)) {
                splitParams.put(sr.userId(), sr.percentage() != null ? sr.percentage() : 0.0);
            } else if ("EXACT".equals(method)) {
                splitParams.put(sr.userId(), sr.owedCents() != null ? sr.owedCents() : 0L);
            }
        }

        SplitStrategy strategy = switch (method) {
            case "EXACT" -> exactSplitStrategy;
            case "PERCENT" -> percentageSplitStrategy;
            default -> equalSplitStrategy;
        };

        Map<UUID, Long> calculatedSplits = strategy.calculateSplits(totalCostCents, participantIds, splitParams);

        // Verify total splits
        long sumSplits = calculatedSplits.values().stream().mapToLong(Long::longValue).sum();
        if (sumSplits != totalCostCents) {
            throw new IllegalArgumentException(String.format(
                "Calculated splits (%d cents) do not match total expense cost (%d cents).",
                sumSplits, totalCostCents
            ));
        }

        String expenseCurrency = (request.currencyCode() != null && !request.currencyCode().isBlank())
            ? request.currencyCode().trim().toUpperCase()
            : (group.getCurrencyCode() != null ? group.getCurrencyCode() : CurrencyUtil.DEFAULT_CURRENCY);

        Expense expense = new Expense(
            group,
            request.description().trim(),
            totalCostCents,
            expenseCurrency,
            request.date() != null ? request.date() : Instant.now(),
            method,
            false,
            creator
        );

        // Setup payers: default to creator paying 100% if empty
        if (request.payers() == null || request.payers().isEmpty()) {
            expense.addPayer(creator, totalCostCents);
        } else {
            long totalPaid = 0L;
            for (CreateExpenseRequest.PayerRequest pr : request.payers()) {
                User payerUser = userRepository.findById(pr.userId())
                    .orElseThrow(() -> new IllegalArgumentException("Payer user not found: " + pr.userId()));
                expense.addPayer(payerUser, pr.paidCents());
                totalPaid += pr.paidCents();
            }

            if (totalPaid != totalCostCents) {
                throw new IllegalArgumentException(String.format(
                    "Total paid amounts (%d cents) do not match expense cost (%d cents).",
                    totalPaid, totalCostCents
                ));
            }
        }

        // Setup splits
        for (Map.Entry<UUID, Long> entry : calculatedSplits.entrySet()) {
            User splitUser = userRepository.findById(entry.getKey())
                .orElseThrow(() -> new IllegalArgumentException("Split user not found: " + entry.getKey()));
            expense.addSplit(splitUser, entry.getValue());
        }

        Expense saved = expenseRepository.save(expense);
        if (group != null) {
            group.setUpdatedAt(Instant.now());
            groupRepository.save(group);
        }

        return ExpenseDto.fromEntity(saved);
    }

    @Transactional(readOnly = true)
    public List<ExpenseDto> getExpensesForGroup(UUID groupId, UUID currentUserId) {
        Group group = groupRepository.findById(groupId)
            .orElseThrow(() -> new IllegalArgumentException("Group not found"));

        return expenseRepository.findAllActiveByGroup(group).stream()
            .map(ExpenseDto::fromEntity)
            .toList();
    }

    @Transactional
    public void deleteExpense(UUID expenseId, UUID currentUserId) {
        Expense expense = expenseRepository.findById(expenseId)
            .orElseThrow(() -> new IllegalArgumentException("Expense not found"));

        expense.setDeletedAt(Instant.now());
        expenseRepository.save(expense);
    }
}
